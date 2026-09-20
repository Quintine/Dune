import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocalTableAudio, TableSoundCursor, soundVolume, type TableSoundFrame } from '../lib/table-sound';
import { TableSounds } from '../components/table-sounds';

const opening: TableSoundFrame = { room: 'SOUND001', phase: 'playing:1:2', sequence: 15, automaticSequence: 12 };

void test('sound cursor consumes refresh history, duplicates, muted/hidden batches and stale snapshots without replay', () => {
  const cursor = new TableSoundCursor();
  assert.equal(cursor.consume(opening), null);
  assert.equal(cursor.consume({ ...opening }), null);
  const next = { ...opening, sequence: 18, automaticSequence: 18 };
  // A muted or hidden consumer discards this cue; no retained playback queue exists.
  assert.equal(cursor.consume(next), 'automatic');
  assert.equal(cursor.consume(next), null);
  assert.equal(cursor.consume(opening), null);
  assert.equal(cursor.consume(next), null);
  assert.equal(cursor.consume({ ...next, sequence: 19, automaticSequence: -1 }), null);
  assert.equal(cursor.consume({ ...next, sequence: 20 }), null);
  assert.equal(cursor.consume({ ...next, sequence: 21, automaticSequence: 21 }), 'automatic');
});

void test('phase cues take priority over automatic batches and switching rooms establishes a new silent baseline', () => {
  const cursor = new TableSoundCursor();
  cursor.consume(opening);
  const phase = { ...opening, phase: 'playing:1:3', sequence: 100, automaticSequence: 99 };
  assert.equal(cursor.consume(phase), 'phase');
  assert.equal(cursor.consume(phase), null);
  const other = { ...opening, room: 'SOUND002' };
  assert.equal(cursor.consume(other), null);
  assert.equal(cursor.consume({ ...other, phase: 'finished:1:3', sequence: 16 }), 'phase');
  assert.equal(new TableSoundCursor().consume(phase), null);
});

function fakeAudio() {
  const nodes: { starts: number[]; stops: number[]; disconnected: number; onended: (() => void) | null; type: string; frequency: { setValueAtTime: (frequency: number) => void }; connect: () => void; start: (time: number) => void; stop: (time?: number) => void; disconnect: () => void }[] = [];
  const gains: { values: number[]; disconnected: number; gain: { setValueAtTime: (value: number) => void; linearRampToValueAtTime: (value: number) => void; cancelScheduledValues: () => void }; connect: () => void; disconnect: () => void }[] = [];
  let created = 0;
  let closed = 0;
  let resumed = 0;
  const context = {
    state: 'suspended', currentTime: 10, destination: {},
    async resume() { resumed++; context.state = 'running'; },
    async close() { closed++; context.state = 'closed'; },
    createOscillator() {
      const node = {
        starts: [] as number[], stops: [] as number[], disconnected: 0, onended: null as (() => void) | null,
        type: '', frequency: { setValueAtTime() {} }, connect() {},
        start(time: number) { node.starts.push(time); },
        stop(time = context.currentTime) { node.stops.push(time); },
        disconnect() { node.disconnected++; },
      };
      nodes.push(node);
      return node;
    },
    createGain() {
      const gain = {
        values: [] as number[], disconnected: 0,
        gain: {
          setValueAtTime(value: number) { gain.values.push(value); },
          linearRampToValueAtTime(value: number) { gain.values.push(value); },
          cancelScheduledValues() {},
        }, connect() {}, disconnect() { gain.disconnected++; },
      };
      gains.push(gain);
      return gain;
    },
  };
  const audio = new LocalTableAudio(() => { created++; return context as unknown as AudioContext; });
  return { audio, context, nodes, gains, counts: () => ({ created, closed, resumed }) };
}

void test('audio starts only after explicit unlock, bounds volume and coalesces closely spaced updates', async () => {
  const fixture = fakeAudio();
  const { audio, context, nodes, gains } = fixture;
  assert.equal(audio.play('phase', 35), false);
  assert.deepEqual(fixture.counts(), { created: 0, closed: 0, resumed: 0 });
  assert.equal(await audio.unlock(), true);
  assert.equal(audio.play('phase', 200), true);
  assert.equal(nodes.length, 2);
  assert.ok(gains.every((gain) => Math.max(...gain.values) === 0.12));
  assert.ok(nodes.every((node) => node.stops[0] - node.starts[0] < 0.2));
  assert.equal(audio.play('automatic', 50), false);
  context.currentTime += 1;
  assert.equal(audio.play('automatic', 50), true);
  assert.equal(nodes.length, 3);
  assert.ok(nodes.slice(0, 2).every((node) => node.disconnected > 0));
  assert.equal(Math.max(...gains[2].values), 0.06);
  nodes[2].onended?.();
  assert.equal(nodes[2].disconnected, 1);
  assert.equal(gains[2].disconnected, 1);
  audio.dispose();
  assert.equal(fixture.counts().closed, 1);
});

void test('mute, suspension and disposal prevent playback and cancel pending unlocks', async () => {
  const { audio, context, nodes, gains } = fakeAudio();
  const pending = audio.unlock();
  audio.stop();
  assert.equal(await pending, false);
  assert.equal(audio.play('automatic', 0), false);
  assert.equal(await audio.unlock(), true);
  assert.equal(audio.play('phase', 35), true);
  audio.stop();
  assert.ok(gains.every((gain) => gain.values.at(-1) === 0));
  assert.ok(nodes.every((node) => node.disconnected > 0));
  context.state = 'suspended';
  assert.equal(audio.play('automatic', 35, true), false);
  const pendingAgain = audio.unlock();
  audio.dispose();
  assert.equal(await pendingAgain, false);
  assert.equal(audio.play('phase', 35, true), false);
});

void test('unavailable or rejected audio fails quietly and previews replace active voices', async () => {
  const absent = new LocalTableAudio(() => { throw new Error('Unavailable'); });
  assert.equal(await absent.unlock(), false);
  assert.equal(absent.play('phase', 35), false);
  absent.dispose();
  const fixture = fakeAudio();
  fixture.context.resume = async () => { throw new Error('Gesture required'); };
  assert.equal(await fixture.audio.unlock(), false);
  fixture.context.state = 'running';
  assert.equal(await fixture.audio.unlock(), true);
  assert.equal(fixture.audio.play('phase', 35, true), true);
  assert.equal(fixture.audio.play('phase', 35, true), true);
  assert.equal(fixture.nodes.length, 4);
  assert.ok(fixture.nodes.slice(0, 2).every((node) => node.disconnected > 0));
  fixture.audio.dispose();
});

void test('volume input stays finite and initial controls expose an accessible muted preference', () => {
  assert.equal(soundVolume(NaN), 35);
  assert.equal(soundVolume(Infinity), 35);
  assert.equal(soundVolume('80'), 35);
  assert.equal(soundVolume(-1), 0);
  assert.equal(soundVolume(250), 100);
  const html = renderToStaticMarkup(createElement(TableSounds, { frame: opening }));
  assert.match(html, /Sound effects: Off/);
  assert.match(html, /aria-label="Sound effects" aria-pressed="false"/);
  assert.match(html, /Volume · 35%/);
  assert.match(html, /type="range"/);
  assert.match(html, /aria-labelledby="table-sounds-volume-label"/);
  assert.match(html, /disabled=""[^>]*>Test sound/);
});

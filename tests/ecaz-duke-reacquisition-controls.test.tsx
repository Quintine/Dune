import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type Action, type Game } from '../game/engine';
import { acquireDuke, DUKE_VIDAL_ID } from '../game/duke-vidal';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { EcazDukeAcquisitionChoices } from '../components/ecaz-duke-acquisition-choices';
import { actEcazDukeAlly as act, createEcazDukeAllyFixture as fixture,
  ecazDukeAllyInventory as inventory, ecazDukeAllyPhysical as physical,
  finishEcazDukeAlly as finish } from './fixture-ecaz-duke-ally';

const aliases=registerHooks({
  resolve(specifier,context,next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier === 'next/link' ? 'vinext/shims/link' : specifier,context);
  },
  load(url,context,next) {
    if (!url.endsWith('.module.css')) return next(url,context);
    const css=readFileSync(new URL(url),'utf8');
    const classes=Object.fromEntries([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match => [match[1],match[1]]));
    return {format:'module',source:`export default ${JSON.stringify(classes)}`,shortCircuit:true};
  },
});
const { EcazEntry } = await import('../components/ecaz-entry');
const { GameTable } = await import('../components/game-table');
aliases.deregister();

type ButtonProps={ 'data-testid'?:string; disabled?:boolean; onClick?:() => void; children?:ReactNode };
function button(node: ReactNode, id:string): ReactElement<ButtonProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) { const found=button(child,id); if (found) return found; }
    return null;
  }
  if (!isValidElement<ButtonProps>(node)) return null;
  if (node.props['data-testid'] === id) return node;
  return button(node.props.children,id);
}
/** The fixture earns the alliance, Ecaz Ambassador placement, normal shared
 * Duke, paid entry and pending offer through real actions. This single,
 * explicitly controlled supplement changes the original shared disc's
 * existing control to the already-allied recipient under an ally-loan tenure.
 * It does not install a leader, card, force, payment or pending event. */
function loan(advanced:boolean) {
  const f=fixture({advanced}), game=structuredClone(f.game);
  game.dukeVidal=acquireDuke(game.dukeVidal!,f.ally,game.turn,'ally');
  assert.equal(game.dukeVidal.controller,f.ally); assert.equal(game.dukeVidal.source,'ally');
  assert.deepEqual(inventory(game),f.originalInventory);
  return {f,game};
}
function checkCompleted(f: ReturnType<typeof fixture>, before:Game, game:Game, recipient=f.ally) {
  assert.deepEqual([game.dukeVidal!.controller,game.dukeVidal!.source,game.dukeVidal!.acquiredTurn],
    [recipient,'ecaz',before.turn]);
  assert.deepEqual(game.dukeVidal!.leader,before.dukeVidal!.leader);
  assert.deepEqual(physical(game),physical(before));
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === f.token)!.zone,'supply');
  assert.ok(game.players.every(seat => !seat.leaders.some(leader => leader.id === DUKE_VIDAL_ID)));
  assert.deepEqual(inventory(game),f.originalInventory);
}

for (const advanced of [false,true]) {
  const mode=advanced ? 'Advanced' : 'Basic';
  void test(`${mode} actual Ecaz table renders and submits same-recipient Duke renewal`, () => {
    const {f,game:staged}=loan(advanced), before=structuredClone(staged);
    const view=viewGame(staged,f.owner), entry=view.ambassadorEntry; assert.ok(entry);
    assert.equal(entry.effect,'ecaz'); assert.equal(entry.stage,'offer');
    assert.equal(entry.beneficiaries.find(row => row.player === f.ally)?.blocked,null);
    const entryHtml=renderToStaticMarkup(createElement(EcazEntry,{game:view,busy:false,act() {}}));
    const tableHtml=renderToStaticMarkup(createElement(GameTable,{game:view,busy:false,send:async () => {},onExit() {}}));
    for (const html of [entryHtml,tableHtml]) {
      assert.match(html,/Acquire Duke Vidal for/);
      assert.match(html,/renew that control/);
      assert.ok(html.includes(`data-testid="ecaz-duke-acquisition-${f.ally}"`));
    }
    const sent:Action[]=[];
    const control=EcazDukeAcquisitionChoices({game:view,busy:false,act(action) {sent.push(action);}});
    const choice=button(control,`ecaz-duke-acquisition-${f.ally}`); assert.ok(choice);
    assert.equal(choice.props.disabled,false); assert.ok(choice.props.onClick);
    choice.props.onClick();
    assert.deepEqual(sent,[{type:'decision',event:f.event,trigger:true,beneficiary:f.ally,choice:'duke'}]);
    let game=act(staged,f.owner,sent[0]); game=finish(f,game);
    assert.deepEqual(staged,before,'The actual callback does not mutate its input');
    checkCompleted(f,before,game);
    // Server-rendered controls and this leaf callback are exercised; a browser
    // hydration/navigation or external deployed session is not represented.
  });

  void test(`${mode} busy renewal controls do not submit and all four bots choose a legal native acquisition`, () => {
    const {f,game:staged}=loan(advanced), original=structuredClone(staged);
    const view=viewGame(staged,f.owner), sent:Action[]=[];
    const control=EcazDukeAcquisitionChoices({game:view,busy:true,act(action) {sent.push(action);}});
    const choice=button(control,`ecaz-duke-acquisition-${f.ally}`); assert.ok(choice);
    assert.equal(choice.props.disabled,true); choice.props.onClick?.(); assert.deepEqual(sent,[]);
    for (const difficulty of DIFFICULTIES) {
      const bot=viewGame(staged,f.owner);
      bot.players.find(row => row.id === f.owner)!.bot=difficulty;
      const action=botActions(bot)[0]; assert.ok(action,difficulty);
      assert.equal(action.type,'decision'); assert.equal(action.event,f.event);
      assert.equal(action.trigger,true); assert.equal(action.choice,'duke');
      assert.equal(typeof action.beneficiary,'string');
      const recipient=String(action.beneficiary);
      assert.ok(bot.ambassadorEntry?.beneficiaries.some(row => row.player === recipient && !row.blocked),
        'The bot selects a server-projected legal recipient without imposing a strategic preference');
      let game=act(structuredClone(staged),f.owner,action); game=finish(f,game);
      checkCompleted(f,original,game,recipient);
    }
    assert.deepEqual(staged,original);
  });
}

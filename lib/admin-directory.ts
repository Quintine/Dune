/** Public operational metadata only; never a player view or a saved game. */
import type { RoomControl } from './room-control';
export type AdminRoom = {
  code: string;
  version: number;
  updatedAt: number;
  status: 'lobby' | 'setup' | 'playing' | 'finished' | 'unreadable';
  host: string | null;
  players: { id: string; name: string; faction: string; control: 'human' | 'ai' | 'autopilot' }[];
  advanced: boolean;
  preview: boolean;
  expansions: string[];
  modules: string[];
  turn: number | null;
  phase: string;
  pending: { label: string; owners: string[] };
  control: RoomControl;
};
export type AdminDirectory = {
  rooms: AdminRoom[];
  total: number;
  page: number;
  pageSize: number;
};

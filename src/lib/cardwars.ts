// Card Wars player stats: who plays the port at savavlad.com/cardwars (in a browser or on Windows), counted by its PvP
// relay, which only the server can reach: it passes them on at /api/cardwars/stats, public, no sign-in.
// One copy for the whole app, fetched again every 30 seconds while the page is open and visible (lib/liveStats.ts).
// Counting started on 2026-11-01, so everything here can be zero, empty or missing: tidy() fills in what isn't there.
import { liveStats } from './liveStats';
import type { Peak } from './glops';

/** Where a game is: its scene, as the game reports it. */
export const SCENES = ['title', 'loading', 'menu', 'map', 'decks', 'battle', 'pvp', 'other'] as const;

export interface Buckets { bounds: number[]; counts: number[] }
export interface Spread3 { avg: number; median: number; max: number }
export interface Picked { id: string; picks: number; decided: number; wins: number }
export interface Rated { name: string; rating: number; wins: number; losses: number }
export interface CwDay { day: string; players: number; new: number; sessions: number; playMin: number; peak: number; peakInMatch: number; matches: number; pvpPlayers: number; questBattles: number }
export interface CwMatch {
  at: string;
  mode: 'deck' | 'random' | string;
  /** the hero level both were dealt, Random Deck only (else 0) */
  level: number;
  reason: string;
  /** the winner's seat, -1 when there was no contest */
  winner: number;
  firstSeat: number;
  minutes: number;
  turns: number;
  /** seat 0, seat 1; leader only in My Deck */
  players: { name: string; rating: number; leader: string | null }[];
}

export interface CardWarsStats {
  now: string;
  since: string;
  online: { total: number; web: number; windows: number; scenes: Record<string, number>; inMatch: number; queued: number; rooms: number; matches: number };
  peak: { online: Peak; inMatch: Peak };
  totals: { players: number; active7: number; active30: number; returning: number; sessions: number; playMin: number; questBattles: number; pvpPlayers: number; matches: number };
  longest: Peak;
  /** session lengths in minutes: counts[0] under bounds[0], counts[i] from bounds[i-1] to bounds[i], the last above */
  lengths: Buckets;
  /** minutes played by hour of the week, UTC, Sunday 0:00 first */
  week: number[];
  sceneMin: Record<string, number>;
  platforms: { players: Record<string, number>; minutes: Record<string, number> };
  versions: Record<string, number>;
  days: CwDay[];
  series: [number, number, number][];
  seriesMs: number;
  progress: {
    players: number;
    stars: Record<string, { total: number; avg: number; max: number; players: number }>;
    quests: Buckets & { avg: number };
    coins: Spread3; gems: Spread3; trophies: Spread3;
    pvpWinRate: number;
  };
  pvp: {
    matches: { total: number; deck: number; random: number };
    started: number;
    reasons: Record<string, number>;
    via: Record<string, number>;
    decided: number;
    firstSeatWins: number;
    avgMinutes: number;
    avgTurns: number;
    durations: Buckets;
    avgQueueSec: number;
    rooms: { created: number; joined: number; expired: number };
    levels: { level: number; matches: number; decided: number; firstSeatWins: number }[];
    leaders: Picked[];
    cards: Picked[];
    leaderboards: { deck: Rated[]; random: Rated[] };
    recent: CwMatch[];
  };
}

const none = (bounds: number[]): Buckets => ({ bounds, counts: Array(bounds.length + 1).fill(0) });
const spread = (): Spread3 => ({ avg: 0, median: 0, max: 0 });
const EMPTY = (): CardWarsStats => ({
  now: new Date().toISOString(),
  since: '',
  online: { total: 0, web: 0, windows: 0, scenes: {}, inMatch: 0, queued: 0, rooms: 0, matches: 0 },
  peak: { online: { n: 0, at: null }, inMatch: { n: 0, at: null } },
  totals: { players: 0, active7: 0, active30: 0, returning: 0, sessions: 0, playMin: 0, questBattles: 0, pvpPlayers: 0, matches: 0 },
  longest: { n: 0, at: null },
  lengths: none([1, 5, 15, 30, 60, 120]),
  week: Array(168).fill(0),
  sceneMin: {},
  platforms: { players: {}, minutes: {} },
  versions: {},
  days: [],
  series: [],
  seriesMs: 300_000,
  progress: { players: 0, stars: {}, quests: { avg: 0, ...none([1, 10, 25, 50, 100, 150]) }, coins: spread(), gems: spread(), trophies: spread(), pvpWinRate: 0 },
  pvp: {
    matches: { total: 0, deck: 0, random: 0 }, started: 0, reasons: {}, via: {}, decided: 0, firstSeatWins: 0, avgMinutes: 0, avgTurns: 0,
    durations: none([2, 5, 10, 15, 20, 30]), avgQueueSec: 0, rooms: { created: 0, joined: 0, expired: 0 },
    levels: [], leaders: [], cards: [], leaderboards: { deck: [], random: [] }, recent: [],
  },
});

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** `raw` laid over `shape`: what's missing or of the wrong kind takes the shape's value (a list's items are kept as they came). */
function fill<T>(shape: T, raw: unknown): T {
  if (Array.isArray(shape)) return (Array.isArray(raw) ? raw : shape) as T;
  if (isObject(shape)) {
    const r = isObject(raw) ? raw : {};
    const out: Record<string, unknown> = { ...r };
    for (const [k, v] of Object.entries(shape)) out[k] = fill(v, r[k]);
    return out as T;
  }
  if (typeof shape === 'number') return (typeof raw === 'number' && Number.isFinite(raw) ? raw : shape) as T;
  if (typeof shape === 'string') return (typeof raw === 'string' ? raw : shape) as T;
  return (raw === undefined ? shape : raw) as T;
}

/** The relay's answer, with every field the pages read in place; a leaderboard's unfilled places are left out. */
export function tidy(raw: unknown): CardWarsStats {
  if (!isObject(raw)) throw new Error('not stats');
  const s = fill(EMPTY(), raw);
  const named = (rows: Rated[]) => rows.filter((r) => isObject(r) && typeof r.name === 'string' && r.name !== '').map((r) => fill(RATED, r));
  s.pvp.leaderboards = { deck: named(s.pvp.leaderboards.deck), random: named(s.pvp.leaderboards.random) };
  for (const k of ['leaders', 'cards'] as const) s.pvp[k] = s.pvp[k].filter((p) => isObject(p) && typeof p.id === 'string').map((p) => fill(PICKED, p));
  s.pvp.levels = s.pvp.levels.filter(isObject).map((l) => fill(LEVEL, l));
  s.pvp.recent = s.pvp.recent
    .filter((m) => isObject(m) && Array.isArray(m.players) && m.players.length === 2)
    .map((m) => ({ ...fill(MATCH, m), players: m.players.map((p) => fill(PLAYER, p)) }));
  s.days = s.days.filter((d) => isObject(d) && typeof d.day === 'string').map((d) => fill(DAY, d));
  s.series = s.series.filter((p) => Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite));
  return s;
}
const DAY: CwDay = { day: '', players: 0, new: 0, sessions: 0, playMin: 0, peak: 0, peakInMatch: 0, matches: 0, pvpPlayers: 0, questBattles: 0 };
const RATED: Rated = { name: '', rating: 0, wins: 0, losses: 0 };
const PICKED: Picked = { id: '', picks: 0, decided: 0, wins: 0 };
const LEVEL = { level: 0, matches: 0, decided: 0, firstSeatWins: 0 };
const MATCH: CwMatch = { at: '', mode: '', level: 0, reason: '', winner: -1, firstSeat: 0, minutes: 0, turns: 0, players: [] };
const PLAYER: CwMatch['players'][number] = { name: '', rating: 0, leader: null };

const live = liveStats('/api/cardwars/stats', tidy);
export const loadCardWars = live.load;
/** The stats, loaded while `on` and refreshed every 30 seconds the page stays visible. */
export const useCardWars = live.use;

/** "CoolDog" → "Cool Dog", "IceKing" → "Ice King", "Fionna_Cake" → "Fionna Cake". */
export const spaced = (s: string) => s.replace(/_+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').trim();

/** A card's id ("Creature_CoolDog") as its type and name; a hero's ("Leader_Jake") as its name. */
export function cardOf(id: string): { type: string; name: string } {
  const i = id.indexOf('_');
  return i > 0 ? { type: id.slice(0, i), name: spaced(id.slice(i + 1)) || id } : { type: '', name: spaced(id) || id };
}

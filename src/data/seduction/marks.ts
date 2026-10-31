// The Art of Seduction's marks, one per seducer, victim and move, drawn with the shared pen (data/marks.ts) and kept
// beside their entries. Keyed by the entry's id.
import { MARKS as SEDUCERS } from './marks-seducers';
import { MARKS as VICTIMS_1 } from './marks-victims-1';
import { MARKS as VICTIMS_2 } from './marks-victims-2';
import { MARKS as MOVES_1 } from './marks-moves-1';
import { MARKS as MOVES_2 } from './marks-moves-2';

export const SEDUCTION_MARKS: Record<string, string> = { ...SEDUCERS, ...VICTIMS_1, ...VICTIMS_2, ...MOVES_1, ...MOVES_2 };

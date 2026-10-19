import { RO as FIRST } from './traps-1';
import { RO as SECOND, RO_REFLECT } from './traps-2';

export const RO_TRAPS = { ...FIRST, ...SECOND };
export { RO_REFLECT };

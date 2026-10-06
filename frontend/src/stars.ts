/**
 * Starred terms/concepts, persisted per reviewer in localStorage.
 * Only identifiers are stored — never reviewer content.
 */

export const STARRED_STORAGE_KEY = 'studysnap_starred';

export type StarredMap = Record<string, string[]>;

const MAX_STARS_PER_REVIEWER = 500;

const sanitizeList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const term = entry.trim();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    out.push(term);
    if (out.length >= MAX_STARS_PER_REVIEWER) break;
  }
  return out;
};

/** Read + validate the whole map. Never throws (private mode, corrupt JSON). */
export const readStarredMap = (): StarredMap => {
  try {
    const raw = localStorage.getItem(STARRED_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: StarredMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key.trim()) continue;
      const list = sanitizeList(value);
      if (list.length > 0) map[key] = list;
    }
    return map;
  } catch {
    return {};
  }
};

const writeStarredMap = (map: StarredMap): void => {
  try {
    localStorage.setItem(STARRED_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable/full: stars still work in memory for this session.
  }
};

/** Restore the stars saved for one reviewer. */
export const loadStars = (reviewerId: string): Set<string> =>
  new Set(readStarredMap()[reviewerId] || []);

/** Star an item, or unstar it when already starred. Returns the updated set. */
export const toggleStar = (reviewerId: string, term: string): Set<string> => {
  const map = readStarredMap();
  const next = new Set(map[reviewerId] || []);
  if (next.has(term)) next.delete(term);
  else next.add(term);

  const list = Array.from(next);
  if (list.length > 0) map[reviewerId] = list;
  else delete map[reviewerId];

  writeStarredMap(map);
  return next;
};

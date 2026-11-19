import { record } from '../types/contracts';
import { isObjectId } from './object-id';

export function validateCartItems(input: unknown) {
  if (!Array.isArray(input)) return null;

  const ids = new Set<string>();
  const items: { id: string; count: number }[] = [];
  for (const value of input as unknown[]) {
    const { id, count } = record(value);
    if (!isObjectId(id) || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1) {
      return null;
    }
    const canonicalId = id.toLowerCase();
    if (ids.has(canonicalId)) return null;
    ids.add(canonicalId);
    items.push({ id: canonicalId, count });
  }
  return items;
}

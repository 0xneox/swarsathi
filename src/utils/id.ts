/**
 * Identifier generation.
 *
 * We avoid `crypto.randomUUID`, which is not present in every React Native runtime, and instead
 * combine a timestamp with random segments. These ids only ever need to be unique on one device.
 */
export function createId(prefix = ''): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  const extra = Math.random().toString(36).slice(2, 6);
  const id = `${time}-${random}${extra}`;
  return prefix ? `${prefix}_${id}` : id;
}

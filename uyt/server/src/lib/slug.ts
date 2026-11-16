import { randomBytes } from 'node:crypto';

/** Latin slug; Arabic-only names fall back to a random suffix so QR links stay ASCII. */
export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const suffix = randomBytes(3).toString('hex');
  return base ? `${base}-${suffix}` : `store-${suffix}`;
}

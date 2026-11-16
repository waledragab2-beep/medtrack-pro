import { z } from 'zod';
import { AppError } from './errors.js';

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const res = schema.safeParse(data);
  if (!res.success) {
    throw new AppError(400, 'validation_error', 'Invalid request data', z.flattenError(res.error));
  }
  return res.data;
}

export const uuid = z.uuid();
export const idParams = (...keys: string[]) =>
  z.object(Object.fromEntries(keys.map((k) => [k, z.uuid()])) as Record<string, z.ZodUUID>);

/** Optional http(s) URL; empty string becomes null. */
export const optionalUrl = z
  .union([z.literal(''), z.null(), z.url({ protocol: /^https?$/ })])
  .optional()
  .transform((v) => (v ? v : v === undefined ? undefined : null));

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB colour');

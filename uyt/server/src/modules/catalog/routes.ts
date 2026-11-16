import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { many, one } from '../../db/pool.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { optionalUrl, parse } from '../../lib/validate.js';
import { ADMIN_ROLES, requireRole } from '../../plugins/guards.js';

export const serializeCategory = (c: any) => ({ id: c.id, name: c.name, nameEn: c.name_en, sort: c.sort });
export const serializeItem = (i: any) => ({
  id: i.id,
  categoryId: i.category_id,
  name: i.name,
  nameEn: i.name_en,
  description: i.description,
  descriptionEn: i.description_en,
  price: i.price,
  imageUrl: i.image_url,
  isAvailable: i.is_available,
  sort: i.sort,
});
export const serializeOffer = (o: any) => ({
  id: o.id,
  title: o.title,
  titleEn: o.title_en,
  description: o.description,
  descriptionEn: o.description_en,
  imageUrl: o.image_url,
  badge: o.badge,
  startsAt: o.starts_at,
  endsAt: o.ends_at,
  isActive: o.is_active,
  sort: o.sort,
});

const category = z.object({
  name: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().max(60).nullish(),
  sort: z.number().int().optional(),
});
const item = z.object({
  categoryId: z.uuid().nullish(),
  name: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().max(80).nullish(),
  description: z.string().trim().max(300).nullish(),
  descriptionEn: z.string().trim().max(300).nullish(),
  price: z.number().min(0).max(1_000_000).nullish(),
  imageUrl: optionalUrl,
  isAvailable: z.boolean().optional(),
  sort: z.number().int().optional(),
});
const offer = z.object({
  title: z.string().trim().min(1).max(80),
  titleEn: z.string().trim().max(80).nullish(),
  description: z.string().trim().max(300).nullish(),
  descriptionEn: z.string().trim().max(300).nullish(),
  imageUrl: optionalUrl,
  badge: z.string().trim().max(20).nullish(),
  startsAt: z.iso.datetime({ offset: true }).nullish(),
  endsAt: z.iso.datetime({ offset: true }).nullish(),
  isActive: z.boolean().optional(),
  sort: z.number().int().optional(),
});

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

/** Generic tenant-scoped CRUD for a simple table. Every statement is filtered by brand_id. */
function crud(
  app: FastifyInstance,
  path: string,
  table: string,
  schema: z.ZodObject<any>,
  serialize: (r: any) => unknown,
  orderBy: string,
  validate?: (brandId: string, body: any) => Promise<void>,
) {
  const admin = { preHandler: requireRole(ADMIN_ROLES) };
  const idParam = z.object({ id: z.uuid() });

  app.get(`/brands/:brandId/${path}`, admin, async (req) => ({
    items: (await many(`SELECT * FROM ${table} WHERE brand_id = $1 ORDER BY ${orderBy}`, [req.membership!.brandId])).map(
      serialize,
    ),
  }));

  app.post(`/brands/:brandId/${path}`, admin, async (req, reply) => {
    const body = parse(schema, req.body);
    await validate?.(req.membership!.brandId, body);
    const entries = Object.entries(body).filter(([, v]) => v !== undefined);
    const cols = ['brand_id', ...entries.map(([k]) => snake(k))];
    const vals = [req.membership!.brandId, ...entries.map(([, v]) => v)];
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
    const row = await one(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`, vals);
    reply.code(201);
    return { item: serialize(row) };
  });

  app.patch(`/brands/:brandId/${path}/:id`, admin, async (req) => {
    const { id } = parse(idParam, req.params);
    const body = parse(schema.partial(), req.body);
    await validate?.(req.membership!.brandId, body);
    const entries = Object.entries(body).filter(([, v]) => v !== undefined);
    if (!entries.length) throw badRequest('empty_update', 'Nothing to update');
    const vals: unknown[] = entries.map(([, v]) => v);
    const sets = entries.map(([k], i) => `${snake(k)} = $${i + 1}`);
    vals.push(id, req.membership!.brandId);
    const row = await one(
      `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND brand_id = $${vals.length} RETURNING *`,
      vals,
    );
    if (!row) throw notFound();
    return { item: serialize(row) };
  });

  app.delete(`/brands/:brandId/${path}/:id`, admin, async (req) => {
    const { id } = parse(idParam, req.params);
    const row = await one(`DELETE FROM ${table} WHERE id = $1 AND brand_id = $2 RETURNING id`, [id, req.membership!.brandId]);
    if (!row) throw notFound();
    return { ok: true };
  });
}

export async function catalogRoutes(app: FastifyInstance) {
  crud(app, 'menu/categories', 'menu_categories', category, serializeCategory, 'sort, created_at');
  crud(app, 'menu/items', 'menu_items', item, serializeItem, 'sort, created_at', async (brandId, body) => {
    // Prevent linking an item to another tenant's category.
    if (body.categoryId && !(await one(`SELECT 1 FROM menu_categories WHERE id = $1 AND brand_id = $2`, [body.categoryId, brandId])))
      throw notFound('Category');
  });
  crud(app, 'offers', 'offers', offer, serializeOffer, 'sort, created_at DESC');
}

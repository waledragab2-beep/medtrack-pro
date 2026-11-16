import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { one } from '../db/pool.js';
import { forbidden, notFound, unauthorized } from '../lib/errors.js';
import { sha256, verifyAccessToken } from '../lib/security.js';

export type Role = 'owner' | 'manager' | 'cashier';

export interface Membership {
  brandId: string;
  role: Role;
  /** When set, the member may only operate this branch. */
  branchId: string | null;
}

export interface DeviceContext {
  id: string;
  orderId: string;
  brandId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    membership?: Membership;
    device?: DeviceContext;
  }
}

export const ALL_ROLES: Role[] = ['owner', 'manager', 'cashier'];
export const ADMIN_ROLES: Role[] = ['owner', 'manager'];

function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

export async function requireUser(req: FastifyRequest): Promise<void> {
  const token = bearer(req);
  const userId = token ? verifyAccessToken(token) : null;
  if (!userId) throw unauthorized();
  req.userId = userId;
}

export async function loadMembership(userId: string, brandId: string): Promise<Membership | null> {
  const row = await one<{ role: Role; branch_id: string | null }>(
    `SELECT role, branch_id FROM memberships WHERE user_id = $1 AND brand_id = $2 AND is_active`,
    [userId, brandId],
  );
  return row ? { brandId, role: row.role, branchId: row.branch_id } : null;
}

/** Ensures the caller is an active member of :brandId with one of the given roles (tenant isolation). */
export function requireRole(roles: Role[]) {
  return async (req: FastifyRequest): Promise<void> => {
    await requireUser(req);
    const brandId = (req.params as Record<string, string>).brandId;
    if (!z.uuid().safeParse(brandId).success) throw notFound('Brand');
    const m = await loadMembership(req.userId!, brandId);
    if (!m) throw notFound('Brand'); // do not reveal other tenants' existence
    if (!roles.includes(m.role)) throw forbidden();
    req.membership = m;
  };
}

/** Throws if a branch-restricted member tries to act on another branch. */
export function assertBranchAccess(m: Membership, branchId: string): void {
  if (m.branchId && m.branchId !== branchId) throw forbidden('You are assigned to a different branch');
}

/** Customer device auth: `X-Device-Token` issued when the phone was linked to an order. */
export async function requireDevice(req: FastifyRequest): Promise<void> {
  const token = req.headers['x-device-token'];
  if (typeof token !== 'string' || token.length < 20) throw unauthorized('Device token required');
  const row = await one<{ id: string; order_id: string; brand_id: string }>(
    `UPDATE order_devices SET last_seen_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL
      RETURNING id, order_id, brand_id`,
    [sha256(token)],
  );
  if (!row) throw unauthorized('This device is no longer linked to the order');
  req.device = { id: row.id, orderId: row.order_id, brandId: row.brand_id };
}

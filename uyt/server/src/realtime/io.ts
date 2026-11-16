import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { one } from '../db/pool.js';
import { sha256, verifyAccessToken } from '../lib/security.js';
import { loadMembership } from '../plugins/guards.js';

let io: Server | null = null;

/**
 * Rooms:
 *   branch:<id> – cashier/manager screens of that branch (order list updates)
 *   order:<id>  – customer devices linked to that order (status updates)
 * For more than one API instance, add @socket.io/redis-adapter here.
 */
export function attachRealtime(server: HttpServer, corsOrigins: string[]): Server {
  io = new Server(server, { cors: { origin: corsOrigins, credentials: true }, path: '/socket.io' });

  io.use(async (socket, next) => {
    const { accessToken, deviceToken } = (socket.handshake.auth ?? {}) as Record<string, unknown>;
    if (typeof accessToken === 'string') {
      const userId = verifyAccessToken(accessToken);
      if (!userId) return next(new Error('unauthorized'));
      socket.data.userId = userId;
      return next();
    }
    if (typeof deviceToken === 'string') {
      const row = await one<{ order_id: string }>(
        `SELECT order_id FROM order_devices WHERE token_hash = $1 AND revoked_at IS NULL`,
        [sha256(deviceToken)],
      ).catch(() => null);
      if (!row) return next(new Error('unauthorized'));
      socket.data.orderId = row.order_id;
      return next();
    }
    next(new Error('unauthorized'));
  });

  io.on('connection', (socket) => {
    if (socket.data.orderId) socket.join(`order:${socket.data.orderId}`);

    socket.on('subscribe:branch', async (msg: { brandId?: string; branchId?: string }, ack?: (r: unknown) => void) => {
      try {
        const userId = socket.data.userId as string | undefined;
        if (!userId || !msg?.brandId || !msg?.branchId) throw new Error('bad_request');
        const m = await loadMembership(userId, msg.brandId);
        const branch = await one(`SELECT 1 FROM branches WHERE id = $1 AND brand_id = $2`, [msg.branchId, msg.brandId]);
        if (!m || !branch || (m.branchId && m.branchId !== msg.branchId)) throw new Error('forbidden');
        for (const room of socket.rooms) if (room.startsWith('branch:')) socket.leave(room);
        socket.join(`branch:${msg.branchId}`);
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, error: (e as Error).message });
      }
    });
  });
  return io;
}

export function emitToBranch(branchId: string, event: string, payload: unknown): void {
  io?.to(`branch:${branchId}`).emit(event, payload);
}

export function emitToOrder(orderId: string, event: string, payload: unknown): void {
  io?.to(`order:${orderId}`).emit(event, payload);
}

export function closeRealtime(): Promise<void> {
  return new Promise((resolve) => (io ? io.close(() => resolve()) : resolve()));
}

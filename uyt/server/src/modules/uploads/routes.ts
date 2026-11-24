import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { config } from '../../config.js';
import { badRequest } from '../../lib/errors.js';
import { ADMIN_ROLES, requireRole } from '../../plugins/guards.js';

// SVG is deliberately excluded (it can carry scripts).
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

/** Detect the real type from magic bytes instead of trusting the client's Content-Type. */
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 3).toString() === 'GIF') return 'image/gif';
  return null;
}

/**
 * Local-disk storage (one folder per brand). For multi-instance production, mount UPLOAD_DIR on shared
 * storage or swap this handler for S3/R2/GCS – clients only depend on the returned URL.
 */
export async function uploadRoutes(app: FastifyInstance) {
  app.post('/brands/:brandId/uploads', { preHandler: requireRole(['owner', 'manager']) }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw badRequest('no_file', 'No file uploaded');
    const buf = await file.toBuffer();
    const type = sniff(buf);
    if (!type) throw badRequest('unsupported_type', 'Only PNG, JPEG, WEBP or GIF images are allowed');
    const brandId = req.membership!.brandId;
    const dir = path.resolve(config.UPLOAD_DIR, brandId);
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.${EXT[type]}`;
    await writeFile(path.join(dir, name), buf);
    reply.code(201);
    return { url: `${config.PUBLIC_API_URL}/uploads/${brandId}/${name}` };
  });
}

import { createHash, randomBytes, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const hashPassword = (plain: string) => bcrypt.hash(plain, 11);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: 'access' }, config.JWT_SECRET, {
    expiresIn: config.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'uyt',
  });
}

export function verifyAccessToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { issuer: 'uyt' }) as jwt.JwtPayload;
    return payload.typ === 'access' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** URL-safe random secret. */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => createHash('sha256').update(value).digest();
export const fourDigitCode = () => String(randomInt(0, 10000)).padStart(4, '0');

import pg from 'pg';
import { config } from '../config.js';

// Return BIGINT counts and NUMERIC values as JS numbers (values in this app are well within range).
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 20 });

export type Queryable = Pick<pg.Pool | pg.PoolClient, 'query'>;

export async function many<T = any>(text: string, params: unknown[] = [], db: Queryable = pool): Promise<T[]> {
  const res = await db.query(text, params);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: unknown[] = [], db: Queryable = pool): Promise<T | null> {
  const res = await db.query(text, params);
  return (res.rows[0] as T) ?? null;
}

export async function withTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

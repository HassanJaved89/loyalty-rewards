import * as fs from 'node:fs';
import * as path from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

type Direction = 'up' | 'down';

async function main(): Promise<void> {
  loadEnvFile(path.join(process.cwd(), '.env'));

  const direction: Direction = process.argv[2] === 'down' ? 'down' : 'up';
  const pool = new Pool({
    host: requiredEnv('DATABASE_HOST'),
    port: Number(requiredEnv('DATABASE_PORT')),
    database: requiredEnv('DATABASE_NAME'),
    user: requiredEnv('DATABASE_USER'),
    password: process.env.DATABASE_PASSWORD ?? '',
  });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    if (direction === 'up') {
      await migrateUp(client);
    } else {
      await migrateDown(client);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function migrateUp(client: {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<{ id: string }> }>;
}): Promise<void> {
  const applied = new Set(
    (await client.query('SELECT id FROM schema_migrations')).rows.map((row) => row.id),
  );
  const files = listUpMigrations();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`apply ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

async function migrateDown(client: {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Array<{ id: string }> }>;
}): Promise<void> {
  const result = await client.query(
    'SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1',
  );
  const last = result.rows[0]?.id;
  if (!last) {
    console.log('No applied migrations to revert');
    return;
  }

  const downFile = last.replace(/\.sql$/, '.down.sql');
  const downPath = path.join(MIGRATIONS_DIR, downFile);
  if (!fs.existsSync(downPath)) {
    throw new Error(`Missing down migration: ${downFile}`);
  }

  const sql = fs.readFileSync(downPath, 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE id = $1', [last]);
    await client.query('COMMIT');
    console.log(`revert ${last}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

function listUpMigrations(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file) && !file.endsWith('.down.sql'))
    .sort();
}

function loadEnvFile(envPath: string): void {
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${key}`);
  }
  return value;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

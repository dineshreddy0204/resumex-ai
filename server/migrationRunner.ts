import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Pool, PoolClient } from 'pg';

export interface MigrationRecord {
  id: string;
  name: string;
  appliedAt: string;
}

function getCurrentDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
}

/**
 * Dynamically resolves the migrations directory in both development and production.
 * Checks dist/migrations (production bundle), relative paths, and server/migrations (dev).
 */
export function resolveMigrationsDir(): string {
  const currentDir = getCurrentDir();
  const candidateDirs = [
    path.join(process.cwd(), 'dist', 'migrations'),
    path.resolve(currentDir, 'migrations'),
    path.resolve(currentDir, '..', 'dist', 'migrations'),
    path.join(process.cwd(), 'server', 'migrations'),
    path.resolve(currentDir, '..', 'server', 'migrations'),
    path.resolve(currentDir, 'server', 'migrations'),
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      const sqlFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));
      if (sqlFiles.length > 0) {
        return dir;
      }
    }
  }

  // Fallback to server/migrations or dist/migrations
  return path.join(process.cwd(), 'server', 'migrations');
}

export class MigrationRunner {
  // Constant 64-bit integer ID for migration advisory lock
  private static readonly MIGRATION_LOCK_ID = 748392019;

  /**
   * Runs all pending migrations in order, tracking applied migrations in schema_migrations table.
   * Safe to run concurrently across multiple instances via PostgreSQL advisory locking; idempotent.
   */
  public static async runMigrations(pool: Pool): Promise<string[]> {
    const client = await pool.connect();
    const applied: string[] = [];

    try {
      // 1. Acquire PostgreSQL advisory lock to serialize concurrent migrations across instances
      await client.query('SELECT pg_advisory_lock($1)', [MigrationRunner.MIGRATION_LOCK_ID]);

      try {
        // 2. Ensure tracking table exists
        await client.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // 3. Query already applied migrations
        const res = await client.query('SELECT id FROM schema_migrations;');
        const appliedSet = new Set<string>(res.rows.map((r: { id: string }) => r.id));

        // 4. Discover migration files
        const migrationsDir = resolveMigrationsDir();
        if (!fs.existsSync(migrationsDir)) {
          console.warn('[MigrationRunner] No migrations directory found at:', migrationsDir);
          return applied;
        }

        const files = fs
          .readdirSync(migrationsDir)
          .filter((f) => f.endsWith('.sql'))
          .sort();

        for (const file of files) {
          const migrationId = path.basename(file, '.sql');
          if (appliedSet.has(migrationId)) {
            continue;
          }

          const filePath = path.join(migrationsDir, file);
          const sql = fs.readFileSync(filePath, 'utf-8');

          console.log(`[MigrationRunner] Applying migration: ${file}...`);
          try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query(
              'INSERT INTO schema_migrations (id, name, applied_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO NOTHING',
              [migrationId, file]
            );
            await client.query('COMMIT');
            applied.push(migrationId);
            console.log(`[MigrationRunner] Successfully applied: ${file}`);
          } catch (migrationErr) {
            await client.query('ROLLBACK');
            console.error(`[MigrationRunner] Failed to apply migration ${file}:`, migrationErr);
            throw migrationErr;
          }
        }

        return applied;
      } finally {
        // 5. Always release advisory lock
        await client.query('SELECT pg_advisory_unlock($1)', [MigrationRunner.MIGRATION_LOCK_ID]);
      }
    } finally {
      client.release();
    }
  }
}

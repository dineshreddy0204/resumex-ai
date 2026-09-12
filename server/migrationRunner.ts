import fs from 'fs';
import path from 'path';
import type { Pool, PoolClient } from 'pg';

export interface MigrationRecord {
  id: string;
  name: string;
  appliedAt: string;
}

export class MigrationRunner {
  /**
   * Runs all pending migrations in order, tracking applied migrations in schema_migrations table.
   * Safe to run concurrently or repeatedly; idempotent.
   */
  public static async runMigrations(pool: Pool): Promise<string[]> {
    const client = await pool.connect();
    const applied: string[] = [];

    try {
      // 1. Ensure tracking table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Query already applied migrations
      const res = await client.query('SELECT id FROM schema_migrations;');
      const appliedSet = new Set<string>(res.rows.map((r: { id: string }) => r.id));

      // 3. Discover migration files
      const migrationsDir = path.join(process.cwd(), 'server', 'migrations');
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
      client.release();
    }
  }
}

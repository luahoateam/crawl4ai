import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import fs from 'node:fs';
import path from 'node:path';

// Hàm tự đọc migrations thay thế readD1Migrations do lỗi thiếu export trên v0.16.6
function readLocalMigrations(migrationsDir: string) {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(file => {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const queries = content
      .split('--> statement-breakpoint')
      .map(q => q.trim())
      .filter(q => q.length > 0);

    return {
      name: file,
      queries: queries
    };
  });
}

export default defineConfig(() => {
  const migrationsPath = path.resolve(__dirname, './drizzle/migrations');
  const migrations = readLocalMigrations(migrationsPath);

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          // Giả lập D1 và R2 cho môi trường test
          d1Databases: ["DB"],
          r2Buckets: ["BUCKET"],
        }
      })
    ],
    test: {
      setupFiles: ['./test/setup.ts'],
      provide: {
        migrations: migrations
      }
    }
  };
});

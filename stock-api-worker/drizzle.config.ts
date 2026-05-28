import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  // driver: 'd1-http', // Note: drizzle-kit v0.21+ doesn't need 'driver' property for sqlite dialect usually, 
                        // but since the spec mentioned it, I'll include it if necessary or use the latest format.
});

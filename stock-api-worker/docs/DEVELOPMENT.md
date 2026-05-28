# Development Guide & TDD Workflow

## 1. Local Stack Setup

We use **Wrangler** for local development. D1 and R2 are emulated locally.

### Start the server
```bash
npm run dev
```

### Access Local D1 Console
```bash
npx wrangler d1 execute stock_db --local --command "SELECT * FROM companies LIMIT 10"
```

## 2. TDD (Test Driven Development)

This project is built using a "Test-First" philosophy.

### Writing a new feature
1.  **RED:** Create a test in `test/` that calls the API. Run `npm test` and watch it fail.
2.  **GREEN:** Implement the minimal logic in `src/endpoints/` using Chanfana.
3.  **REFACTOR:** Clean up the code. Ensure all tests still pass.

### Running tests with Miniflare
We use `vitest` with `@cloudflare/vitest-pool-workers` to simulate the full Cloudflare environment (D1, R2, KV).

```bash
npm test
```

## 3. Database Migrations

We use **Drizzle Kit** to manage SQL migrations.

### 1. Update Schema
Modify `src/db/schema.ts`.

### 2. Generate Migration
```bash
npx drizzle-kit generate
```

### 3. Apply Locally
```bash
npx wrangler d1 migrations apply DB --local
```

### 4. Apply to Production
```bash
npx wrangler d1 migrations apply DB --remote
```

## 4. API Standards (Chanfana)

-   Always inherit from `OpenAPIRoute`.
-   Define your request/response schemas using **Zod v4**.
-   This automatically generates the OpenAPI spec and Swagger UI.
-   Access validated data via `await this.getValidatedData<typeof this.schema>()`.

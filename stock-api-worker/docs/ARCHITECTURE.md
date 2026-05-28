# System Architecture: D1 + R2 Hybrid Storage

## 1. Design Philosophy

The core challenge of this project is managing a large volume of stock data (1500+ companies) where each company has:
1.  **High-frequency updates:** Daily research summaries.
2.  **Structural metadata:** Business models and profiles.
3.  **High-volume content:** Merged Markdown files and OCR text (several hundred KB per file).

To solve this, we use a **Hybrid Storage Strategy**.

## 2. Component Roles

### 💾 Cloudflare D1 (Metadata Engine)
- **Technology:** SQLite on the Edge.
- **Usage:** Stores all structured data from Excel.
- **Optimization:** 
    - A single set of tables with a `symbol` column (Multi-tenant).
    - `INDEX` on the `symbol` column ensures constant O(1) or O(log N) lookup time even with millions of records.
- **Benefit:** Super fast for listing companies and retrieving small text fields.

### 📦 Cloudflare R2 (Content Engine)
- **Technology:** S3-compatible Object Storage.
- **Usage:** Stores the heavy Markdown content.
- **Access Pattern:** D1 stores a "Key" (e.g., `VIC/news.md`), and the API fetches the actual content from R2 only when needed.
- **Benefit:** Database stays small and performant; storage cost is minimized.

### 🛡️ Waddler (The SQL Guard)
- **Role:** Every query to D1 is wrapped by **Waddler**.
- **Security:** Prevents SQL injection via template tags.
- **Developer Experience:** Allows writing clean, raw SQL while maintaining safety.

## 3. Data Ingestion Flow

1.  **Source:** Local Excel files and Markdown folders.
2.  **Process:** A Python-based Batch Ingestion script.
3.  **Transport:** Standard REST API calls with `X-API-Key` authentication.
4.  **Target:** Cloudflare Worker processes the request and populates D1/R2.

## 4. AI-Ready Endpoint (`/pack`)

The `/pack` endpoint is specifically designed for LLMs. It performs an **Internal Join** between D1 (Profile/Research) and R2 (Content) to provide a single, dense JSON object containing everything an AI needs to understand a specific stock.

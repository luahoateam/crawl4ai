# Vietnam Stock Data Hub API

[![Built with Hono](https://img.shields.io/badge/-Hono-e36002?logo=hono&logoColor=white)](https://hono.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/-Workers-F38020?logo=cloudflare-workers&logoColor=white)](https://workers.cloudflare.com/)
[![Drizzle ORM](https://img.shields.io/badge/-Drizzle-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

A professional-grade API for managing high-volume listed company data, including business models, daily research, and large-scale OCR/Markdown content.

## 🚀 Overview

This project provides a robust backend to serve financial data to **AI Agents** and **Dashboards**. It utilizes a hybrid storage strategy:
- **Metadata & Research:** Stored in [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) for ultra-fast queries and indexing.
- **Large Content (OCR/Markdown):** Offloaded to [Cloudflare R2](https://developers.cloudflare.com/r2/) to keep the database lean and cost-effective.

The API is fully "Waddler-Wrapped", ensuring safe and optimized SQL execution on Cloudflare's edge.

## 🛠️ Tech Stack

- **Framework:** Hono
- **OpenAPI/Swagger:** Chanfana (Zod v4)
- **Database Wrapper:** Waddler
- **ORM:** Drizzle (Schema management)
- **Testing:** Vitest + Miniflare (TDD compliant)

## 📖 API Documentation

Once running, the interactive Swagger UI is available at:
`http://localhost:8787/docs`

### Key Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/companies` | `GET` | List all companies |
| `/api/companies/:symbol/pack` | `GET` | **AI Ready:** Returns full data pack (D1 + R2) |
| `/api/companies/:symbol/business-model` | `GET/PUT` | Manage quarterly business model data |
| `/api/companies/:symbol/research` | `GET/PUT` | Manage daily research summaries |

## 💻 Local Development

### 1. Installation
```bash
npm install
```

### 2. Configuration
Create a `.dev.vars` file for local secrets:
```env
API_KEY=your-secure-api-key
```

### 3. Database Migration
```bash
npx drizzle-kit generate
npx wrangler d1 migrations apply DB --local
```

### 4. Running the server
```bash
npm run dev
```

## 🚢 Deployment

Deploy to Cloudflare Workers:
```bash
npx wrangler deploy
```
Remember to set your production API key:
```bash
npx wrangler secret put API_KEY
```

## 🧪 Testing

This project follows a strict **TDD (Test-Driven Development)** approach.
```bash
npm test
```

---
*Created with ❤️ for the Vietnam Financial Market.*

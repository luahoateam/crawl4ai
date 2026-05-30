# Design: Pipeline Thu Thập & Xử Lý Báo Cáo Thường Niên

**Ngày:** 2026-05-30  
**Trạng thái:** Approved - Sẵn sàng triển khai  
**Tác giả:** Antigravity (AI Agent)  

---

## 1. Mục Tiêu

Xây dựng pipeline tự động thu thập toàn bộ Báo cáo thường niên (BCTN) 2024 của tất cả doanh nghiệp niêm yết trên sàn chứng khoán Việt Nam (~1.600+ mã), chuyển đổi sang định dạng Markdown bằng Paddle OCR VL1.6, lưu trữ trên Cloudflare R2, và tích hợp vào API pack hiện có tại `stock-api-worker`.

---

## 2. Phạm Vi

- **Dữ liệu:** Báo cáo thường niên năm 2024, toàn bộ sàn HOSE + HNX + UPCoM (~1.600+ mã)
- **Output cuối:** File `report.md` trên R2 + entry trong bảng `documents` D1 (label rõ ràng theo năm)
- **Không bao gồm:** Phân tích LLM nội dung BCTN (để dành phase sau)
- **Giới hạn xử lý:** Paddle OCR API giới hạn 20.000 trang/ngày → pipeline chạy nhiều ngày liên tiếp

---

## 3. Kiến Trúc Tổng Thể

```
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 0: Khởi tạo hàng đợi (Một lần duy nhất)                     │
│  Python: vnstock_data.Listing → D1 bảng annual_report_queue         │
│  (~1600+ mã ticker + ngành nghề)                                    │
└──────────────────┬──────────────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1→N: Pipeline hàng ngày (zx script, chạy lặp lại đến hết)   │
│                                                                     │
│  [D1] Lấy batch ticker status='pending'                             │
│     ▼                                                               │
│  [Crawl4AI/Python] Cào link PDF BCTN 2024 từ CafeF                 │
│     ▼                                                               │
│  Tải PDF về local (tạm thời)                                        │
│     ▼                                                               │
│  Đếm số trang PDF → Kiểm tra còn đủ quota 20k trang/ngày không?    │
│     ├── Không đủ → Dừng, ghi log, chờ hôm sau                      │
│     └── Đủ → Tiếp tục                                              │
│     ▼                                                               │
│  [Paddle OCR VL1.6 API] Gửi PDF → Poll → Nhận Markdown             │
│     ▼                                                               │
│  Ghép tất cả trang thành 1 file report.md hoàn chỉnh               │
│     ▼                                                               │
│  [R2] Upload: annual-reports/2024/{TICKER}/report.md                │
│     ▼                                                               │
│  [Chanfana API] POST /api/pipeline/annual-reports/ingest            │
│  → Insert vào D1 bảng documents + update queue status='done'       │
│     ▼                                                               │
│  Xóa PDF tạm trên local                                             │
└─────────────────────────────────────────────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RESULT: Cloudflare Worker API trả về trong /pack endpoint          │
│  documents: [{year: 2024, document_type: "bctn",                    │
│    label: "Báo cáo thường niên 2024 (PaddleOCR)",                  │
│    fileUrl: "https://r2.../annual-reports/2024/VNM/report.md"}]    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Công Nghệ & Vai Trò

| Công cụ | Vai trò |
|---|---|
| `vnstock_data` (Golden) | Lấy danh sách 1600+ mã + ngành nghề để seed hàng đợi |
| `Crawl4AI` | Cào link PDF BCTN 2024 từ CafeF.vn theo từng ticker |
| `Paddle OCR VL1.6 API` | Chuyển đổi PDF → Markdown (20.000 trang/ngày giới hạn) |
| `zx` (Google) | Script điều phối tổng thể toàn bộ pipeline |
| `Cloudflare R2` | Lưu trữ file `report.md` (không lưu PDF, không lưu ảnh) |
| `Cloudflare D1` | Quản lý hàng đợi, trạng thái pipeline, quota log |
| `Chanfana` | Định nghĩa OpenAPI endpoints cho Worker API |
| `Wrangler CLI` | Deploy Worker, tương tác D1/R2 trong quá trình phát triển |

---

## 5. Schema D1 - Các Bảng Mới

### 5.1 Bảng `annual_report_queue`

```sql
CREATE TABLE annual_report_queue (
  id          TEXT PRIMARY KEY,  -- "{ticker}_2024"
  ticker      TEXT NOT NULL,
  year        INTEGER NOT NULL DEFAULT 2024,
  status      TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'crawling' | 'downloading' | 'ocr_submitted'
  -- | 'ocr_done' | 'uploaded' | 'done' | 'failed' | 'no_report_found'
  pdf_url     TEXT,              -- Link PDF tìm được từ CafeF
  ocr_job_id  TEXT,              -- Job ID từ Paddle OCR API
  page_count  INTEGER,           -- Số trang PDF
  r2_key      TEXT,              -- Key trong R2: "annual-reports/2024/{ticker}/report.md"
  error_msg   TEXT,              -- Lý do thất bại nếu có
  attempts    INTEGER DEFAULT 0, -- Số lần đã thử (max 3)
  created_at  INTEGER,
  updated_at  INTEGER
);
```

### 5.2 Bảng `daily_quota_log`

```sql
CREATE TABLE daily_quota_log (
  date        TEXT PRIMARY KEY,  -- "2026-05-30"
  pages_used  INTEGER DEFAULT 0, -- Số trang đã gửi OCR hôm nay
  pages_limit INTEGER DEFAULT 19500 -- Buffer an toàn (giới hạn thực là 20.000)
);
```

### 5.3 Bổ sung cột `document_type` vào bảng `documents` hiện tại

```sql
ALTER TABLE documents ADD COLUMN document_type TEXT DEFAULT 'bctc';
-- 'bctc'  → BCTC kiểm toán (Surgical OCR - hiện tại)
-- 'bctn'  → Báo cáo thường niên (PaddleOCR)
-- 'other' → Tài liệu khác
```

---

## 6. Tổ Chức Dữ Liệu - 3 Lớp Phân Biệt

### Lớp 1 — Cột `document_type` trong bảng `documents`

Phân biệt loại tài liệu rõ ràng: `'bctc'` vs `'bctn'`.

### Lớp 2 — Label nhúng năm rõ ràng

```
"Báo cáo thường niên 2024 (PaddleOCR)"
"Báo cáo thường niên 2025 (PaddleOCR)"   ← năm sau tự động khác
```

### Lớp 3 — R2 key có năm ở cấp thư mục

```
annual-reports/2024/VNM/report.md
annual-reports/2025/VNM/report.md
annual-reports/2026/VNM/report.md
```

**Kết quả trong `/pack` API:**

```json
"documents": [
  {
    "year": 2025,
    "document_type": "bctc",
    "label": "Bản OCR Surgical",
    "fileUrl": "...VNM_Baocaotaichinh_2025_extracted.txt"
  },
  {
    "year": 2024,
    "document_type": "bctn",
    "label": "Báo cáo thường niên 2024 (PaddleOCR)",
    "fileUrl": "https://r2.../annual-reports/2024/VNM/report.md"
  }
]
```

---

## 7. Cấu Trúc Module & File Mới

```
stock_data/
├── python/
│   ├── annual_report/              ← MỚI
│   │   ├── __init__.py
│   │   ├── queue_builder.py        # Phase 0: vnstock_data.Listing → seed D1 queue
│   │   ├── pdf_crawler.py          # Crawl4AI: tìm link PDF BCTN 2024 trên CafeF
│   │   ├── pdf_downloader.py       # Tải PDF về local, đếm số trang
│   │   ├── ocr_client.py           # Gọi Paddle OCR VL1.6 API, poll kết quả
│   │   ├── md_builder.py           # Ghép các trang → 1 file report.md
│   │   ├── r2_uploader.py          # Upload report.md lên R2 (qua Wrangler CLI)
│   │   └── tests/                  ← TDD - viết test trước khi implement
│   │       ├── test_queue_builder.py
│   │       ├── test_pdf_crawler.py
│   │       ├── test_pdf_downloader.py
│   │       ├── test_ocr_client.py
│   │       ├── test_md_builder.py
│   │       └── test_r2_uploader.py
│   └── extractor/                  ← Giữ nguyên
│
├── scripts/
│   ├── annual_report_pipeline.mjs  ← MỚI (zx orchestrator chính)
│   └── build_queue.mjs             ← MỚI (Phase 0: khởi tạo hàng đợi)
│
├── src/
│   └── endpoints/
│       └── annual_reports.ts       ← MỚI (Chanfana endpoints)
│
└── drizzle/                        ← Thêm migration cho các bảng mới
```

---

## 8. Chanfana Endpoints Mới (Cloudflare Worker)

### 8.1 `GET /api/companies/:ticker/annual-reports`

Lấy danh sách BCTN + trạng thái pipeline của 1 mã.

```typescript
class ListAnnualReports extends D1ListEndpoint {
  _meta = {
    model: {
      schema: AnnualReportQueueSchema,
      primaryKeys: ['id'],
      tableName: 'annual_report_queue',
    },
    tags: ['Annual Reports'],
  };
  dbName = 'DB';
  filterFields = ['ticker', 'year', 'status'];
  orderByFields = ['year', 'updated_at'];
  defaultOrderBy = 'year';
}
```

### 8.2 `POST /api/pipeline/annual-reports/ingest`

Script `zx` gọi sau khi upload R2 xong để ghi vào bảng `documents`.

```typescript
class IngestAnnualReport extends D1CreateEndpoint {
  _meta = {
    model: {
      schema: DocumentIngestSchema,
      // { ticker, year, fileName, fileUrl, label, document_type }
      primaryKeys: ['id'],
      tableName: 'documents',
    },
    tags: ['Pipeline Internal'],
  };
  dbName = 'DB';
}
```

---

## 9. Chiến Lược Xử Lý Lỗi

| Bước | Lỗi có thể xảy ra | Xử lý |
|---|---|---|
| Cào CafeF | Không tìm thấy BCTN 2024 | `status='no_report_found'`, bỏ qua mã đó |
| Tải PDF | Timeout / 404 | Retry 3 lần với backoff, sau đó `status='failed'` |
| Đếm trang | PDF bị mã hóa / hỏng | `status='failed'`, ghi `error_msg` |
| Quota check | `pages_used + page_count > 19.500` | Dừng pipeline ngay lập tức, log ngày |
| Paddle OCR | `state='failed'` | Retry 1 lần, sau đó `status='failed'` |
| Upload R2 | Network error | Retry 3 lần với exponential backoff |
| Ingest API | Worker trả lỗi 4xx/5xx | Retry 2 lần, sau đó log lỗi và tiếp tục mã tiếp theo |
| Tổng thể | `attempts >= 3` | Đánh dấu `status='failed'` vĩnh viễn, không retry thêm |

---

## 10. Quy Trình TDD Bắt Buộc

Mọi module mới **phải** tuân thủ chu trình **Red → Green → Refactor**:

1. **Red:** Viết test thất bại trước (`tests/test_*.py`)
2. **Green:** Implement code tối thiểu để test pass
3. **Refactor:** Cải thiện code, đảm bảo test vẫn pass

**Áp dụng cho:**
- Mỗi module Python trong `python/annual_report/`
- Mỗi Chanfana endpoint mới trong `src/endpoints/annual_reports.ts`
- Script zx `annual_report_pipeline.mjs` (integration test với 5 mã thử nghiệm)

---

## 11. Quy Trình Skill Loading Bắt Buộc

Trước khi thực thi bất kỳ task nào, agent **phải** load các skill liên quan:

| Loại task | Skill cần load |
|---|---|
| Cloudflare Worker, R2, D1 | `cloudflare` + `wrangler` |
| Chanfana endpoint | `write-endpoints` |
| Viết code mới / TDD | `tdd` |
| Web scraping Crawl4AI | `crawl4ai` |
| vnstock / vnstock_data | Đọc `docs/vnstock-data/` liên quan |

---

## 12. Thứ Tự Triển Khai (Implementation Order)

### Phase 0 — Chuẩn bị nền tảng
1. Viết Drizzle migration cho 3 thay đổi schema D1
2. Deploy migration lên D1 remote
3. Thêm migration `ALTER TABLE documents ADD COLUMN document_type`

### Phase 1 — Queue Builder
4. TDD: `test_queue_builder.py` → `queue_builder.py`
5. `build_queue.mjs` (zx): Gọi Python, seed toàn bộ D1 queue

### Phase 2 — Crawl & Download
6. TDD: `test_pdf_crawler.py` → `pdf_crawler.py` (Crawl4AI + CafeF)
7. TDD: `test_pdf_downloader.py` → `pdf_downloader.py`

### Phase 3 — OCR & Markdown
8. TDD: `test_ocr_client.py` → `ocr_client.py` (Paddle OCR VL1.6)
9. TDD: `test_md_builder.py` → `md_builder.py`

### Phase 4 — Upload & Ingest
10. TDD: `test_r2_uploader.py` → `r2_uploader.py` (Wrangler R2 CLI)
11. Chanfana endpoint: `IngestAnnualReport` (POST /api/pipeline/annual-reports/ingest)
12. Chanfana endpoint: `ListAnnualReports` (GET /api/companies/:ticker/annual-reports)

### Phase 5 — Orchestrator
13. `annual_report_pipeline.mjs` (zx): Kết nối toàn bộ Phase 1→4
14. Integration test toàn bộ pipeline với 5 mã thử nghiệm (VNM, VCB, HPG, TCB, VIC)

---

## 13. Định Nghĩa Hoàn Thành (Definition of Done)

- [ ] Tất cả unit test pass cho 6 module Python
- [ ] Hai Chanfana endpoint có OpenAPI schema hợp lệ và test pass
- [ ] Pipeline chạy end-to-end thành công với 5 mã thử nghiệm
- [ ] File `report.md` xuất hiện đúng path trên R2
- [ ] `/api/companies/{ticker}/pack` trả về đúng entry `document_type: "bctn"` với label đúng năm
- [ ] Quota tracking hoạt động đúng: pipeline tự dừng khi đạt 19.500 trang/ngày
- [ ] Retry logic hoạt động đúng: tối đa 3 lần, sau đó `status='failed'`

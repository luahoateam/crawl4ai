# Comprehensive Design Spec: Vietnam Stock Data Hub

## 1. Hệ thống & Công nghệ (Tech Stack)
- **Runtime:** Cloudflare Workers (TypeScript)
- **Framework:** Hono (Siêu nhẹ, tối ưu cho Edge)
- **API Standard:** Chanfana (Kế thừa từ `itty-router-openapi`, dùng Zod v4)
- **ORM/Query Builder:** Waddler (Interface chính) + Drizzle ORM (Quản lý Schema & Migration)
- **Database:** Cloudflare D1 (SQLite)
- **Storage:** Cloudflare R2 (Lưu trữ file Markdown/OCR lớn)
- **Testing:** Vitest + Miniflare (Giả lập D1, R2, KV ngay trong môi trường test)
- **Validation:** Zod v4 (Chuẩn xác, type-safe)

## 2. Kiến trúc Dữ liệu (Data Architecture)

### 2.1. Cloudflare D1 (Metadata & Structured Data)
Chúng ta sử dụng kiến trúc Bảng Chung (Multi-tenant) với Chỉ mục (Index) mạnh mẽ trên cột `symbol`.

#### Bảng: `companies`
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `symbol` | TEXT (PK) | Mã chứng khoán (Viết hoa: AAA, FPT...) |
| `exchange` | TEXT | HOSE, HNX, UPCOM |
| `industry` | TEXT | Ngành nghề từ Excel |
| `updated_at` | INTEGER | Timestamp cập nhật cuối |

#### Bảng: `business_models` (Dữ liệu từ business_model.xlsx)
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `symbol` | TEXT (FK) | Trỏ đến `companies.symbol` |
| `revenue_struct` | TEXT | Cơ cấu thu nhập (Markdown/Text) |
| `inputs` | TEXT | Đầu vào sản xuất |
| `production` | TEXT | Quy trình sản xuất |
| `outputs` | TEXT | Đầu ra/Sản phẩm |
| `others` | TEXT | Các thông tin khác |

#### Bảng: `daily_research` (Dữ liệu từ daily_research.xlsx)
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `symbol` | TEXT (FK) | Trỏ đến `companies.symbol` |
| `summary` | TEXT | Tóm tắt nghiên cứu |
| `ssi_review` | TEXT | Review từ SSI Research |
| `last_updated` | INTEGER | Ngày cập nhật bản ghi |

#### Bảng: `news_index`
| Cột | Kiểu dữ liệu | Ghi chú |
| :--- | :--- | :--- |
| `id` | INTEGER (PK, AI) | ID tự tăng |
| `symbol` | TEXT (FK) | Trỏ đến `companies.symbol` |
| `title` | TEXT | Tiêu đề tin tức hoặc "Merged News" |
| `r2_key` | TEXT | Đường dẫn tới file trên R2 |
| `created_at` | INTEGER | Ngày tạo bản ghi |

### 2.2. Cloudflare R2 (Large Content Storage)
- **Path format:** `content/{symbol}/news_merged.md` hoặc `content/{symbol}/ocr/{year}.md`
- **Mục tiêu:** Giảm tải cho D1, phục vụ các đoạn text dài cho AI đọc.

## 3. Thiết kế API (Chanfana/OpenAPI Full CRUD)

Hệ thống cung cấp đầy đủ các thao tác Thêm, Sửa, Xóa cho các thực thể quan trọng để phục vụ việc cập nhật dữ liệu hàng ngày/hàng quý.

### 3.1. Nhóm Doanh nghiệp & Tổng hợp
| Phương thức | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/companies/:symbol/pack` | Trả về 1 "Pack" dữ liệu đầy đủ cho AI (D1 + R2). |
| `GET` | `/api/companies/:symbol` | Lấy Profile cơ bản. |
| `DELETE` | `/api/companies/:symbol` | Xóa doanh nghiệp khỏi hệ thống. |

### 3.2. Nhóm Mô hình Kinh doanh (Business Model) - Cập nhật hàng Quý
| Phương thức | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/companies/:symbol/business-model` | Xem mô hình kinh doanh hiện tại. |
| `PUT` | `/api/companies/:symbol/business-model` | Thêm mới hoặc Cập nhật (Upsert) mô hình. |
| `DELETE` | `/api/companies/:symbol/business-model` | Xóa dữ liệu mô hình. |

### 3.3. Nhóm Nghiên cứu (Daily Research) - Cập nhật hàng Ngày
| Phương thức | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/companies/:symbol/research` | Lấy bản tin nghiên cứu mới nhất. |
| `PUT` | `/api/companies/:symbol/research` | Thêm mới hoặc Cập nhật (Upsert) kết quả research. |
| `DELETE` | `/api/companies/:symbol/research` | Xóa bản tin research. |

### 3.4. Nhóm Tin tức & Nội dung (News & R2)
| Phương thức | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/companies/:symbol/news` | Liệt kê danh sách tin tức. |
| `POST` | `/api/companies/:symbol/news` | Thêm đầu mục tin mới và upload nội dung lên R2. |
| `DELETE` | `/api/companies/:symbol/news/:id` | Xóa tin tức và tệp tương ứng trên R2. |

### 3.5. Endpoint Ingest Hàng loạt
| Phương thức | Đường dẫn | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/api/ingest` | Nhận dữ liệu từ script Python hoặc Excel upload. |

## 4. Các Schema Validation (Zod v4)

Chúng ta sử dụng Zod để kiểm soát chặt chẽ dữ liệu đầu vào cho các thao tác Sửa/Xóa:

```typescript
// Ví dụ Schema cho Daily Research Update
const UpdateResearchSchema = z.object({
  summary: z.string().min(10).describe('Tóm tắt nghiên cứu mới'),
  ssiReview: z.string().optional().describe('Đánh giá từ SSI'),
  lastUpdated: z.iso.datetime().default(() => new Date().toISOString())
});

// Ví dụ Schema cho Business Model Update
const UpdateBusinessModelSchema = z.object({
  revenueStruct: z.string().optional(),
  inputs: z.string().optional(),
  production: z.string().optional(),
  outputs: z.string().optional(),
  others: z.string().optional()
});
```

## 4. Chiến lược Kiểm thử (TDD với Miniflare)

### 4.1. Unit Test (Logic)
- Kiểm tra các hàm trích xuất Excel chuyển đổi sang Schema D1.
- Kiểm tra logic gộp dữ liệu (Merge logic).

### 4.2. Integration Test (Miniflare)
Sử dụng `vitest` và `miniflare` để chạy các bài test:
- **Case 1:** "Nạp dữ liệu giả vào D1 và R2, gọi Endpoint `/pack`, mong đợi dữ liệu trả về chính xác".
- **Case 2:** "Truy cập mã không tồn tại, mong đợi lỗi 404 từ Chanfana".
- **Case 3:** "Truy cập không có Token, mong đợi lỗi 401".

## 5. Kế hoạch Triển khai Chi tiết (Checklist)

### Giai đoạn 1: Khởi tạo Project & Infrastructure
- [ ] Khởi tạo `npm create cloudflare@latest` (Template: Hono).
- [ ] Cài đặt dependencies: `hono`, `chanfana`, `drizzle-orm`, `waddler`, `zod`.
- [ ] Cài đặt devDependencies: `vitest`, `miniflare`.
- [ ] Cấu hình `wrangler.toml` (D1, R2, Compatibility Date).

### Giai đoạn 2: Định nghĩa Schema & Migration
- [ ] Viết `src/db/schema.ts` dùng Drizzle.
- [ ] Chạy `npx drizzle-kit generate:sqlite` để tạo file SQL migration.
- [ ] Apply migration vào D1 Local: `npx wrangler d1 migrations apply DB --local`.

### Giai đoạn 3: Xây dựng Ingestion Script (Mẫu AAA)
- [ ] Viết script Node.js dùng `xlsx` để đọc 1 dòng (AAA) từ 2 file Excel.
- [ ] Viết logic đẩy dữ liệu lên D1 qua Waddler.
- [ ] Upload file `AAA_merged_news.md` lên R2 Local.

### Giai đoạn 4: API Development (TDD)
- [ ] Viết file test `src/index.test.ts`.
- [ ] Triển khai Endpoint `CompanyPackEndpoint` kế thừa từ `OpenAPIRoute`.
- [ ] Tích hợp logic truy vấn đồng thời D1 và R2.

### Giai đoạn 5: Validation & Swagger
- [ ] Chạy `npm run dev` và truy cập `/openapi.json` để kiểm tra doc.
- [ ] Test trực tiếp trên Swagger UI.

## 6. Ghi chú Bảo mật & Hiệu năng
- **Bảo mật:** Dùng `env.AUTH_TOKEN` để bảo vệ các endpoint ghi dữ liệu.
- **Hiệu năng:** Sử dụng `Cache API` của Cloudflare để lưu kết quả `/pack` trong 1 giờ nếu dữ liệu không thay đổi thường xuyên.

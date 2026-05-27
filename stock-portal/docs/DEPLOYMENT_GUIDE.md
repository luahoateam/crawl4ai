# 🚀 Hướng Dẫn Triển Khai Stock Portal Lên Cloudflare Pages

Cổng thông tin **Stock Portal** được xây dựng trên nền tảng **Astro SSR** kết hợp cùng **Cloudflare Pages** để đạt tốc độ tải tối ưu ở Edge và tích hợp trực tiếp với Cloudflare D1 (`stock_db`) và Cloudflare KV (`USER_STORE`).

---

## 1. Chuẩn Bị Môi Trường & Cấu Hình

Tệp cấu hình `wrangler.toml` tại thư mục `stock-portal/` đã được định nghĩa đầy đủ các bindings cần thiết cho môi trường chạy local và production:

```toml
name = "stock-portal"
compatibility_date = "2024-09-26"

[[d1_databases]]
binding = "DB"
database_name = "stock_db"
database_id = "64fdc9a0-7248-46f6-8da5-578f0a3b8af6"

[[kv_namespaces]]
binding = "USER_STORE"
id = "PLACEHOLDER_KV_ID"
```

---

## 2. Quy Trình Khởi Tạo & Triển Khai Lên Cloudflare Dashboard

Cách tốt nhất và được khuyến nghị nhất là **liên kết trực tiếp GitHub Repository với Cloudflare Pages** để kích hoạt chế độ tự động Deploy (CI/CD) mỗi khi có commit mới trên branch `main`.

### Bước 2.1: Tạo dự án Pages mới
1. Đăng nhập vào **Cloudflare Dashboard**.
2. Di chuyển đến mục **Workers & Pages** &rarr; Chọn **Create Application** &rarr; Chọn tab **Pages** &rarr; Chọn **Connect to Git**.
3. Chọn repository của bạn và nhấn **Begin setup**.

### Bước 2.2: Cấu hình Build settings
Thiết lập các thông số biên dịch như sau:
* **Framework preset**: `Astro`
* **Build command**: `npm run build`
* **Build output directory**: `dist`
* **Root directory**: `stock-portal`
* **Environment variables**:
  * `API_URL`: Điền URL của API Worker (ví dụ: `https://stock-api-worker.luahoateam.workers.dev`).
  * `JWT_SECRET`: Điền mã khóa bí mật JWT (ví dụ một chuỗi ký tự ngẫu nhiên siêu dài).

Nhấn **Save and Deploy** để Cloudflare thực hiện bản build đầu tiên.

---

## 3. Ràng Buộc Dữ Liệu (Bindings D1 & KV)

Sau khi bản build đầu tiên hoàn tất (hoặc đang build), bạn cần cấu hình các liên kết tài nguyên trên dashboard của Pages:

### Bước 3.1: Liên kết D1 Database (`stock_db`)
1. Di chuyển vào dự án Pages của bạn trên Cloudflare &rarr; Chọn tab **Settings** &rarr; Chọn **Functions**.
2. Cuộn xuống phần **D1 database bindings**.
3. Nhấn **Add binding**:
   * **Variable name**: `DB`
   * **D1 database**: Chọn database `stock_db` thực tế của bạn.
4. Làm tương tự cho cả hai môi trường **Production** và **Preview**.

### Bước 3.2: Liên kết KV Namespace (`USER_STORE`)
1. Cũng tại trang **Settings &rarr; Functions**, cuộn tới phần **KV namespace bindings**.
2. Nhấn **Add binding**:
   * **Variable name**: `USER_STORE`
   * **KV namespace**: Chọn namespace lưu trữ user của bạn (hoặc tạo một cái mới tên `USER_STORE` trên Cloudflare KV rồi quay lại chọn).
3. Lưu lại và nhấn **Redeploy** dự án để cấu hình có hiệu lực.

---

## 4. Quản Lý Tài Khoản Hội Viên (Thêm User vào KV)

Để thêm tài khoản hội viên mới vào KV store giúp họ mở khóa tính năng **Daily Research**:

1. Mở terminal tại thư mục `stock-portal/`.
2. Chạy script tạo mã băm và lệnh Wrangler:
   ```bash
   node scripts/add-user.js <username_moi> <password_moi>
   ```
3. Script sẽ in ra các lệnh Wrangler dạng:
   ```bash
   # Lệnh thêm vào Cloudflare KV thực tế
   wrangler kv:key put --binding=USER_STORE "user:username_moi" '{"id":"user-123456","username":"username_moi","passwordHash":"...","role":"member"}'
   ```
4. Copy lệnh đó chạy trực tiếp trên máy của bạn (nơi đã đăng nhập Wrangler CLI) để đẩy tài khoản mới lên đám mây Cloudflare ngay lập tức!

---

## 5. Chạy Local Development Thử Nghiệm

Để chạy thử nghiệm toàn bộ hệ thống (Portal + API Worker) trên môi trường cục bộ thông qua Miniflare:

```bash
# Khởi động dev server của stock-portal
npm run dev
```

Hệ thống sẽ chạy tại `http://localhost:4321` và tự động kết nối tới API local `http://localhost:8787` (nếu đang chạy `stock-api-worker`).

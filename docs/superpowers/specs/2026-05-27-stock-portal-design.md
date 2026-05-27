# Stock Portal — Design Specification

**Ngày:** 2026-05-27  
**Tác giả:** Lúa Hóa Team  
**Trạng thái:** Đã duyệt  

---

## 1. Tổng Quan

Xây dựng một website công khai (không cần đăng nhập) để người đầu tư tra cứu thông tin doanh nghiệp niêm yết trên thị trường chứng khoán Việt Nam (HOSE, HNX, UPCOM). Dữ liệu được lấy từ Cloudflare D1 (`stock_db`) thông qua `stock-api-worker` đã có sẵn. Trọng tâm là **Business Model** — bao gồm cơ cấu doanh thu, lợi nhuận, và chuỗi giá trị (inputs → production → outputs) được bóc tách bằng AI.

### Mục tiêu
- Giúp người dùng tra cứu nhanh thông tin doanh nghiệp bất kỳ trong 1.411 mã
- Hiển thị Business Model trực quan, dễ hiểu cho người không chuyên
- Daily Research được bảo vệ bằng login — phân phối qua Lúa Hóa Team

---

## 2. Kiến Trúc Hệ Thống

### Tech Stack
- **Framework:** Astro (SSR mode)
- **Adapter:** `@astrojs/cloudflare`
- **Deploy:** Cloudflare Pages
- **Auth store:** Cloudflare KV (user credentials)
- **Data source:** `stock-api-worker` (Cloudflare Workers, đã có)
- **Database:** Cloudflare D1 `stock_db` (truy cập gián tiếp qua API)

### Sơ đồ kiến trúc

```
Browser → Cloudflare Pages (Astro SSR)
               ↓ server-side fetch
         stock-api-worker (Hono API)
               ↓
         Cloudflare D1 (stock_db)

Auth:
Browser → POST /api/auth/login (Astro API route)
               ↓ check credentials
         Cloudflare KV (user store)
               ↓ JWT cookie (httpOnly, 7 ngày)
```

### Cấu trúc Repo

```
stock-portal/
  ├── src/
  │   ├── pages/
  │   │   ├── index.astro                  # Trang chủ
  │   │   ├── companies/
  │   │   │   ├── index.astro              # Danh sách mã
  │   │   │   └── [symbol].astro           # Chi tiết mã
  │   │   ├── login.astro                  # Trang đăng nhập
  │   │   └── api/
  │   │       └── auth/
  │   │           └── login.ts             # API route xử lý auth
  │   ├── components/
  │   │   ├── BusinessModel.astro          # Wrapper Business Model
  │   │   ├── ValueChainDiagram.astro      # Diagram inputs→production→outputs
  │   │   ├── CompanyCard.astro            # Card mã trong danh sách
  │   │   └── DailyResearchGate.astro      # Blur overlay + CTA login
  │   ├── layouts/
  │   │   └── Base.astro                   # Header + dark/light toggle + footer
  │   └── lib/
  │       ├── api.ts                       # Wrapper gọi stock-api-worker
  │       └── auth.ts                      # JWT verify helper
  ├── wrangler.toml                        # KV binding
  └── astro.config.mjs
```

---

## 3. Các Trang & Routes

| Route | Render | Mô tả |
|---|---|---|
| `/` | SSR | Trang chủ — hero search box + thống kê tổng quan |
| `/companies` | SSR | Danh sách mã — lọc Sàn/Ngành + search client-side |
| `/companies/[symbol]` | SSR | Chi tiết mã — Business Model là trọng tâm |
| `/login` | SSR | Form đăng nhập cho Daily Research |
| `/api/auth/login` | API Route | Xử lý POST login, trả JWT cookie |

---

## 4. Thiết Kế UI

### 4.1 Theme — Light/Dark Mode
- Toggle button ở header (icon mặt trời / mặt trăng)
- Lưu lựa chọn vào `localStorage`
- CSS variables cho toàn bộ màu sắc — swap bằng `[data-theme="dark"]` trên `<html>`

### 4.2 Trang Chủ `/`

```
┌─────────────────────────────────────────────┐
│  🌾 Lúa Hóa Stock        [🌙 Dark/Light]    │
├─────────────────────────────────────────────┤
│                                             │
│   Tra cứu thông tin doanh nghiệp            │
│   niêm yết trên thị trường Việt Nam         │
│                                             │
│   [ 🔍 Tìm mã hoặc tên công ty...      ]   │
│   (autocomplete gợi ý khi gõ)              │
│                                             │
│   1.411 doanh nghiệp · HOSE · HNX · UPCOM  │
│                                             │
└─────────────────────────────────────────────┘
```

### 4.3 Trang Danh Sách `/companies`

**Bộ lọc:**
- Dropdown: Sàn giao dịch (Tất cả / HOSE / HNX / UPCOM)
- Dropdown: Ngành (dynamic từ API)
- Ô search nhỏ để filter realtime phía client

**Grid cards (50 mã/trang):**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ VCB          │  │ FPT          │  │ HPG          │
│ Vietcombank  │  │ FPT Corp     │  │ Hòa Phát     │
│ Ngân hàng    │  │ Công nghệ    │  │ Thép         │
│ HOSE         │  │ HOSE         │  │ HOSE         │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 4.4 Trang Chi Tiết `/companies/[symbol]`

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Header: VCB | Vietcombank | Ngân hàng       │
│  Sàn: HOSE                                  │
├─────────────────────────────────────────────┤
│  Tab: [Business Model] [Tin Tức] [Tài Liệu] [Daily Research 🔒] │
├─────────────────────────────────────────────┤
│  === Tab Business Model (mặc định) ===       │
│                                             │
│  Cơ Cấu Doanh Thu        Cơ Cấu Lợi Nhuận  │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │ • Mảng A: 60%   │  │ • Mảng X: 70%   │  │
│  │ • Mảng B: 40%   │  │ • Mảng Y: 30%   │  │
│  └─────────────────┘  └─────────────────┘  │
│                                             │
│  ── Chuỗi Giá Trị ──────────────────────── │
│                                             │
│  [INPUTS] ──→ [PRODUCTION] ──→ [OUTPUTS]   │
│  (animated flow diagram, hover = tooltip)   │
│                                             │
│  ┌──────────┐ ┌────────────┐ ┌──────────┐  │
│  │ Đầu Vào  │ │ Sản Xuất   │ │ Đầu Ra   │  │
│  │ detail   │ │ detail     │ │ detail   │  │
│  └──────────┘ └────────────┘ └──────────┘  │
└─────────────────────────────────────────────┘
```

### 4.5 Daily Research Gate

Khi user chưa đăng nhập, tab Daily Research hiển thị:
```
┌─────────────────────────────────────────────┐
│  [Nội dung bị blur ████████████████████]    │
│  [████████████████████████████████████]     │
│                                             │
│    🔒 Nội dung này dành riêng cho           │
│       thành viên Lúa Hóa Team               │
│                                             │
│    [ Đăng nhập ]  [ Liên hệ cấp tài khoản ]│
└─────────────────────────────────────────────┘
```

---

## 5. Authentication — Daily Research

### User Store (Cloudflare KV)
```
Key:   "user:{username}"
Value: {
  "passwordHash": "<bcrypt hash>",
  "name": "Nguyễn Văn A",
  "createdAt": "2026-05-27"
}
```

### Flow đăng nhập
1. User POST `/api/auth/login` với `{ username, password }`
2. Astro API route tra KV → so sánh bcrypt hash
3. Nếu đúng → tạo JWT (payload: `{ username, exp: +7d }`) → Set `httpOnly` cookie
4. Redirect về trang trước hoặc `/`
5. Mọi SSR request sau → middleware check cookie → nếu valid → fetch Daily Research

### Thêm user (CLI script)
```bash
# Admin chạy script để thêm user mới vào KV
node scripts/add-user.js --username "nguyenvana" --password "secret123" --name "Nguyễn Văn A"
```

---

## 6. Data Flow

### `/companies/[symbol]` — 1 request duy nhất
```
Astro SSR → GET stock-api-worker/api/companies/{symbol}/pack
Response:  {
  company: { symbol, exchange, industry },
  businessModel: { revenueStruct, profitStruct, inputs, production, outputs },
  news: [...],
  documents: [...]
}
```

### `/companies` — danh sách + filter
```
Astro SSR → GET stock-api-worker/api/companies?exchange=HOSE&industry=Ngân hàng
Response: [{ symbol, exchange, industry }, ...]
```

### Daily Research — gated
```
Middleware check JWT cookie
→ valid  → fetch /api/companies/{symbol}/research → render
→ invalid → render blur overlay + CTA
```

---

## 7. Kiểm Thử

| Loại | Kịch bản |
|---|---|
| API integration | Gọi `stock-api-worker` từ Astro SSR, kiểm tra data parse đúng |
| Render | Kiểm tra trang với mã thực: VCB, FPT, HPG, mã không có data |
| Auth | Login đúng/sai, cookie expire, access Daily Research trước/sau login |
| Filter | Lọc HOSE, HNX, UPCOM; lọc theo ngành; kết hợp hai filter |
| Responsive | Mobile 375px, tablet 768px, desktop 1440px |
| Theme | Dark/Light toggle, persist qua `localStorage`, reload trang |
| Edge case | Mã không có business model → hiện "Chưa có dữ liệu" |

---

## 8. Ngoài Phạm Vi (Out of Scope)

- Admin Portal (đã có sẵn, không dùng trong project này)
- Biểu đồ giá cổ phiếu realtime
- So sánh nhiều mã
- Bình luận / cộng đồng
- Thông báo / alert giá

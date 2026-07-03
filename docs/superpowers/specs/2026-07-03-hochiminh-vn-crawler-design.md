# Design Spec: Crawl4AI - Cào Nội Dung Văn Bản từ hochiminh.vn

**Ngày tạo:** 2026-07-03  
**Phạm vi:** Cào nội dung văn bản (không có hình ảnh) từ các chuyên mục được chọn trên https://hochiminh.vn/  
**Công nghệ:** Python, Crawl4AI (`AsyncWebCrawler`), asyncio  

---

## 1. Mục Tiêu

Xây dựng một pipeline cào dữ liệu tự động, an toàn, có khả năng resume để thu thập **toàn bộ** nội dung văn bản (Tiêu đề + Nội dung bài viết) từ các chuyên mục được chọn trên trang https://hochiminh.vn/, lưu ra các file `.md` riêng biệt theo từng chuyên mục. Dữ liệu đầu ra phục vụ cho các tác vụ xử lý ngôn ngữ tự nhiên (NLP), huấn luyện AI, hoặc nghiên cứu.

---

## 2. Chuyên Mục Mục Tiêu (11 chuyên mục)

| # | Tên chuyên mục | URL | Slug thư mục |
|---|---|---|---|
| 1 | Tiểu sử Hồ Chí Minh | `/cuoc-doi-su-nghiep/tieu-su-ho-chi-minh` | `tieu-su` |
| 2 | Biên niên Tiểu sử Hồ Chí Minh | `/cuoc-doi-su-nghiep/bien-nien-tieu-su-ho-chi-minh` | `bien-nien-tieu-su` |
| 3 | Tác phẩm về HCM - Trong nước | `/tac-pham-ve-ho-chi-minh/tac-pham-trong-nuoc` | `tac-pham-trong-nuoc` |
| 4 | Tác phẩm về HCM - Nước ngoài | `/tac-pham-ve-ho-chi-minh/tac-pham-nuoc-ngoai` | `tac-pham-nuoc-ngoai` |
| 5 | Những bài báo của Hồ Chí Minh | `/tac-pham-cua-ho-chi-minh/nhung-bai-bao-cua-bac` | `nhung-bai-bao-cua-bac` |
| 6 | Hồ Chí Minh toàn tập | `/tac-pham-cua-ho-chi-minh/ho-chi-minh-toan-tap` | `ho-chi-minh-toan-tap` |
| 7 | Hồ Chí Minh tuyển tập | `/tac-pham-cua-ho-chi-minh/ho-chi-minh-tuyen-tap` | `ho-chi-minh-tuyen-tap` |
| 8 | Hoạt động quốc tế của Hồ Chí Minh | `/ho-chi-minh-va-the-gioi/hoat-dong-quoc-te-cua-ho-chi-minh` | `hoat-dong-quoc-te` |
| 9 | Bạn bè quốc tế với Hồ Chí Minh | `/ho-chi-minh-va-the-gioi/ban-be-quoc-te-voi-ho-chi-minh` | `ban-be-quoc-te` |
| 10 | Di chúc | `/hoc-va-lam-theo-bac/di-chuc` | `di-chuc` |
| 11 | Học và làm theo Bác (bài viết) | `/hoc-va-lam-theo-bac/hoc-va-lam-theo-bac` | `hoc-va-lam-theo-bac` |

---

## 3. Dữ Liệu Thu Thập

Với mỗi bài viết, chỉ thu thập:
- **Tiêu đề**: Lấy từ thẻ `<h1>` của trang bài viết.
- **Nội dung văn bản**: Phần nội dung chính của bài viết, được Crawl4AI tự động chuyển đổi thành Markdown sạch.

**Loại bỏ hoàn toàn**: hình ảnh, video, sidebar, header, footer, thanh điều hướng, quảng cáo, script, style.

---

## 4. Kiến Trúc Hệ Thống

Pipeline chia làm 2 giai đoạn liên tiếp trong cùng một lần chạy (`main.py`):

### Giai đoạn 1: Discoverer (Thu thập URL)
- Duyệt qua từng chuyên mục trong danh sách cấu hình.
- Tự động phát hiện và duyệt qua toàn bộ các trang phân trang của mỗi chuyên mục.
- Trích xuất tất cả URL bài viết chi tiết bằng CSS selector.
- Ghi URL mới (chưa tồn tại) vào `checkpoint.json` với `status = "pending"`.
- Bỏ qua URL đã có trong checkpoint (tránh trùng lặp).

### Giai đoạn 2: Crawler (Cào nội dung)
- Đọc toàn bộ URL có `status = "pending"` hoặc `status = "failed"` từ `checkpoint.json`.
- Dùng `AsyncWebCrawler` để tải trang và trích xuất nội dung.
- Lưu nội dung ra file `.md` trong thư mục output tương ứng với chuyên mục.
- Đánh dấu `status = "done"` hoặc `status = "failed"` trong checkpoint sau mỗi bài.
- Nghỉ ngẫu nhiên 1.0 – 2.5 giây (jitter) sau mỗi request để tránh bị chặn IP.
- Retry tối đa 3 lần với exponential backoff khi gặp lỗi timeout hoặc mạng.

---

## 5. Cấu Trúc Thư Mục Dự Án

```
hochiminh_crawl/
├── config.py           # Danh mục mục tiêu, cài đặt tốc độ, đường dẫn output
├── main.py             # Entry point: gọi Discoverer rồi Crawler
├── discoverer.py       # Module tìm và thu thập URL bài viết từ các trang danh mục
├── crawler.py          # Module cào nội dung và lưu file .md
├── logger.py           # Cấu hình hệ thống log (file + console)
│
├── checkpoint.json     # Trạng thái toàn bộ URL {url, status, category, slug}
├── crawl.log           # Log chi tiết (SUCCESS / SKIP / ERROR / RETRY)
│
└── output/
    ├── tieu-su/
    ├── bien-nien-tieu-su/
    ├── tac-pham-trong-nuoc/
    ├── tac-pham-nuoc-ngoai/
    ├── nhung-bai-bao-cua-bac/
    ├── ho-chi-minh-toan-tap/
    ├── ho-chi-minh-tuyen-tap/
    ├── hoat-dong-quoc-te/
    ├── ban-be-quoc-te/
    ├── di-chuc/
    └── hoc-va-lam-theo-bac/
```

---

## 6. Cấu Trúc File Output `.md`

Mỗi bài viết được lưu trong một file `.md` riêng biệt. Tên file lấy từ slug của URL bài viết (ví dụ URL `/tieu-su/bai-viet-abc.html` → file `bai-viet-abc.md`), đảm bảo tên file là duy nhất.

```markdown
# [Tiêu đề bài viết - lấy từ <h1>]

[Nội dung văn bản Markdown thuần túy - không có hình ảnh,
không có HTML thừa, đã qua bộ lọc PruningContentFilter]
```

---

## 7. Cấu Hình Crawl4AI

```python
# Browser config
BrowserConfig(
    headless=True,
    java_script_enabled=True,   # Cần thiết cho trang web động
)

# Crawler run config
CrawlerRunConfig(
    markdown_generator=DefaultMarkdownGenerator(
        content_filter=PruningContentFilter(
            threshold=0.45,
            threshold_type="fixed"
        )
    ),
    excluded_tags=[
        "img", "video", "figure", "picture",  # Loại bỏ media
        "nav", "header", "footer",             # Loại bỏ khung trang
        "aside", "script", "style"             # Loại bỏ code thừa
    ],
    cache_mode=CacheMode.BYPASS,       # Luôn lấy dữ liệu mới nhất
    page_timeout=30000,                # Timeout 30 giây/trang
    wait_until="domcontentloaded",     # Không đợi load ảnh
)
```

---

## 8. Checkpoint & Cơ Chế Resume

File `checkpoint.json` lưu trạng thái của toàn bộ URL đã phát hiện:

```json
[
  {
    "url": "https://hochiminh.vn/cuoc-doi-su-nghiep/tieu-su/bai-viet.html",
    "category": "Tiểu sử Hồ Chí Minh",
    "slug": "tieu-su",
    "status": "done"
  }
]
```

**Vòng đời trạng thái URL:**
```
pending → [Cào thành công] → done
pending → [Lỗi, retry 1-3 lần] → failed
failed  → [Chạy lại script]  → pending → done / failed
done    → [Chạy lại script]  → BỎ QUA (không cào lại)
```

---

## 9. Xử Lý Lỗi & Retry

| Tình huống | Hành vi |
|---|---|
| Timeout / lỗi mạng | Retry tối đa 3 lần, chờ 2^n giây (backoff: 2s, 4s, 8s) |
| Trang 404 / nội dung rỗng | Đánh dấu `failed`, ghi log, tiếp tục bài tiếp theo |
| Không tìm thấy thẻ `<h1>` | Dùng tiêu đề mặc định từ `<title>`, ghi cảnh báo vào log |
| Lỗi ghi file | Ghi log ERROR, đánh dấu `failed`, không crash toàn bộ script |

---

## 10. Tốc Độ & An Toàn

- **Jitter delay**: Nghỉ ngẫu nhiên trong khoảng `1.0 – 2.5 giây` sau mỗi request bài viết.
- **Chế độ Sequential**: Cào từng bài một (không song song) để giảm tải tối đa cho máy chủ mục tiêu.
- **User-Agent**: Sử dụng User-Agent mặc định của Playwright (browser thực).
- **Không cào trang danh mục song song**: Khám phá URL cũng tuần tự từng trang một.

---

## 11. Báo Cáo Tổng Kết Sau Khi Chạy

```
============================
 KẾT QUẢ CÀO DỮ LIỆU
============================
 Tổng URL phát hiện : 1,243
 ✅ Thành công      : 1,230
 ⚠️  Bỏ qua (done) :     0
 ❌ Thất bại        :    13
 Thời gian chạy     : 42 phút 18 giây
 Thư mục output    : ./output/
============================
```

---

## 12. Các Ràng Buộc & Giả Định

- Trang web https://hochiminh.vn/ **không sử dụng cơ chế chống bot mạnh** (như Cloudflare challenge). Nếu gặp phải, cần bổ sung thêm cấu hình stealth mode của Crawl4AI.
- Cơ chế phân trang dự đoán sử dụng tham số URL dạng `?page=N` hoặc `/page/N`. Cần kiểm tra thực tế khi implement `discoverer.py`.
- Script chạy trên môi trường Python `>=3.10` với Crawl4AI đã được cài đặt và setup đầy đủ (Playwright đã có).
- Dữ liệu đầu ra chỉ phục vụ mục đích nghiên cứu/học thuật cá nhân, không phân phối thương mại.

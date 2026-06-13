# Thiết kế: Thu thập dữ liệu Superinvestor (Golden News)

## 1. Tổng quan
Dự án nhằm mục đích bổ sung một luồng dữ liệu mới cho hệ thống Golden News bằng cách thu thập danh mục đầu tư của 82 nhà đầu tư huyền thoại từ Apify. Dữ liệu này sẽ được lưu trữ dưới dạng thô để phục vụ cho các bước phân tích và tạo bản tin sau này.

## 2. Mục tiêu
- Thu thập toàn bộ dữ liệu danh mục đầu tư (holdings) của 82 nhà đầu tư từ Actor `parsebird/superinvestor-scraper`.
- Phân loại và lưu trữ dữ liệu theo từng nhà đầu tư riêng biệt để dễ dàng tra cứu.
- Đảm bảo tính nhất quán của dữ liệu bằng cách thu thập trong một phiên chạy duy nhất (one-shot).

## 3. Kiến trúc hệ thống

### 3.1. Cấu trúc thư mục mới
- `data/superinvestors/`: Thư mục chứa kết quả đầu ra.
- `scripts/fetch_investors.py`: Script Python thực hiện việc gọi API và xử lý dữ liệu.
- `.env`: Lưu trữ thông tin nhạy cảm (`APIFY_API_TOKEN`).

### 3.2. Quy trình dữ liệu (Data Flow)
1. **Khởi chạy:** Script đọc `APIFY_API_TOKEN` từ môi trường.
2. **Gọi API Apify:** Kích hoạt Actor `parsebird/superinvestor-scraper` với tham số lấy toàn bộ dữ liệu.
3. **Thu thập Dataset:** Đợi Actor hoàn thành, sau đó tải về toàn bộ Dataset (dạng danh sách các object).
4. **Xử lý tại máy (Partitioning):**
   - Duyệt qua từng bản ghi trong Dataset.
   - Sử dụng trường `investorName` hoặc `investorId` làm khóa để phân nhóm.
5. **Lưu trữ:** Ghi mỗi nhóm dữ liệu vào file tương ứng: `data/superinvestors/{investor_name}.json`.

## 4. Chi tiết kỹ thuật
- **Ngôn ngữ:** Python 3.10+
- **Thư viện:** `requests` hoặc `httpx` (ưu tiên `httpx` để đồng bộ với dự án hiện tại), `python-dotenv`.
- **Định dạng đầu ra:** JSON chuẩn, có thụt lề để dễ đọc.

## 5. Bảo mật và Rủi ro
- **Bảo mật:** API Token tuyệt đối không được ghi cứng trong mã nguồn. Sử dụng file `.env` và thêm vào `.gitignore`.
- **Rủi ro:** Nếu số lượng kết quả vượt quá dự kiến (ví dụ > 10,000 dòng), cần kiểm tra giới hạn bộ nhớ của script. Tuy nhiên với 82 nhà đầu tư, rủi ro này được đánh giá là thấp.

## 6. Tiêu chí thành công
- Thư mục `data/superinvestors/` chứa đầy đủ các file JSON của các nhà đầu tư.
- Mỗi file JSON chứa danh sách các cổ phiếu nắm giữ với đầy đủ thông tin (ticker, shares, %, price...).
- Script chạy thành công mà không gặp lỗi kết nối hoặc lỗi phân quyền.

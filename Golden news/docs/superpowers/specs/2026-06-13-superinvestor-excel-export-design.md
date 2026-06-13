# Thiết kế: Xuất dữ liệu Superinvestor ra Excel (Golden News)

## 1. Tổng quan
Dự án này thực hiện việc tổng hợp dữ liệu danh mục đầu tư của 81 siêu nhà đầu tư (đã thu thập được dưới dạng JSON) vào một file Excel duy nhất để phục vụ việc tra cứu và phân tích chéo. Hệ thống sẽ sử dụng công cụ `officecli` để tạo file Excel từ dữ liệu đã được tiền xử lý bằng Python.

## 2. Mục tiêu
- Gộp toàn bộ dữ liệu từ 81 file JSON trong `data/superinvestors/` vào 1 sheet duy nhất.
- Phẳng hóa (flatten) dữ liệu ngành kinh tế thành các cột riêng biệt.
- Việt hóa toàn bộ tiêu đề và nội dung mô tả hoạt động (trạng thái).
- Sử dụng `officecli` để đảm bảo tính chuẩn xác của định dạng Excel.

## 3. Kiến trúc hệ thống

### 3.1. Các thành phần chính
- `scripts/prepare_excel_data.py`: Script Python thực hiện tiền xử lý dữ liệu.
- `temp_excel_data.json`: File dữ liệu trung gian đã được làm sạch và dịch thuật.
- `Danh_muc_Sieu_dau_tu.xlsx`: File kết quả cuối cùng.

### 3.2. Quy trình xử lý (Pipeline)
1. **Tiền xử lý (Python):**
   - Đọc 81 file JSON.
   - Duyệt qua từng bản ghi (holding).
   - Dịch các trạng thái hoạt động:
     - `Buy` -> `Mua mới`
     - `Add` -> `Mua thêm`
     - `Reduce` -> `Giảm tỷ trọng`
     - `Sold` -> `Bán hết`
     - `New` -> `Mới`
   - Phẳng hóa `sectorBreakdown`: Chuyển `{"Technology": 10.5}` thành cột `Ngành: Technology (%)` với giá trị `10.5`.
   - Lưu kết quả ra file `temp_excel_data.json` dưới dạng mảng các object phẳng.
2. **Xuất Excel (officecli):**
   - Khởi tạo file Excel mới.
   - Thêm Sheet "Danh mục tổng hợp".
   - Sử dụng `officecli` để đổ dữ liệu từ `temp_excel_data.json` vào bảng.

## 4. Danh sách cột dữ liệu (Việt hóa)
- Nhà đầu tư (superinvestorName)
- ID nhà đầu tư (superinvestorId)
- Kỳ báo cáo (period)
- Mã cổ phiếu (symbol)
- Tên công ty (stockName)
- % Danh mục (percentOfPortfolio)
- Hoạt động gần đây (recentActivity)
- Số lượng cổ phiếu (shares)
- Giá báo cáo (reportedPrice)
- Giá hiện tại (currentPrice)
- % Thay đổi giá (changeFromReportedPrice)
- Thấp nhất 52 tuần (week52Low)
- Cao nhất 52 tuần (week52High)
- [Danh sách các ngành kinh tế trích xuất được]

## 5. Tiêu chí thành công
- File `Danh_muc_Sieu_dau_tu.xlsx` được tạo ra thành công.
- Toàn bộ dữ liệu của 81 nhà đầu tư nằm trong một Sheet duy nhất.
- Tiêu đề và các trạng thái mua/bán hiển thị đúng tiếng Việt.
- Các cột ngành được tách riêng và có giá trị số chính xác.

# Tài liệu Thiết Kế: Hệ Thống Trích Xuất & Đồng Bộ Dữ Liệu Business Model VN30 (Năm 2025)

## 📌 1. Bối cảnh & Mục tiêu

### Bối cảnh
Bảng cơ sở dữ liệu `business_models` trên Cloudflare D1 Production lưu trữ thông tin chiến lược của các doanh nghiệp niêm yết tại Việt Nam. Hiện tại:
- Dữ liệu của các doanh nghiệp trong rổ VN30 mới chỉ cập nhật đến năm 2024.
- Hơn 70% doanh nghiệp VN30 đang bỏ trống cột kế hoạch và động lực phát triển (`others` = 0).
- 100% doanh nghiệp VN30 đều có cơ cấu lợi nhuận `profit_struct` là `Null`.
- Kho dữ liệu OCR local đã có sẵn BCTC hợp nhất 2025 của nhiều doanh nghiệp, nhưng BCTC kiểm toán thường khuyết thiếu các thông tin phi tài chính quan trọng (sản lượng vật lý, thị phần %, kế hoạch tương lai).

### Mục tiêu
Xây dựng một pipeline tự động hóa tích hợp hoàn hảo **Vnstock thế hệ mới (Sponsor Tier)** và **MiMo AI** để:
1. Thu thập dữ liệu tài chính định lượng năm 2025 và kế hoạch năm 2026 qua `vnstock_data`.
2. Crawl tin tức hoạt động năm 2025 qua `vnstock_news` làm đầu vào phi tài chính (sản lượng, thị phần).
3. Sử dụng AI để trích xuất ra Unified JSON 2025 tương ứng với **3 nhóm ngành đặc thù** trong VN30 (Ngân hàng, Bất động sản, Sản xuất & Bán lẻ).
4. Định dạng Markdown đẹp mắt và đồng bộ ghép nối tiếp (Append) dữ liệu 2025 mới lên đầu dữ liệu cũ trên Cloudflare D1 Production để giữ lại lịch sử các năm trước.
5. Đảm bảo toàn bộ hệ thống được bảo vệ bởi test suite tự động (Node.js & Python) tuân thủ TDD.

---

## 🏛️ 2. Kiến trúc Pipeline Tích hợp (Multi-Source Pipeline)

Hệ thống được thiết kế theo mô hình 3 bước độc lập để đảm bảo độ bền vững (resilience) và dễ dàng kiểm thử cô lập:

### Bước 1: Data Gathering (Thu thập dữ liệu thô tự động)
Sử dụng script Python với SDK vnstock nâng cao để tải:
- **Tài chính**: Lớp `Fundamental(source="mas")` gọi phương thức `financial_health(scorecard="auto", limit=4)` để lấy dữ liệu cân đối, kết quả kinh doanh và chỉ số tài chính đã chuẩn hóa phân ngành.
- **Kế hoạch**: Lớp `Finance(source="mas")` gọi phương thức `annual_plan()` để lấy kế hoạch doanh thu & lợi nhuận năm mới.
- **Tin tức**: Thư viện `vnstock_news` để crawl tự động toàn bộ tin tức chính thống của doanh nghiệp trong năm 2025/2026.
*Dữ liệu thô lưu tại local cache:* `stock_data/vnstock_raw/{SYMBOL}/2025/`.

### Bước 2: AI Extraction (Trích xuất & Cấu trúc hóa)
Sử dụng mô hình `xiaomi/mimo-v2.5-pro` thông qua `langextract_bridge.py` để trích xuất ra JSON cấu trúc. Để tối ưu hóa độ chính xác và tránh trôi ngữ cảnh, AI sẽ được gọi theo **Dual-Run AI Extractor**:
- **Run 1 (Financial Sweep)**: Đọc file tài chính đã tải từ `vnstock_data` và file OCR BCTC để xuất ra JSON cơ cấu tài chính mảng.
- **Run 2 (Operational Sweep)**: Đọc file tin tức từ `vnstock_news` và Báo cáo thường niên để xuất ra JSON sản lượng, thị phần và kế hoạch tương lai.
- **Merge Step**: Gộp kết quả 2 lần chạy thành một Unified JSON 2025 duy nhất lưu tại `stock_data/extracted_structure/{SYMBOL}/2025.json`.

### Bước 3: Formatter & Append-Sync (Ghép nối & Cập nhật D1)
- **Formatter**: Đọc Unified JSON, chuyển đổi thành 2 khối Markdown tương thích với D1 (`outputs_2025` và `others_2025`).
- **D1 Sync**: Gọi API Worker GET lấy dữ liệu cũ của D1, chèn khối 2025 mới lên đầu khối cũ (phân cách bằng tiêu đề năm rõ ràng), sau đó gọi PUT cập nhật ngược lại D1 Production.

---

## 📐 3. Thiết kế JSON Schema Phân Ngành VN30

Chúng ta xây dựng 3 mẫu JSON Schema chuyên biệt tùy thuộc vào loại hình kinh doanh của doanh nghiệp trong VN30 để tối ưu hóa tính chính xác của dữ liệu:

### Mẫu A: Nhóm Ngân Hàng (Banks)
*Áp dụng cho: ACB, BID, CTG, HDB, MBB, SHB, SSB, STB, TCB, TPB, VCB, VIB, VPB*
```json
{
  "symbol": "TCB",
  "year": 2025,
  "industry_group": "banking",
  "financial_segments_2025": {
    "net_interest_income_vnd": "number (Thu nhập lãi thuần thực tế năm 2025)",
    "net_fee_income_vnd": "number (Thu nhập từ hoạt động dịch vụ năm 2025)",
    "nim_percentage": "string (Biên lãi thuần NIM năm 2025, ví dụ: 4.2%)",
    "bad_debt_npl_percentage": "string (Tỷ lệ nợ xấu NPL năm 2025, ví dụ: 1.1%)",
    "bad_debt_provision_llr_percentage": "string (Tỷ lệ bao phủ nợ xấu LLR năm 2025, ví dụ: 135%)",
    "car_ratio": "string (Hệ số an toàn vốn CAR năm 2025 nếu có)"
  },
  "outputs_data_2025": {
    "credit_growth_actual": "string (Tăng trưởng tín dụng thực tế năm 2025, ví dụ: 18.2%)",
    "casa_ratio": "string (Tỷ lệ tiền gửi không kỳ hạn CASA năm 2025, ví dụ: 40.5%)",
    "customer_base": "string (Tổng số lượng khách hàng lũy kế đến hết năm 2025, ví dụ: 14 triệu khách hàng)"
  },
  "others_data_2025": {
    "targets_2026": {
      "target_credit_growth_2026": "string (Mục tiêu tăng trưởng tín dụng năm 2026)",
      "target_net_profit_before_tax_2026": "string (Mục tiêu lợi nhuận trước thuế năm 2026)"
    },
    "strategic_priorities_2026": "array of strings (Các ưu tiên chiến lược của ngân hàng trong năm 2026, ví dụ: đẩy mạnh số hóa, tăng tỷ lệ CASA)"
  }
}
```

### Mẫu B: Nhóm Bất Động Sản (Real Estate)
*Áp dụng cho: VHM, VIC, VRE, BCM*
```json
{
  "symbol": "VHM",
  "year": 2025,
  "industry_group": "real_estate",
  "financial_segments_2025": {
    "property_sales_revenue_vnd": "number (Doanh thu chuyển nhượng bất động sản năm 2025)",
    "leasing_revenue_vnd": "number (Doanh thu cho thuê bất động sản đầu tư/sàn thương mại năm 2025)",
    "inventory_value_vnd": "number (Giá trị hàng tồn kho dở dang tại ngày 31/12/2025 từ thuyết minh BCTC)"
  },
  "outputs_data_2025": {
    "launched_projects_2025": [
      {
        "project_name": "string (Tên dự án được mở bán hoặc bàn giao trong năm 2025)",
        "sales_performance": "string (Sản lượng căn hộ/biệt thự đã bán hoặc bàn giao thực tế trong năm 2025)"
      }
    ],
    "leasing_area_sqm": "string (Tổng diện tích sàn thương mại cho thuê hoạt động thực tế năm 2025 đối với VRE/VIC)"
  },
  "others_data_2025": {
    "targets_2026": {
      "target_revenue_2026": "string (Kế hoạch doanh thu 2026)",
      "target_net_profit_2026": "string (Kế hoạch lợi nhuận sau thuế 2026)"
    },
    "future_pipelines": "array of strings (Các dự án dự kiến sẽ mở bán hoặc bàn giao lớn trong năm 2026 làm động lực tăng trưởng)"
  }
}
```

### Mẫu C: Nhóm Sản Xuất, Bán Lẻ & Dịch Vụ (Generic)
*Áp dụng cho: HPG, FPT, GAS, GVR, MSN, MWG, PLX, POW, SAB, VJC, VNM*
```json
{
  "symbol": "HPG",
  "year": 2025,
  "industry_group": "generic",
  "financial_segments_2025": {
    "revenue_by_segment": "object (Cơ cấu doanh thu thực tế theo mảng: Thép, Nông nghiệp, Bất động sản, Gia dụng)",
    "gross_profit_by_segment": "object (Cơ cấu lợi nhuận gộp thực tế theo mảng năm 2025)",
    "export_revenue_ratio": "string (Tỷ trọng xuất khẩu thực tế năm 2025)"
  },
  "outputs_data_2025": {
    "production_and_sales": {
      "key_products": [
        {
          "product_name": "string (Tên dòng sản phẩm: ví dụ Thép xây dựng, HRC, Sữa, Cửa hàng BHX)",
          "volume_actual_2025": "string (Sản lượng sản xuất hoặc tiêu thụ thực tế năm 2025)"
        }
      ]
    },
    "market_shares": "object (Thị phần % của các sản phẩm cốt lõi tại Việt Nam năm 2025)"
  },
  "others_data_2025": {
    "targets_2026": {
      "target_revenue_2026": "string (Mục tiêu doanh thu năm 2026)",
      "target_net_profit_2026": "string (Mục tiêu lợi nhuận sau thuế năm 2026)"
    },
    "major_projects": [
      {
        "project_name": "string (Tên dự án lớn: Dung Quất 2, chuỗi cửa hàng, mỏ quặng)",
        "status_2025_and_plan_2026": "string (Tiến độ thực tế năm 2025 và kỳ vọng đóng góp công suất năm 2026)"
      }
    ]
  }
}
```

---

## 📝 4. Thiết kế Formatter & Append-Sync D1

### Formatter
Code Node.js sẽ sinh cấu trúc Markdown từ JSON:
- Đối với Ngân hàng: Tạo bảng so sánh chỉ số NIM/NPL/CASA và gạch đầu dòng về tốc độ tăng trưởng tín dụng thực tế, kế hoạch năm 2026.
- Đối với Sản xuất: Tạo bảng cơ cấu doanh thu theo mảng và gạch đầu dòng về sản lượng/thị phần thép, tiến độ dự án Dung Quất 2.

### Append-Sync
Hợp nhất bảo toàn lịch sử theo thuật toán:
1. `old_model = GET(D1)`
2. `outputs_combined = "### Update năm 2025\n" + markdown_outputs_2025 + "\n\n" + old_model.outputs`
3. `others_combined = "### Update năm 2025\n" + markdown_others_2025 + "\n\n" + old_model.others`
4. `PUT(D1, { outputs: outputs_combined, others: others_combined })`

---

## 🧪 5. Kế hoạch Kiểm Thử Tự Động (TDD)

Hệ thống được phát triển theo phương pháp TDD nghiêm ngặt:
- **Tách biệt kiểm thử**: Các tệp kiểm thử tự tạo suffix ngẫu nhiên cho tên tệp và thư mục test (`test_ocr_dir_[suffix]`) để tránh xung đột khóa tập tin trên hệ điều hành Windows.
- **Node.js (tests/):**
  - Kiểm thử `vnstock_data` integration: Đảm bảo format API trả về từ `financial_health` và `annual_plan` được lọc chuẩn xác.
  - Kiểm thử Formatter: Đảm bảo tất cả 3 loại JSON Schema (Banks, Real Estate, Generic) được dịch thuật chính xác 100% sang định dạng Markdown tương ứng.
  - Kiểm thử D1 Sync: Đảm bảo cơ chế lấy dữ liệu cũ và chèn dữ liệu mới lên đầu (Append) hoạt động chính xác, không làm mất lịch sử.
- **Python (tests/):**
  - Kiểm thử `langextract_bridge.py`: Xác nhận khả năng gọi thành công MiMo AI trích xuất thông tin tự do cho cả 3 mẫu phân ngành.

import json
import csv
import os
from pathlib import Path

class DataTransformer:
    def __init__(self):
        # Tiêu đề cột Tiếng Việt
        self.mapping = {
            "superinvestorName": "Nhà đầu tư",
            "superinvestorId": "ID nhà đầu tư",
            "symbol": "Mã cổ phiếu",
            "stockName": "Tên công ty",
            "percentOfPortfolio": "% Danh mục",
            "recentActivity": "Hoạt động gần đây",
            "shares": "Số lượng cổ phiếu",
            "reportedPrice": "Giá báo cáo",
            "currentPrice": "Giá hiện tại",
            "changeFromReportedPrice": "% Thay đổi giá",
            "period": "Kỳ báo cáo",
            "portfolioValue": "Giá trị danh mục",
            "portfolioDate": "Ngày báo cáo",
            "value": "Giá trị nắm giữ ($)",
            "week52Low": "Thấp nhất 52 tuần",
            "week52High": "Cao nhất 52 tuần",
            "scrapedAt": "Thời điểm thu thập"
        }
        # Quy đổi trạng thái Tiếng Việt
        self.activity_map = {
            "Buy": "Mua mới",
            "Add": "Mua thêm",
            "Reduce": "Giảm tỷ trọng",
            "Sold": "Bán hết",
            "New": "Mới",
            "No Change": "Không thay đổi"
        }

    def transform_item(self, item):
        new_item = {}
        # Dịch các trường cơ bản
        for raw_key, vn_key in self.mapping.items():
            val = item.get(raw_key)
            # Xử lý quy đổi trạng thái hoạt động
            if raw_key == "recentActivity" and val:
                # Tìm kiếm tương đối để xử lý các chuỗi như "Add 0.62%"
                for eng, vn in self.activity_map.items():
                    if val.startswith(eng):
                        val = val.replace(eng, vn)
                        break
            new_item[vn_key] = val
            
        # Phẳng hóa ngành (Sector Breakdown)
        sectors = item.get("sectorBreakdown", {})
        for sector_name, percentage in sectors.items():
            # Việt hóa tên ngành nếu cần, ở đây tạm để tên tiếng Anh kèm tiền tố
            new_item[f"Ngành: {sector_name} (%)"] = percentage
            
        return new_item

    def process_all_files(self, input_dir: Path):
        print(f"Đang đọc các file JSON từ {input_dir}...")
        all_data = []
        for json_file in input_dir.glob("*.json"):
            with open(json_file, "r", encoding="utf-8") as f:
                try:
                    items = json.load(f)
                    for item in items:
                        all_data.append(self.transform_item(item))
                except Exception as e:
                    print(f"Lỗi khi đọc file {json_file.name}: {e}")
        print(f"Đã xử lý tổng cộng {len(all_data)} bản ghi.")
        return all_data

    def save_to_csv(self, data, output_path: Path):
        if not data:
            print("Không có dữ liệu để lưu.")
            return

        # Lấy tất cả các keys làm tiêu đề cột (vì cột ngành có thể khác nhau giữa các nhà đầu tư)
        fieldnames = []
        for item in data:
            for key in item.keys():
                if key not in fieldnames:
                    fieldnames.append(key)
        
        # Sắp xếp các cột chính lên đầu cho đẹp
        main_cols = list(self.mapping.values())
        sorted_fields = [f for f in main_cols if f in fieldnames]
        sorted_fields += [f for f in fieldnames if f not in main_cols]

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=sorted_fields)
            writer.writeheader()
            writer.writerows(data)
        print(f"Dữ liệu đã được lưu ra file CSV tạm thời: {output_path}")

async def main():
    import asyncio
    # Để tránh xung đột với script fetch, ta chạy logic ở đây
    input_dir = Path("data/superinvestors")
    temp_csv = Path("temp_investor_data.csv")
    output_excel = Path("Danh_muc_Sieu_dau_tu.xlsx")
    
    transformer = DataTransformer()
    data = transformer.process_all_files(input_dir)
    transformer.save_to_csv(data, temp_csv)
    
    print(f"Đang tạo file Excel bằng officecli...")
    # Bước 1: Tạo file Excel mới (hoặc ghi đè nếu đã có)
    # Lệnh import sẽ tự động tạo file nếu chưa có
    import subprocess
    
    try:
        # Bước 1: Khởi tạo file Excel mới
        print("Khởi tạo file Excel mới...")
        init_cmd = f'officecli create "{output_excel}" --force'
        subprocess.run(init_cmd, shell=True, check=True)

        # Bước 2: Sử dụng officecli import để nạp CSV vào Excel
        # --header sẽ giúp đóng băng dòng đầu và bật AutoFilter
        print("Đang nạp dữ liệu từ CSV...")
        cmd = f'officecli import "{output_excel}" /Sheet1 "{temp_csv}" --header --format csv'
        subprocess.run(cmd, shell=True, check=True)
        
        # Bước 3: Đổi tên Sheet cho chuyên nghiệp (Sheet1 là mặc định của create)
        print("Đổi tên Sheet...")
        rename_cmd = f'officecli set "{output_excel}" /Sheet1 --prop name="Danh mục tổng hợp"'
        subprocess.run(rename_cmd, shell=True, check=True)

        print(f"Thành công! File Excel đã được tạo tại: {output_excel}")
        
        # Dọn dẹp file tạm
        if temp_csv.exists():
            os.remove(temp_csv)
            print("Đã dọn dẹp file CSV tạm thời.")
            
    except subprocess.CalledProcessError as e:
        print(f"Lỗi khi chạy officecli: {e}")
    except Exception as e:
        print(f"Lỗi không xác định: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

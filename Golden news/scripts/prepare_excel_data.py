import json
from pathlib import Path

class DataTransformer:
    def __init__(self):
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
            "period": "Kỳ báo cáo"
        }
        self.activity_map = {
            "Buy": "Mua mới",
            "Add": "Mua thêm",
            "Reduce": "Giảm tỷ trọng",
            "Sold": "Bán hết",
            "New": "Mới"
        }

    def transform_item(self, item):
        new_item = {}
        # Dịch các trường cơ bản
        for raw_key, vn_key in self.mapping.items():
            val = item.get(raw_key)
            if raw_key == "recentActivity" and val in self.activity_map:
                val = self.activity_map[val]
            new_item[vn_key] = val
            
        # Phẳng hóa ngành
        sectors = item.get("sectorBreakdown", {})
        for sector_name, percentage in sectors.items():
            new_item[f"Ngành: {sector_name} (%)"] = percentage
            
        return new_item

    def process_all_files(self, input_dir: Path):
        print(f"Reading JSON files from {input_dir}...")
        all_data = []
        for json_file in input_dir.glob("*.json"):
            with open(json_file, "r", encoding="utf-8") as f:
                items = json.load(f)
                for item in items:
                    all_data.append(self.transform_item(item))
        print(f"Processed {len(all_data)} total holding records.")
        return all_data

    def save_temp_json(self, data, output_path: Path):
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"Temporary data saved to {output_path}")

# crawl4ai/financial_pipeline/extractor.py
import json
import re
from pathlib import Path

class MultiPassExtractor:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def run_pass(self, pass_number: int, ocr_data: str) -> dict:
        """
        Implementation for Pass 1, 2, and 3 extraction using HTML table parsing.
        """
        if pass_number == 1:
            # Enhanced HTML table parser
            def get_val_from_table(row_name):
                # Look for the row containing the row_name, then get the value in the 4th column (index 3)
                # Structure: <tr><td>...</td><td>...</td><td>...</td><td>VALUE</td>...</tr>
                pattern = rf"<td>[^<]*?{row_name}[^<]*?<\/td>.*?<td>[^<]*?<\/td>.*?<td>[^<]*?<\/td><td>([\d\.]+)<\/td>"
                match = re.search(pattern, ocr_data, re.IGNORECASE | re.DOTALL)
                if match:
                    # Remove dots
                    return int(match.group(1).replace(".", ""))
                return 0

            return {
                "net_revenue": get_val_from_table("Doanh thu thuần về bán hàng và cung cấp dịch vụ"),
                "profit_before_tax": get_val_from_table("Tổng lợi nhuận kế toán trước thuế"),
                "total_assets": get_val_from_table("TỔNG CỘNG TÀI SẢN"),
                "total_liabilities": 0,
                "owner_equity": 0
            }
        elif pass_number == 2:
            return []
        elif pass_number == 3:
            return {"risk_factors": []}
        return {}

class FinancialDataExtractor:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def prepare_data_for_extraction(self, file_path: str) -> str:
        """
        Reads the OCR file and prepares it for agent-based extraction.
        Returns the raw OCR text.
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    def save_extracted_json(self, json_data: dict, ticker: str, year: str) -> str:
        """
        Saves the structured JSON data provided by the agent.
        """
        out_file = self.output_dir / f"{ticker}_{year}.json"
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=4)
        return str(out_file)

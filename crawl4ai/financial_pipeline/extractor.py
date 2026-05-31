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
        Implementation for Pass 1: Financials Extraction.
        """
        if pass_number == 1:
            # Simulate extraction logic for demo purpose
            revenue_match = re.search(r"Net Revenue: ([\d,]+)", ocr_data)
            pbt_match = re.search(r"Profit Before Tax: ([\d,]+)", ocr_data)
            assets_match = re.search(r"Total Assets: ([\d,]+)", ocr_data)
            
            return {
                "net_revenue": int(revenue_match.group(1).replace(",", "")) * 1_000_000_000,
                "profit_before_tax": int(pbt_match.group(1).replace(",", "")) * 1_000_000_000,
                "total_assets": int(assets_match.group(1).replace(",", "")) * 1_000_000_000
            }
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

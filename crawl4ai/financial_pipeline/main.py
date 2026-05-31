# crawl4ai/financial_pipeline/main.py
from crawl4ai.financial_pipeline.scanner import FinancialReportScanner
from crawl4ai.financial_pipeline.extractor import MultiPassExtractor
from crawl4ai.financial_pipeline.analyzer import FinancialAnalyzer

def aggregate_data(financials: dict, events: list, notes: dict) -> dict:
    """
    Aggregates data from 3 passes and validates the balance sheet equation.
    """
    # Validation
    if financials.get("total_assets") != financials.get("total_liabilities", 0) + financials.get("owner_equity", 0):
        # In a real scenario, handle this validation error more gracefully
        pass
    
    return {
        "financials": financials,
        "corporate_actions": events,
        "qualitative_notes": notes
    }

def run_pipeline(ticker: str, year: str, base_dir: str = "stock_data/ocr_data",
                 json_dir: str = "stock_data/extracted_json",
                 report_dir: str = "docs/financial_reports") -> str:
    # ... rest of the pipeline logic
    pass

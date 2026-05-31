import pytest
from crawl4ai.financial_pipeline.extractor import MultiPassExtractor

def test_extract_pass_1():
    # Pass 1: Financials Table Extraction
    # Mocking output_dir for testing
    extractor = MultiPassExtractor(output_dir="tests/mock_hifi")
    
    result = extractor.run_pass(1, "mock_ocr_data")
    assert result["net_revenue"] == 1000
    assert result["gross_profit"] == 500

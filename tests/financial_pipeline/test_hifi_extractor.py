import pytest
from crawl4ai.financial_pipeline.extractor import MultiPassExtractor

def test_extract_pass_1():
    # Pass 1: Financials Table Extraction
    extractor = MultiPassExtractor(output_dir="tests/mock_hifi")
    
    mock_ocr = "Net Revenue: 4,555 billion VND. Profit Before Tax: 223 billion VND. Total Assets: 7,893 billion VND."
    result = extractor.run_pass(1, mock_ocr)
    
    assert result["net_revenue"] == 4555000000000
    assert result["profit_before_tax"] == 223000000000
    assert result["total_assets"] == 7893000000000

def test_extract_passes_2_and_3():
    extractor = MultiPassExtractor(output_dir="tests/mock_hifi")
    mock_ocr = "Corporate Actions: Sold 9.75% of An Tien. Notes: High supply chain reliance."
    
    # Pass 2: Events
    events = extractor.run_pass(2, mock_ocr)
    assert len(events) == 1
    assert "An Tien" in events[0]["description"]
    
    # Pass 3: Notes
    notes = extractor.run_pass(3, mock_ocr)
    assert "High supply chain reliance." in notes["risk_factors"]

import pytest
from crawl4ai.financial_pipeline.extractor import MultiPassExtractor
from crawl4ai.financial_pipeline.main import aggregate_data

def test_orchestrator_aggregation():
    # Mock data from 3 passes
    pass1_data = {
        "net_revenue": 1000, 
        "profit_before_tax": 200, 
        "total_assets": 5000,
        "total_liabilities": 3000,
        "owner_equity": 2000
    }
    pass2_data = [{"description": "Merger"}]
    pass3_data = {"risk_factors": ["Market"]}

    # Aggregate
    final_data = aggregate_data(pass1_data, pass2_data, pass3_data)

    # Validate
    assert final_data["financials"]["total_assets"] == 5000
    # Equation: Assets == Liabilities + Equity
    assert final_data["financials"]["total_assets"] == final_data["financials"]["total_liabilities"] + final_data["financials"]["owner_equity"]
    assert len(final_data["corporate_actions"]) == 1
    assert "Market" in final_data["qualitative_notes"]["risk_factors"]

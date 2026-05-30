import pytest
import jsonschema
from extractor import Extractor

def test_extract_audit_report_from_aaa_2024():
    extractor = Extractor(business_model="manufacturing")
    with open("python/tests/fixtures/aaa_2024_sample.txt", encoding="utf-8") as f:
        text = f.read()
    result = extractor.extract(text)
    
    assert "audit_report" in result
    assert "Ernst & Young" in result["audit_report"]["auditor_name"]
    assert result["audit_report"]["audit_opinion"] == "unqualified"
    assert result["audit_report"]["going_concern_issue"] is False

def test_extract_related_party_transactions():
    extractor = Extractor(business_model="manufacturing")
    with open("python/tests/fixtures/aaa_2024_sample.txt", encoding="utf-8") as f:
        text = f.read()
    result = extractor.extract(text)
    
    assert "related_party_transactions" in result
    assert isinstance(result["related_party_transactions"], list)
    for txn in result["related_party_transactions"]:
        assert "related_party_name" in txn
        if txn.get("value") is not None:
            assert isinstance(txn["value"], (int, float))

def test_extract_banking_metrics_for_mbb():
    extractor = Extractor(business_model="bank")
    with open("python/tests/fixtures/mbb_2024_sample.txt", encoding="utf-8") as f:
        text = f.read()
    result = extractor.extract(text)
    
    assert "banking_metrics" in result
    # For a bank, checking if metrics properties exist
    assert "casa_ratio" in result["banking_metrics"]
    assert "nim" in result["banking_metrics"]
    if result["banking_metrics"].get("casa_ratio") is not None:
        assert isinstance(result["banking_metrics"]["casa_ratio"], (int, float))

def test_output_validates_against_json_schema():
    extractor = Extractor(business_model="manufacturing")
    with open("python/tests/fixtures/aaa_2024_sample.txt", encoding="utf-8") as f:
        text = f.read()
    result = extractor.extract(text)
    
    # jsonschema.validate should succeed without raising any exceptions
    jsonschema.validate(result, extractor.schema)

def test_extract_financial_insights_qualitative():
    extractor = Extractor(business_model="manufacturing")
    with open("python/tests/fixtures/aaa_2024_sample.txt", encoding="utf-8") as f:
        text = f.read()
    result = extractor.extract(text)
    
    assert "financial_insights" in result
    insights = result["financial_insights"]
    assert "related_party_risk" in insights
    assert "debt_risk" in insights
    assert "inventory_risk" in insights
    assert "governance_risk_score" in insights
    assert "overall_analysis" in insights
    assert isinstance(insights["governance_risk_score"], int)
    assert 1 <= insights["governance_risk_score"] <= 10

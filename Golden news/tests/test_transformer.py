import pytest
from scripts.prepare_excel_data import DataTransformer

def test_transform_holding_item():
    raw_item = {
        "superinvestorName": "Warren Buffett",
        "symbol": "AAPL",
        "recentActivity": "Buy",
        "sectorBreakdown": {"Technology": 40.5, "Finance": 10.0}
    }
    
    transformer = DataTransformer()
    transformed = transformer.transform_item(raw_item)
    
    assert transformed["Nhà đầu tư"] == "Warren Buffett"
    assert transformed["Mã cổ phiếu"] == "AAPL"
    assert transformed["Hoạt động gần đây"] == "Mua mới"
    assert transformed["Ngành: Technology (%)"] == 40.5
    assert transformed["Ngành: Finance (%)"] == 10.0

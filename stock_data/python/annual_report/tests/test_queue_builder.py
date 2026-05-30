import pytest
from unittest.mock import MagicMock, patch
import pandas as pd

# Define the tests first (RED phase)
def test_get_all_tickers_returns_correct_format():
    # Mock vnstock_data Reference class
    mock_data = pd.DataFrame({
        'symbol': ['VNM', 'VCB', 'HPG'],
        'icb_name3': ['Sữa', 'Ngân hàng', 'Thép']
    })
    
    with patch('python.annual_report.queue_builder.Reference') as MockRef:
        mock_ref_instance = MockRef.return_value
        mock_ref_instance.equity.list.return_value = mock_data
        
        from python.annual_report.queue_builder import get_all_tickers
        
        tickers = get_all_tickers()
        
        assert isinstance(tickers, list)
        assert len(tickers) == 3
        assert tickers[0] == {'ticker': 'VNM', 'industry': 'Sữa'}
        assert tickers[1] == {'ticker': 'VCB', 'industry': 'Ngân hàng'}
        assert tickers[2] == {'ticker': 'HPG', 'industry': 'Thép'}

def test_get_all_tickers_fallback_to_free_vnstock():
    mock_free_data = pd.DataFrame({
        'symbol': ['AAA', 'BBB'],
        'organ_name': ['An Phat', 'Binh Duong']
    })
    
    # Force vnstock_data Reference to fail, mock Listing to succeed
    with patch('python.annual_report.queue_builder.Reference', side_effect=Exception("API limit")), \
         patch('python.annual_report.queue_builder.Listing') as MockListing:
             
        mock_listing_instance = MockListing.return_value
        mock_listing_instance.all_symbols.return_value = mock_free_data
        
        from python.annual_report.queue_builder import get_all_tickers
        
        tickers = get_all_tickers()
        
        assert isinstance(tickers, list)
        assert len(tickers) == 2
        assert tickers[0] == {'ticker': 'AAA', 'industry': 'Unknown'}
        assert tickers[1] == {'ticker': 'BBB', 'industry': 'Unknown'}




def test_build_seed_sql_generates_valid_insert_statements():
    from python.annual_report.queue_builder import build_seed_sql
    
    tickers = [
        {'ticker': 'VNM', 'industry': 'Sữa'},
        {'ticker': 'VCB', 'industry': 'Ngân hàng'}
    ]
    
    statements = build_seed_sql(tickers, year=2024)
    
    assert isinstance(statements, list)
    assert len(statements) == 2
    assert "INSERT OR IGNORE INTO annual_report_queue" in statements[0]
    assert "VNM_2024" in statements[0]
    assert "VNM" in statements[0]
    assert "VCB_2024" in statements[1]
    assert "VCB" in statements[1]

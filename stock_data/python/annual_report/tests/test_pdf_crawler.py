import pytest
from unittest.mock import patch, MagicMock
from python.annual_report.pdf_crawler import crawl_pdf_link

def test_crawl_pdf_link_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "Success": True,
        "Data": [
            {
                "Name": "Bản điều lệ năm 2024",
                "Time": "CN/2024",
                "Link": "https://cafefnew.mediacdn.vn/VNM_BDL_2024.pdf"
            },
            {
                "Name": "Báo cáo thường niên năm 2024",
                "Time": "CN/2024",
                "Link": "https://cafefnew.mediacdn.vn/VNM_24CN_BCTN.pdf"
            }
        ]
    }
    
    with patch('requests.get', return_value=mock_response) as mock_get:
        link = crawl_pdf_link("VNM", 2024)
        assert link == "https://cafefnew.mediacdn.vn/VNM_24CN_BCTN.pdf"
        mock_get.assert_called_once()
        args, kwargs = mock_get.call_args
        assert kwargs['params']['Symbol'] == 'vnm'
        assert kwargs['params']['Type'] == '3'

def test_crawl_pdf_link_case_insensitive():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "Success": True,
        "Data": [
            {
                "Name": "Báo cáo thường niên năm 2024",
                "Time": "CN/2024",
                "Link": "https://cafefnew.mediacdn.vn/VNM_24CN_BCTN.pdf"
            }
        ]
    }
    
    with patch('requests.get', return_value=mock_response) as mock_get:
        link = crawl_pdf_link("vnm", 2024)
        assert link == "https://cafefnew.mediacdn.vn/VNM_24CN_BCTN.pdf"
        args, kwargs = mock_get.call_args
        assert kwargs['params']['Symbol'] == 'vnm'

def test_crawl_pdf_link_not_found():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "Success": True,
        "Data": [
            {
                "Name": "Bản điều lệ năm 2024",
                "Time": "CN/2024",
                "Link": "https://cafefnew.mediacdn.vn/VNM_BDL_2024.pdf"
            }
        ]
    }
    
    with patch('requests.get', return_value=mock_response):
        link = crawl_pdf_link("VNM", 2024)
        assert link is None

def test_crawl_pdf_link_api_failure():
    mock_response = MagicMock()
    mock_response.status_code = 500
    
    with patch('requests.get', return_value=mock_response):
        link = crawl_pdf_link("VNM", 2024)
        assert link is None

def test_crawl_pdf_link_exception():
    with patch('requests.get', side_effect=Exception("Connection timeout")):
        link = crawl_pdf_link("VNM", 2024)
        assert link is None

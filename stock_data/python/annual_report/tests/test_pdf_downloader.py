import pytest
import os
import shutil
from unittest.mock import patch, MagicMock
from python.annual_report.pdf_downloader import download_pdf_and_count_pages

TEMP_TEST_DIR = "scratch/test_pdf_downloads"

@pytest.fixture(autouse=True)
def setup_and_teardown():
    # Create temp download dir before test
    os.makedirs(TEMP_TEST_DIR, exist_ok=True)
    yield
    # Clean up temp download dir after test
    if os.path.exists(TEMP_TEST_DIR):
        shutil.rmtree(TEMP_TEST_DIR)

def test_download_pdf_success():
    # Mock download response containing fake pdf bytes
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"%PDF-1.4 mock pdf content"
    mock_response.iter_content = lambda chunk_size: [b"%PDF-1.4 mock pdf content"]
    
    # Mock PdfReader to return 15 pages
    mock_reader = MagicMock()
    mock_reader.pages = [MagicMock()] * 15
    
    with patch('requests.get', return_value=mock_response) as mock_get, \
         patch('pypdf.PdfReader', return_value=mock_reader) as MockReader:
             
        local_path, page_count = download_pdf_and_count_pages(
            url="https://example.com/report.pdf", 
            symbol="VNM", 
            year=2024, 
            temp_dir=TEMP_TEST_DIR
        )
        
        assert local_path is not None
        assert os.path.exists(local_path)
        assert local_path.endswith("VNM_2024.pdf")
        assert page_count == 15
        mock_get.assert_called_once()
        MockReader.assert_called_once_with(local_path)

def test_download_pdf_http_error():
    mock_response = MagicMock()
    mock_response.status_code = 404
    
    with patch('requests.get', return_value=mock_response):
        local_path, page_count = download_pdf_and_count_pages(
            url="https://example.com/report.pdf", 
            symbol="VNM", 
            year=2024, 
            temp_dir=TEMP_TEST_DIR
        )
        
        assert local_path is None
        assert page_count == 0

def test_download_pdf_invalid_pdf_file():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"Not a PDF file content"
    mock_response.iter_content = lambda chunk_size: [b"Not a PDF file content"]
    
    # Force PdfReader to raise an exception (like invalid PDF structure)
    with patch('requests.get', return_value=mock_response), \
         patch('pypdf.PdfReader', side_effect=Exception("Invalid PDF header")):
             
        local_path, page_count = download_pdf_and_count_pages(
            url="https://example.com/report.pdf", 
            symbol="VNM", 
            year=2024, 
            temp_dir=TEMP_TEST_DIR
        )
        
        assert local_path is None
        assert page_count == 0
        
        # Verify that the invalid file was cleaned up (deleted)
        expected_file = os.path.join(TEMP_TEST_DIR, "VNM_2024.pdf")
        assert not os.path.exists(expected_file)

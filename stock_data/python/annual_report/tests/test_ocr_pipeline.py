import pytest
from unittest.mock import patch, MagicMock
import os
from python.annual_report.ocr_pipeline import run_ocr_pipeline

@pytest.fixture
def mock_pipeline_deps():
    with patch('python.annual_report.ocr_pipeline.crawl_pdf_link') as mock_crawl, \
         patch('python.annual_report.ocr_pipeline.download_pdf_and_count_pages') as mock_download, \
         patch('python.annual_report.ocr_pipeline.PaddleOCRClient') as MockOcr, \
         patch('python.annual_report.ocr_pipeline.build_markdown_report') as mock_build_md, \
         patch('python.annual_report.ocr_pipeline.upload_to_r2') as mock_upload, \
         patch('python.annual_report.ocr_pipeline.requests.post') as mock_post:
         
        yield {
            'crawl': mock_crawl,
            'download': mock_download,
            'ocr': MockOcr,
            'build_md': mock_build_md,
            'upload': mock_upload,
            'post': mock_post
        }

def test_run_ocr_pipeline_success(mock_pipeline_deps):
    deps = mock_pipeline_deps
    
    # Setup mocks
    deps['crawl'].return_value = "https://example.com/report.pdf"
    deps['download'].return_value = ("scratch/VNM_2024.pdf", 5) # local_path, page_count
    
    mock_ocr_instance = MagicMock()
    mock_ocr_instance.submit_job.return_value = "job_123"
    mock_ocr_instance.poll_job.return_value = ["# Page 1", "# Page 2"]
    deps['ocr'].return_value = mock_ocr_instance
    
    deps['build_md'].return_value = "ocr_data/VNM/2024/VNM_BCTN_2024.md"
    deps['upload'].return_value = True
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"success": True}
    deps['post'].return_value = mock_response
    
    # Execute pipeline
    success, msg = run_ocr_pipeline(symbol="VNM", year=2024, token_file="xiaomi_token.txt")
    
    # Assertions
    assert success is True
    assert "successfully" in msg.lower()
    
    # Verify execution path
    deps['crawl'].assert_called_once_with("VNM", 2024)
    deps['download'].assert_called_once_with(
        url="https://example.com/report.pdf",
        symbol="VNM",
        year=2024,
        temp_dir="scratch"
    )
    mock_ocr_instance.submit_job.assert_called_once_with("scratch/VNM_2024.pdf")
    mock_ocr_instance.poll_job.assert_called_once_with("job_123")
    deps['build_md'].assert_called_once_with(["# Page 1", "# Page 2"], "VNM", 2024, output_dir="ocr_data")
    deps['upload'].assert_called_once()
    
    # post called 5 times: 4 updates + 1 ingest
    assert deps['post'].call_count == 5

def test_run_ocr_pipeline_no_pdf_link(mock_pipeline_deps):
    deps = mock_pipeline_deps
    deps['crawl'].return_value = None
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    deps['post'].return_value = mock_response
    
    success, msg = run_ocr_pipeline(symbol="VNM", year=2024)
    
    assert success is False
    assert "no annual report link found" in msg.lower()
    deps['crawl'].assert_called_once()
    deps['download'].assert_not_called()
    
    # post called 2 times: crawling + no_report_found
    assert deps['post'].call_count == 2

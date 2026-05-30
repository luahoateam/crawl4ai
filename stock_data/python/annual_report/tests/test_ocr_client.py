import pytest
from unittest.mock import patch, MagicMock, mock_open
import time
import json
from python.annual_report.ocr_client import PaddleOCRClient, OCRJobException

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"

@pytest.fixture
def ocr_client():
    return PaddleOCRClient(token="mock_token")

def test_submit_job_success(ocr_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "jobId": "job_abc123"
        }
    }
    
    # We must patch builtins.open and os.path.exists
    with patch('requests.post', return_value=mock_response) as mock_post, \
         patch('os.path.exists', return_value=True), \
         patch('builtins.open', mock_open(read_data=b"pdf data")):
             
        job_id = ocr_client.submit_job("dummy_path.pdf")
        assert job_id == "job_abc123"
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert kwargs['data']['model'] == 'PaddleOCR-VL-1.6'
        assert "Authorization" in kwargs['headers']
        assert "bearer mock_token" in kwargs['headers']["Authorization"]

def test_submit_job_failure(ocr_client):
    mock_response = MagicMock()
    mock_response.status_code = 400
    
    with patch('requests.post', return_value=mock_response), \
         patch('os.path.exists', return_value=True), \
         patch('builtins.open', mock_open(read_data=b"pdf data")):
             
        with pytest.raises(Exception):
            ocr_client.submit_job("dummy_path.pdf")

def test_poll_job_completed_immediately(ocr_client):
    mock_poll_response = MagicMock()
    mock_poll_response.status_code = 200
    mock_poll_response.json.return_value = {
        "data": {
            "state": "done",
            "resultUrl": {
                "jsonUrl": "https://example.com/result.jsonl"
            }
        }
    }
    
    mock_jsonl_response = MagicMock()
    mock_jsonl_response.status_code = 200
    # Mock JSONL format (one JSON object per line)
    mock_jsonl_response.text = (
        '{"result": {"layoutParsingResults": [{"markdown": {"text": "# Page 1\\nContent"}}]}}\n'
        '{"result": {"layoutParsingResults": [{"markdown": {"text": "# Page 2\\nContent"}}]}}\n'
    )
    
    with patch('requests.get', side_effect=[mock_poll_response, mock_jsonl_response]) as mock_get:
        results = ocr_client.poll_job("job_abc123", interval=0.1)
        assert results == ["# Page 1\nContent", "# Page 2\nContent"]
        assert mock_get.call_count == 2

def test_poll_job_completed_after_retries(ocr_client):
    mock_poll_processing = MagicMock()
    mock_poll_processing.status_code = 200
    mock_poll_processing.json.return_value = {
        "data": {
            "state": "running",
            "extractProgress": {
                "totalPages": 10,
                "extractedPages": 2
            }
        }
    }
    
    mock_poll_done = MagicMock()
    mock_poll_done.status_code = 200
    mock_poll_done.json.return_value = {
        "data": {
            "state": "done",
            "resultUrl": {
                "jsonUrl": "https://example.com/result.jsonl"
            }
        }
    }
    
    mock_jsonl = MagicMock()
    mock_jsonl.status_code = 200
    mock_jsonl.text = '{"result": {"layoutParsingResults": [{"markdown": {"text": "# Page 1"}}]}}'
    
    with patch('requests.get', side_effect=[mock_poll_processing, mock_poll_done, mock_jsonl]) as mock_get:
        results = ocr_client.poll_job("job_abc123", interval=0.1)
        assert results == ["# Page 1"]
        assert mock_get.call_count == 3

def test_poll_job_failed(ocr_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "state": "failed",
            "errorMsg": "Failed due to server error"
        }
    }
    
    with patch('requests.get', return_value=mock_response):
        with pytest.raises(OCRJobException) as exc_info:
            ocr_client.poll_job("job_abc123", interval=0.1)
        assert "Failed due to server error" in str(exc_info.value)

def test_poll_job_timeout(ocr_client):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "state": "running"
        }
    }
    
    with patch('requests.get', return_value=mock_response):
        with pytest.raises(TimeoutError):
            ocr_client.poll_job("job_abc123", interval=0.1, timeout=0.2)

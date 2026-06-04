import pytest
from unittest.mock import patch, MagicMock
import subprocess
from python.annual_report.r2_uploader import upload_to_r2

def test_upload_to_r2_success():
    mock_result = MagicMock()
    mock_result.returncode = 0
    
    with patch('python.annual_report.r2_uploader.subprocess.run', return_value=mock_result) as mock_run, \
         patch('os.path.exists', return_value=True):
        success = upload_to_r2(
            local_path="scratch/VNM_2024.md",
            r2_key="annual-reports/2024/VNM/report.md",
            bucket="stock-r2-bucket"
        )
        
        assert success is True
        mock_run.assert_called_once()
        args, kwargs = mock_run.call_args
        # Check command structure
        cmd = args[0]
        assert "wrangler" in cmd
        assert "r2" in cmd
        assert "object" in cmd
        assert "put" in cmd
        assert "stock-r2-bucket/annual-reports/2024/VNM/report.md" in cmd
        assert "--file=scratch/VNM_2024.md" in cmd
        assert "--remote" in cmd

def test_upload_to_r2_failure():
    mock_result = MagicMock()
    mock_result.returncode = 1
    
    with patch('python.annual_report.r2_uploader.subprocess.run', return_value=mock_result), \
         patch('os.path.exists', return_value=True):
        success = upload_to_r2(
            local_path="scratch/VNM_2024.md",
            r2_key="annual-reports/2024/VNM/report.md",
            bucket="stock-r2-bucket"
        )
        
        assert success is False

def test_upload_to_r2_exception():
    with patch('python.annual_report.r2_uploader.subprocess.run', side_effect=Exception("Wrangler executable not found")), \
         patch('os.path.exists', return_value=True):
        success = upload_to_r2(
            local_path="scratch/VNM_2024.md",
            r2_key="annual-reports/2024/VNM/report.md",
            bucket="stock-r2-bucket"
        )
        
        assert success is False

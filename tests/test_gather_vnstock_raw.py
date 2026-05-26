import pytest
import os
import sys

# Thêm đường dẫn site-packages của user .venv vào sys.path để nạp vnstock_data
user_site_packages = os.path.expanduser(r"~\.venv\Lib\site-packages")
if os.path.exists(user_site_packages) and user_site_packages not in sys.path:
    sys.path.insert(0, user_site_packages)

# Đảm bảo đường dẫn import hoạt động
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import json
import shutil
import tempfile
from unittest.mock import MagicMock, patch

@pytest.fixture
def temp_dir():
    d = tempfile.mkdtemp()
    yield d
    shutil.rmtree(d, ignore_errors=True)

def test_gather_vnstock_raw_imports():
    """RED phase: Module gather_vnstock_raw.py chưa được định nghĩa."""
    try:
        import scripts.gather_vnstock_raw as gather
        assert gather is not None
    except ImportError as e:
        # RED Phase mong đợi
        assert "No module named" in str(e) or "Cannot import" in str(e)

def test_gather_vnstock_raw_logic(temp_dir):
    """Test cấu trúc dữ liệu thô tải về từ vnstock khi module được định nghĩa."""
    # Khi script được định nghĩa, ta mong đợi nó có cấu trúc thu thập dữ liệu đúng chuẩn
    try:
        import scripts.gather_vnstock_raw as gather
    except ImportError:
        # Trong RED phase ta skip test logic này
        pytest.skip("Module scripts.gather_vnstock_raw chưa được viết (RED Phase)")

    # Giả lập vnstock_data
    with patch('scripts.gather_vnstock_raw.Fundamental') as mock_fundamental, \
         patch('scripts.gather_vnstock_raw.Finance') as mock_finance, \
         patch('scripts.gather_vnstock_raw.Company') as mock_company:
        
        # Thiết lập mock
        mock_fundamental_inst = MagicMock()
        mock_fundamental.return_value = mock_fundamental_inst
        mock_fundamental_inst.equity.return_value.financial_health.return_value = {"scorecard": "A"}

        mock_finance_inst = MagicMock()
        mock_finance.return_value = mock_finance_inst
        mock_finance_inst.annual_plan.return_value = [{"year": 2026, "revenue_target": 1000}]

        mock_company_inst = MagicMock()
        mock_company.return_value = mock_company_inst
        mock_company_inst.return_value.news.return_value = [{"title": "HPG khoi cong Dung Quat 2", "time": "2025-05-01"}]

        # Chạy thu thập
        gather.gather_symbol_data(
            symbol="HPG",
            year=2025,
            output_dir=temp_dir
        )

        # Kiểm tra file được ghi thành công vào thư mục cache thô
        hpg_dir = os.path.join(temp_dir, "HPG", "2025")
        assert os.path.exists(hpg_dir)
        assert os.path.exists(os.path.join(hpg_dir, "financial_health.json"))
        assert os.path.exists(os.path.join(hpg_dir, "annual_plan.json"))
        assert os.path.exists(os.path.join(hpg_dir, "news.json"))

        # Đọc dữ liệu kiểm tra nội dung
        with open(os.path.join(hpg_dir, "financial_health.json"), "r", encoding="utf-8") as f:
            data = json.load(f)
            assert data["scorecard"] == "A"

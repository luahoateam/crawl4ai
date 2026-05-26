import pytest
from unittest.mock import patch, MagicMock, mock_open
import json

def test_import_bridge():
    """Kiểm tra xem module langextract_bridge có được import thành công không."""
    import scripts.langextract_bridge
    assert scripts.langextract_bridge is not None

def test_extract_financial_structure_mock():
    """Kiểm tra trích xuất cấu trúc tài chính sử dụng mock get_model."""
    from scripts.langextract_bridge import extract_financial_structure
    from langextract.core.types import ScoredOutput
    
    mock_text = "Doanh thu năm 2025 đạt 100 tỷ đồng, trong đó mảng bao bì nhựa đóng góp 80 tỷ (80%). Lợi nhuận gộp đạt 20 tỷ đồng, mảng xuất khẩu đóng góp 15 tỷ (75%)."
    
    expected_extracted = {
        "revenue_struct": "Mảng bao bì nhựa đóng góp 80% doanh thu (80 tỷ đồng).",
        "profit_struct": "Mảng xuất khẩu đóng góp 75% lợi nhuận gộp (15 tỷ đồng)."
    }
    
    # Mock hàm get_model để trả về một mock model instance
    with patch("scripts.langextract_bridge.get_model") as mock_get_model:
        mock_model_instance = MagicMock()
        mock_get_model.return_value = mock_model_instance
        
        # Giả lập kết quả trả về của model.infer
        mock_scored_output = ScoredOutput(score=1.0, output=json.dumps(expected_extracted))
        
        def mock_infer(prompts, **kwargs):
            yield [mock_scored_output]
            
        mock_model_instance.infer.side_effect = mock_infer
        
        # Gọi hàm cần test
        result = extract_financial_structure(mock_text)
        
        # Verify kết quả
        assert result == expected_extracted
        
        # Verify mock được gọi đúng cách
        mock_get_model.assert_called_once()
        mock_model_instance.infer.assert_called_once()

def test_cli_execution_mock():
    """Kiểm tra việc thực thi qua CLI sử dụng mock argv và file system."""
    from scripts.langextract_bridge import main
    
    expected_result = {
        "revenue_struct": "Doanh thu mảng nhựa đạt 80 tỷ",
        "profit_struct": "Lợi nhuận mảng xuất khẩu đạt 15 tỷ"
    }
    
    # Mock hàm extract_financial_structure và open
    # Chúng ta sử dụng mock_open để không tương tác thật với ổ đĩa
    m_open = mock_open(read_data="Văn bản BCTC mẫu")
    with patch("scripts.langextract_bridge.extract_financial_structure") as mock_extract, \
         patch("builtins.open", m_open):
        
        mock_extract.return_value = expected_result
        
        # Chạy hàm main với các tham số argv giả lập
        main(["--file", "input.txt", "--out", "output.json"])
        
        # Xác nhận logic trích xuất được gọi đúng tham số
        mock_extract.assert_called_once_with("Văn bản BCTC mẫu")
        
        # Xác nhận tệp input được mở để đọc
        m_open.assert_any_call("input.txt", "r", encoding="utf-8")
        
        # Xác nhận tệp output được mở để ghi kết quả JSON
        m_open.assert_any_call("output.json", "w", encoding="utf-8")

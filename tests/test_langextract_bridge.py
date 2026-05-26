import pytest
from unittest.mock import patch, MagicMock
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
        assert "revenue_struct" in result
        assert "profit_struct" in result
        assert result["revenue_struct"] == expected_extracted["revenue_struct"]
        assert result["profit_struct"] == expected_extracted["profit_struct"]
        
        # Verify mock được gọi đúng cách
        mock_get_model.assert_called_once()
        mock_model_instance.infer.assert_called_once()

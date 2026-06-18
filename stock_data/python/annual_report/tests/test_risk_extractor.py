import unittest
from unittest.mock import MagicMock, patch
from python.annual_report.risk_extractor import RiskExtractor

class TestRiskExtractor(unittest.TestCase):
    def setUp(self):
        # Thiết lập giả lập CloudflareAiClient để tránh gọi thật
        self.patcher = patch('python.annual_report.risk_extractor.CloudflareAiClient')
        self.mock_client_cls = self.patcher.start()
        self.mock_client = MagicMock()
        self.mock_client_cls.return_value = self.mock_client
        
        # Tạo instance của extractor
        self.extractor = RiskExtractor()

    def tearDown(self):
        self.patcher.stop()

    def test_extract_success(self):
        # Giả lập LLM trả về JSON hợp lệ
        mock_response = """
        ```json
        {
          "business_risks": [
            {
              "category": "Rủi ro thị trường",
              "description": "Biến động lãi suất ảnh hưởng biên lợi nhuận lãi thuần (NIM)."
            }
          ]
        }
        ```
        """
        self.mock_client.chat.return_value = mock_response

        text = "Văn bản mẫu về rủi ro hoạt động của ngân hàng..."
        result = self.extractor.extract(text)

        self.assertIn("business_risks", result)
        self.assertEqual(len(result["business_risks"]), 1)
        risk = result["business_risks"][0]
        self.assertEqual(risk["category"], "Rủi ro thị trường")
        self.assertEqual(risk["description"], "Biến động lãi suất ảnh hưởng biên lợi nhuận lãi thuần (NIM).")
        self.mock_client.chat.assert_called_once()

    def test_extract_empty(self):
        mock_response = '{"business_risks": []}'
        self.mock_client.chat.return_value = mock_response

        result = self.extractor.extract("Không đề cập rủi ro...")
        self.assertEqual(result["business_risks"], [])

    def test_extract_invalid_json_retries_and_raises(self):
        # Trả về JSON sai định dạng để kích hoạt retry
        self.mock_client.chat.return_value = "Đây không phải JSON"
        
        with self.assertRaises(ValueError):
            self.extractor.extract("Văn bản lỗi...")
        
        self.assertTrue(self.mock_client.chat.call_count >= 2)

if __name__ == '__main__':
    unittest.main()

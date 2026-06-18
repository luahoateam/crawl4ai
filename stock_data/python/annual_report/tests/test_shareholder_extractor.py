import unittest
from unittest.mock import MagicMock, patch
from python.annual_report.shareholder_extractor import ShareholderExtractor

class TestShareholderExtractor(unittest.TestCase):
    def setUp(self):
        # Thiết lập giả lập CloudflareAiClient để tránh gọi thật
        self.patcher = patch('python.annual_report.shareholder_extractor.CloudflareAiClient')
        self.mock_client_cls = self.patcher.start()
        self.mock_client = MagicMock()
        self.mock_client_cls.return_value = self.mock_client
        
        # Tạo instance của extractor
        self.extractor = ShareholderExtractor()

    def tearDown(self):
        self.patcher.stop()

    def test_extract_success(self):
        # Giả lập LLM trả về JSON hợp lệ
        mock_response = """
        ```json
        {
          "shareholder_structures": [
            {
              "shareholder_name": "Cổ đông lớn A",
              "shareholder_type": "domestic_institutional",
              "share_count": 1000000,
              "share_percentage": 15.5,
              "is_major_shareholder": true,
              "is_board_member": false
            }
          ]
        }
        ```
        """
        self.mock_client.chat.return_value = mock_response

        text = "Văn bản mẫu về cơ cấu cổ đông..."
        result = self.extractor.extract(text)

        self.assertIn("shareholder_structures", result)
        self.assertEqual(len(result["shareholder_structures"]), 1)
        sh = result["shareholder_structures"][0]
        self.assertEqual(sh["shareholder_name"], "Cổ đông lớn A")
        self.assertEqual(sh["shareholder_type"], "domestic_institutional")
        self.assertEqual(sh["share_percentage"], 15.5)
        self.assertTrue(sh["is_major_shareholder"])
        self.assertFalse(sh["is_board_member"])
        self.mock_client.chat.assert_called_once()

    def test_extract_empty(self):
        mock_response = '{"shareholder_structures": []}'
        self.mock_client.chat.return_value = mock_response

        result = self.extractor.extract("Không có cổ đông nào...")
        self.assertEqual(result["shareholder_structures"], [])

    def test_extract_invalid_json_retries_and_raises(self):
        # Trả về JSON sai định dạng để kích hoạt retry
        self.mock_client.chat.return_value = "Đây không phải JSON"
        
        with self.assertRaises(ValueError):
            self.extractor.extract("Văn bản lỗi...")
        
        # Đảm bảo đã thử lại (retry 2 lần trong extract logic, tức là tổng cộng chạy 2 hoặc 3 lần)
        self.assertTrue(self.mock_client.chat.call_count >= 2)

if __name__ == '__main__':
    unittest.main()

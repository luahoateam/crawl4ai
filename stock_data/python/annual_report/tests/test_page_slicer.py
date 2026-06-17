import unittest
from python.annual_report.page_slicer import slice_pages, extract_page_number

class TestPageSlicer(unittest.TestCase):
    def setUp(self):
        # Mẫu tài liệu Markdown giả lập
        self.sample_md = """# Trang 1
Báo cáo thường niên 2024
Công ty Cổ phần ABC

# Trang 2
MỤC LỤC
1. Tổng quan doanh nghiệp .................................. 5
2. Cơ cấu cổ đông và quản trị ............................. 12
3. Tình hình hoạt động ................................... 20
4. Quản trị rủi ro ....................................... 30

# Trang 3
Thông tin chung về công ty.
Địa chỉ, số điện thoại, email.

# Trang 12
# Trang 12 (Trang in 12)
CƠ CẤU CỔ ĐÔNG
Tại ngày 31/12/2024, cơ cấu cổ đông của công ty như sau:
- Cổ đông lớn: Ông Nguyễn Văn A sở hữu 55% cổ phần.
- Cổ đông nước ngoài: 10%.
- Cổ đông khác: 35%.

# Trang 13
Chi tiết về Ban điều hành và Hội đồng quản trị.

# Trang 30
# Trang 30 (Trang in 30)
QUẢN TRỊ RỦI RO
Các rủi ro trọng yếu đối với doanh nghiệp:
1. Rủi ro thị trường: Biến động giá nguyên vật liệu.
2. Rủi ro tài chính: Biến động tỷ giá hối đoái.
"""

    def test_extract_page_number(self):
        self.assertEqual(extract_page_number("# Trang 12"), 12)
        self.assertEqual(extract_page_number("# Trang 105"), 105)
        self.assertIsNone(extract_page_number("Không phải trang"))

    def test_slice_shareholders_by_keywords(self):
        # Tìm kiếm cơ cấu cổ đông
        keywords = ['cơ cấu cổ đông', 'cổ đông lớn']
        sliced_text = slice_pages(self.sample_md, keywords, window_size=2)
        
        self.assertIsNotNone(sliced_text)
        self.assertIn("CƠ CẤU CỔ ĐÔNG", sliced_text)
        self.assertIn("Ông Nguyễn Văn A sở hữu 55%", sliced_text)
        # Vì window_size = 2, nó sẽ bao gồm cả Trang 12 và Trang 13
        self.assertIn("Ban điều hành", sliced_text)
        # Nhưng không có Trang 30 (Rủi ro)
        self.assertNotIn("Rủi ro thị trường", sliced_text)

    def test_slice_risks_by_keywords(self):
        # Tìm kiếm quản trị rủi ro
        keywords = ['quản trị rủi ro', 'rủi ro trọng yếu']
        sliced_text = slice_pages(self.sample_md, keywords, window_size=1)
        
        self.assertIsNotNone(sliced_text)
        self.assertIn("QUẢN TRỊ RỦI RO", sliced_text)
        self.assertIn("Rủi ro thị trường", sliced_text)
        # Không có Cơ cấu cổ đông
        self.assertNotIn("CƠ CẤU CỔ ĐÔNG", sliced_text)

    def test_keyword_not_found(self):
        keywords = ['từ khóa không tồn tại']
        sliced_text = slice_pages(self.sample_md, keywords, window_size=2)
        self.assertIsNone(sliced_text)

if __name__ == '__main__':
    unittest.main()

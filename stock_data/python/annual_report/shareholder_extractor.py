import json
import jsonschema
from python.extractor.client import XiaomiMimoClient

# Định nghĩa JSON Schema cho Cơ cấu Cổ đông
SHAREHOLDER_SCHEMA = {
    "type": "object",
    "properties": {
        "shareholder_structures": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "shareholder_name": {"type": "string"},
                    "shareholder_type": {
                        "type": "string",
                        "enum": ["state", "foreign", "domestic_institutional",
                                 "domestic_individual", "management", "others"]
                    },
                    "share_count": {"type": ["integer", "null"]},
                    "share_percentage": {"type": "number", "minimum": 0, "maximum": 100},
                    "is_major_shareholder": {"type": "boolean"},
                    "is_board_member": {"type": "boolean"}
                },
                "required": ["shareholder_name", "shareholder_type", "share_percentage"]
            }
        }
    },
    "required": ["shareholder_structures"]
}

class ShareholderExtractor:
    def __init__(self, token_file_path: str = "xiaomi_token.txt"):
        self.client = XiaomiMimoClient(token_file_path=token_file_path)
        self.schema = SHAREHOLDER_SCHEMA

    def extract(self, text: str) -> dict:
        system_prompt = self._build_system_prompt()
        prompt = f"Hãy trích xuất thông tin cơ cấu cổ đông từ đoạn văn bản Báo cáo thường niên sau đây:\n\n{text}"
        
        # Thử tối đa 3 lần (1 lần chính thức + 2 lần retry nếu validation lỗi)
        last_error = None
        for attempt in range(3):
            try:
                raw_response = self.client.chat(prompt, system_prompt=system_prompt)
                
                # Làm sạch markdown code block
                cleaned_response = raw_response.strip()
                if cleaned_response.startswith("```json"):
                    cleaned_response = cleaned_response[7:]
                if cleaned_response.endswith("```"):
                    cleaned_response = cleaned_response[:-3]
                cleaned_response = cleaned_response.strip()
                
                # Parse JSON
                result = json.loads(cleaned_response)
                
                # Chuẩn hóa dữ liệu cơ cấu cổ đông trước khi validate
                self._normalize_data(result)
                
                # Validate schema
                jsonschema.validate(result, self.schema)
                
                return result
            except Exception as e:
                last_error = e
                # Tạo log lỗi để debug
                print(f"Attempt {attempt + 1} failed: {e}", flush=True)
                
        raise ValueError(f"Failed to extract shareholder structures after 3 attempts. Last error: {last_error}")

    def _normalize_data(self, data: dict):
        if "shareholder_structures" not in data or data["shareholder_structures"] is None:
            data["shareholder_structures"] = []
            return
            
        for sh in data["shareholder_structures"]:
            # Đảm bảo các thuộc tính Boolean có giá trị mặc định nếu bị thiếu
            if "is_major_shareholder" not in sh or sh["is_major_shareholder"] is None:
                sh["is_major_shareholder"] = False
            if "is_board_member" not in sh or sh["is_board_member"] is None:
                sh["is_board_member"] = False
            
            # Đảm bảo share_count có giá trị null thay vì thiếu nếu không xác định
            if "share_count" not in sh:
                sh["share_count"] = None
                
            # Đảm bảo share_percentage là float hoặc int
            if "share_percentage" in sh:
                try:
                    sh["share_percentage"] = float(sh["share_percentage"])
                except (ValueError, TypeError):
                    sh["share_percentage"] = 0.0

    def _build_system_prompt(self) -> str:
        schema_str = json.dumps(self.schema, ensure_ascii=False, indent=2)
        few_shot_example = {
            "shareholder_structures": [
                {
                    "shareholder_name": "Cổ đông Nhà nước (Đại diện Bộ Tài chính)",
                    "shareholder_type": "state",
                    "share_count": 350000000,
                    "share_percentage": 35.0,
                    "is_major_shareholder": True,
                    "is_board_member": False
                },
                {
                    "shareholder_name": "Dragon Capital",
                    "shareholder_type": "foreign",
                    "share_count": 85000000,
                    "share_percentage": 8.5,
                    "is_major_shareholder": True,
                    "is_board_member": False
                },
                {
                    "shareholder_name": "Nguyễn Văn A (Chủ tịch HĐQT)",
                    "shareholder_type": "management",
                    "share_count": 12000000,
                    "share_percentage": 1.2,
                    "is_major_shareholder": False,
                    "is_board_member": True
                }
            ]
        }
        few_shot_str = json.dumps(few_shot_example, ensure_ascii=False, indent=2)

        return f"""Bạn là một chuyên gia phân tích tài chính cấp cao của thị trường chứng khoán Việt Nam.
Nhiệm vụ của bạn là đọc hiểu đoạn văn bản Báo cáo thường niên (BCTN) và trích xuất thông tin cơ cấu cổ đông vào một đối tượng JSON khớp CHÍNH XÁC với JSON Schema sau:

{schema_str}

CÁC QUY TẮC PHÂN LOẠI & TRÍCH XUẤT:
1. PHÂN LOẠI CỔ ĐÔNG (shareholder_type):
   Bạn phải gán một trong các loại sau:
   - "state": Cổ đông Nhà nước, các tổng công ty nhà nước như SCIC, các Bộ ngành đại diện vốn nhà nước.
   - "foreign": Cổ đông nước ngoài (cá nhân hoặc tổ chức nước ngoài, quỹ ngoại).
   - "domestic_institutional": Cổ đông tổ chức trong nước (doanh nghiệp Việt Nam, quỹ nội, công ty chứng khoán, ngân hàng).
   - "domestic_individual": Cổ đông cá nhân trong nước (không thuộc ban lãnh đạo).
   - "management": Cổ đông thuộc Ban điều hành, Hội đồng quản trị, Ban kiểm soát, kế toán trưởng và người có liên quan của họ được liệt kê trong danh sách cổ đông quản trị.
   - "others": Các loại cổ đông khác hoặc cổ đông nhỏ lẻ còn lại không phân loại được.

2. CỔ ĐÔNG LỚN (is_major_shareholder):
   Đặt thành true nếu tỷ lệ sở hữu >= 5.0%, hoặc văn bản ghi rõ họ là "cổ đông lớn". Ngược lại đặt là false.

3. THÀNH VIÊN BAN ĐIỀU HÀNH/HĐQT (is_board_member):
   Đặt thành true nếu cổ đông đó thuộc Hội đồng quản trị, Ban giám đốc hoặc Ban kiểm soát.

4. XỬ LÝ LỖI OCR & CHUẨN HÓA SỐ LIỆU:
   - Nếu số lượng cổ phần (share_count) chứa dấu chấm/dấu phẩy phân tách hàng nghìn (ví dụ: "7.064.851.739" hoặc "7,064,851,739"), hãy chuyển đổi nó thành một số nguyên thuần túy (ví dụ: 7064851739).
   - Tỷ lệ phần trăm (share_percentage) là số thực từ 0 đến 100 (ví dụ: 14.84 thay vì 0.1484).

VÍ DỤ ĐẦU RA JSON CHUẨN:
```json
{few_shot_str}
```

Đầu ra của bạn chỉ được phép chứa chuỗi JSON hợp lệ, không chứa bất kỳ ký tự hay lời giải thích nào ngoài khối JSON.
"""

import json
import jsonschema
from python.annual_report.cf_client import CloudflareAiClient

# Định nghĩa JSON Schema cho Rủi ro Doanh nghiệp
BUSINESS_RISK_SCHEMA = {
    "type": "object",
    "properties": {
        "business_risks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "enum": ["Rủi ro thị trường", "Rủi ro tài chính", "Rủi ro hoạt động",
                                 "Rủi ro pháp lý", "Rủi ro chiến lược", "Rủi ro môi trường",
                                 "Rủi ro nhân sự", "Rủi ro công nghệ", "Rủi ro khác"]
                    },
                    "description": {"type": "string"}
                },
                "required": ["category", "description"]
            },
            "minItems": 0,
            "maxItems": 20
        }
    },
    "required": ["business_risks"]
}

class RiskExtractor:
    def __init__(self, token_file_path: str = None):
        self.client = CloudflareAiClient()
        self.schema = BUSINESS_RISK_SCHEMA

    def extract(self, text: str) -> dict:
        system_prompt = self._build_system_prompt()
        prompt = f"Hãy trích xuất danh sách các rủi ro doanh nghiệp từ đoạn văn bản Báo cáo thường niên sau đây:\n\n{text}"
        
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
                
                # Chuẩn hóa dữ liệu rủi ro trước khi validate
                self._normalize_data(result)
                
                # Validate schema
                jsonschema.validate(result, self.schema)
                
                return result
            except Exception as e:
                last_error = e
                print(f"Attempt {attempt + 1} failed: {e}", flush=True)
                
        raise ValueError(f"Failed to extract business risks after 3 attempts. Last error: {last_error}")

    def _normalize_data(self, data: dict):
        if "business_risks" not in data or data["business_risks"] is None:
            data["business_risks"] = []
            return
            
        # Đảm bảo không vượt quá 20 items như trong schema quy định
        if len(data["business_risks"]) > 20:
            data["business_risks"] = data["business_risks"][:20]

    def _build_system_prompt(self) -> str:
        schema_str = json.dumps(self.schema, ensure_ascii=False, indent=2)
        few_shot_example = {
            "business_risks": [
                {
                    "category": "Rủi ro thị trường",
                    "description": "Biến động tỷ giá USD/VND và lãi suất cho vay trên thị trường quốc tế có thể ảnh hưởng tiêu cực đến chi phí tài chính và dòng tiền trả nợ của doanh nghiệp."
                },
                {
                    "category": "Rủi ro pháp lý",
                    "description": "Những thay đổi trong Luật Đất đai 2024 và các quy định về phê duyệt pháp lý dự án bất động sản có thể làm chậm tiến độ triển khai các dự án đang thực hiện."
                }
            ]
        }
        few_shot_str = json.dumps(few_shot_example, ensure_ascii=False, indent=2)

        return f"""Bạn là một chuyên gia quản trị rủi ro doanh nghiệp cấp cao của Việt Nam.
Nhiệm vụ của bạn là đọc hiểu đoạn văn bản Báo cáo thường niên (BCTN) và trích xuất thông tin về các rủi ro mà doanh nghiệp tự khai báo vào một đối tượng JSON khớp CHÍNH XÁC với JSON Schema sau:

{schema_str}

CÁC QUY TẮC PHÂN LOẠI & TRÍCH XUẤT:
1. PHÂN LOẠI DANH MỤC RỦI RO (category):
   Bạn phải gán rủi ro vào một trong các danh mục sau:
   - "Rủi ro thị trường": Biến động giá cả nguyên vật liệu đầu vào, biến động giá bán sản phẩm, cạnh tranh thị trường, sụt giảm nhu cầu tiêu dùng.
   - "Rủi ro tài chính": Biến động lãi suất, tỷ giá hối đoái, rủi ro thanh khoản, rủi ro tín dụng (khách hàng bùng nợ), rủi ro dòng tiền trả nợ.
   - "Rủi ro hoạt động": Gián đoạn chuỗi cung ứng, hỏng hóc thiết bị nhà máy, sự cố sản xuất, các vấn đề về quy trình nội bộ.
   - "Rủi ro pháp lý": Thay đổi chính sách pháp luật, tranh chấp hợp đồng, kiện tụng, vấn đề cấp phép dự án.
   - "Rủi ro chiến lược": Quyết định đầu tư sai hướng, không bắt kịp xu hướng thị trường, sáp nhập/thâu tóm thất bại.
   - "Rủi ro môi trường": Thiên tai, lũ lụt, biến đổi khí hậu ảnh hưởng đến vùng nguyên liệu, quy chuẩn phát thải môi trường nghiêm ngặt hơn.
   - "Rủi ro nhân sự": Thiếu hụt lao động tay nghề cao, biến động nhân sự cấp cao, đình công.
   - "Rủi ro công nghệ": Sự cố hệ thống IT, rò rỉ dữ liệu thông tin, rủi ro từ việc không kịp số hóa.
   - "Rủi ro khác": Các rủi ro đặc thù khác không nằm trong danh mục trên.

2. MÔ TẢ RỦI RO (description):
   Mô tả chi tiết bằng tiếng Việt về rủi ro đó dựa trên thông tin cụ thể mà doanh nghiệp nêu trong BCTN. Tránh viết chung chung, cần nêu rõ nó ảnh hưởng thế nào đến doanh nghiệp nếu được đề cập.

VÍ DỤ ĐẦU RA JSON CHUẨN:
```json
{few_shot_str}
```

Đầu ra của bạn chỉ được phép chứa chuỗi JSON hợp lệ, không chứa bất kỳ ký tự hay lời giải thích nào ngoài khối JSON.
"""

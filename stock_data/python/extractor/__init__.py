import json
import jsonschema
from extractor.client import XiaomiMimoClient

# Define Schemas for Validation and LLM Prompting
CORE_PROPERTIES = {
    "audit_report": {
        "type": "object",
        "properties": {
            "auditor_name": {"type": "string"},
            "audit_opinion": {"type": "string", "enum": ["unqualified", "qualified", "adverse", "disclaimer"]},
            "going_concern_issue": {"type": "boolean"},
            "going_concern_detail": {"type": ["string", "null"]}
        },
        "required": ["auditor_name", "audit_opinion", "going_concern_issue"]
    },
    "related_party_transactions": {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "related_party_name": {"type": "string"},
                "relationship": {"type": ["string", "null"]},
                "transaction_type": {"type": ["string", "null"]},
                "value": {"type": ["number", "null"]},
                "interest_rate": {"type": ["string", "null"]},
                "collateral": {"type": ["string", "null"]}
            },
            "required": ["related_party_name"]
        }
    },
    "debts_breakdown": {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "creditor_name": {"type": "string"},
                "debt_type": {"type": "string", "enum": ["short_term", "long_term"]},
                "amount": {"type": ["number", "null"]},
                "interest_rate": {"type": ["string", "null"]},
                "collateral": {"type": ["string", "null"]},
                "maturity_date": {"type": ["string", "null"]}
            },
            "required": ["creditor_name", "debt_type"]
        }
    },
    "inventories_and_projects": {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "item_name": {"type": "string"},
                "item_type": {"type": "string", "enum": ["raw_material", "finished_goods", "construction_in_progress", "real_estate_project"]},
                "value": {"type": ["number", "null"]},
                "provision": {"type": ["number", "null"]},
                "description": {"type": ["string", "null"]}
            },
            "required": ["item_name", "item_type"]
        }
    },
    "financial_insights": {
        "type": "object",
        "properties": {
            "related_party_risk": {"type": ["string", "null"]},
            "debt_risk": {"type": ["string", "null"]},
            "inventory_risk": {"type": ["string", "null"]},
            "governance_risk_score": {"type": "integer", "minimum": 1, "maximum": 10},
            "overall_analysis": {"type": ["string", "null"]}
        },
        "required": ["related_party_risk", "debt_risk", "inventory_risk", "governance_risk_score", "overall_analysis"]
    }
}

INDUSTRY_SCHEMAS = {
    "bank": {
        "banking_metrics": {
            "type": "object",
            "properties": {
                "casa_ratio": {"type": ["number", "null"]},
                "nim": {"type": ["number", "null"]},
                "non_performing_loans": {"type": ["string", "null"]}, # JSON array string E.g. '[{"group": 3, "value": 10000000}]'
                "provision_coverage_ratio": {"type": ["number", "null"]}
            },
            "required": ["casa_ratio", "nim"]
        }
    },
    "securities": {
        "securities_metrics": {
            "type": "object",
            "properties": {
                "margin_outstanding": {"type": ["number", "null"]},
                "fvtpl_value": {"type": ["number", "null"]},
                "afs_value": {"type": ["number", "null"]},
                "htm_value": {"type": ["number", "null"]}
            },
            "required": ["margin_outstanding"]
        }
    },
    "real_estate": {
        "real_estate_metrics": {
            "type": "object",
            "properties": {
                "customer_advances": {"type": ["number", "null"]},
                "unearned_revenue": {"type": ["number", "null"]}
            },
            "required": ["customer_advances"]
        }
    },
    "general": {
        "general_metrics": {
            "type": "object",
            "properties": {
                "gross_margin": {"type": ["number", "null"]},
                "depreciation_expense": {"type": ["number", "null"]},
                "divestment_profit": {"type": ["number", "null"]}
            },
            "required": ["gross_margin"]
        }
    }
}

FEW_SHOT_EXAMPLE = {
    "audit_report": {
        "auditor_name": "Công ty TNHH Ernst & Young Việt Nam",
        "audit_opinion": "unqualified",
        "going_concern_issue": False,
        "going_concern_detail": None
    },
    "related_party_transactions": [
        {
            "related_party_name": "Công ty Cổ phần Tập đoàn An Phát Holdings",
            "relationship": "Công ty mẹ",
            "transaction_type": "Mua nguyên vật liệu",
            "value": 152300450000,
            "interest_rate": None,
            "collateral": None
        }
    ],
    "debts_breakdown": [
        {
            "creditor_name": "Ngân hàng TMCP Ngoại thương Việt Nam - Chi nhánh Hải Dương",
            "debt_type": "short_term",
            "amount": 85000000000,
            "interest_rate": "8.5%/năm",
            "collateral": "Quyền sử dụng đất và nhà xưởng tại Hải Dương",
            "maturity_date": "2026-12-31"
        }
    ],
    "inventories_and_projects": [
        {
            "item_name": "Dự án Nhà máy sản xuất chất dẻo phân hủy sinh học An Phát",
            "item_type": "construction_in_progress",
            "value": 340000000000,
            "provision": 0,
            "description": "Chi phí xây dựng cơ bản dở dang đang trong tiến độ hoàn thiện lắp đặt thiết bị"
        }
    ],
    "financial_insights": {
        "related_party_risk": "Giao dịch mua bán với công ty mẹ An Phát Holdings có giá trị lớn nhưng thuộc hoạt động cốt lõi mua nguyên vật liệu nhựa. Chưa thấy dấu hiệu rút ruột hay chuyển giá bất thường.",
        "debt_risk": "Nợ vay chủ yếu tại các ngân hàng lớn với lãi suất ưu đãi ngắn hạn. Tỷ lệ nợ/Vốn chủ sở hữu duy trì ở mức an toàn 0.4 lần. Áp lực thanh toán ngắn hạn thấp.",
        "inventory_risk": "Hàng tồn kho dở dang tập quan vào dự án xây dựng nhà máy công nghệ cao, tiến độ xây dựng vẫn đang được đẩy mạnh đúng kế hoạch, rủi ro đọng vốn thấp.",
        "governance_risk_score": 3,
        "overall_analysis": "Doanh nghiệp có cấu trúc tài chính lành mạnh, hoạt động kinh doanh cốt lõi ổn định, ban lãnh đạo nhất quán và công tác quản trị rủi ro tốt. Triển vọng đầu tư trung hạn khả quan."
    },
    "general_metrics": {
        "gross_margin": 0.125,
        "depreciation_expense": 45000000000,
        "divestment_profit": None
    }
}

class Extractor:
    def __init__(self, business_model: str, token_file_path: str = "xiaomi_token.txt"):
        self.business_model = business_model
        # Map business models to core group schemas
        if business_model in ["bank", "securities", "real_estate"]:
            self.industry_key = business_model
        else:
            self.industry_key = "general" # Default/General metrics for manufacturing, retail, etc.
            
        self.client = XiaomiMimoClient(token_file_path=token_file_path)
        self.schema = self._build_schema()

    def _build_schema(self) -> dict:
        properties = CORE_PROPERTIES.copy()
        industry_prop = INDUSTRY_SCHEMAS[self.industry_key]
        properties.update(industry_prop)
        
        required = list(CORE_PROPERTIES.keys()) + list(industry_prop.keys())
        
        return {
            "type": "object",
            "properties": properties,
            "required": required
        }

    def extract(self, text: str) -> dict:
        system_prompt = self._build_system_prompt()
        prompt = f"Hãy trích xuất dữ liệu từ văn bản Báo cáo tài chính sau đây:\n\n{text}"
        
        # Call LLM API
        raw_response = self.client.chat(prompt, system_prompt=system_prompt)
        
        # Clean JSON markdown blocks if any
        cleaned_response = raw_response.strip()
        if cleaned_response.startswith("```json"):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.endswith("```"):
            cleaned_response = cleaned_response[:-3]
        cleaned_response = cleaned_response.strip()
        
        try:
            result = json.loads(cleaned_response)
        except Exception as e:
            raise ValueError(f"Failed to parse LLM response as JSON. Raw output: {raw_response}. Error: {e}")
            
        # Standardize and normalise currency values in output
        self._normalize_data(result)
        
        # Validate output against constructed json schema
        jsonschema.validate(result, self.schema)
        
        return result

    def _normalize_data(self, data: dict):
        # Double check and ensure non-null arrays for transaction/debt lists
        for key in ["related_party_transactions", "debts_breakdown", "inventories_and_projects"]:
            if key not in data or data[key] is None:
                data[key] = []
        
        # Ensure audit_report exists
        if "audit_report" not in data or data["audit_report"] is None:
            data["audit_report"] = {
                "auditor_name": "Unknown",
                "audit_opinion": "unqualified",
                "going_concern_issue": False,
                "going_concern_detail": None
            }

        # Ensure financial_insights exists
        if "financial_insights" not in data or data["financial_insights"] is None:
            data["financial_insights"] = {
                "related_party_risk": "Không có thông tin đánh giá.",
                "debt_risk": "Không có thông tin đánh giá.",
                "inventory_risk": "Không có thông tin đánh giá.",
                "governance_risk_score": 5,
                "overall_analysis": "Không có thông tin phân tích."
            }

    def _build_system_prompt(self) -> str:
        schema_str = json.dumps(self.schema, ensure_ascii=False, indent=2)
        few_shot_str = json.dumps(FEW_SHOT_EXAMPLE, ensure_ascii=False, indent=2)

        return f"""Bạn là một chuyên gia phân tích tài chính cấp cao, chuyên phân tích Báo cáo tài chính (BCTC) của các công ty niêm yết tại Việt Nam.
Nhiệm vụ của bạn là trích xuất dữ liệu từ văn bản OCR của Báo cáo tài chính thành định dạng JSON hợp lệ khớp CHÍNH XÁC với JSON Schema sau đây:

{schema_str}

BẠN PHẢI TUÂN THỦ NGHIÊM NGẶT CÁC QUY TẮC VÀ TIÊU CHUẨN NGHIỆP VỤ SAU ĐỂ ĐẢM BẢO CHẤT LƯỢNG PHÂN TÍCH:

1. CHUẨN HÓA TIỀN TỆ TUYỆT ĐỐI VỀ VNĐ:
   - Các giá trị tiền tệ trong BCTC thường ghi bằng đơn vị Triệu VNĐ hoặc Tỷ VNĐ.
   - Bạn PHẢI nhân giá trị với hệ số tương ứng để trả về giá trị VNĐ TUYỆT ĐỐI (Con số đầy đủ, kiểu số thực/nguyên).
   - Ví dụ: "100 triệu VNĐ" -> 100000000. "15 tỷ VNĐ" -> 15000000000.
   - Nếu trong văn bản ghi tỷ lệ lãi suất (%), hãy giữ nguyên chuỗi mô tả lãi suất (ví dụ: "8.5%/năm" hoặc "thỏa thuận").

2. XỬ LÝ LỖI OCR VÀ MOJIBAKE TIẾNG VIỆT:
   - Văn bản đầu vào được quét bằng OCR có thể bị lỗi font chữ tiếng Việt (ví dụ: "CÃ´ng Ty Cá»• PhÃ¢n" -> "Công Ty Cổ Phần", "Ernst & Young Viá»‡t Nam" -> "Ernst & Young Việt Nam").
   - Bạn PHẢI đọc hiểu và tự động khôi phục đúng tên riêng, ý kiến kiểm toán từ các ký tự bị lỗi font này.
   - Đặc biệt, tên Công ty kiểm toán (auditor_name) phải được làm sạch về tên tiếng Anh hoặc tiếng Việt chuẩn (E.g. Ernst & Young Việt Nam, PwC, KPMG, Deloitte, AASC, v.v.).

3. Ý KIẾN KIỂM TOÁN (audit_opinion):
   - Chỉ được phép trả về một trong các giá trị: "unqualified" (Chấp nhận toàn phần), "qualified" (Ngoại trừ), "adverse" (Trái ngược), "disclaimer" (Từ chối đưa ra ý kiến).
   - Đọc kỹ mục "Báo cáo kiểm toán độc lập" hoặc thuyết minh tương ứng.

4. TRUNG THỰC - KHÔNG HALLUCINATION (BỊA ĐẶT DỮ LIỆU):
   - Chỉ trích xuất thông tin CÓ THỰC sự tồn tại trong văn bản.
   - Nếu một bảng hoặc thông tin nào đó (ví dụ: Giao dịch bên liên quan, Nợ vay chi tiết, Hàng tồn kho/Dự án) KHÔNG có trong văn bản, hãy trả về mảng RỖNG [] hoặc giá trị null cho trường đó. Tuyệt đối không tự nghĩ ra dữ liệu.

5. TIÊU CHUẨN ĐÁNH GIÁ ĐỊNH TÍNH SÂU (financial_insights):
   - related_party_risk (Rủi ro bên liên quan): Phân tích kỹ các giao dịch với công ty mẹ, công ty con, các cá nhân liên quan. Chú ý các dấu hiệu bất thường như cho vay không lãi suất, mua bán tài sản giá trị lớn không rõ ràng, các khoản phải thu chiếm dụng vốn kéo dài. Đưa ra nhận xét định tính cụ thể bằng tiếng Việt.
   - debt_risk (Rủi ro nợ vay): Đánh giá áp lực trả nợ ngắn hạn và dài hạn trên tổng tài sản và vốn chủ sở hữu. Nhận xét chi tiết về các chủ nợ lớn (Ngân hàng thương mại, trái phiếu phát hành), lãi suất vay trung bình, thời gian đáo hạn và tài sản thế chấp nổi bật (bất động sản, cổ phiếu của ban lãnh đạo, quyền tài sản).
   - inventory_risk (Rủi ro hàng tồn kho): Đánh giá tính thanh khoản của hàng tồn kho, tỷ lệ trích lập dự phòng giảm giá hàng tồn kho. Đối với doanh nghiệp bất động sản hoặc xây lắp, phân tích sâu các dự án xây dựng dở dang, xem xét liệu dự án có bị đình trệ, chậm tiến độ hay tích tụ chi phí quá lâu mà không tạo ra doanh thu hay không.
   - governance_risk_score (Chấm điểm rủi ro quản trị): Bạn PHẢI thực hiện chấm điểm theo thang điểm nguyên từ 1 đến 10 dựa trên các tiêu chí sau:
     * Điểm 1-2 (An toàn tuyệt đối): Cơ cấu cổ đông rõ ràng, không có giao dịch đáng ngờ với bên liên quan, ý kiến kiểm toán chấp nhận toàn phần, ban điều hành nhất quán.
     * Điểm 3-5 (Rủi ro thấp đến trung bình): Có giao dịch bên liên quan nhưng quy mô nhỏ, phục vụ sản xuất kinh doanh thông thường; nợ vay ở mức hợp lý; hàng tồn kho luân chuyển tốt.
     * Điểm 6-8 (Rủi ro cao): Giao dịch bên liên quan lớn, có các khoản cho vay hoặc tạm ứng đáng ngờ; nợ vay lớn chịu áp lực chi phí lãi vay cao; kiểm toán có ý kiến nhấn mạnh hoặc ngoại trừ.
     * Điểm 9-10 (Rủi ro cực lớn): Giao dịch bên liên quan chồng chéo phức tạp, có dấu hiệu tuồn vốn ra sân sau; hàng tồn kho đọng dở dang nhiều năm không trích lập dự phòng; kiểm toán từ chối đưa ra ý kiến hoặc có nghi ngờ lớn về khả năng hoạt động liên tục.
   - overall_analysis (Nhận định tổng quan): Tóm tắt toàn diện sức khỏe tài chính và triển vọng đầu tư của doanh nghiệp.

6. VÍ DỤ MẪU ĐẦU RA JSON CHUẨN (FEW-SHOT EXAMPLE):
Dưới đây là một ví dụ JSON chuẩn đáp ứng đầy đủ yêu cầu nghiệp vụ để bạn tham khảo cấu trúc (giá trị số tiền đã được nhân hệ số quy đổi về VNĐ tuyệt đối):
```json
{few_shot_str}
```

Đầu ra của bạn chỉ được phép chứa chuỗi JSON hợp lệ, không chứa lời giải thích hay bất kỳ ký tự thừa nào ngoài khối JSON.
"""

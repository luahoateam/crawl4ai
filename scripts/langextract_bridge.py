import os
import json
from langextract.providers.openai import OpenAILanguageModel
from langextract.providers.schemas.openai import OpenAISchema

# 1. Load biến môi trường từ file .env ở thư mục gốc nếu chưa có
def load_env():
    if not os.environ.get("MIMO_API_KEY"):
        # Đi ngược lên 1 thư mục để tìm file .env từ thư mục scripts/
        env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        parts = line.split("=", 1)
                        key = parts[0].strip()
                        val = parts[1].strip().strip('"').strip("'")
                        os.environ[key] = val

# Gọi load_env để nạp MIMO_API_KEY
load_env()

# 2. Định nghĩa JSON Schema đầu ra
SCHEMA_DICT = {
    "type": "object",
    "properties": {
        "revenue_struct": {
            "type": "string",
            "description": "Mô tả chi tiết cơ cấu doanh thu theo tỷ trọng hoặc giá trị từ văn bản BCTC."
        },
        "profit_struct": {
            "type": "string",
            "description": "Mô tả chi tiết cơ cấu lợi nhuận (lợi nhuận gộp hoặc sau thuế) theo tỷ trọng hoặc giá trị từ văn bản BCTC."
        }
    },
    "required": ["revenue_struct", "profit_struct"],
    "additionalProperties": False
}

# 3. Khởi tạo OpenAISchema
openai_schema = OpenAISchema(schema_dict=SCHEMA_DICT, schema_name="financial_structure")

# 4. Khởi tạo OpenAILanguageModel lười (lazy initialization)
_model = None

def get_model():
    global _model
    if _model is None:
        load_env()
        MIMO_API_KEY = os.environ.get("MIMO_API_KEY")
        if not MIMO_API_KEY:
            MIMO_API_KEY = "dummy-key-for-testing"
        _model = OpenAILanguageModel(
            model_id="mimo-v2.5-pro",
            api_key=MIMO_API_KEY,
            base_url="https://api.xiaomimimo.com/v1",
            openai_schema=openai_schema
        )
    return _model

def extract_financial_structure(text: str) -> dict:
    """ Trích xuất cơ cấu doanh thu và lợi nhuận từ văn bản OCR BCTC sử dụng langextract và MiMo.
    
    Args:
        text (str): Văn bản OCR BCTC đã được tiền xử lý.
        
    Returns:
        dict: Chứa 'revenue_struct' và 'profit_struct'.
    """
    if not text or not text.strip():
        return {
            "revenue_struct": "Không có dữ liệu văn bản BCTC.",
            "profit_struct": "Không có dữ liệu văn bản BCTC."
        }

    # Xây dựng Prompt mẫu tối ưu cho BCTC tiếng Việt
    prompt = (
        "Bạn là một chuyên gia phân tích tài chính doanh nghiệp Việt Nam.\n"
        "Hãy đọc đoạn văn bản báo cáo tài chính (BCTC) dưới đây và trích xuất cấu trúc tài chính của doanh nghiệp bao gồm:\n"
        "1. Cơ cấu doanh thu (revenue_struct): Chi tiết tỷ trọng đóng góp của các mảng kinh doanh, sản phẩm, dịch vụ hoặc thị trường chính vào tổng doanh thu, kèm theo số liệu cụ thể (nếu có).\n"
        "2. Cơ cấu lợi nhuận (profit_struct): Chi tiết tỷ trọng đóng góp của các mảng kinh doanh chính hoặc cơ cấu chi phí chính ảnh hưởng đến lợi nhuận gộp/lợi nhuận sau thuế, kèm số liệu cụ thể (nếu có).\n\n"
        "Yêu cầu:\n"
        "- Trích xuất thông tin khách quan, chính xác dựa trên số liệu trong văn bản.\n"
        "- Trình bày ngắn gọn, súc tích bằng tiếng Việt.\n\n"
        f"Văn bản BCTC:\n{text}"
    )

    try:
        # Gọi mô hình để trích xuất thông tin structured output
        model = get_model()
        outputs = next(model.infer([prompt]))
        if not outputs or len(outputs) == 0 or not outputs[0].output:
            raise ValueError("Không nhận được kết quả trả về từ mô hình.")
            
        raw_output = outputs[0].output
        result = json.loads(raw_output)
        
        # Đảm bảo các key yêu cầu tồn tại
        if "revenue_struct" not in result:
            result["revenue_struct"] = "Không thể trích xuất cơ cấu doanh thu."
        if "profit_struct" not in result:
            result["profit_struct"] = "Không thể trích xuất cơ cấu lợi nhuận."
            
        return result
        
    except Exception as e:
        # Fallback khi xảy ra lỗi gọi API hoặc parse JSON
        return {
            "revenue_struct": f"Lỗi trích xuất cơ cấu doanh thu: {str(e)}",
            "profit_struct": f"Lỗi trích xuất cơ cấu lợi nhuận: {str(e)}"
        }

def main(argv=None):
    import argparse
    parser = argparse.ArgumentParser(description="Xiaomi MiMo BCTC Structure Extraction CLI")
    parser.add_argument("--file", required=True, help="Đường dẫn đến file chứa văn bản OCR BCTC")
    parser.add_argument("--out", required=True, help="Đường dẫn file JSON đầu ra")
    
    args = parser.parse_args(argv)
    
    with open(args.file, "r", encoding="utf-8") as f:
        text = f.read()
        
    result = extract_financial_structure(text)
    
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()

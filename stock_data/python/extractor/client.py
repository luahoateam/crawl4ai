import os
import sys
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

class XiaomiMimoClient:
    def __init__(self, token_file_path: str = "xiaomi_token.txt"):
        self.api_key = os.environ.get("XIAOMI_API_KEY")
        self.base_url = None
        self.model = None
        
        # Read credentials from token file if environment variable is not set
        if not self.api_key and os.path.exists(token_file_path):
            with open(token_file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    if key.strip() == "API_KEY":
                        self.api_key = val.strip()
                    elif key.strip() == "BASE_URL":
                        self.base_url = val.strip()
                    elif key.strip() == "MODEL":
                        self.model = val.strip()
        
        # Fallbacks if properties are missing
        if not self.api_key:
            raise ValueError(f"API_KEY not found in {token_file_path}")
            
        self.fallback_model = "xiaomi/mimo-v2.5"
        
        # OpenRouter configurations
        self.openrouter_api_key = os.environ.get("OPENROUTER_API_KEY", "")
        self.openrouter_base_url = "https://openrouter.ai/api/v1"
        self.openrouter_model = "moonshotai/kimi-k2.6:free"
        
        # DeepSeek configurations (Sử dụng model deepseek-v4-flash siêu tốc độ làm mặc định)
        self.deepseek_api_key = os.environ.get("DEEPSEEK_API_KEY", "")
        self.deepseek_base_url = "https://api.deepseek.com"
        self.deepseek_model = "deepseek-v4-flash"
        
        # Tự động nhận diện loại Token để cấu hình model và base_url chính xác cho Load Balancing
        if self.api_key.startswith("sk-or-"):
            print(f"🔌 Nhận diện Token OpenRouter. Cấu hình luồng chính chạy model: {self.openrouter_model}", file=sys.stderr)
            self.model = self.openrouter_model
            self.base_url = self.openrouter_base_url
            self.using_openrouter = True
            self.using_deepseek = False
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url,
                default_headers={
                    "HTTP-Referer": "https://github.com/vnstock-hq/vnstock-agent-guide",
                    "X-Title": "Vnstock Agent Financial Data Enrichment"
                }
            )
        elif self.api_key.startswith("sk-"):
            print(f"🔌 Nhận diện Token DeepSeek. Cấu hình luồng chính chạy model: {self.deepseek_model}", file=sys.stderr)
            self.model = self.deepseek_model
            self.base_url = self.deepseek_base_url
            self.using_openrouter = False
            self.using_deepseek = True
            self.client = OpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
        else:
            if not self.base_url:
                self.base_url = "https://token-plan-sgp.xiaomimimo.com/v1"
            if not self.model:
                self.model = "xiaomi/mimo-v2.5-pro"
            self.using_openrouter = False
            self.using_deepseek = False
            self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)

    @retry(
        stop=stop_after_attempt(10),
        wait=wait_exponential(multiplier=2, min=4, max=45),
        retry=retry_if_exception_type(Exception),
        reraise=True
    )
    def chat(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        import time
        # Tạo giãn cách tự nhiên 3 giây để tránh lỗi Rate Limit 429 khi chạy đa luồng
        time.sleep(3)
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )
            if not response.choices or not response.choices[0].message:
                raise ValueError("Empty response from LLM API")
            return response.choices[0].message.content
        except Exception as e:
            err_msg = str(e).lower()
            # Tự động fallback sang model mimo-v2.5 hoặc DeepSeek nếu phát hiện lỗi quota/credit/hạn mức/429
            if any(k in err_msg for k in ["quota", "credit", "insufficient", "limit", "429", "rate_limit", "rate limit"]):
                if not self.using_deepseek and not self.using_openrouter:
                    if self.model == "xiaomi/mimo-v2.5-pro":
                        print(f"⚠️ Phát hiện lỗi quota/hạn mức hoặc 429 trên {self.model}. Tự động fallback sang {self.fallback_model}...", file=sys.stderr)
                        self.model = self.fallback_model
                    else:
                        print(f"⚠️ Phát hiện lỗi quota/hạn mức hoặc 429 trên model Xiaomi {self.model}. Tạm ngừng dùng DeepSeek, tiếp tục retry trên dòng máy Xiaomi...", file=sys.stderr)
                elif self.using_deepseek:
                    # Hỗ trợ cơ chế fallback đa tầng cực kỳ bền bỉ bên trong nội bộ DeepSeek API (tắt/giữ nguyên cấu trúc nhưng thực tế không dùng vì key DeepSeek đã bị tắt)
                    if self.model == "deepseek-v4-flash":
                        print(f"⚠️ Phát hiện lỗi quota/hạn mức hoặc 429 trên {self.model}. Tự động fallback sang deepseek-v4-pro...", file=sys.stderr)
                        self.model = "deepseek-v4-pro"
                    elif self.model == "deepseek-v4-pro":
                        print(f"⚠️ Phát hiện lỗi quota/hạn mức hoặc 429 trên {self.model}. Tự động fallback sang deepseek-chat...", file=sys.stderr)
                        self.model = "deepseek-chat"
            # Output error log for debug and trigger tenacity retry
            print(f"API Call failed on model {self.model}: {e}. Retrying...", file=sys.stderr)
            raise e






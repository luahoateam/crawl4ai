import os
import json
import urllib.request
import urllib.error
import sys
import time
from pathlib import Path

class CloudflareAiClient:
    def __init__(self, account_id: str = "7c72ee1bcdc2afa2991960a054a10e8e"):
        self.account_id = account_id
        # Sử dụng Llama 3.1 8b Instruct làm mô hình ngôn ngữ mặc định (mô hình Llama 3 cũ đã bị deprecate)
        self.model = "@cf/meta/llama-3.1-8b-instruct"
        self.token = self._get_wrangler_token()
        
        if not self.token:
            # Fallback lấy từ biến môi trường
            self.token = os.environ.get("CLOUDFLARE_API_TOKEN") or os.environ.get("CF_API_TOKEN")
        
        if not self.token:
            raise ValueError(
                "Không tìm thấy Cloudflare API Token. Vui lòng đăng nhập qua 'npx wrangler login' "
                "hoặc đặt biến môi trường CLOUDFLARE_API_TOKEN."
            )

    def _get_wrangler_token(self) -> str | None:
        """
        Tự động quét và đọc OAuth token từ config của Wrangler CLI trên máy.
        """
        paths = [
            Path(os.environ.get("APPDATA", "")) / "xdg.config" / ".wrangler" / "config" / "default.toml",
            Path(os.environ.get("USERPROFILE", "")) / ".config" / ".wrangler" / "config" / "default.toml",
            Path(os.environ.get("APPDATA", "")) / ".wrangler" / "config" / "default.toml",
            Path(os.environ.get("USERPROFILE", "")) / ".wrangler" / "config" / "default.toml"
        ]
        
        for p in paths:
            if p.exists():
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith("oauth_token"):
                                parts = line.split("=", 1)
                                return parts[1].strip().replace('"', '')
                except Exception:
                    pass
        return None

    def chat(self, prompt: str, system_prompt: str = "You are a helpful assistant.") -> str:
        """
        Gửi yêu cầu trích xuất dữ liệu tới Cloudflare Workers AI REST API.
        """
        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/ai/run/{self.model}"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        body = {
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
        }
        
        last_error = None
        for attempt in range(3):
            # Delay nhẹ giữa các lần gọi để bảo vệ quota / rate limit
            time.sleep(2)
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(body).encode("utf-8"),
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=45) as res:
                    resp_data = json.loads(res.read().decode("utf-8"))
                    if not resp_data.get("success"):
                        errors = resp_data.get("errors", [])
                        err_msg = errors[0].get("message") if errors else "Unknown error"
                        raise ValueError(f"Cloudflare AI returned error: {err_msg}")
                    
                    result = resp_data.get("result", {})
                    response_text = result.get("response")
                    if not response_text:
                        raise ValueError("Empty response from Cloudflare AI")
                    return response_text
            except urllib.error.HTTPError as e:
                err_body = ""
                try:
                    err_body = e.read().decode("utf-8")
                except Exception:
                    pass
                last_error = f"HTTP Error {e.code}: {e.reason}. Detail: {err_body}"
                print(f"[CloudflareAiClient] Attempt {attempt+1} failed: {last_error}", file=sys.stderr, flush=True)
            except Exception as e:
                last_error = str(e)
                print(f"[CloudflareAiClient] Attempt {attempt+1} failed: {last_error}", file=sys.stderr, flush=True)
                
        raise ValueError(f"Cloudflare Workers AI call failed after 3 attempts. Last error: {last_error}")

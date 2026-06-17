import subprocess
import os
import sys

def download_r2_object(r2_key: str, local_path: str = "temp_r2_report.md") -> str | None:
    """
    Tải file từ R2 sử dụng Wrangler CLI.
    """
    bucket_name = "stock-contents"
    # Thiết lập environment variables cho Wrangler
    env = os.environ.copy()
    env["CLOUDFLARE_ACCOUNT_ID"] = "7c72ee1bcdc2afa2991960a054a10e8e"
    
    # Xóa file cũ nếu tồn tại
    if os.path.exists(local_path):
        try:
            os.remove(local_path)
        except Exception:
            pass

    # Wrangler command: npx wrangler r2 object get bucket/key --file local_path --remote
    # Trên Windows, sử dụng shell=True để chạy npx
    cmd = f'npx wrangler r2 object get "{bucket_name}/{r2_key}" --file "{local_path}" --remote'
    
    print(f"Executing: {cmd}", file=sys.stderr, flush=True)
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=90  # Timeout 90s phòng ngừa treo
        )
        
        if result.returncode != 0:
            print(f"Wrangler error: {result.stderr}", file=sys.stderr, flush=True)
            return None
            
        if not os.path.exists(local_path):
            print(f"Error: Output file {local_path} was not created.", file=sys.stderr, flush=True)
            return None
            
        with open(local_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        # Dọn dẹp file tạm
        try:
            os.remove(local_path)
        except Exception:
            pass
            
        return content
    except subprocess.TimeoutExpired:
        print("Wrangler execution timed out after 90 seconds.", file=sys.stderr, flush=True)
        return None
    except Exception as e:
        print(f"Exception downloading R2 object: {e}", file=sys.stderr, flush=True)
        return None

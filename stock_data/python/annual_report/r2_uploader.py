import subprocess
import logging
import platform
import os
import time

logger = logging.getLogger(__name__)

def upload_to_r2(local_path: str, r2_key: str, bucket: str = "stock-r2-bucket", max_retries: int = 3) -> bool:
    """
    Uploads a local file to Cloudflare R2 bucket using Wrangler CLI with retries.
    
    Args:
        local_path (str): Path to the local file to upload.
        r2_key (str): The key (path) inside the R2 bucket.
        bucket (str): R2 bucket name.
        max_retries (int): Maximum number of retry attempts.
        
    Returns:
        bool: True if successful, False otherwise.
    """
    if not os.path.exists(local_path):
        logger.error(f"Local file does not exist for upload: {local_path}")
        return False
        
    logger.info(f"Uploading {local_path} to R2 ({bucket}/{r2_key})...")
    
    # Construct the wrangler command
    cmd = [
        "npx", "wrangler", "r2", "object", "put", 
        f"{bucket}/{r2_key}", 
        f"--file={local_path}",
        "--remote"
    ]
    
    is_windows = platform.system() == "Windows"
    
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Upload attempt {attempt}/{max_retries}...")
            result = subprocess.run(
                cmd, 
                shell=is_windows, 
                capture_output=True, 
                text=True, 
                encoding="utf-8",
                errors="replace",
                timeout=120
            )
            
            if result.returncode == 0:
                logger.info(f"Successfully uploaded {local_path} to R2 bucket.")
                return True
            else:
                logger.error(f"Wrangler upload failed with exit code {result.returncode} (Attempt {attempt}/{max_retries}).")
                logger.error(f"Stdout: {result.stdout}")
                logger.error(f"Stderr: {result.stderr}")
                
        except subprocess.TimeoutExpired:
            logger.warning(f"Wrangler upload timed out after 120 seconds (Attempt {attempt}/{max_retries}).")
        except Exception as e:
            logger.error(f"Exception during R2 upload via Wrangler CLI: {e} (Attempt {attempt}/{max_retries}).")
            
        if attempt < max_retries:
            time.sleep(5)  # Wait 5 seconds before retrying
            
    logger.error(f"Failed to upload {local_path} to R2 after {max_retries} attempts.")
    return False

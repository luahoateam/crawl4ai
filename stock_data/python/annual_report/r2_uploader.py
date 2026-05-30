import subprocess
import logging
import platform
import os

logger = logging.getLogger(__name__)

def upload_to_r2(local_path: str, r2_key: str, bucket: str = "stock-r2-bucket") -> bool:
    """
    Uploads a local file to Cloudflare R2 bucket using Wrangler CLI.
    
    Args:
        local_path (str): Path to the local file to upload.
        r2_key (str): The key (path) inside the R2 bucket.
        bucket (str): R2 bucket name.
        
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
        f"--file={local_path}"
    ]
    
    is_windows = platform.system() == "Windows"
    
    try:
        # Run wrangler CLI. On Windows, npx requires shell=True to locate npx.cmd
        result = subprocess.run(
            cmd, 
            shell=is_windows, 
            capture_output=True, 
            text=True, 
            timeout=60
        )
        
        if result.returncode == 0:
            logger.info(f"Successfully uploaded {local_path} to R2 bucket.")
            return True
        else:
            logger.error(f"Wrangler upload failed with exit code {result.returncode}.")
            logger.error(f"Stdout: {result.stdout}")
            logger.error(f"Stderr: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"Exception during R2 upload via Wrangler CLI: {e}")
        return False

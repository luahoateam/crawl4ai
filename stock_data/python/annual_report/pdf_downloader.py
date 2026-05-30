import os
import requests
import logging
from typing import Tuple, Optional
import pypdf

logger = logging.getLogger(__name__)

def download_pdf_and_count_pages(
    url: str, 
    symbol: str, 
    year: int, 
    temp_dir: str = "ocr_data/temp_pdf"
) -> Tuple[Optional[str], int]:
    """
    Downloads a PDF file from a URL, saves it to a local temporary directory, and counts its pages.
    
    Args:
        url (str): Direct link to the PDF file.
        symbol (str): The stock ticker (used to name the file).
        year (int): The report year (used to name the file).
        temp_dir (str): The temporary directory to store the PDF.
        
    Returns:
        Tuple[Optional[str], int]: (local_filepath, page_count). 
                                   Returns (None, 0) if download or counting fails.
    """
    os.makedirs(temp_dir, exist_ok=True)
    filename = f"{symbol.upper()}_{year}.pdf"
    local_path = os.path.join(temp_dir, filename)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        logger.info(f"Downloading PDF from {url} to {local_path}...")
        response = requests.get(url, headers=headers, stream=True, timeout=30)
        
        if response.status_code != 200:
            logger.error(f"Failed to download PDF. Status code: {response.status_code}")
            return None, 0
            
        # Download and write file in chunks to save RAM
        with open(local_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    
        # Verify and count pages using pypdf
        logger.info(f"Counting pages for {local_path}...")
        reader = pypdf.PdfReader(local_path)
        page_count = len(reader.pages)
        
        logger.info(f"Downloaded {local_path} successfully. Page count: {page_count}")
        return local_path, page_count
        
    except Exception as e:
        logger.error(f"Error occurred during download or page counting for {symbol} ({year}): {e}")
        
        # Clean up the file if it was partially written
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
                logger.info(f"Cleaned up partial file: {local_path}")
            except Exception as clean_err:
                logger.error(f"Failed to remove corrupted file {local_path}: {clean_err}")
                
        return None, 0

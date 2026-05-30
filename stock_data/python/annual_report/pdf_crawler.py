import requests
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def crawl_pdf_link(symbol: str, year: int) -> Optional[str]:
    """
    Crawls the direct PDF download link for the annual report of a given stock ticker and year from CafeF.
    
    Args:
        symbol (str): The stock ticker symbol (e.g. 'VNM', 'vcb').
        year (int): The target year of the annual report (e.g. 2024).
        
    Returns:
        Optional[str]: The URL to the PDF file, or None if not found or on error.
    """
    url = "https://cafef.vn/du-lieu/Ajax/PageNew/FileBCTC.ashx"
    params = {
        "Symbol": symbol.lower(),
        "Type": "3",  # Type 3 represents "Bản cáo bạch & BCTN"
        "Year": "0"   # Retrieve for all years to filter locally
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=15)
        if response.status_code != 200:
            logger.error(f"Failed to fetch CafeF API for {symbol}. Status code: {response.status_code}")
            return None
            
        data = response.json()
        if not data.get("Success") or not data.get("Data"):
            logger.warning(f"No document data returned from CafeF for {symbol}")
            return None
            
        items = data.get("Data", [])
        
        # Look for the annual report matching the target year
        for item in items:
            name = item.get("Name", "")
            time_str = item.get("Time", "")
            
            # Match conditions:
            # 1. Must be an Annual Report (Báo cáo thường niên)
            is_annual_report = "thường niên" in name.lower() or "thuong nien" in name.lower()
            
            # 2. Must match the year (e.g. '2024' or '24')
            year_str = str(year)
            short_year_str = str(year)[-2:]
            is_matching_year = year_str in name or short_year_str in time_str or year_str in time_str
            
            if is_annual_report and is_matching_year:
                link = item.get("Link")
                if link:
                    logger.info(f"Successfully found annual report link for {symbol} ({year}): {link}")
                    return link
                    
        logger.warning(f"Annual report for {symbol} ({year}) not found in the documents list")
        return None
        
    except Exception as e:
        logger.error(f"Error crawling CafeF PDF link for {symbol} ({year}): {e}")
        return None

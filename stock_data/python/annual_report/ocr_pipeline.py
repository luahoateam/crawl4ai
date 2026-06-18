import os
import sys
import logging
import requests
from typing import Tuple

# Thêm các imports từ module hiện tại
from python.annual_report.pdf_crawler import crawl_pdf_link
from python.annual_report.pdf_downloader import download_pdf_and_count_pages
from python.annual_report.ocr_client import PaddleOCRClient, OCRJobException
from python.annual_report.md_builder import build_markdown_report
from python.annual_report.r2_uploader import upload_to_r2

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

API_BASE_URL = "https://stock-api-worker.luahoateam.workers.dev/api"
API_KEY = "Luahoachungkhoan@ssi"

def get_headers():
    return {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json"
    }

def update_status(
    symbol: str, 
    year: int, 
    status: str, 
    pdf_url: str = None, 
    ocr_job_id: str = None, 
    error_msg: str = None, 
    page_count: int = None
) -> bool:
    url = f"{API_BASE_URL}/pipeline/annual-reports/update-status"
    payload = {
        "ticker": symbol.upper(),
        "year": year,
        "status": status,
        "pdfUrl": pdf_url,
        "ocrJobId": ocr_job_id,
        "errorMsg": error_msg,
        "pageCount": page_count
    }
    
    try:
        resp = requests.post(url, json=payload, headers=get_headers(), timeout=30)
        if resp.status_code == 200:
            return True
        logger.error(f"Failed to update status on D1 for {symbol} ({year}): {resp.status_code} - {resp.text}")
        return False
    except Exception as e:
        logger.error(f"Network error updating status for {symbol} ({year}): {e}")
        return False

def ingest_report(
    symbol: str, 
    year: int, 
    file_name: str, 
    file_url: str, 
    r2_key: str, 
    label: str, 
    page_count: int
) -> bool:
    url = f"{API_BASE_URL}/pipeline/annual-reports/ingest"
    payload = {
        "ticker": symbol.upper(),
        "year": year,
        "fileName": file_name,
        "fileUrl": file_url,
        "r2Key": r2_key,
        "label": label,
        "pageCount": page_count
    }
    
    try:
        resp = requests.post(url, json=payload, headers=get_headers(), timeout=30)
        if resp.status_code == 200:
            return True
        logger.error(f"Failed to ingest document metadata for {symbol}: {resp.status_code} - {resp.text}")
        return False
    except Exception as e:
        logger.error(f"Network error ingesting report for {symbol}: {e}")
        return False

def run_ocr_pipeline(symbol: str, year: int, token_file: str = "xiaomi_token.txt") -> Tuple[bool, str]:
    """
    Run complete OCR pipeline for single ticker.
    """
    symbol = symbol.upper()
    logger.info(f"--- Starting OCR pipeline for {symbol} ({year}) ---")
    
    # 1. Update status to crawling
    update_status(symbol, year, "crawling")
    
    # 2. Crawl PDF link
    pdf_link = crawl_pdf_link(symbol, year)
    if not pdf_link:
        err_msg = "No annual report link found"
        logger.warning(f"{symbol}: {err_msg}")
        update_status(symbol, year, "no_report_found")
        return False, err_msg
        
    # 3. Update status to downloading
    update_status(symbol, year, "downloading", pdf_url=pdf_link)
    
    # 4. Download PDF and count pages
    local_pdf_path = None
    try:
        logger.info(f"Downloading PDF from: {pdf_link}")
        local_pdf_path, page_count = download_pdf_and_count_pages(
            url=pdf_link,
            symbol=symbol,
            year=year,
            temp_dir="scratch"
        )
        if not local_pdf_path or page_count == 0:
            raise Exception("Download failed or page count is 0")
            
        logger.info(f"Downloaded PDF successfully. Page count: {page_count}")
        
    except Exception as e:
        err_msg = f"Failed to download PDF: {e}"
        logger.error(f"{symbol}: {err_msg}")
        update_status(symbol, year, "failed", error_msg=err_msg)
        if local_pdf_path and os.path.exists(local_pdf_path):
            os.remove(local_pdf_path)
        return False, err_msg
        
    # 5. Update status to ocr_submitted
    update_status(symbol, year, "ocr_submitted", page_count=page_count)
    
    # 6. OCR using Paddle OCR
    try:
        # PaddleOCRClient will automatically use DEFAULT_TOKEN or env PADDLE_OCR_TOKEN
        ocr_client = PaddleOCRClient()
        job_id = ocr_client.submit_job(local_pdf_path)
        
        # Cập nhật job id cho queue
        update_status(symbol, year, "ocr_submitted", ocr_job_id=job_id, page_count=page_count)
        
        # Poll kết quả
        pages = ocr_client.poll_job(job_id)
        if not pages:
            raise Exception("OCR returned no pages content")
            
        logger.info(f"OCR completed successfully for {symbol} ({year}). Pages: {len(pages)}")
        
    except Exception as e:
        err_msg = f"OCR Job failed: {e}"
        logger.error(f"{symbol}: {err_msg}")
        update_status(symbol, year, "failed", error_msg=err_msg)
        if local_pdf_path and os.path.exists(local_pdf_path):
            os.remove(local_pdf_path)
        return False, err_msg
        
    # 7. Build Markdown and save local
    try:
        # Đường dẫn thư mục ocr_data local làm root
        output_dir = "ocr_data"
        md_filepath = build_markdown_report(pages, symbol, year, output_dir=output_dir)
        if not md_filepath:
            raise Exception("Failed to build markdown file")
            
        logger.info(f"Built markdown report successfully at: {md_filepath}")
        
    except Exception as e:
        err_msg = f"Failed to build markdown: {e}"
        logger.error(f"{symbol}: {err_msg}")
        update_status(symbol, year, "failed", error_msg=err_msg)
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)
        return False, err_msg
        
    # 8. Upload to Cloudflare R2
    r2_key = f"annual-reports/{year}/{symbol}/{symbol}_BCTN_{year}.md"
    bucket = "stock-contents"
    
    try:
        # Upload lên R2 qua Wrangler CLI
        upload_success = upload_to_r2(md_filepath, r2_key, bucket=bucket)
        if not upload_success:
            raise Exception("R2 upload failed via Wrangler CLI")
            
        logger.info(f"Uploaded markdown report to R2 successfully: {bucket}/{r2_key}")
        
    except Exception as e:
        err_msg = f"Failed to upload report to R2: {e}"
        logger.error(f"{symbol}: {err_msg}")
        update_status(symbol, year, "failed", error_msg=err_msg)
        if os.path.exists(temp_pdf_path):
            os.remove(temp_pdf_path)
        return False, err_msg
        
    # 9. Ingest report và update queue sang 'done'
    # fileName là VNM_BCTN_2024.md
    file_name = f"{symbol}_BCTN_{year}.md"
    # Dùng URL tượng trưng, ingest API sẽ tự cập nhật fileUrl thật
    temp_file_url = f"https://stock-api-worker.luahoateam.workers.dev/api/documents/view"
    label = f"Báo cáo thường niên {year} (PaddleOCR)"
    
    try:
        ingest_success = ingest_report(
            symbol=symbol,
            year=year,
            file_name=file_name,
            file_url=temp_file_url,
            r2_key=r2_key,
            label=label,
            page_count=page_count
        )
        if not ingest_success:
            raise Exception("Ingest metadata API failed")
            
        logger.info(f"Ingested and completed OCR pipeline successfully for {symbol} ({year})")
        
    except Exception as e:
        err_msg = f"Failed to ingest metadata: {e}"
        logger.error(f"{symbol}: {err_msg}")
        update_status(symbol, year, "failed", error_msg=err_msg)
        if local_pdf_path and os.path.exists(local_pdf_path):
            os.remove(local_pdf_path)
        return False, err_msg
        
    # Clean up temp PDF file
    if local_pdf_path and os.path.exists(local_pdf_path):
        os.remove(local_pdf_path)
        
    return True, f"Successfully completed OCR pipeline for {symbol} ({year})"

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--ticker", required=True, help="Ticker symbol")
    parser.add_argument("--year", type=int, default=2024, help="Report year")
    parser.add_argument("--token-file", default="xiaomi_token.txt", help="Token file")
    
    args = parser.parse_args()
    
    success, msg = run_ocr_pipeline(args.ticker, args.year, args.token_file)
    if success:
        print(f"SUCCESS: {msg}")
        sys.exit(0)
    else:
        print(f"FAILED: {msg}", file=sys.stderr)
        sys.exit(1)

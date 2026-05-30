import argparse
import sys
import json
import logging
import subprocess
import requests
import datetime
import os
from typing import List, Optional

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("pipeline")

# Try relative imports, fallback to standard imports for different running environments
try:
    from python.annual_report.pdf_crawler import crawl_pdf_link
    from python.annual_report.pdf_downloader import download_pdf_and_count_pages
    from python.annual_report.ocr_client import PaddleOCRClient
    from python.annual_report.md_builder import build_markdown_report
    from python.annual_report.r2_uploader import upload_to_r2
except ImportError:
    # If python prefix is missing from PYTHONPATH
    from pdf_crawler import crawl_pdf_link
    from pdf_downloader import download_pdf_and_count_pages
    from ocr_client import PaddleOCRClient
    from md_builder import build_markdown_report
    from r2_uploader import upload_to_r2

YEAR = 2024
BUCKET_NAME = "stock-contents"  # Wrangler R2 bucket name

def execute_d1_query(command: str) -> list:
    """Executes a SQL command on D1 via Wrangler CLI and returns JSON results."""
    cmd = ["npx", "wrangler", "d1", "execute", "DB", "--remote", f"--command={command}", "--json"]
    is_windows = os.name == 'nt'
    try:
        result = subprocess.run(cmd, shell=is_windows, capture_output=True, text=True, timeout=45)
        if result.returncode != 0:
            logger.error(f"D1 Query failed. Command: {command}")
            logger.error(f"Stderr: {result.stderr}")
            raise Exception(f"D1 Query failed with exit code {result.returncode}")
        
        # Parse wrangler output
        data = json.loads(result.stdout)
        # Wrangler returns a list of results, one per statement (usually we run 1 statement)
        if isinstance(data, list) and len(data) > 0:
            return data[0].get("results", [])
        return []
    except Exception as e:
        logger.error(f"Exception running D1 command: {e}")
        raise e

def run_pipeline(limit: int = 5, tickers: List[str] = None):
    logger.info("Starting Annual Report 2024 pipeline...")
    
    # 1. Determine tickers to process
    if tickers:
        logger.info(f"Processing manual tickers list: {tickers}")
        items = [{"ticker": t.upper()} for t in tickers]
    else:
        logger.info(f"Fetching {limit} pending tickers from D1 queue...")
        query = f"SELECT ticker FROM annual_report_queue WHERE status = 'pending' LIMIT {limit}"
        items = execute_d1_query(query)
        
    if not items:
        logger.info("No pending tickers found in the queue. Done.")
        return
        
    for item in items:
        ticker = item["ticker"]
        row_id = f"{ticker}_{YEAR}"
        logger.info(f"\n=========================================")
        logger.info(f"Processing ticker: {ticker}")
        
        # Set status to crawling
        execute_d1_query(f"UPDATE annual_report_queue SET status = 'crawling', updated_at = strftime('%s','now') WHERE id = '{row_id}'")
        
        # Step 2: Crawl link PDF
        pdf_url = crawl_pdf_link(ticker, YEAR)
        if not pdf_url:
            logger.error(f"Annual report PDF link for {ticker} ({YEAR}) not found!")
            execute_d1_query(f"UPDATE annual_report_queue SET status = 'no_report_found', error_msg = 'Link PDF not found', updated_at = strftime('%s','now') WHERE id = '{row_id}'")
            continue
            
        # Save pdf_url and update status to downloading
        escaped_pdf_url = pdf_url.replace("'", "''")
        execute_d1_query(f"UPDATE annual_report_queue SET pdf_url = '{escaped_pdf_url}', status = 'downloading', updated_at = strftime('%s','now') WHERE id = '{row_id}'")
        
        # Step 3: Download PDF and count pages
        local_pdf_path, page_count = download_pdf_and_count_pages(pdf_url, ticker, YEAR, temp_dir="ocr_data/temp_pdf")
        if not local_pdf_path or page_count == 0:
            logger.error(f"Failed to download and count PDF for {ticker} ({YEAR})!")
            execute_d1_query(f"UPDATE annual_report_queue SET status = 'failed', error_msg = 'Download failed or PDF is corrupted', updated_at = strftime('%s','now') WHERE id = '{row_id}'")
            continue
            
        # Step 4: Check daily quota limits
        today = datetime.date.today().isoformat()
        # Ensure quota row exists for today
        execute_d1_query(f"INSERT OR IGNORE INTO daily_quota_log (date, pages_used) VALUES ('{today}', 0)")
        quota_results = execute_d1_query(f"SELECT pages_used, pages_limit FROM daily_quota_log WHERE date = '{today}'")
        pages_used = 0
        pages_limit = 19500
        if quota_results:
            pages_used = quota_results[0].get("pages_used", 0)
            pages_limit = quota_results[0].get("pages_limit", 19500)
            
        if pages_used + page_count > pages_limit:
            logger.warning(f"⚠️ Daily quota limit reached! (Used: {pages_used}, Required for {ticker}: {page_count}, Limit: {pages_limit}). Skipping this run.")
            if os.path.exists(local_pdf_path):
                os.remove(local_pdf_path)
            break
            
        # Step 5: Submit OCR Job
        logger.info(f"Submitting OCR job for {ticker} ({page_count} pages)...")
        execute_d1_query(f"UPDATE annual_report_queue SET status = 'ocr_submitted', updated_at = strftime('%s','now') WHERE id = '{row_id}'")
        
        local_md_path = None
        try:
            client = PaddleOCRClient()
            job_id = client.submit_job(pdf_url)
            
            # Save job_id in queue
            execute_d1_query(f"UPDATE annual_report_queue SET ocr_job_id = '{job_id}', updated_at = strftime('%s','now') WHERE id = '{row_id}'")
            
            # Poll for results
            results = client.poll_job(job_id)
            
            # Build markdown
            local_md_path = build_markdown_report(results, ticker, YEAR, output_dir="ocr_data/markdown")
            if not local_md_path:
                raise Exception("Failed to build consolidated markdown file")
                
            # Step 6: Upload to R2
            r2_key = f"annual-reports/{YEAR}/{ticker}/report.md"
            upload_success = upload_to_r2(local_md_path, r2_key, bucket=BUCKET_NAME)
            if not upload_success:
                raise Exception("Wrangler R2 upload failed")
                
            # Step 7: Ingest to Worker API
            logger.info("Registering document metadata to Worker API...")
            api_url = "https://stock-api-worker.luahoateam.workers.dev/api/pipeline/annual-reports/ingest"
            payload = {
                "ticker": ticker,
                "year": YEAR,
                "fileName": "report.md",
                "fileUrl": "https://stock-api-worker.luahoateam.workers.dev/api/documents/temp/view", # dummy URL, server auto-regenerates it
                "r2Key": r2_key,
                "label": f"Báo cáo thường niên năm {YEAR} (PaddleOCR)",
                "pageCount": page_count
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            resp = requests.post(api_url, json=payload, headers=headers, timeout=30)
            if resp.status_code != 200:
                raise Exception(f"Ingest API failed with status {resp.status_code}: {resp.text}")
                
            resp_data = resp.json()
            if not resp_data.get("success"):
                raise Exception(f"Ingest API returned success=False: {resp_data}")
                
            # Step 8: Update log quota pages in D1
            execute_d1_query(f"UPDATE daily_quota_log SET pages_used = pages_used + {page_count} WHERE date = '{today}'")
            
            # Step 8.5: Update queue status to success
            execute_d1_query(f"UPDATE annual_report_queue SET status = 'success', updated_at = strftime('%s','now') WHERE id = '{row_id}'")
            
            logger.info(f"✅ Successfully completed annual report for {ticker}! Registered document ID: {resp_data.get('documentId')}")
            
        except Exception as ocr_err:
            logger.error(f"OCR or Upload failure for {ticker}: {ocr_err}")
            escaped_err = str(ocr_err).replace("'", "''").replace("\n", " ")
            execute_d1_query(f"UPDATE annual_report_queue SET status = 'failed', error_msg = '{escaped_err}', attempts = attempts + 1, updated_at = strftime('%s','now') WHERE id = '{row_id}'")
            
        finally:
            # Step 9: Clean up local temporary files
            if os.path.exists(local_pdf_path):
                try:
                    os.remove(local_pdf_path)
                    logger.info(f"Cleaned up local PDF: {local_pdf_path}")
                except Exception as clean_err:
                    logger.error(f"Failed to delete {local_pdf_path}: {clean_err}")
                    
            if local_md_path and os.path.exists(local_md_path):
                try:
                    os.remove(local_md_path)
                    logger.info(f"Cleaned up local Markdown: {local_md_path}")
                except Exception as clean_err:
                    logger.error(f"Failed to delete {local_md_path}: {clean_err}")

def main():
    parser = argparse.ArgumentParser(description="Annual Report 2024 Pipeline Orchestrator")
    parser.add_argument("--limit", type=int, default=5, help="Number of pending tickers to process")
    parser.add_argument("--tickers", type=str, help="Comma-separated list of specific tickers to run (e.g. VNM,VCB)")
    args = parser.parse_args()
    
    ticker_list = None
    if args.tickers:
        ticker_list = [t.strip() for t in args.tickers.split(",") if t.strip()]
        
    run_pipeline(limit=args.limit, tickers=ticker_list)

if __name__ == "__main__":
    main()

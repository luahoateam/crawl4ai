import asyncio
import logging
from pathlib import Path
import httpx

from progress import ProgressTracker
from ocr_client import PaddleOCRClient
from writer import ResultWriter

logger = logging.getLogger("pdf_to_markdown.converter")

class PDFConverter:
    def __init__(self, progress_filepath="progress.json"):
        self.progress_filepath = progress_filepath

    async def run(self, pdf_dir: Path, output_dir: Path, concurrency: int, reset: bool = False, retry_failed_only: bool = False):
        """Runs the conversion pipeline.
        
        Args:
            pdf_dir: Directory containing input PDF files.
            output_dir: Directory where markdown & images will be saved.
            concurrency: Number of PDFs to process concurrently.
            reset: If True, clear progress tracker and start from scratch.
            retry_failed_only: If True, only process files that failed in a previous run.
        """
        tracker = ProgressTracker(self.progress_filepath)
        
        if reset:
            logger.info("Resetting progress tracking state...")
            tracker.reset()
            # Reload tracker after reset
            tracker = ProgressTracker(self.progress_filepath)
            
        # Ensure output directory exists
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Scan PDF directory
        pdf_files = sorted(list(pdf_dir.glob("*.pdf")))
        if not pdf_files:
            logger.error(f"No PDF files found in {pdf_dir}")
            return
            
        logger.info(f"Scanned {len(pdf_files)} PDF files in input directory.")
        
        # Filter files based on progress tracking
        files_to_process = []
        for pdf_file in pdf_files:
            filename = pdf_file.name
            
            # Skip if already marked as done
            if tracker.is_done(filename):
                logger.info(f"Skipping [{filename}] (Already completed).")
                continue
                
            status = tracker.data.get(filename, {}).get("status")
            
            if retry_failed_only:
                if status == "failed":
                    files_to_process.append(pdf_file)
                else:
                    logger.debug(f"Skipping [{filename}] (Not in failed state).")
            else:
                files_to_process.append(pdf_file)
                
        if not files_to_process:
            logger.info("No pending files to process.")
            return
            
        logger.info(f"Starting pipeline to process {len(files_to_process)} files with concurrency={concurrency}...")
        
        # Create an AsyncClient with custom connection limits tailored for concurrency
        limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
        async with httpx.AsyncClient(http2=True, limits=limits, timeout=60.0) as client:
            ocr_client = PaddleOCRClient(client)
            writer = ResultWriter(client)
            
            sem = asyncio.Semaphore(concurrency)
            tasks = [
                self._process_pdf(sem, ocr_client, tracker, writer, pdf_file, output_dir)
                for pdf_file in files_to_process
            ]
            
            await asyncio.gather(*tasks)
            
        # Final Summary
        total_attempted = len(files_to_process)
        tracker_updated = ProgressTracker(self.progress_filepath) # reload
        success_count = sum(1 for f in files_to_process if tracker_updated.is_done(f.name))
        failed_count = total_attempted - success_count
        
        logger.info("==================================================")
        logger.info("PIPELINE EXECUTION SUMMARY")
        logger.info(f"Total files attempted: {total_attempted}")
        logger.info(f"Successfully converted: {success_count}/{total_attempted}")
        logger.info(f"Failed conversions:     {failed_count}/{total_attempted}")
        logger.info("==================================================")

    async def _process_pdf(self, sem: asyncio.Semaphore, ocr_client: PaddleOCRClient, tracker: ProgressTracker, writer: ResultWriter, pdf_path: Path, output_dir: Path):
        filename = pdf_path.name
        async with sem:
            logger.info(f"[START] Processing file: {filename}")
            try:
                # 1. Submit PDF file to PaddleOCR API
                job_id = await ocr_client.submit_job(pdf_path)
                tracker.mark_running(filename, job_id)
                
                # 2. Wait for API to complete OCR extraction
                jsonl_url = await ocr_client.poll_job(filename, job_id)
                
                # 3. Fetch layout result JSONL file content
                logger.info(f"[{filename}] Fetching extraction result JSONL...")
                results = await ocr_client.fetch_jsonl_results(jsonl_url)
                
                # 4. Save markdown texts and download images concurrently
                logger.info(f"[{filename}] Saving results to output folder...")
                await writer.save(results, output_dir, pdf_path.stem.strip())
                
                # 5. Mark as successfully done
                tracker.mark_done(filename, len(results))
                logger.info(f"[SUCCESS] Finished processing: {filename}")
                
            except Exception as e:
                logger.error(f"[FAILED] Error processing [{filename}]: {e}", exc_info=True)
                tracker.mark_failed(filename, str(e))

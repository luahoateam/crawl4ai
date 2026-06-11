import argparse
import asyncio
import logging
import sys
from pathlib import Path

from config import MAX_CONCURRENT
from converter import PDFConverter

def setup_logging():
    """Sets up structured logging output to console."""
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    if hasattr(sys.stderr, 'reconfigure'):
        try:
            sys.stderr.reconfigure(encoding='utf-8')
        except Exception:
            pass

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)-7s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

async def main():
    setup_logging()
    logger = logging.getLogger("pdf_to_markdown.main")
    
    parser = argparse.ArgumentParser(
        description="Async Pipeline to convert Golden News Letter PDFs to Markdown using PaddleOCR API."
    )
    parser.add_argument(
        "--input", "-i",
        type=str,
        default="PDF",
        help="Path to directory containing input PDF files (default: PDF)"
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        default="output",
        help="Path to directory where output markdown/images will be saved (default: output)"
    )
    parser.add_argument(
        "--concurrency", "-c",
        type=int,
        default=MAX_CONCURRENT,
        help=f"Number of PDF files to process concurrently (default: {MAX_CONCURRENT})"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset progress tracking file and process all files from scratch"
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Only process files that previously failed"
    )
    parser.add_argument(
        "--progress-file",
        type=str,
        default="progress.json",
        help="Filename for storing progress status (default: progress.json)"
    )
    
    args = parser.parse_args()
    
    pdf_dir = Path(args.input)
    output_dir = Path(args.output)
    
    # Resolve relative paths relative to current directory
    if not pdf_dir.is_absolute():
        pdf_dir = Path().absolute() / pdf_dir
    if not output_dir.is_absolute():
        output_dir = Path().absolute() / output_dir
        
    if not pdf_dir.exists():
        logger.error(f"Input directory does not exist: {pdf_dir}")
        sys.exit(1)
        
    logger.info("==================================================")
    logger.info("STARTING PDF TO MARKDOWN CONVERSION PIPELINE")
    logger.info(f"Input PDF Dir:   {pdf_dir}")
    logger.info(f"Output MD Dir:   {output_dir}")
    logger.info(f"Concurrency:     {args.concurrency}")
    logger.info(f"Reset Progress:  {args.reset}")
    logger.info(f"Retry Failed:    {args.retry_failed}")
    logger.info("==================================================")
    
    converter = PDFConverter(progress_filepath=args.progress_file)
    
    try:
        await converter.run(
            pdf_dir=pdf_dir,
            output_dir=output_dir,
            concurrency=args.concurrency,
            reset=args.reset,
            retry_failed_only=args.retry_failed
        )
    except KeyboardInterrupt:
        logger.warning("\nPipeline interrupted by user. Exiting gracefully...")
        sys.exit(130)
    except Exception as e:
        logger.critical(f"Unhandled critical exception in pipeline: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    # Windows event loop policy support for httpx aiofiles
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass

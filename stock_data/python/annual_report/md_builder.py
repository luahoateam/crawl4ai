import os
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

def build_markdown_report(
    pages: List[str], 
    symbol: str, 
    year: int, 
    output_dir: str = "ocr_data/markdown"
) -> Optional[str]:
    """
    Combines parsed markdown pages from OCR into a single markdown file with metadata frontmatter.
    
    Args:
        pages (List[str]): List of markdown strings representing each page.
        symbol (str): The company stock ticker (e.g. 'VNM').
        year (int): The target year of the report (e.g. 2024).
        output_dir (str): Directory where the final markdown file should be saved.
        
    Returns:
        Optional[str]: File path to the generated markdown report, or None if failed.
    """
    if not pages:
        logger.warning(f"No pages provided to build markdown report for {symbol} ({year})")
        return None
        
    os.makedirs(output_dir, exist_ok=True)
    filename = f"{symbol.upper()}_{year}.md"
    filepath = os.path.join(output_dir, filename)
    
    try:
        logger.info(f"Generating markdown report for {symbol} ({year}) with {len(pages)} pages...")
        
        # Build YAML frontmatter
        frontmatter = (
            "---\n"
            f"ticker: {symbol.upper()}\n"
            "document_type: bctn\n"
            f"year: {year}\n"
            f"page_count: {len(pages)}\n"
            "source: PaddleOCR-VL-1.6\n"
            "---\n\n"
        )
        
        # Join pages with page break separator (---) for clear sectioning
        content_separator = "\n\n---\n\n"
        # We can also just join with newlines if preferred, but test expects the pages to be joined and present.
        # Let's join pages using double newlines
        joined_pages = "\n\n".join(pages)
        
        full_content = frontmatter + joined_pages + "\n"
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(full_content)
            
        logger.info(f"Markdown report generated successfully at {filepath}")
        return filepath
        
    except Exception as e:
        logger.error(f"Error building markdown report for {symbol} ({year}): {e}")
        return None

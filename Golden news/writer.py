import asyncio
import logging
import re
from pathlib import Path
import aiofiles
import httpx

logger = logging.getLogger("pdf_to_markdown.writer")

class ResultWriter:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def save(self, results: list, output_dir: Path, pdf_stem: str):
        """Saves OCR markdown results and downloads associated images.
        
        Args:
            results: List of page objects parsed from the JSONL result.
            output_dir: Root output directory Path.
            pdf_stem: Name of the PDF file without extension.
        """
        # Create folder for this specific PDF: output/<pdf_stem>
        pdf_output_dir = output_dir / pdf_stem
        pdf_output_dir.mkdir(parents=True, exist_ok=True)
        
        image_tasks = []
        page_num = 0
        
        for page_data in results:
            result = page_data.get("result", {})
            layout_results = result.get("layoutParsingResults", [])
            
            for res in layout_results:
                # 1. Write the markdown file for the page
                md_filename = pdf_output_dir / f"doc_{page_num}.md"
                markdown_text = res.get("markdown", {}).get("text", "")
                
                try:
                    async with aiofiles.open(md_filename, "w", encoding="utf-8") as md_file:
                        await md_file.write(markdown_text)
                    logger.debug(f"[{pdf_stem}] Saved page {page_num} to {md_filename.name}")
                except Exception as e:
                    logger.error(f"[{pdf_stem}] Failed to write markdown for page {page_num}: {e}")

                # 2. Extract and download markdown inline images
                md_images = res.get("markdown", {}).get("images", {})
                for img_path, img_url in md_images.items():
                    # img_path is usually a relative path like "images/image_0.png"
                    full_img_path = pdf_output_dir / img_path
                    full_img_path.parent.mkdir(parents=True, exist_ok=True)
                    
                    image_tasks.append(self._download_image(img_url, full_img_path))
                    
                # 3. Extract and download layout output images
                output_images = res.get("outputImages", {})
                for img_name, img_url in output_images.items():
                    img_filename = pdf_output_dir / "images" / f"{img_name}_{page_num}.jpg"
                    img_filename.parent.mkdir(parents=True, exist_ok=True)
                    
                    image_tasks.append(self._download_image(img_url, img_filename))
                    
                page_num += 1
                
        # Download all images concurrently
        if image_tasks:
            logger.info(f"[{pdf_stem}] Downloading {len(image_tasks)} images concurrently...")
            await asyncio.gather(*image_tasks, return_exceptions=True)
            logger.info(f"[{pdf_stem}] Completed downloading all images.")
        else:
            logger.info(f"[{pdf_stem}] No images to download.")

        # Merge all page markdown files into a single combined file
        await self._merge_pages(pdf_output_dir, pdf_stem)

    async def _merge_pages(self, pdf_output_dir: Path, pdf_stem: str):
        """Ghép tất cả doc_*.md trong thư mục thành một file <pdf_stem>.md duy nhất."""
        def _natural_key(p: Path) -> list:
            parts = re.split(r"(\d+)", p.stem)
            return [int(x) if x.isdigit() else x.lower() for x in parts]

        md_files = sorted(pdf_output_dir.glob("doc_*.md"), key=_natural_key)
        if not md_files:
            logger.warning(f"[{pdf_stem}] No doc_*.md files found, skipping merge.")
            return

        segments = []
        for idx, md_file in enumerate(md_files, start=1):
            try:
                async with aiofiles.open(md_file, "r", encoding="utf-8") as f:
                    content = (await f.read()).strip()
            except Exception as e:
                logger.error(f"[{pdf_stem}] Cannot read {md_file.name}: {e}")
                content = f"*[Lỗi đọc file: {e}]*"
            segments.append(f"## Trang {idx}\n\n{content}")

        merged = "\n\n---\n".join(segments) + "\n"
        output_file = pdf_output_dir / f"{pdf_stem}.md"
        try:
            async with aiofiles.open(output_file, "w", encoding="utf-8") as f:
                await f.write(merged)
            logger.info(f"[{pdf_stem}] Merged {len(md_files)} pages -> {output_file.name}")
        except Exception as e:
            logger.error(f"[{pdf_stem}] Failed to write merged file: {e}")

    async def _download_image(self, url: str, path: Path):
        """Helper to download a single image asynchronously."""
        try:
            # Reusing the shared HTTPX client for connection pooling
            response = await self.client.get(url, timeout=30.0)
            if response.status_code == 200:
                async with aiofiles.open(path, "wb") as f:
                    await f.write(response.content)
                logger.debug(f"Downloaded image: {path.name}")
            else:
                logger.error(f"Failed to download image {url}: HTTP {response.status_code}")
        except Exception as e:
            logger.error(f"Exception downloading image {url} to {path}: {e}")

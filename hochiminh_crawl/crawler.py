import asyncio
import os
import re
import random
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from config import OUTPUT_DIR, PAGE_TIMEOUT, DELAY_MIN, DELAY_MAX, MAX_RETRIES
from logger import get_logger

log = get_logger()

def _make_crawler_config() -> CrawlerRunConfig:
    """Tạo cấu hình tối ưu cho Crawl4AI khi cào bài viết."""
    return CrawlerRunConfig(
        markdown_generator=DefaultMarkdownGenerator(
            content_filter=PruningContentFilter(
                threshold=0.45,
                threshold_type="fixed",
            )
        ),
        excluded_tags=[
            "img", "video", "figure", "picture",  # Loại bỏ hoàn toàn hình ảnh/video
            "nav", "header", "footer",             # Loại bỏ khung giao diện trang web
            "aside", "script", "style",            # Loại bỏ các code thừa
        ],
        cache_mode=CacheMode.BYPASS,       # Bỏ qua cache để lấy dữ liệu mới
        page_timeout=PAGE_TIMEOUT,          # Thời gian chờ tối đa 30s
        wait_until="domcontentloaded",     # Chỉ cần DOM tải xong, không đợi ảnh
    )

def _slug_from_url(url: str) -> str:
    """Trích xuất slug để làm tên file .md từ URL bài viết chi tiết."""
    # Bỏ query string
    path = url.split("?")[0]
    # Lấy phần tử cuối của đường dẫn
    filename = path.rstrip("/").split("/")[-1]
    # Bỏ đuôi .html hoặc .htm nếu có
    filename = re.sub(r"\.html?$", "", filename)
    # Nếu filename rỗng hoặc lỗi, sinh tên ngẫu nhiên dựa trên hash
    if not filename:
        filename = f"article_{hash(url)}"
    return filename

def _save_article(slug_dir: str, filename: str, title: str, content: str) -> str:
    """Ghi tiêu đề và nội dung bài viết ra file .md tương ứng với chuyên mục."""
    out_dir = os.path.join(OUTPUT_DIR, slug_dir)
    os.makedirs(out_dir, exist_ok=True)
    filepath = os.path.join(out_dir, f"{filename}.md")
    
    # Định dạng Markdown lưu trữ
    markdown_content = f"# {title}\n\n{content}"
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(markdown_content)
    return filepath

async def crawl_article(
    crawler: AsyncWebCrawler,
    record: dict,
    config: CrawlerRunConfig,
) -> bool:
    """
    Cào một bài viết cụ thể. Hỗ trợ retry tối đa MAX_RETRIES lần
    với cơ chế exponential backoff.
    """
    url = record["url"]
    slug_dir = record["slug"]
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = await crawler.arun(url, config=config)
            
            if not result.success:
                raise ValueError(f"Crawl4AI báo lỗi: {result.error_message}")
                
            # Lấy tiêu đề bài viết
            title = "Không có tiêu đề"
            if result.metadata and result.metadata.get("title"):
                title = result.metadata["title"]
            
            # Làm sạch tiêu đề (bỏ phần tên website thừa ở cuối nếu có)
            title = re.sub(r"\s*-\s*Trang thông tin điện tử.*$", "", title, flags=re.IGNORECASE)
            title = re.sub(r"\s*-\s*Hồ Chí Minh.*$", "", title, flags=re.IGNORECASE)
            title = title.strip()
            
            # Lấy nội dung markdown
            content = result.markdown.fit_markdown or result.markdown.raw_markdown
            
            if not content or len(content.strip()) < 50:
                raise ValueError("Nội dung bài viết quá ngắn hoặc rỗng sau khi lọc.")
                
            # Lưu ra file
            filename = _slug_from_url(url)
            filepath = _save_article(slug_dir, filename, title, content)
            log.info(f"[SUCCESS] Đã lưu: {url} -> {filepath}")
            return True
            
        except Exception as e:
            wait = 2 ** attempt  # Backoff: 2s, 4s, 8s
            log.warning(f"[RETRY {attempt}/{MAX_RETRIES}] Lỗi cào {url}: {e}. Thử lại sau {wait} giây...")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(wait)
                
    log.error(f"[FAILED] Cào thất bại {url} sau {MAX_RETRIES} lần thử.")
    return False

async def run_crawling(crawler: AsyncWebCrawler, checkpoint: dict):
    """Lấy các bài viết chưa cào từ checkpoint và tiến hành cào tuần tự."""
    config = _make_crawler_config()
    
    # Chỉ lấy các URL ở trạng thái pending hoặc failed
    pending_records = [r for r in checkpoint.values() if r["status"] in ("pending", "failed")]
    total = len(pending_records)
    
    if total == 0:
        log.info("[CRAWL] Không có bài viết nào cần cào.")
        return 0, 0
        
    log.info(f"[CRAWL] Bắt đầu cào {total} bài viết tuần tự...")
    
    done_count = 0
    fail_count = 0
    
    for i, record in enumerate(pending_records, 1):
        log.info(f"[CRAWL] [{i}/{total}] Đang xử lý: {record['url']}")
        
        success = await crawl_article(crawler, record, config)
        
        if success:
            record["status"] = "done"
            done_count += 1
        else:
            record["status"] = "failed"
            fail_count += 1
            
        # Lưu checkpoint sau mỗi bài để đảm bảo có thể resume khi bị tắt đột ngột
        from discoverer import save_checkpoint
        save_checkpoint(checkpoint)
        
        # Jitter delay ngẫu nhiên từ 1.0 đến 2.5s để chống chặn IP
        if i < total:
            delay = random.uniform(DELAY_MIN, DELAY_MAX)
            await asyncio.sleep(delay)
            
    return done_count, fail_count

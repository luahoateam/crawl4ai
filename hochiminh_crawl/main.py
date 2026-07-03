import asyncio
import time
from crawl4ai import AsyncWebCrawler, BrowserConfig
from discoverer import run_discovery, load_checkpoint
from crawler import run_crawling
from logger import get_logger

log = get_logger()

async def main():
    start_time = time.time()
    
    log.info("==================================================")
    log.info(" BẮT ĐẦU PIPELINE CÀO DỮ LIỆU HOCHIMINH.VN")
    log.info("==================================================")
    
    # Giai đoạn 1: Khám phá URL bài viết bằng Playwright (Dynamic Clicking)
    log.info(">>> GIAI ĐOẠN 1: KHÁM PHÁ URL BÀI VIẾT (DISCOVERY PHASE)")
    checkpoint = await run_discovery()
    
    # Giai đoạn 2: Cào nội dung bài viết bằng Crawl4AI (AsyncWebCrawler)
    log.info(">>> GIAI ĐOẠN 2: CÀO NỘI DUNG VÀ GHI FILE MARKDOWN (CRAWL PHASE)")
    
    browser_config = BrowserConfig(
        headless=True,
        java_script_enabled=True,
    )
    
    done_count = 0
    fail_count = 0
    
    async with AsyncWebCrawler(config=browser_config) as crawler:
        done_count, fail_count = await run_crawling(crawler, checkpoint)
        
    # Tính thời gian chạy
    elapsed_time = time.time() - start_time
    minutes, seconds = divmod(int(elapsed_time), 60)
    
    # Đọc lại checkpoint hoàn chỉnh
    final_checkpoint = load_checkpoint()
    total_urls = len(final_checkpoint)
    skipped_count = total_urls - done_count - fail_count
    
    # In ra báo cáo tổng kết đẹp mắt
    print("\n" + "=" * 50)
    print("           BÁO CÁO TỔNG KẾT CÀO DỮ LIỆU")
    print("=" * 50)
    print(f" Tổng URL phát hiện trong checkpoint : {total_urls:,}")
    print(f" ✅ Cào thành công mới              : {done_count:,}")
    print(f" ⚠️  Bỏ qua (đã cào từ trước)         : {skipped_count:,}")
    print(f" ❌ Thất bại                         : {fail_count:,}")
    print(f" Thời gian thực thi                  : {minutes} phút {seconds} giây")
    print(f" Thư mục lưu kết quả                 : ./output/")
    print(f" File log chi tiết                   : ./crawl.log")
    print("=" * 50 + "\n")

if __name__ == "__main__":
    asyncio.run(main())

import json
import os
import re
from playwright.async_api import async_playwright
from config import BASE_URL, CATEGORIES, CHECKPOINT_FILE
from logger import get_logger

log = get_logger()

def is_article_url(href: str, category_slug: str) -> bool:
    """
    Kiểm tra xem một đường liên kết (href) có phải là URL bài viết chi tiết hay không.
    Quy luật: Path kết thúc bằng '-[số ID]' (Ví dụ: -11439 hoặc -2690) hoặc '.html'.
    Loại trừ các chuyên mục tư liệu media.
    """
    if not href:
        return False
        
    # Chuẩn hóa link relative thành absolute
    if href.startswith("/"):
        href = BASE_URL + href
    elif not href.startswith("http"):
        return False

    # Bỏ query string để kiểm tra path
    path = href.split("?")[0]
    
    # Check id số ở cuối (ví dụ: -2035) hoặc kết thúc bằng .html
    match_id = re.search(r"-\d+$", path)
    match_html = path.endswith(".html")
    
    if not (match_id or match_html):
        return False
        
    # Loại trừ các link video, audio, ảnh
    if any(x in path for x in ["/tu-lieu-video/", "/tu-lieu-anh/", "/tu-lieu-audio/", "/audio/"]):
        return False
        
    return True

def load_checkpoint() -> dict:
    """Đọc checkpoint hiện có từ file JSON, trả về dict {url: record}."""
    if os.path.exists(CHECKPOINT_FILE):
        try:
            with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
                records = json.load(f)
            return {r["url"]: r for r in records}
        except Exception as e:
            log.error(f"Lỗi khi đọc file checkpoint: {e}")
    return {}

def save_checkpoint(checkpoint: dict):
    """Ghi toàn bộ checkpoint hiện tại ra file JSON."""
    try:
        with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
            json.dump(list(checkpoint.values()), f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.error(f"Lỗi khi ghi file checkpoint: {e}")

async def discover_category_urls(playwright, category: dict, checkpoint: dict) -> int:
    """
    Duyệt qua tất cả các trang phân trang của một chuyên mục bằng Playwright.
    Click vào nút 'Next' động và trích xuất tất cả các link bài viết chi tiết.
    """
    new_count = 0
    url = category["url"]
    slug = category["slug"]
    
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    page = await context.new_page()
    
    log.info(f"[DISCOVER] Khám phá chuyên mục: {category['name']} ({url})")
    
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(2000)  # Đợi JS render xong
        
        page_num = 1
        
        while True:
            # Lấy tất cả các thẻ a có href trên trang hiện tại
            links = await page.eval_on_selector_all("a[href]", "elements => elements.map(el => el.getAttribute('href'))")
            
            # Lọc ra các link bài viết hợp lệ
            article_urls = []
            for href in links:
                if is_article_url(href, slug):
                    # Chuẩn hóa relative url thành absolute url
                    if href.startswith("/"):
                        href = BASE_URL + href
                    article_urls.append(href)
            
            # Loại bỏ trùng lặp trong trang hiện tại
            unique_articles = list(set(article_urls))
            
            # Đánh dấu và đếm số lượng URL mới
            new_in_page = 0
            for a_url in unique_articles:
                if a_url not in checkpoint:
                    checkpoint[a_url] = {
                        "url": a_url,
                        "category": category["name"],
                        "slug": slug,
                        "status": "pending"
                    }
                    new_count += 1
                    new_in_page += 1
            
            log.info(f"[DISCOVER] {category['name']} | Trang {page_num}: tìm thấy {len(unique_articles)} bài, {new_in_page} bài mới")
            
            if new_in_page > 0:
                save_checkpoint(checkpoint)
                
            # Phát hiện nút Next phân trang động
            next_btn = page.locator("div.default-pagination a.next, #pagination23 a.next")
            
            if await next_btn.count() > 0:
                log.info(f"[DISCOVER] Đang chuyển sang trang {page_num + 1}...")
                
                # Lưu HTML trước khi click để so sánh xem DOM có thay đổi không
                old_html = await page.content()
                
                try:
                    await next_btn.click(timeout=5000)
                    await page.wait_for_timeout(2500)  # Đợi AJAX load xong dữ liệu mới
                    
                    new_html = await page.content()
                    if old_html == new_html:
                        log.info("[DISCOVER] Nội dung trang không đổi sau khi click Next. Dừng phân trang.")
                        break
                except Exception as e:
                    log.warning(f"[DISCOVER] Lỗi click Next hoặc timeout: {e}. Dừng phân trang.")
                    break
                    
                page_num += 1
            else:
                log.info("[DISCOVER] Không tìm thấy nút Next phân trang. Kết thúc duyệt chuyên mục.")
                break
                
    except Exception as e:
        log.error(f"[DISCOVER] Lỗi khi duyệt chuyên mục {category['name']}: {e}")
    finally:
        await browser.close()
        
    return new_count

async def run_discovery() -> dict:
    """Chạy khám phá link cho toàn bộ danh mục cấu hình."""
    checkpoint = load_checkpoint()
    total_new = 0
    
    async with async_playwright() as playwright:
        for category in CATEGORIES:
            new = await discover_category_urls(playwright, category, checkpoint)
            total_new += new
            log.info(f"[DISCOVER] Hoàn thành {category['name']}: thêm {new} bài viết mới")
            
    log.info(f"[DISCOVER] ========================================")
    log.info(f"[DISCOVER] TỔNG HỢP DISCOVER: Tìm thấy {total_new} URL bài viết mới.")
    log.info(f"[DISCOVER] ========================================")
    return checkpoint

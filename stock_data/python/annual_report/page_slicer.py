import re

def extract_page_number(line: str):
    """
    Trích xuất số trang từ tiêu đề '# Trang N'.
    Ví dụ: '# Trang 12' -> 12
    """
    match = re.match(r'^#\s+Trang\s+(\d+)', line.strip())
    if match:
        return int(match.group(1))
    return None

def is_toc_page(text: str) -> bool:
    """
    Kiểm tra xem trang có phải là trang Mục lục hay không.
    Dấu hiệu: Chứa 'mục lục' hoặc chứa nhiều dòng có dấu chấm chấm kéo dài '....'
    """
    text_lower = text.lower()
    if 'mục lục' in text_lower:
        return True
    # Đếm số lượng dấu chấm kéo dài (ví dụ: '...' hoặc '....')
    dots_count = len(re.findall(r'\.{3,}', text))
    if dots_count >= 3:
        return True
    return False

def slice_pages(md_content: str, keywords: list[str], window_size: int = 15) -> str | None:
    """
    Phân tích file markdown và cắt slice từ trang chứa keywords.
    Bỏ qua các trang Mục lục để tránh match nhầm.
    """
    if not md_content:
        return None

    # Tách tài liệu thành các trang
    pages = []
    current_page_num = None
    current_page_lines = []

    lines = md_content.splitlines()
    for line in lines:
        page_num = extract_page_number(line)
        if page_num is not None:
            # Lưu trang trước đó
            if current_page_num is not None:
                pages.append((current_page_num, '\n'.join(current_page_lines)))
            current_page_num = page_num
            current_page_lines = [line]
        else:
            if current_page_num is not None:
                current_page_lines.append(line)
            else:
                # Dòng trước khi gặp `# Trang` đầu tiên, bỏ qua hoặc gom vào trang 0
                pass

    # Lưu trang cuối cùng
    if current_page_num is not None:
        pages.append((current_page_num, '\n'.join(current_page_lines)))

    if not pages:
        return None

    # Tìm trang đầu tiên chứa keywords (bỏ qua trang mục lục)
    start_idx = -1
    for idx, (page_num, page_text) in enumerate(pages):
        # Bỏ qua 5 trang đầu tiên hoặc trang có cấu trúc mục lục
        if idx < 5 or is_toc_page(page_text):
            continue
            
        page_text_lower = page_text.lower()
        if any(kw.lower() in page_text_lower for kw in keywords):
            start_idx = idx
            break

    # Nếu không tìm thấy và bỏ qua TOC, ta thử quét lại toàn bộ (bao gồm cả < 5 trang nếu không phải TOC)
    if start_idx == -1:
        for idx, (page_num, page_text) in enumerate(pages):
            if is_toc_page(page_text):
                continue
            page_text_lower = page_text.lower()
            if any(kw.lower() in page_text_lower for kw in keywords):
                start_idx = idx
                break

    if start_idx == -1:
        return None

    # Cắt slice theo window_size
    end_idx = min(start_idx + window_size, len(pages))
    sliced_pages = pages[start_idx:end_idx]

    # Gộp nội dung
    return '\n\n'.join(page_text for _, page_text in sliced_pages)

import logging
from config import LOG_FILE

def get_logger(name: str = "crawl4ai_hcm") -> logging.Logger:
    """Trả về logger đã được cấu hình ghi đồng thời ra console và file log."""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # Tránh thêm trùng lặp handler nếu import nhiều lần

    logger.setLevel(logging.DEBUG)

    # Format log rõ ràng có thời gian và level
    fmt = "%(asctime)s [%(levelname)s] %(message)s"
    formatter = logging.Formatter(fmt, datefmt="%Y-%m-%d %H:%M:%S")

    # Handler ghi ra file crawl.log (lưu tất cả thông tin debug)
    fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(formatter)

    # Handler hiển thị trên console (chỉ các thông tin INFO trở lên)
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(formatter)

    logger.addHandler(fh)
    logger.addHandler(ch)
    return logger

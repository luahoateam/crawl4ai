BASE_URL = "https://hochiminh.vn"

# Danh sách 11 chuyên mục mục tiêu cào dữ liệu
CATEGORIES = [
    {
        "name": "Tiểu sử Hồ Chí Minh",
        "url": f"{BASE_URL}/cuoc-doi-su-nghiep/tieu-su-ho-chi-minh",
        "slug": "tieu-su",
    },
    {
        "name": "Biên niên Tiểu sử Hồ Chí Minh",
        "url": f"{BASE_URL}/cuoc-doi-su-nghiep/bien-nien-tieu-su-ho-chi-minh",
        "slug": "bien-nien-tieu-su",
    },
    {
        "name": "Tác phẩm về Hồ Chí Minh - Trong nước",
        "url": f"{BASE_URL}/tac-pham-ve-ho-chi-minh/tac-pham-trong-nuoc?categoryId=102001162",
        "slug": "tac-pham-trong-nuoc",
    },
    {
        "name": "Tác phẩm về Hồ Chí Minh - Nước ngoài",
        "url": f"{BASE_URL}/tac-pham-ve-ho-chi-minh/tac-pham-nuoc-ngoai?categoryId=102001161",
        "slug": "tac-pham-nuoc-ngoai",
    },
    {
        "name": "Những bài báo của Hồ Chí Minh",
        "url": f"{BASE_URL}/tac-pham-cua-ho-chi-minh/nhung-bai-bao-cua-bac?categoryId=102001156",
        "slug": "nhung-bai-bao-cua-bac",
    },
    {
        "name": "Hồ Chí Minh toàn tập",
        "url": f"{BASE_URL}/tac-pham-cua-ho-chi-minh/ho-chi-minh-toan-tap?categoryId=102001160",
        "slug": "ho-chi-minh-toan-tap",
    },
    {
        "name": "Hồ Chí Minh tuyển tập",
        "url": f"{BASE_URL}/tac-pham-cua-ho-chi-minh/ho-chi-minh-tuyen-tap?categoryId=102001159",
        "slug": "ho-chi-minh-tuyen-tap",
    },
    {
        "name": "Hoạt động quốc tế của Hồ Chí Minh",
        "url": f"{BASE_URL}/ho-chi-minh-va-the-gioi/hoat-dong-quoc-te-cua-ho-chi-minh",
        "slug": "hoat-dong-quoc-te",
    },
    {
        "name": "Bạn bè quốc tế với Hồ Chí Minh",
        "url": f"{BASE_URL}/ho-chi-minh-va-the-gioi/ban-be-quoc-te-voi-ho-chi-minh",
        "slug": "ban-be-quoc-te",
    },
    {
        "name": "Di chúc",
        "url": f"{BASE_URL}/hoc-va-lam-theo-bac/di-chuc",
        "slug": "di-chuc",
    },
    {
        "name": "Học và làm theo Bác",
        "url": f"{BASE_URL}/hoc-va-lam-theo-bac/hoc-va-lam-theo-bac",
        "slug": "hoc-va-lam-theo-bac",
    },
]

# Cài đặt tốc độ và thời gian chờ (để cào an toàn)
DELAY_MIN = 1.0       # Giây tối thiểu nghỉ giữa các request
DELAY_MAX = 2.5       # Giây tối đa nghỉ giữa các request
MAX_RETRIES = 3       # Số lần thử lại tối đa cho mỗi URL bài viết nếu gặp lỗi
PAGE_TIMEOUT = 30000  # Milliseconds (30 giây)

# Đường dẫn file và thư mục lưu dữ liệu
OUTPUT_DIR = "output"
CHECKPOINT_FILE = "checkpoint.json"
LOG_FILE = "crawl.log"

"""
merge_existing.py
-----------------
Ghép tất cả các file doc_*.md trong mỗi thư mục output/<pdf_stem>/
thành một file markdown duy nhất: output/<pdf_stem>/<pdf_stem>.md

Cấu trúc file đầu ra:
    ## Trang 1

    <nội dung trang 1>

    ---
    ## Trang 2

    <nội dung trang 2>

    ---
    ...

Chạy:
    python merge_existing.py
"""

import logging
import re
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("merge_existing")


OUTPUT_DIR = Path(__file__).parent / "output"


def natural_sort_key(path: Path) -> list:
    """Sắp xếp tự nhiên cho doc_0.md, doc_1.md, ..., doc_10.md, ..."""
    parts = re.split(r"(\d+)", path.stem)
    return [int(p) if p.isdigit() else p.lower() for p in parts]


def merge_folder(folder: Path) -> bool:
    """
    Ghép tất cả doc_*.md trong folder thành <folder_name>.md.
    Trả về True nếu thành công.
    """
    md_files = sorted(folder.glob("doc_*.md"), key=natural_sort_key)

    if not md_files:
        logger.warning(f"  [SKIP] Không tìm thấy file doc_*.md trong: {folder.name}")
        return False

    output_file = folder / f"{folder.name}.md"

    segments = []
    for idx, md_file in enumerate(md_files, start=1):
        try:
            content = md_file.read_text(encoding="utf-8").strip()
        except Exception as e:
            logger.error(f"  [ERROR] Không đọc được {md_file.name}: {e}")
            content = f"*[Lỗi đọc file: {e}]*"

        segments.append(f"## Trang {idx}\n\n{content}")

    merged_content = "\n\n---\n".join(segments) + "\n"

    try:
        output_file.write_text(merged_content, encoding="utf-8")
        logger.info(
            f"  [OK] {folder.name!r} -> {output_file.name} ({len(md_files)} trang)"
        )
        return True
    except Exception as e:
        logger.error(f"  [ERROR] Không ghi được file {output_file}: {e}")
        return False


def main():
    if not OUTPUT_DIR.exists():
        logger.error(f"Thư mục output không tồn tại: {OUTPUT_DIR}")
        return

    folders = sorted(
        [f for f in OUTPUT_DIR.iterdir() if f.is_dir()],
        key=lambda p: p.name.lower(),
    )

    logger.info(f"Tìm thấy {len(folders)} thư mục trong {OUTPUT_DIR}")

    success, skipped, failed = 0, 0, 0
    for folder in folders:
        result = merge_folder(folder)
        if result is True:
            success += 1
        elif result is False:
            skipped += 1
        else:
            failed += 1

    logger.info(
        f"\n{'='*50}\n"
        f"Hoàn tất: {success} thành công | {skipped} bỏ qua | {failed} lỗi\n"
        f"{'='*50}"
    )


if __name__ == "__main__":
    main()

import pytest
import os
import shutil
from python.annual_report.md_builder import build_markdown_report

TEMP_MD_DIR = "scratch/test_md_builder"

@pytest.fixture(autouse=True)
def setup_and_teardown():
    os.makedirs(TEMP_MD_DIR, exist_ok=True)
    yield
    if os.path.exists(TEMP_MD_DIR):
        shutil.rmtree(TEMP_MD_DIR)

def test_build_markdown_report_success():
    pages = [
        "# Trang 1\nĐây là nội dung trang 1.",
        "# Trang 2\nĐây là nội dung trang 2.",
        "# Trang 3\nĐây là nội dung trang 3."
    ]
    
    filepath = build_markdown_report(
        pages=pages,
        symbol="VNM",
        year=2024,
        output_dir=TEMP_MD_DIR
    )
    
    assert filepath is not None
    assert os.path.exists(filepath)
    assert filepath.endswith("VNM_2024.md")
    
    # Verify file content
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Check for metadata yaml frontmatter
    assert "---" in content
    assert "ticker: VNM" in content
    assert "year: 2024" in content
    assert "document_type: bctn" in content
    assert "page_count: 3" in content
    
    # Check for pages content joining
    assert "Đây là nội dung trang 1." in content
    assert "Đây là nội dung trang 2." in content
    assert "Đây là nội dung trang 3." in content
    
    # Pages should be separated by standard markdown page breaks or newlines
    assert "Trang 1" in content
    assert "Trang 2" in content
    assert "Trang 3" in content

def test_build_markdown_report_empty_pages():
    filepath = build_markdown_report(
        pages=[],
        symbol="VNM",
        year=2024,
        output_dir=TEMP_MD_DIR
    )
    assert filepath is None

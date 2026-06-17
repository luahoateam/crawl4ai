import argparse
import json
import sys
import os

from python.annual_report.page_slicer import slice_pages
from python.annual_report.r2_fetcher import download_r2_object
from python.annual_report.shareholder_extractor import ShareholderExtractor
from python.annual_report.risk_extractor import RiskExtractor

def main():
    # Cấu hình encoding utf-8 cho stdout để tránh lỗi encoding trên Windows
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    parser = argparse.ArgumentParser(description="Annual Report Data Extraction Pipeline")
    parser.add_argument("--ticker", required=True, help="Stock ticker (e.g. VNM)")
    parser.add_argument("--year", type=int, default=2024, help="Report year")
    parser.add_argument("--r2_key", help="R2 object key pattern")
    parser.add_argument("--token_path", default="xiaomi_token.txt", help="Xiaomi token file path")
    parser.add_argument("--local_file", help="Path to local markdown file (offline bypass R2)")
    
    args = parser.parse_args()

    content = None
    if args.local_file:
        if os.path.exists(args.local_file):
            print(f"Reading local file: {args.local_file}", file=sys.stderr, flush=True)
            with open(args.local_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        else:
            print(f"Error: Local file {args.local_file} not found.", file=sys.stderr, flush=True)
            sys.exit(1)
    elif args.r2_key:
        print(f"Downloading from R2: {args.r2_key}", file=sys.stderr, flush=True)
        # Sử dụng ticker để tạo tên file tạm duy nhất tránh ghi đè
        temp_name = f"temp_r2_{args.ticker}_{args.year}.md"
        content = download_r2_object(args.r2_key, temp_name)
    else:
        print("Error: Either --r2_key or --local_file must be specified.", file=sys.stderr, flush=True)
        sys.exit(1)

    if not content:
        print(f"Error: Failed to obtain report content for {args.ticker}.", file=sys.stderr, flush=True)
        sys.exit(1)

    # 1. Cắt slice & Extract Cơ cấu Cổ đông
    shareholder_keywords = ['cơ cấu cổ đông', 'cổ đông lớn', 'danh sách cổ đông', 'quan hệ nhà đầu tư']
    shareholder_text = slice_pages(content, shareholder_keywords, window_size=15)
    
    shareholder_data = {"shareholder_structures": []}
    if shareholder_text:
        print("Sliced shareholder segment successfully. Running extraction...", file=sys.stderr, flush=True)
        try:
            sh_extractor = ShareholderExtractor(token_file_path=args.token_path)
            shareholder_data = sh_extractor.extract(shareholder_text)
        except Exception as e:
            print(f"Shareholder extraction failed: {e}. Skipping.", file=sys.stderr, flush=True)
    else:
        print("Shareholder keywords not found in document. Returning empty list.", file=sys.stderr, flush=True)

    # 2. Cắt slice & Extract Rủi ro doanh nghiệp tự khai
    risk_keywords = ['quản trị rủi ro', 'rủi ro trọng yếu', 'các yếu tố rủi ro', 'rủi ro kinh doanh']
    risk_text = slice_pages(content, risk_keywords, window_size=15)

    risk_data = {"business_risks": []}
    if risk_text:
        print("Sliced business risk segment successfully. Running extraction...", file=sys.stderr, flush=True)
        try:
            risk_extractor = RiskExtractor(token_file_path=args.token_path)
            risk_data = risk_extractor.extract(risk_text)
        except Exception as e:
            print(f"Risk extraction failed: {e}. Skipping.", file=sys.stderr, flush=True)
    else:
        print("Risk keywords not found in document. Returning empty list.", file=sys.stderr, flush=True)

    # 3. Gộp kết quả
    combined_result = {
        "shareholder_structures": shareholder_data.get("shareholder_structures", []),
        "business_risks": risk_data.get("business_risks", [])
    }

    # Xuất ra stdout dưới dạng JSON chuẩn
    print(json.dumps(combined_result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()

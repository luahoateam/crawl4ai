import sys
import argparse
import json
from extractor import Extractor

def main():
    parser = argparse.ArgumentParser(description="Vietnamese Stock Data Enrichment Extractor CLI")
    parser.add_argument("--file", required=True, help="Path to the OCR text file")
    parser.add_argument("--model", default="general", help="Business model of the company")
    parser.add_argument("--token-file", default="xiaomi_token.txt", help="Path to the Xiaomi API token file")
    
    args = parser.parse_args()
    
    try:
        # Read the OCR text file
        with open(args.file, "r", encoding="utf-8") as f:
            text = f.read()
            
        # Initialize extractor and perform enrichment
        extractor = Extractor(business_model=args.model, token_file_path=args.token_file)
        result = extractor.extract(text)
        
        # Safe stdout reconfigure for UTF-8 on Windows
        sys.stdout.reconfigure(encoding='utf-8')
        # Output clean JSON to stdout
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        try:
            sys.stderr.reconfigure(encoding='utf-8')
        except Exception:
            pass
        print(f"Error during extraction: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

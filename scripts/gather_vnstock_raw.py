#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
gather_vnstock_raw.py
Tải dữ liệu thô (tài chính định lượng, kế hoạch năm, tin tức doanh nghiệp)
từ hệ sinh thái vnstock cho rổ VN30 hoặc các mã được chỉ định.
Lưu vào thư mục stock_data/vnstock_raw/{SYMBOL}/2025/
"""

import os
import sys

# Ép buộc stdout và stderr sử dụng UTF-8 để tránh lỗi encoding trên console Windows
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except AttributeError:
    # Python cũ không có reconfigure
    pass

# Thêm đường dẫn site-packages của user .venv vào sys.path để nạp vnstock_data
user_site_packages = os.path.expanduser(r"~\.venv\Lib\site-packages")
if os.path.exists(user_site_packages) and user_site_packages not in sys.path:
    sys.path.insert(0, user_site_packages)

import json
import argparse
import pandas as pd
from datetime import datetime

# Import vnstock libraries
try:
    from vnstock_data import Fundamental, Finance, Company, Listing
except ImportError as e:
    print(f"[ERROR] Không thể import vnstock_data: {e}. Vui lòng kiểm tra lại môi trường ảo.")
    sys.exit(1)

# Danh sách VN30 mặc định để dự phòng (bền bỉ)
VN30_FALLBACK = [
    'ACB', 'BCM', 'BID', 'BVH', 'CTG', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG',
    'MBB', 'LPB', 'MSN', 'MWG', 'PLX', 'POW', 'SAB', 'SHB', 'SSB', 'SSI',
    'STB', 'TCB', 'TPB', 'VCB', 'VJC', 'VHM', 'VIC', 'VNM', 'VPB', 'VRE'
]

def load_env_key():
    """Tải API key từ file .env nếu có"""
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                trimmed = line.strip()
                if trimmed and not trimmed.startswith('#') and '=' in trimmed:
                    key, val = trimmed.split('=', 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key == 'API_KEY' or key == 'VNSTOCK_API_KEY':
                        os.environ['VNSTOCK_API_KEY'] = val
                        os.environ['API_KEY'] = val

def get_vn30_symbols():
    """Lấy danh sách VN30 từ API, nếu lỗi dùng fallback"""
    try:
        listing = Listing(source="kbs")
        df = listing.indices(index="VN30")
        if df is not None and not df.empty:
            # Tùy theo cấu trúc DataFrame trả về, thường có cột 'symbol' hoặc 'ticker'
            for col in ['symbol', 'ticker', 'code']:
                if col in df.columns:
                    return df[col].astype(str).str.upper().tolist()
            # Nếu không tìm thấy cột chuẩn, lấy cột đầu tiên
            return df.iloc[:, 0].astype(str).str.upper().tolist()
    except Exception as e:
        print(f"[WARN] Không lấy được VN30 từ API ({e}). Dùng danh sách fallback.")
    return VN30_FALLBACK

def save_dataframe_to_json(df, file_path):
    """Lưu pandas DataFrame sang file JSON một cách an toàn"""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    if df is None or (isinstance(df, pd.DataFrame) and df.empty):
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump({}, f, ensure_ascii=False, indent=2)
        return False

    try:
        # Chuyển đổi DataFrame sang dict định dạng records
        if isinstance(df, pd.DataFrame):
            # Reset index để tránh mất trường index quan trọng
            df_reset = df.reset_index()
            # Xử lý các kiểu dữ liệu không serialize được (datetime)
            for col in df_reset.columns:
                if pd.api.types.is_datetime64_any_dtype(df_reset[col]):
                    df_reset[col] = df_reset[col].dt.strftime('%Y-%m-%d %H:%M:%S')
            data = df_reset.to_dict(orient='records')
        else:
            data = df
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[ERROR] Lỗi khi ghi file {file_path}: {e}")
        # Ghi dự phòng thô dạng chuỗi
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump({"error": str(e), "raw_string": str(df)}, f, ensure_ascii=False, indent=2)
        return False

def gather_symbol_data(symbol, year, output_dir, force=False):
    """Thu thập dữ liệu thô cho một mã cụ thể trong năm chỉ định"""
    symbol = symbol.upper()
    target_dir = os.path.join(output_dir, symbol, str(year))
    os.makedirs(target_dir, exist_ok=True)

    print(f"\n[GATHER] ======= Thu thập dữ liệu {symbol} (Năm {year}) =======")

    # 1. Tải Sức khỏe Tài chính (financial_health) chuẩn hóa phân ngành
    # Dùng source="mas" hoặc "kbs" (ở đây dùng Fundamental mặc định)
    fh_file = os.path.join(target_dir, "financial_health.json")
    if not os.path.exists(fh_file) or force:
        try:
            print(f"[GATHER] -> Tải financial_health cho {symbol}...")
            fun = Fundamental(source="mas")
            # Tải tối đa 4 kỳ gần nhất để bao quát năm 2025
            df_fh = fun.equity(symbol).financial_health(scorecard="auto", lang="vi", limit=4)
            save_dataframe_to_json(df_fh, fh_file)
            print(f"[GATHER] ✓ Đã lưu financial_health.")
        except Exception as e:
            print(f"[WARN] Không tải được financial_health cho {symbol}: {e}")
            # Thử phương án dự phòng lấy ratio cơ bản từ Finance
            try:
                print(f"[GATHER] -> Thử dự phòng: Tải ratios cơ bản...")
                fin = Finance(source="kbs", symbol=symbol)
                df_ratio = fin.ratio()
                save_dataframe_to_json(df_ratio, fh_file)
                print(f"[GATHER] ✓ Đã lưu ratios dự phòng.")
            except Exception as ex:
                print(f"[ERROR] Thất bại hoàn toàn tải dữ liệu tài chính cho {symbol}: {ex}")
    else:
        print(f"[GATHER] - Bỏ qua financial_health (đã tồn tại).")

    # 2. Tải Kế hoạch kinh doanh năm mới (annual_plan)
    ap_file = os.path.join(target_dir, "annual_plan.json")
    if not os.path.exists(ap_file) or force:
        try:
            print(f"[GATHER] -> Tải annual_plan cho {symbol}...")
            fin = Finance(source="mas", symbol=symbol)
            df_plan = fin.annual_plan()
            save_dataframe_to_json(df_plan, ap_file)
            print(f"[GATHER] ✓ Đã lưu annual_plan.")
        except Exception as e:
            print(f"[WARN] Không tải được annual_plan cho {symbol}: {e}")
            # Ghi file rỗng để tránh lỗi pipeline
            save_dataframe_to_json(None, ap_file)
    else:
        print(f"[GATHER] - Bỏ qua annual_plan (đã tồn tại).")

    # 3. Tải Tin tức doanh nghiệp (news)
    news_file = os.path.join(target_dir, "news.json")
    if not os.path.exists(news_file) or force:
        try:
            print(f"[GATHER] -> Tải tin tức liên quan cho {symbol}...")
            comp = Company(source="kbs", symbol=symbol)
            df_news = comp.news()
            save_dataframe_to_json(df_news, news_file)
            print(f"[GATHER] ✓ Đã lưu tin tức.")
        except Exception as e:
            print(f"[WARN] Không tải được tin tức qua Company cho {symbol}: {e}")
            # Thử phương án dự phòng lấy tin qua vnstock_news nếu có
            try:
                from vnstock_news import EnhancedNewsCrawler
                import asyncio
                
                print(f"[GATHER] -> Thử dự phòng: Crawl tin qua vnstock_news...")
                crawler = EnhancedNewsCrawler(cache_enabled=True)
                # Dùng asyncio run thô
                async def fetch():
                    return await crawler.fetch_articles_async(
                        sources=["https://cafef.vn/latest-news-sitemap.xml"],
                        top_n=50
                    )
                loop = asyncio.get_event_loop()
                df_news_crawler = loop.run_until_complete(fetch())
                # Lọc tin liên quan đến symbol
                if df_news_crawler is not None and not df_news_crawler.empty:
                    df_filtered = df_news_crawler[df_news_crawler['title'].str.contains(symbol, case=False, na=False) |
                                                  df_news_crawler['content'].str.contains(symbol, case=False, na=False)]
                    save_dataframe_to_json(df_filtered, news_file)
                    print(f"[GATHER] ✓ Đã lưu {len(df_filtered)} tin tức lọc từ crawler.")
                else:
                    save_dataframe_to_json(None, news_file)
            except Exception as ex:
                print(f"[ERROR] Thất bại hoàn toàn tải tin tức cho {symbol}: {ex}")
                save_dataframe_to_json(None, news_file)
    else:
        print(f"[GATHER] - Bỏ qua news (đã tồn tại).")

    # 4. Tải Thông tin tổng quan doanh nghiệp (overview) để phân loại ngành
    overview_file = os.path.join(target_dir, "overview.json")
    if not os.path.exists(overview_file) or force:
        try:
            print(f"[GATHER] -> Tải thông tin tổng quan (overview) cho {symbol}...")
            comp = Company(source="vci", symbol=symbol)
            df_overview = comp.overview()
            save_dataframe_to_json(df_overview, overview_file)
            print(f"[GATHER] ✓ Đã lưu overview.")
        except Exception as e:
            print(f"[WARN] Không tải được overview qua VCI cho {symbol}: {e}")
            try:
                print(f"[GATHER] -> Thử lại với KBS...")
                comp = Company(source="kbs", symbol=symbol)
                df_overview = comp.overview()
                save_dataframe_to_json(df_overview, overview_file)
                print(f"[GATHER] ✓ Đã lưu overview bằng KBS.")
            except Exception as ex:
                print(f"[ERROR] Thất bại hoàn toàn tải overview cho {symbol}: {ex}")
                save_dataframe_to_json(None, overview_file)
    else:
        print(f"[GATHER] - Bỏ qua overview (đã tồn tại).")

def main():
    parser = argparse.ArgumentParser(description="Tải dữ liệu thô tài chính & tin tức từ vnstock cho rổ VN30.")
    parser.add_argument("--symbols", type=str, help="Danh sách mã cổ phiếu phân tách bằng dấu phẩy (VD: HPG,TCB,VHM)")
    parser.add_argument("--vn30", action="store_true", help="Tải cho toàn bộ rổ VN30")
    parser.add_argument("--all", action="store_true", help="Tải cho toàn bộ cổ phiếu trên thị trường")
    parser.add_argument("--year", type=int, default=2025, help="Năm dữ liệu cần tải (mặc định: 2025)")
    parser.add_argument("--force", action="store_true", help="Ghi đè cache cũ")
    parser.add_argument("--output-dir", type=str, default="stock_data/vnstock_raw", help="Thư mục lưu dữ liệu thô")
    args = parser.parse_args()

    # Load env keys
    load_env_key()

    symbols = []
    if args.symbols:
        symbols = [s.strip().upper() for s in args.symbols.split(',') if s.strip()]
    elif args.vn30:
        symbols = get_vn30_symbols()
    elif args.all:
        try:
            print("[GATHER] Lấy danh sách toàn bộ mã chứng khoán trên sàn...")
            listing = Listing(source="kbs")
            all_df = listing.all_symbols()
            if isinstance(all_df, pd.DataFrame) and not all_df.empty:
                # Tìm cột chứa ký hiệu symbol
                symbol_col = 'symbol' if 'symbol' in all_df.columns else all_df.columns[0]
                all_syms = all_df[symbol_col].astype(str).tolist()
            else:
                all_syms = list(all_df)
            
            # Chỉ lấy các mã cổ phiếu chuẩn (3 ký tự chữ viết hoa)
            symbols = [s.upper() for s in all_syms if len(s) == 3 and s.isalpha()]
            print(f"[GATHER] Lấy thành công {len(symbols)} mã cổ phiếu chuẩn.")
        except Exception as e:
            print(f"[ERROR] Không thể lấy toàn bộ danh sách mã từ Listing: {e}")
            sys.exit(1)
    else:
        print("[ERROR] Bạn phải chỉ định --symbols, --vn30 hoặc --all để chạy.")
        sys.exit(1)

    print(f"[GATHER] Bắt đầu tải dữ liệu thô cho {len(symbols)} mã cổ phiếu...")
    
    # Tạo thư mục đầu ra
    output_path = os.path.abspath(args.output_dir)
    os.makedirs(output_path, exist_ok=True)

    success_count = 0
    for symbol in symbols:
        try:
            gather_symbol_data(symbol, args.year, output_path, force=args.force)
            success_count += 1
        except Exception as e:
            print(f"[ERROR] Lỗi thu thập {symbol}: {e}")

    print(f"\n[GATHER] Hoàn thành thu thập {success_count}/{len(symbols)} mã.")

if __name__ == "__main__":
    main()

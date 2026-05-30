import time
from vnstock_data import Reference
from vnstock import Listing

def get_all_tickers():
    """
    Fetch all listed tickers from vnstock_data or fallback to free vnstock.
    Returns:
        list of dict: [{"ticker": "VNM", "industry": "Sữa"}]
    """
    try:
        ref = Reference()
        df = ref.equity.list()
        # Normalize column names if needed
        if 'symbol' in df.columns:
            df = df.rename(columns={'symbol': 'ticker'})
        if 'icb_name3' in df.columns:
            df = df.rename(columns={'icb_name3': 'industry'})
            
        # Standardize columns
        ticker_col = 'ticker' if 'ticker' in df.columns else df.columns[0]
        industry_col = 'industry' if 'industry' in df.columns else ('icb_name3' if 'icb_name3' in df.columns else df.columns[1])
        
        records = df[[ticker_col, industry_col]].to_dict(orient='records')
        return [{'ticker': r[ticker_col], 'industry': r[industry_col]} for r in records]
    except Exception as e:
        import sys
        print(f"WARNING: vnstock_data Reference failed ({e}). Falling back to free vnstock.Listing...", file=sys.stderr)
        try:
            listing = Listing()
            df = listing.all_symbols()
            records = df[['symbol']].to_dict(orient='records')
            return [{'ticker': r['symbol'], 'industry': 'Unknown'} for r in records]
        except Exception as e2:
            print(f"ERROR: Fallback to free vnstock also failed ({e2})", file=sys.stderr)
            raise e2



def build_seed_sql(tickers, year=2024):
    """
    Generates SQL INSERT statements to seed the annual_report_queue.
    """
    statements = []
    now = int(time.time())
    for t in tickers:
        ticker = t['ticker']
        row_id = f"{ticker}_{year}"
        # SQLite safe insert
        statements.append(
            f"INSERT OR IGNORE INTO annual_report_queue (id, ticker, year, status, created_at, updated_at) "
            f"VALUES ('{row_id}', '{ticker}', {year}, 'pending', {now}, {now});"
        )
    return statements

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', help='SQL output file path')
    parser.add_argument('--year', type=int, default=2024, help='Reporting year')
    args = parser.parse_args()
    
    try:
        tickers = get_all_tickers()
        statements = build_seed_sql(tickers, args.year)
        
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write('\n'.join(statements))
            print(f"SUCCESS: Wrote {len(statements)} SQL statements to {args.output}")
        else:
            print('\n'.join(statements))
    except Exception as e:
        import sys
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


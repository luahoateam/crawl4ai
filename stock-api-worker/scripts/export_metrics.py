import os
import sqlite3
import math

LOCAL_DB_PATH = "L:/Hung/crawl4ai/stock_data/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/14b7072239a9e756b0977ac572f7059d356c93a3ef705a91abdd563855bcdd03.sqlite"
OUTPUT_DIR = "L:/Hung/crawl4ai/stock-api-worker/migrations/seeds"

TABLE_BATCH_SIZE = {
    'financial_insights': 10,
    'audit_reports': 20
}
DEFAULT_BATCH_SIZE = 50

TABLE_ROWS_LIMIT = {
    'financial_insights': 100,
    'audit_reports': 200
}
DEFAULT_ROWS_PER_FILE = 1000

TABLES = [
    'processed_reports', 'audit_reports', 'general_metrics',
    'banking_metrics', 'securities_metrics', 'real_estate_metrics',
    'debts_breakdown', 'inventories_and_projects',
    'related_party_transactions', 'financial_insights'
]

def escape_val(v):
    if v is None:
        return 'NULL'
    if isinstance(v, (int, float)):
        return str(v)
    escaped = str(v).replace("'", "''")
    return f"'{escaped}'"

def write_sql_file(file_path, table, col_list_str, rows, batch_size):
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write("PRAGMA foreign_keys = OFF;\n")
        f.write(f"-- Auto-generated seed file for table: {table}\n\n")
        
        total_rows = len(rows)
        num_batches = math.ceil(total_rows / batch_size)
        for b in range(num_batches):
            batch_rows = rows[b*batch_size : (b+1)*batch_size]
            value_strs = []
            for row in batch_rows:
                val_str = ", ".join([escape_val(v) for v in row])
                value_strs.append(f"({val_str})")
            
            bulk_values = ",\n".join(value_strs)
            sql_statement = f"INSERT OR REPLACE INTO `{table}` ({col_list_str}) VALUES\n{bulk_values};\n"
            f.write(sql_statement)
            
        f.write("PRAGMA foreign_keys = ON;\n")

def main():
    print("Starting export from local SQLite to split SQL seed files...")
    
    if not os.path.exists(LOCAL_DB_PATH):
        print(f"Error: Local DB not found at {LOCAL_DB_PATH}")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Clean output dir
    for f in os.listdir(OUTPUT_DIR):
        if f.endswith('.sql'):
            os.remove(os.path.join(OUTPUT_DIR, f))
            
    conn = sqlite3.connect(LOCAL_DB_PATH)
    cursor = conn.cursor()
    
    for table in TABLES:
        print(f"Exporting table: {table}...")
        cursor.execute(f"PRAGMA table_info(`{table}`)")
        cols = [col[1] for col in cursor.fetchall()]
        col_list_str = ", ".join([f"`{c}`" for c in cols])
        
        cursor.execute(f"SELECT * FROM `{table}`")
        rows = cursor.fetchall()
        total_rows = len(rows)
        print(f"  Found {total_rows} records.")
        
        if total_rows == 0:
            print(f"  Skipping empty table: {table}")
            continue
            
        # Split into multiple files if too large
        rows_per_file = TABLE_ROWS_LIMIT.get(table, DEFAULT_ROWS_PER_FILE)
        batch_size = TABLE_BATCH_SIZE.get(table, DEFAULT_BATCH_SIZE)
        num_files = math.ceil(total_rows / rows_per_file)
        for i in range(num_files):
            file_rows = rows[i*rows_per_file : (i+1)*rows_per_file]
            suffix = f"_part{i+1}" if num_files > 1 else ""
            file_name = f"{table}{suffix}.sql"
            file_path = os.path.join(OUTPUT_DIR, file_name)
            
            write_sql_file(file_path, table, col_list_str, file_rows, batch_size)
            file_size_kb = os.path.getsize(file_path) / 1024
            print(f"  -> Written: {file_name} ({len(file_rows)} rows, {file_size_kb:.1f} KB)")
            
    conn.close()
    print("\nDone! All split seed files are ready under migrations/seeds/")

if __name__ == "__main__":
    main()

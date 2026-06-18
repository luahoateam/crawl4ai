import subprocess
import json
import concurrent.futures
import requests
import sys

# Thiết lập encoding utf-8 cho output
sys.stdout.reconfigure(encoding='utf-8')

DATABASE = "stock_db"

def run_wrangler_d1(query):
    cmd = [
        "npx", "wrangler", "d1", "execute", DATABASE,
        "--remote", "--command", query, "--json"
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding="utf-8")
        if res.returncode != 0:
            print(f"Wrangler error: {res.stderr}")
            return []
        
        trimmed = res.stdout.strip()
        json_match = trimmed[trimmed.find('['):trimmed.rfind(']')+1]
        if not json_match:
            return []
        parsed = json.loads(json_match)
        return parsed[0].get("results", []) if parsed else []
    except Exception as e:
        print(f"Exception executing query: {e}")
        return []

def check_url(doc):
    url = doc["file_url"]
    symbol = doc["symbol"]
    doc_id = doc["id"]
    
    try:
        headers = {'X-API-Key': 'Luahoachungkhoan@ssi'}
        r = requests.get(url, headers=headers, timeout=10)
        status_code = r.status_code
        is_empty = len(r.text) == 0 or r.text.strip() == ""
        return {
            "symbol": symbol,
            "id": doc_id,
            "status_code": status_code,
            "is_empty": is_empty
        }
    except Exception as e:
        return {
            "symbol": symbol,
            "id": doc_id,
            "status_code": 999,
            "is_empty": True
        }

def main():
    print("1. Đang truy vấn danh sách BCTN 2024 trong bảng financial_documents...")
    query_docs = "SELECT id, symbol, file_url FROM financial_documents WHERE document_type = 'bctn' AND year = 2024"
    docs = run_wrangler_d1(query_docs)
    print(f"Tìm thấy {len(docs)} tài liệu BCTN 2024 trong bảng financial_documents.")
    
    if not docs:
        print("Không có tài liệu nào để kiểm tra.")
        return

    print("\n2. Đang kiểm tra URL trên R2 để tìm các file bị thiếu (404)...")
    missing_docs = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = {executor.submit(check_url, doc): doc for doc in docs}
        for i, future in enumerate(concurrent.futures.as_completed(futures)):
            res = future.result()
            if res["status_code"] != 200 or res["is_empty"]:
                missing_docs.append(res)
            if (i + 1) % 100 == 0 or (i + 1) == len(docs):
                print(f"  - Đã kiểm tra xong: {i+1}/{len(docs)} files...")

    print(f"\nTìm thấy {len(missing_docs)} file bị thiếu hoặc rỗng trên R2.")
    
    if not missing_docs:
        print("Không có file nào bị thiếu. Không cần dọn dẹp.")
        return
        
    missing_symbols = sorted(list(set([d["symbol"] for d in missing_docs])))
    missing_ids = [str(d["id"]) for d in missing_docs]
    
    print(f"Danh sách {len(missing_symbols)} tickers bị lỗi 404: {', '.join(missing_symbols)}")
    
    # Tạo các câu lệnh SQL dọn dẹp
    # Chia nhỏ ids thành các nhóm 100 để tránh giới hạn SQL query size
    chunk_size = 100
    sql_statements = []
    
    # 1. SQL xóa khỏi bảng financial_documents
    for i in range(0, len(missing_ids), chunk_size):
        chunk = missing_ids[i:i+chunk_size]
        ids_str = ", ".join(chunk)
        sql_statements.append(f"DELETE FROM financial_documents WHERE id IN ({ids_str});")
        
    # 2. SQL reset annual_report_queue sang pending
    for i in range(0, len(missing_symbols), chunk_size):
        chunk = missing_symbols[i:i+chunk_size]
        symbols_str = ", ".join([f"'{s}'" for s in chunk])
        sql_statements.append(
            f"UPDATE annual_report_queue "
            f"SET status = 'pending', attempts = 0, error_msg = NULL, updated_at = strftime('%s', 'now') "
            f"WHERE ticker IN ({symbols_str}) AND year = 2024;"
        )
        
    # Ghi file SQL
    sql_file = "scratch/cleanup_404_reports.sql"
    with open(sql_file, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_statements))
    print(f"\n✅ Đã tạo file SQL dọn dẹp tại: {sql_file}")
    
    # Thực thi SQL trên remote D1
    print("\n3. Đang thực thi các lệnh SQL dọn dẹp trên remote D1...")
    success_count = 0
    for stmt in sql_statements:
        print(f"Executing: {stmt[:80]}...")
        cmd = [
            "npx", "wrangler", "d1", "execute", DATABASE,
            "--remote", "--command", stmt, "--json"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding="utf-8")
        if res.returncode == 0:
            success_count += 1
        else:
            print(f"Error executing statement: {res.stderr}")
            
    print(f"\n==================================================")
    print(f"HOÀN THÀNH DỌN DẸP")
    print(f"Thực thi thành công {success_count}/{len(sql_statements)} nhóm lệnh SQL.")
    print(f"Đã xóa {len(missing_ids)} bản ghi rác trong financial_documents.")
    print(f"Đã reset {len(missing_symbols)} mã sang trạng thái 'pending' trong queue.")
    print(f"==================================================")

if __name__ == "__main__":
    main()

-- Seed companies first to avoid FOREIGN KEY constraints
INSERT OR REPLACE INTO companies (symbol, exchange, industry, updated_at)
VALUES 
('AAA', 'HOSE', 'Bao bì', 1716886400000),
('VNM', 'HOSE', 'Thực phẩm', 1716886400000);

-- Seed daily_research
INSERT OR REPLACE INTO daily_research (symbol, summary, ssi_review, last_updated)
VALUES 
('AAA', 'AAA là doanh nghiệp hàng đầu về bao bì màng mỏng tại Việt Nam, đang dịch chuyển mạnh mẽ sang bao bì sinh học tự hủy thân thiện với môi trường.', 'SSI đánh giá khả quan với tiềm năng xuất khẩu sang châu Âu.', 1716886400000),
('VNM', 'VNM duy trì vị thế thống trị ngành sữa Việt Nam với thị phần trên 50%, biên lợi nhuận ổn định và dòng tiền dồi dào trả cổ tức đều đặn.', 'Đánh giá trung lập do tăng trưởng ngành sữa nội địa bão hòa.', 1716886400000);

-- Seed news_index
INSERT OR REPLACE INTO news_index (id, symbol, title, source_url, published_date, r2_key, created_at)
VALUES 
(1, 'AAA', 'Nhựa An Phát Xanh (AAA) báo lãi tăng trưởng mạnh trong Q1/2026 nhờ xuất khẩu', 'https://example.com/news/aaa-q1-2026', 1716886400000, 'content/aaa/articles/news1.md', 1716886400000),
(2, 'VNM', 'Vinamilk (VNM) lọt top 5 thương hiệu sữa bền vững nhất toàn cầu', 'https://example.com/news/vnm-top-brand', 1716886400000, 'content/vnm/articles/news2.md', 1716886400000);

-- Seed financial_documents
INSERT OR REPLACE INTO financial_documents (id, symbol, year, file_name, file_url, label, status, r2_key, created_at)
VALUES 
(1, 'AAA', 2025, 'AAA_BCTC_KiemToan_2025.pdf', 'http://localhost:8787/api/documents/1/view', 'BCTC Kiểm toán', 'Đã kiểm tra', 'documents/AAA/2025/AAA_BCTC_KiemToan_2025.pdf', 1716886400000),
(2, 'VNM', 2025, 'VNM_BCTC_KiemToan_2025.pdf', 'http://localhost:8787/api/documents/2/view', 'BCTC Kiểm toán', 'Đã kiểm tra', 'documents/VNM/2025/VNM_BCTC_KiemToan_2025.pdf', 1716886400000);

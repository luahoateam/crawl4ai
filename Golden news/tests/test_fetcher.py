import pytest
from scripts.fetch_investors import SuperinvestorFetcher

from pathlib import Path
import json

@pytest.mark.asyncio
async def test_run_actor_starts_and_returns_run_id(httpx_mock):
    # ... (giữ nguyên)
    pass

@pytest.mark.asyncio
async def test_partition_and_save_data(tmp_path):
    # Dữ liệu mẫu trộn lẫn 2 nhà đầu tư
    items = [
        {"investorName": "Buffett", "ticker": "AAPL"},
        {"investorName": "Burry", "ticker": "BABA"},
        {"investorName": "Buffett", "ticker": "KO"}
    ]
    
    fetcher = SuperinvestorFetcher(token="fake")
    output_dir = tmp_path / "data"
    fetcher.partition_and_save(items, output_dir)
    
    # Kiểm tra file Buffett
    buffett_file = output_dir / "Buffett.json"
    assert buffett_file.exists()
    with open(buffett_file) as f:
        data = json.load(f)
        assert len(data) == 2
        assert data[0]["ticker"] == "AAPL"
    
    # Kiểm tra file Burry
    burry_file = output_dir / "Burry.json"
    assert burry_file.exists()

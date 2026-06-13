import httpx
import json
from pathlib import Path

class SuperinvestorFetcher:
    def __init__(self, token):
        self.token = token
        self.base_url = "https://api.apify.com/v2"

    async def start_actor(self):
        # ... (giữ nguyên)
        pass

    async def wait_for_run(self, run_id):
        async with httpx.AsyncClient(timeout=600.0) as client:
            while True:
                url = f"{self.base_url}/actor-runs/{run_id}?token={self.token}"
                resp = await client.get(url)
                status = resp.json()["data"]["status"]
                if status == "SUCCEEDED":
                    return True
                elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                    raise Exception(f"Actor failed with status: {status}")
                await asyncio.sleep(10)

    async def fetch_dataset(self, dataset_id):
        url = f"{self.base_url}/datasets/{dataset_id}/items?token={self.token}"
        async with httpx.AsyncClient(timeout=600.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    def partition_and_save(self, items, output_dir: Path):
        output_dir.mkdir(parents=True, exist_ok=True)
        investors = {}
        for item in items:
            name = item.get("investorName", "Unknown").replace(" ", "_").replace(".", "")
            if name not in investors:
                investors[name] = []
            investors[name].append(item)
            
        for name, data in investors.items():
            file_path = output_dir / f"{name}.json"
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)

import httpx
import json
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

class SuperinvestorFetcher:
    def __init__(self, token):
        self.token = token
        self.base_url = "https://api.apify.com/v2"

    async def start_actor(self):
        url = f"{self.base_url}/acts/parsebird~superinvestor-scraper/runs?token={self.token}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json={"superinvestors": []})
            resp.raise_for_status()
            data = resp.json()["data"]
            return data["id"], data["defaultDatasetId"]

    async def wait_for_run(self, run_id):
        print(f"Waiting for run {run_id} to complete...")
        async with httpx.AsyncClient(timeout=600.0) as client:
            while True:
                url = f"{self.base_url}/actor-runs/{run_id}?token={self.token}"
                resp = await client.get(url)
                status = resp.json()["data"]["status"]
                if status == "SUCCEEDED":
                    print("Run succeeded!")
                    return True
                elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                    raise Exception(f"Actor failed with status: {status}")
                await asyncio.sleep(10)

    async def fetch_dataset(self, dataset_id):
        print(f"Fetching dataset {dataset_id}...")
        url = f"{self.base_url}/datasets/{dataset_id}/items?token={self.token}"
        async with httpx.AsyncClient(timeout=600.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()

    def partition_and_save(self, items, output_dir: Path):
        output_dir.mkdir(parents=True, exist_ok=True)
        investors = {}
        for item in items:
            name = item.get("superinvestorName", "Unknown").replace(" ", "_").replace(".", "")
            if name not in investors:
                investors[name] = []
            investors[name].append(item)
            
        for name, data in investors.items():
            file_path = output_dir / f"{name}.json"
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=4)
        print(f"Saved data for {len(investors)} investors to {output_dir}")

async def main():
    load_dotenv()
    token = os.getenv("APIFY_API_TOKEN")
    if not token:
        print("Error: APIFY_API_TOKEN not found in .env")
        return

    fetcher = SuperinvestorFetcher(token)
    output_dir = Path("data/superinvestors")
    
    try:
        run_id, dataset_id = await fetcher.start_actor()
        await fetcher.wait_for_run(run_id)
        items = await fetcher.fetch_dataset(dataset_id)
        fetcher.partition_and_save(items, output_dir)
        print("Done!")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(main())

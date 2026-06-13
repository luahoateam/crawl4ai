import httpx

class SuperinvestorFetcher:
    def __init__(self, token):
        self.token = token
        self.base_url = "https://api.apify.com/v2"

    async def start_actor(self):
        url = f"{self.base_url}/acts/parsebird/superinvestor-scraper/runs?token={self.token}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json={"superinvestors": []})
            resp.raise_for_status()
            data = resp.json()["data"]
            return data["id"], data["defaultDatasetId"]

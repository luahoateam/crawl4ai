import asyncio
import json
import logging
import time
from pathlib import Path
import httpx

from config import JOB_URL, TOKEN, MODEL, MAX_RETRIES, POLL_INTERVAL_S, JOB_TIMEOUT_S, OPTIONAL_PAYLOAD

logger = logging.getLogger("pdf_to_markdown.ocr_client")

class PaddleOCRClient:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.token = TOKEN
        self.model = MODEL
        self.optional_payload = OPTIONAL_PAYLOAD
        self.headers = {
            "Authorization": f"bearer {self.token}"
        }

    async def _request_with_retry(self, method: str, url: str, **kwargs) -> httpx.Response:
        """Helper to perform requests with retry logic and exponential backoff."""
        # Ensure headers has Authorization only for PaddleOCR API requests
        if "paddleocr.aistudio-app.com" in url:
            if "headers" not in kwargs:
                kwargs["headers"] = self.headers.copy()
            else:
                kwargs["headers"] = {**self.headers, **kwargs["headers"]}

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = await self.client.request(method, url, **kwargs)
                
                # Check for success
                if response.status_code == 200:
                    return response
                
                # Retry on server errors (5xx)
                if 500 <= response.status_code < 600:
                    if attempt == MAX_RETRIES:
                        response.raise_for_status()
                    wait_time = 2 ** attempt
                    logger.warning(
                        f"HTTP {response.status_code} on {method} {url}. "
                        f"Retrying in {wait_time}s... (Attempt {attempt}/{MAX_RETRIES})"
                    )
                    await asyncio.sleep(wait_time)
                    continue
                
                # Raise immediately for client errors (4xx)
                response.raise_for_status()
                
            except (httpx.HTTPError, httpx.NetworkError) as e:
                if attempt == MAX_RETRIES:
                    raise e
                wait_time = 2 ** attempt
                logger.warning(
                    f"Request failed: {e}. "
                    f"Retrying in {wait_time}s... (Attempt {attempt}/{MAX_RETRIES})"
                )
                await asyncio.sleep(wait_time)
        
        raise RuntimeError("Request failed after maximum retries.")

    async def submit_job(self, file_path: Path) -> str:
        """Submits a local PDF file to PaddleOCR API."""
        if not file_path.exists():
            raise FileNotFoundError(f"File not found at {file_path}")
            
        data = {
            "model": self.model,
            "optionalPayload": json.dumps(self.optional_payload)
        }
        
        # Read file bytes to avoid blocking or let httpx handle it
        # Since we want to be safe, opening file in 'rb' is fine
        filename = file_path.name
        with open(file_path, "rb") as f:
            files = {"file": (filename, f, "application/pdf")}
            logger.info(f"Submitting job for: {filename}")
            
            # Note: We do not set Content-Type header manually for multipart uploads,
            # httpx will set the correct boundary header.
            response = await self._request_with_retry(
                "POST", 
                JOB_URL, 
                data=data, 
                files=files
            )
            
        result_json = response.json()
        if result_json.get("code") != 0 or "data" not in result_json or "jobId" not in result_json["data"]:
            raise RuntimeError(f"Failed to submit job. API Response: {result_json}")
            
        job_id = result_json["data"]["jobId"]
        logger.info(f"Job submitted successfully for {filename}. Job ID: {job_id}")
        return job_id

    async def poll_job(self, filename: str, job_id: str) -> str:
        """Polls the status of the job until done. Returns result jsonUrl."""
        start_time = time.time()
        poll_url = f"{JOB_URL}/{job_id}"
        
        logger.info(f"Start polling results for [{filename}] (Job: {job_id})")
        
        while True:
            # Check for total timeout
            elapsed = time.time() - start_time
            if elapsed > JOB_TIMEOUT_S:
                raise TimeoutError(f"Job {job_id} for [{filename}] timed out after {JOB_TIMEOUT_S}s.")
                
            response = await self._request_with_retry("GET", poll_url)
            result_json = response.json()
            
            if result_json.get("code") != 0 or "data" not in result_json:
                raise RuntimeError(f"Error checking job status. Response: {result_json}")
                
            data = result_json["data"]
            state = data.get("state")
            
            if state == 'pending':
                logger.info(f"[{filename}] Status: pending")
            elif state == 'running':
                progress = data.get("extractProgress", {})
                total = progress.get("totalPages", "?")
                extracted = progress.get("extractedPages", "?")
                logger.info(f"[{filename}] Status: running (extracted {extracted}/{total} pages)")
            elif state == 'done':
                progress = data.get("extractProgress", {})
                extracted = progress.get("extractedPages", 0)
                logger.info(f"[{filename}] Status: done! Extracted {extracted} pages.")
                
                result_url_info = data.get("resultUrl", {})
                json_url = result_url_info.get("jsonUrl")
                if not json_url:
                    raise RuntimeError("Job marked as done but no jsonUrl found in response.")
                return json_url
            elif state == 'failed':
                error_msg = data.get("errorMsg", "Unknown error")
                raise RuntimeError(f"Job failed on server: {error_msg}")
            else:
                logger.warning(f"[{filename}] Unknown state: {state}")
                
            await asyncio.sleep(POLL_INTERVAL_S)

    async def fetch_jsonl_results(self, jsonl_url: str) -> list:
        """Downloads the JSONL result file and parses it line by line."""
        response = await self._request_with_retry("GET", jsonl_url)
        lines = response.text.strip().split('\n')
        
        results = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            try:
                page_data = json.loads(line)
                results.append(page_data)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSONL line: {line[:100]}... Error: {e}")
                
        return results

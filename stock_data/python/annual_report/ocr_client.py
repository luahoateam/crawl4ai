import requests
import time
import logging
import os
import json
from typing import List

logger = logging.getLogger(__name__)

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
DEFAULT_TOKEN = "a73d4b8fd67557039f83f005a5d0c1dd24e9dd1f"

class OCRJobException(Exception):
    """Exception raised when an OCR job fails on the server side."""
    pass

class PaddleOCRClient:
    def __init__(self, token: str = None):
        # Allow loading token from environment or fallback to default
        self.token = token or os.environ.get("PADDLE_OCR_TOKEN", DEFAULT_TOKEN)
        # Use lowercase 'bearer' as in the official code example
        self.headers = {
            "Authorization": f"bearer {self.token}"
        }
        
    def submit_job(self, file_path_or_url: str) -> str:
        """
        Submits a local PDF file or public file URL to the Paddle OCR API to start an OCR job.
        
        Args:
            file_path_or_url (str): The local path to the PDF file or a public HTTP/HTTPS URL.
            
        Returns:
            str: The created job ID.
        """
        optional_payload = {
            "useDocOrientationClassify": False,
            "useDocUnwarping": False,
            "useChartRecognition": False,
        }
        
        if file_path_or_url.startswith("http"):
            logger.info(f"Submitting OCR job via URL Mode: {file_path_or_url}...")
            headers = self.headers.copy()
            headers["Content-Type"] = "application/json"
            payload = {
                "fileUrl": file_path_or_url,
                "model": "PaddleOCR-VL-1.6",
                "optionalPayload": optional_payload
            }
            response = requests.post(JOB_URL, json=payload, headers=headers, timeout=300)
        else:
            if not os.path.exists(file_path_or_url):
                raise FileNotFoundError(f"File not found: {file_path_or_url}")
                
            logger.info(f"Submitting OCR job via Local File Mode: {file_path_or_url}...")
            data = {
                "model": "PaddleOCR-VL-1.6",
                "optionalPayload": json.dumps(optional_payload)
            }
            
            filename = os.path.basename(file_path_or_url)
            with open(file_path_or_url, "rb") as f:
                files = {
                    "file": (filename, f, "application/pdf")
                }
                response = requests.post(JOB_URL, headers=self.headers, files=files, data=data, timeout=360)
            
        if response.status_code != 200:
            logger.error(f"Failed to submit OCR job. Status code: {response.status_code}, Response: {response.text}")
            raise Exception(f"Failed to submit OCR job. Status code: {response.status_code}")
            
        res_json = response.json()
        
        # Parse based on official structure: {"data": {"jobId": "..."}}
        data_block = res_json.get("data")
        if not data_block or not data_block.get("jobId"):
            logger.error(f"Invalid API response structure: {res_json}")
            raise Exception("Invalid API response: 'data.jobId' is missing")
            
        job_id = data_block.get("jobId")
        logger.info(f"OCR job submitted successfully. Job ID: {job_id}")
        return job_id
        
    def poll_job(self, job_id: str, interval: float = 15.0, timeout: float = 300.0) -> List[str]:
        """
        Polls the status of an OCR job until it is completed ('done'), failed ('failed'), or times out.
        Then downloads the JSONL results and extracts the markdown text for each page.
        
        Args:
            job_id (str): The job ID to poll.
            interval (float): Seconds to wait between polls.
            timeout (float): Max seconds to wait before raising TimeoutError.
            
        Returns:
            List[str]: List of markdown contents (one string per page).
        """
        poll_url = f"{JOB_URL}/{job_id}"
        start_time = time.time()
        
        logger.info(f"Polling OCR job {job_id}...")
        
        jsonl_url = None
        while time.time() - start_time < timeout:
            try:
                response = requests.get(poll_url, headers=self.headers, timeout=15)
                if response.status_code == 200:
                    res_json = response.json()
                    
                    data_block = res_json.get("data", {})
                    state = data_block.get("state")
                    
                    logger.info(f"Job {job_id} state: {state}")
                    
                    if state == 'pending':
                        logger.info("Job status: pending")
                    elif state == 'running':
                        progress = data_block.get("extractProgress", {})
                        total = progress.get("totalPages", "?")
                        extracted = progress.get("extractedPages", "?")
                        logger.info(f"Job status: running. Progress: {extracted}/{total} pages")
                    elif state == 'done':
                        # Job completed, get the results jsonl url
                        result_url_block = data_block.get("resultUrl", {})
                        jsonl_url = result_url_block.get("jsonUrl")
                        if not jsonl_url:
                            raise Exception("Job marked as done but 'resultUrl.jsonUrl' is missing")
                        logger.info(f"Job {job_id} completed successfully. Results URL: {jsonl_url}")
                        break
                    elif state == 'failed':
                        error_msg = data_block.get("errorMsg", "Unknown error")
                        logger.error(f"Job {job_id} failed: {error_msg}")
                        raise OCRJobException(f"OCR Job failed: {error_msg}")
                else:
                    logger.warning(f"Error checking job status. Status code: {response.status_code}")
            except requests.RequestException as req_err:
                logger.warning(f"Network error during poll: {req_err}")
                
            time.sleep(interval)
            
        if not jsonl_url:
            logger.error(f"OCR job {job_id} timed out after {timeout} seconds.")
            raise TimeoutError(f"OCR Job processing timed out after {timeout} seconds.")
            
        # Download and parse the JSONL results file
        logger.info(f"Downloading OCR results from {jsonl_url}...")
        jsonl_response = requests.get(jsonl_url, timeout=30)
        jsonl_response.raise_for_status()
        
        pages = []
        lines = jsonl_response.text.strip().split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            try:
                line_data = json.loads(line)
                result_block = line_data.get("result", {})
                layout_results = result_block.get("layoutParsingResults", [])
                
                for res in layout_results:
                    markdown_block = res.get("markdown", {})
                    markdown_text = markdown_block.get("text")
                    if markdown_text is not None:
                        pages.append(markdown_text)
            except Exception as parse_err:
                logger.error(f"Failed to parse line in jsonl results: {parse_err}")
                
        logger.info(f"Successfully extracted {len(pages)} pages of markdown content.")
        return pages

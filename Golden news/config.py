import os

# API Configurations
JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
TOKEN = "a73d4b8fd67557039f83f005a5d0c1dd24e9dd1f"
MODEL = "PaddleOCR-VL-1.6"

# Execution Controls
MAX_CONCURRENT = 5
MAX_RETRIES = 3
POLL_INTERVAL_S = 5
JOB_TIMEOUT_S = 600

# Payload options for PaddleOCR
OPTIONAL_PAYLOAD = {
    "useDocOrientationClassify": False,
    "useDocUnwarping": False,
    "useChartRecognition": False,
}

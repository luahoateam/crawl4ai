import json
import os
from datetime import datetime

class ProgressTracker:
    def __init__(self, filepath="progress.json"):
        self.filepath = filepath
        self.data = self._load()

    def _load(self):
        if not os.path.exists(self.filepath):
            return {}
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def is_done(self, filename: str) -> bool:
        return self.data.get(filename, {}).get("status") == "done"

    def mark_running(self, filename: str, job_id: str):
        self.data[filename] = {
            "status": "running",
            "job_id": job_id,
            "updated_at": datetime.now().isoformat()
        }
        self._atomic_write()

    def mark_done(self, filename: str, pages: int):
        self.data[filename] = {
            "status": "done",
            "pages": pages,
            "updated_at": datetime.now().isoformat()
        }
        self._atomic_write()

    def mark_failed(self, filename: str, error_msg: str):
        # Preserve job_id if we have it
        job_id = self.data.get(filename, {}).get("job_id", "")
        self.data[filename] = {
            "status": "failed",
            "job_id": job_id,
            "error": error_msg,
            "updated_at": datetime.now().isoformat()
        }
        self._atomic_write()

    def reset(self):
        self.data = {}
        if os.path.exists(self.filepath):
            try:
                os.remove(self.filepath)
            except Exception:
                pass

    def _atomic_write(self):
        tmp_filepath = self.filepath + ".tmp"
        try:
            with open(tmp_filepath, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
            os.replace(tmp_filepath, self.filepath)
        except Exception as e:
            print(f"Error saving progress atomically: {e}")
            if os.path.exists(tmp_filepath):
                try:
                    os.remove(tmp_filepath)
                except Exception:
                    pass

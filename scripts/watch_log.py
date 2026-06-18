"""
Tail the import log in real-time.
Run: python scripts/watch_log.py
Press Ctrl+C to stop watching.
"""
import time, sys
from pathlib import Path

log = Path(__file__).parent / "import_log.txt"

print(f"Watching: {log}  (Ctrl+C to stop)\n")
with open(log, "r", encoding="utf-8") as f:
    f.seek(0, 2)  # go to end
    while True:
        line = f.readline()
        if line:
            print(line, end="", flush=True)
        else:
            time.sleep(0.5)

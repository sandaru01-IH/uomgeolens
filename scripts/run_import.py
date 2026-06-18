"""
Launches import_kmz.py as a fully detached Windows process.
Run: python scripts/run_import.py
Then check progress: scripts/import_log.txt
"""
import subprocess, sys, os
from pathlib import Path

script = Path(__file__).parent / "import_kmz.py"
log    = Path(__file__).parent / "import_log.txt"
cwd    = Path(__file__).parent.parent  # uom-geolens/

env = os.environ.copy()
env["PYTHONUTF8"] = "1"
env["PYTHONIOENCODING"] = "utf-8"

with open(log, "w", encoding="utf-8") as f:
    proc = subprocess.Popen(
        [sys.executable, "-u", str(script)],
        stdout=f,
        stderr=f,
        cwd=str(cwd),
        env=env,
        creationflags=(
            subprocess.CREATE_NEW_PROCESS_GROUP |
            subprocess.DETACHED_PROCESS
        ),
    )

print(f"Import started as detached process PID {proc.pid}")
print(f"Progress log: {log}")
print("You can close this terminal. Import will continue in background.")
print("To monitor: python scripts/watch_log.py")

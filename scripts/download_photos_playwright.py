"""
UoM GeoLens - Photo Download via Playwright (Authenticated Browser)

Downloads all Google Photos URLs using a real Chrome session, then uploads
to Supabase Storage and updates the database.

Install: pip install playwright && python -m playwright install chromium
Run:     python scripts/download_photos_playwright.py

Steps:
  1. A browser window opens to accounts.google.com
  2. Log in with sandaruwan.silva97@gmail.com
  3. Press ENTER in the terminal when logged in
  4. Script downloads all 4,000+ photos automatically
  5. Resume-capable: re-run if interrupted
"""

import os, sys, uuid, time, json, asyncio
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET       = "tree-photos"

SUPA_HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

PROGRESS_FILE = Path("scripts/.photo_progress.json")
BATCH_UPLOAD  = 5    # Parallel uploads
RATE_DELAY    = 0.08 # seconds between requests


def get_google_photos():
    all_rows = []
    from_idx = 0
    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/tree_photos",
            headers=SUPA_HEADERS,
            params={
                "url": "like.https://lh3.googleusercontent.com%",
                "select": "id,tree_id,photo_type,url",
                "limit": "1000",
                "offset": str(from_idx),
            },
        )
        if not r.ok or not r.json():
            break
        batch = r.json()
        all_rows.extend(batch)
        if len(batch) < 1000:
            break
        from_idx += 1000
    return all_rows


def load_progress():
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE) as f:
            return set(json.load(f).get("done_ids", []))
    return set()


def save_progress(done_ids):
    PROGRESS_FILE.parent.mkdir(exist_ok=True)
    with open(PROGRESS_FILE, "w") as f:
        json.dump({"done_ids": list(done_ids)}, f)


def upload_to_storage(data: bytes, path: str) -> str | None:
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    r = requests.post(url, headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
    }, data=data)
    if r.status_code in (200, 201):
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"
    return None


def update_photo_url(photo_id: str, new_url: str) -> bool:
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/tree_photos",
        headers=SUPA_HEADERS,
        params={"id": f"eq.{photo_id}"},
        json={"url": new_url},
    )
    return r.ok


async def download_and_migrate():
    from playwright.async_api import async_playwright

    print("[*] Fetching Google photo URLs from database...")
    photos = get_google_photos()
    total = len(photos)
    print(f"[OK] {total} Google URLs to migrate\n")

    if total == 0:
        print("[DONE] No Google photos remain. All stored in Supabase!")
        return

    done_ids = load_progress()
    remaining = [p for p in photos if p["id"] not in done_ids]
    already = total - len(remaining)
    if already:
        print(f"[*] Resuming: {already} already done, {len(remaining)} remaining\n")

    async with async_playwright() as pw:
        print("[*] Opening browser... Log in to Google, then press ENTER here.")
        browser = await pw.chromium.launch(
            headless=False,
            args=["--start-maximized"],
        )
        context = await browser.new_context(
            viewport=None,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        )
        page = await context.new_page()
        await page.goto("https://accounts.google.com/signin")
        input("\nPress ENTER after you are logged in to Google... ")
        print()

        # Verify login
        test_url = remaining[0]["url"] if remaining else None
        if test_url:
            print("[*] Verifying access...")
            resp = await page.request.get(test_url)
            ct = resp.headers.get("content-type", "")
            if resp.status == 200 and "image" in ct:
                print("[OK] Authenticated! Starting download...\n")
            else:
                print(f"[WARN] Test request returned HTTP {resp.status}.")
                print("  Photos may be private to a specific Google account.")
                print("  Make sure you logged in with the OWNER's account.\n")

        success, failed = 0, 0
        failed_urls = []
        start = time.time()

        for i, photo in enumerate(remaining, 1):
            url = photo["url"]
            label = f"[{i + already}/{total}] {photo['photo_type'][:8]:<8}"
            print(label, end=" ", flush=True)

            try:
                resp = await page.request.get(url)
                ct = resp.headers.get("content-type", "")

                if resp.status == 200 and "image" in ct:
                    data = await resp.body()
                    ext = "jpg" if "jpeg" in ct else (ct.split("/")[-1] or "jpg")
                    path = f"{photo['tree_id']}/{photo['photo_type']}_{uuid.uuid4().hex[:8]}.{ext}"
                    new_url = upload_to_storage(data, path)
                    if new_url and update_photo_url(photo["id"], new_url):
                        kb = len(data) // 1024
                        print(f"OK {kb}KB")
                        success += 1
                        done_ids.add(photo["id"])
                    else:
                        print("UPLOAD ERR")
                        failed += 1
                        failed_urls.append(url)
                else:
                    print(f"HTTP {resp.status}")
                    failed += 1
                    failed_urls.append(url)

            except Exception as e:
                print(f"ERR {str(e)[:40]}")
                failed += 1
                failed_urls.append(url)

            await asyncio.sleep(RATE_DELAY)

            if i % 100 == 0:
                save_progress(done_ids)
                elapsed = int(time.time() - start)
                rate = i / elapsed if elapsed > 0 else 0
                eta = int((len(remaining) - i) / rate) if rate > 0 else 0
                print(f"\n  [Saved] {success} OK, {failed} fail | {i}/{len(remaining)} | ETA {eta//60}m{eta%60}s\n")

        await browser.close()

    save_progress(done_ids)

    print(f"\n{'='*55}")
    print(f"[DONE] Migration complete!")
    print(f"  Success:  {success}")
    print(f"  Failed:   {failed}")
    print(f"  Total:    {total}")

    if failed_urls:
        fail_file = Path("scripts/failed_photos.txt")
        fail_file.write_text("\n".join(failed_urls))
        print(f"\n[!] {failed} photos failed — saved to {fail_file}")
        print("  Most likely private or expired Google photos.")


if __name__ == "__main__":
    asyncio.run(download_and_migrate())

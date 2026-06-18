"""
UoM GeoLens - Photo Download via Chrome Cookies (Simpler than Playwright)

This script extracts your existing Google cookies from Chrome and uses them
to download photos, then uploads to Supabase Storage.

Requirements: pip install browser-cookie3
(already installed - no Playwright needed)

IMPORTANT: Chrome must be CLOSED or the script may not read cookies correctly.
Close all Chrome windows before running.

Run:
  python scripts/download_photos_cookies.py

The script will:
  1. Extract your Google cookies from Chrome automatically
  2. Download all Google Photos URLs using your session
  3. Upload to Supabase Storage
  4. Update the database with new Supabase URLs
"""

import os, sys, uuid, time, json
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


def get_chrome_cookies():
    """Extract Google cookies from Chrome cookie store."""
    try:
        import browser_cookie3
        print("[*] Extracting Google cookies from Chrome...")
        print("    (Chrome should be CLOSED for best results)")
        cookies = browser_cookie3.chrome(domain_name=".google.com")
        # Also grab googleusercontent.com cookies
        cookies2 = browser_cookie3.chrome(domain_name=".googleusercontent.com")
        jar = requests.cookies.RequestsCookieJar()
        count = 0
        for c in list(cookies) + list(cookies2):
            jar.set(c.name, c.value, domain=c.domain, path=c.path)
            count += 1
        print(f"[OK] Found {count} Google cookies\n")
        return jar
    except Exception as e:
        print(f"[ERROR] Could not extract Chrome cookies: {e}")
        print("  Make sure Chrome is installed and you are logged into Google.")
        print("  If Chrome is open, close it and try again.")
        return None


def get_google_photos():
    """Fetch all tree_photos rows that still have Google URLs."""
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


def run():
    # Step 1: Get cookies
    cookies = get_chrome_cookies()
    if not cookies:
        print("\n[!] Falling back: no cookies. Photos may still fail.")
        print("    Consider running: python scripts/download_photos_playwright.py")
        cookies = None

    # Step 2: Test cookie validity
    if cookies:
        test_url = "https://lh3.googleusercontent.com/umsh/AN6v0v4F5wdLRE5G6vXQ5QpKQdvomZIgrQOO_LIlOtRUYr4lXG6Ln1o2PdLMo"
        session = requests.Session()
        session.cookies = cookies
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Referer": "https://www.google.com/maps/",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        })
        print("[*] Testing cookie validity with a sample URL...")
        r = session.get(test_url, timeout=15, allow_redirects=True)
        print(f"    Status: {r.status_code}, Content-Type: {r.headers.get('content-type', '?')[:40]}")
        if r.status_code == 200 and "image" in r.headers.get("content-type", ""):
            print("[OK] Cookies work! Photos will be downloaded.\n")
        else:
            print("[WARN] Cookies may not be valid or photos are private.")
            print("  Status suggests auth issue. Try closing Chrome and re-running.")
            print("  OR run: python scripts/download_photos_playwright.py (opens real browser)\n")
            confirm = input("Continue anyway? (y/N): ").strip().lower()
            if confirm != "y":
                sys.exit(0)

    # Step 3: Fetch all Google photo URLs
    print("[*] Fetching Google photo URLs from database...")
    photos = get_google_photos()
    print(f"[OK] {len(photos)} Google photos to migrate\n")

    if not photos:
        print("[DONE] No Google photos remain. All photos may already be in Supabase Storage!")
        return

    # Step 4: Resume support
    done_ids = load_progress()
    remaining = [p for p in photos if p["id"] not in done_ids]
    if done_ids:
        print(f"[*] Resuming: {len(done_ids)} already done, {len(remaining)} remaining\n")

    success = 0
    failed = 0
    failed_urls = []

    for i, photo in enumerate(remaining, 1):
        url = photo["url"]
        print(f"[{i + len(done_ids)}/{len(photos)}] {photo['photo_type'][:8]:<8}", end=" ", flush=True)

        try:
            if session:
                r = session.get(url, timeout=20, allow_redirects=True)
            else:
                r = requests.get(url, timeout=20, allow_redirects=True)

            ct = r.headers.get("content-type", "")
            if r.status_code == 200 and "image" in ct:
                ext = "jpg" if "jpeg" in ct else (ct.split("/")[-1] or "jpg")
                path = f"{photo['tree_id']}/{photo['photo_type']}_{uuid.uuid4().hex[:8]}.{ext}"
                new_url = upload_to_storage(r.content, path)
                if new_url and update_photo_url(photo["id"], new_url):
                    print(f"OK ({len(r.content)//1024}KB)")
                    success += 1
                    done_ids.add(photo["id"])
                else:
                    print("UPLOAD FAILED")
                    failed += 1
                    failed_urls.append(url)
            else:
                print(f"HTTP {r.status_code}")
                failed += 1
                failed_urls.append(url)
        except Exception as e:
            print(f"ERROR: {str(e)[:50]}")
            failed += 1
            failed_urls.append(url)

        # Save progress every 50
        if i % 50 == 0:
            save_progress(done_ids)
            print(f"\n  [Progress saved] {success} OK, {failed} failed out of {i} done\n")

        # Gentle rate limiting
        time.sleep(0.05)

    save_progress(done_ids)

    print(f"\n{'='*50}")
    print(f"[DONE] Migration complete!")
    print(f"  Success:  {success}")
    print(f"  Failed:   {failed}")
    print(f"  Total:    {len(photos)}")

    if failed > 0:
        print(f"\n[!] {failed} photos failed.")
        print("    These likely need authenticated browser access.")
        print("    Run: python scripts/download_photos_playwright.py")
        # Save failed URLs for reference
        fail_file = Path("scripts/failed_photos.txt")
        fail_file.write_text("\n".join(failed_urls))
        print(f"    Failed URLs saved to: {fail_file}")


if __name__ == "__main__":
    run()

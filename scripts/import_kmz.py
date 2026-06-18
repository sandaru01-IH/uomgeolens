"""
UoM GeoLens - KMZ Import Script
Parses University of Moratuwa Trees.kmz, normalises fields,
downloads Google Photos, uploads to Supabase Storage, and inserts all data.

Usage:
  pip install requests python-dotenv
  python scripts/import_kmz.py

Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local (service role key, not anon).
"""

import os
import sys
import re
import uuid
import json
import time
import zipfile
import tempfile
import requests
import xml.etree.ElementTree as ET
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(".env.local")  # override first
load_dotenv(".env")        # fallback

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET       = "tree-photos"
KMZ_PATH     = Path(__file__).parent.parent.parent / "University of Moratuwa Trees.kmz"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

NS = {"kml": "http://www.opengis.net/kml/2.2"}

# ─── Field normalisation map ──────────────────────────────────────────────────
NAME_FIELDS   = {"NAME", "Name", "name"}
HEIGHT_FIELDS = {"HEIGHT", "Height"}
DEPT_FIELDS   = {"DEPT", "Affli_with", "Affliated", "Department", "Which dep"}
DIAM_FIELDS   = {"DBS", "Dia_Trunk", "DBH"}

PHOTO_FIELDS = {
    "full":   {"F IMAGE", "full image", "Tree_Image"},
    "trunk":  {"TRUNK IMAG", "Trunk_Img", "img trunk"},
    "branch": {"BRANCH", "Branch_IMG", "branch img"},
    "leaves": {"LEAVES", "Leaves_IMG", "leaves img"},
    "flower": {"FLOWERS", "Flo_Frt_IM", "flower"},
}

TREE_FOLDER_NAMES = {
    "Group No 1 Trees": "Group 1",
    "Group No 3 Trees": "Group 3",
    "Group No 4 Trees": "Group 4",
    "Group No 5 trees": "Group 5",
    "Mora devide area 2.csv": "Group 2",
}

# ─── Helpers ─────────────────────────────────────────────────────────────────

def extract_kmz(kmz_path: Path) -> ET.Element:
    with zipfile.ZipFile(kmz_path) as z:
        kml_name = next(n for n in z.namelist() if n.endswith(".kml"))
        with z.open(kml_name) as f:
            return ET.parse(f).getroot()

def get_data(extended_data, *field_names) -> str | None:
    for d in extended_data.findall("kml:Data", NS):
        if d.get("name") in field_names:
            v = d.find("kml:value", NS)
            if v is not None and v.text and v.text.strip():
                return v.text.strip()
    return None

def extract_media_urls(extended_data) -> list[str]:
    """Extract all Google Photos URLs from gx_media_links and description."""
    urls = []
    gx = get_data(extended_data, "gx_media_links")
    if gx:
        urls += [u.strip() for u in gx.split() if "googleusercontent" in u]

    desc_node = extended_data.find("kml:Data[@name='description']/kml:value", NS)
    desc_text = (desc_node.text or "") if desc_node is not None else ""

    # Also check <description> in parent (we'll pass it separately)
    found = re.findall(r'https://lh3\.googleusercontent\.com/[^\s"\'<>]+', desc_text)
    for u in found:
        if u not in urls:
            urls.append(u)

    return urls

def download_image(url: str, timeout: int = 15) -> bytes | None:
    try:
        r = requests.get(url, timeout=timeout, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("image"):
            return r.content
    except Exception as e:
        print(f"  [WARN] Download failed: {e}")
    return None

def upload_to_storage(data: bytes, path: str, content_type: str = "image/jpeg") -> str | None:
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    r = requests.post(url, headers=headers, data=data)
    if r.status_code in (200, 201):
        return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"
    print(f"  [WARN] Upload failed ({r.status_code}): {r.text[:200]}")
    return None

def get_existing_tree_id(lat: float, lng: float) -> str | None:
    """Check if a tree at these coordinates already exists."""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/trees",
        headers=HEADERS,
        params={"lat": f"eq.{lat}", "lng": f"eq.{lng}", "select": "id", "limit": "1"},
    )
    if r.status_code == 200:
        rows = r.json()
        if rows:
            return rows[0]["id"]
    return None

def tree_has_photos(tree_id: str) -> bool:
    """Check if a tree already has photos uploaded."""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/tree_photos",
        headers=HEADERS,
        params={"tree_id": f"eq.{tree_id}", "select": "id", "limit": "1"},
    )
    return r.status_code == 200 and len(r.json()) > 0

def insert_tree(tree: dict) -> str | None:
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/trees",
        headers={**HEADERS, "Prefer": "return=representation"},
        json=tree,
    )
    if r.status_code in (200, 201):
        return r.json()[0]["id"]
    print(f"  [WARN] Tree insert failed ({r.status_code}): {r.text[:200]}")
    return None

def insert_photo(photo: dict):
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/tree_photos",
        headers=HEADERS,
        json=photo,
    )
    if r.status_code not in (200, 201):
        print(f"  [WARN] Photo insert failed ({r.status_code}): {r.text[:100]}")

# ─── Main ─────────────────────────────────────────────────────────────────────

def parse_placemarks(root: ET.Element) -> list[dict]:
    doc = root.find("kml:Document", NS)
    records = []

    for folder in doc.findall("kml:Folder", NS):
        fname_el = folder.find("kml:name", NS)
        folder_name = fname_el.text.strip() if fname_el is not None else ""
        group_label = TREE_FOLDER_NAMES.get(folder_name)
        if not group_label:
            continue  # skip boundary folders

        for pm in folder.findall("kml:Placemark", NS):
            coords_el = pm.find(".//kml:coordinates", NS)
            if coords_el is None or not coords_el.text:
                continue
            parts = coords_el.text.strip().split(",")
            if len(parts) < 2:
                continue
            try:
                lng, lat = float(parts[0]), float(parts[1])
            except ValueError:
                continue

            ext = pm.find("kml:ExtendedData", NS)
            if ext is None:
                continue

            # Get description element for photo URL fallback
            desc_el = pm.find("kml:description", NS)
            desc_text = desc_el.text or "" if desc_el is not None else ""

            # Normalise fields
            name   = get_data(ext, *NAME_FIELDS)
            height = get_data(ext, *HEIGHT_FIELDS)
            dept   = get_data(ext, *DEPT_FIELDS)
            diam   = get_data(ext, *DIAM_FIELDS)

            # Collect photo URLs by type
            typed_photos: dict[str, str | None] = {t: None for t in PHOTO_FIELDS}
            for ptype, field_set in PHOTO_FIELDS.items():
                typed_photos[ptype] = get_data(ext, *field_set)

            # Collect all media URLs (from gx_media_links + description)
            media_urls = extract_media_urls(ext)
            # Also scan description text
            extra = re.findall(r'https://lh3\.googleusercontent\.com/[^\s"\'<>]+', desc_text)
            for u in extra:
                if u not in media_urls:
                    media_urls.append(u)

            records.append({
                "tree_name": name,
                "height": height,
                "diameter": diam,
                "department": dept,
                "group_no": group_label,
                "lat": lat,
                "lng": lng,
                "source_group": folder_name,
                "typed_photos": typed_photos,
                "media_urls": media_urls,
            })

    return records


def run():
    print(f"[*] Parsing KMZ: {KMZ_PATH}")
    root = extract_kmz(KMZ_PATH)
    records = parse_placemarks(root)
    print(f"[OK] Found {len(records)} tree placemarks\n")

    skipped = 0
    for i, rec in enumerate(records, 1):
        print(f"[{i}/{len(records)}] {rec['tree_name'] or 'Unnamed'} - {rec['group_no']}")

        # Resume support: skip if tree at these coords already exists AND has photos
        existing_id = get_existing_tree_id(rec["lat"], rec["lng"])
        if existing_id and tree_has_photos(existing_id):
            print(f"  [SKIP] Already imported")
            skipped += 1
            continue

        if existing_id:
            tree_id = existing_id
            print(f"  [RESUME] Tree exists, re-processing photos")
        else:
            tree_row = {
                "tree_name":    rec["tree_name"],
                "height":       rec["height"],
                "diameter":     rec["diameter"],
                "department":   rec["department"],
                "group_no":     rec["group_no"],
                "lat":          rec["lat"],
                "lng":          rec["lng"],
                "source_group": rec["source_group"],
            }
            tree_id = insert_tree(tree_row)
            if not tree_id:
                continue

        all_urls = list(rec["media_urls"])

        # Typed photos (specific field-type mappings)
        processed_urls = set()
        for ptype, url in rec["typed_photos"].items():
            if not url or "googleusercontent" not in url:
                continue
            if url in processed_urls:
                continue
            processed_urls.add(url)

            print(f"  -> [{ptype}] downloading...")
            img_data = download_image(url)
            if img_data:
                path = f"{tree_id}/{ptype}_{uuid.uuid4().hex[:8]}.jpg"
                stored_url = upload_to_storage(img_data, path)
                if stored_url:
                    insert_photo({"tree_id": tree_id, "photo_type": ptype, "url": stored_url})
                    print(f"  [OK] [{ptype}] uploaded")
            time.sleep(0.3)

        # Remaining media_urls not already handled (use 'full' type)
        for url in all_urls:
            if url in processed_urls:
                continue
            processed_urls.add(url)
            print(f"  -> [full] downloading...")
            img_data = download_image(url)
            if img_data:
                path = f"{tree_id}/full_{uuid.uuid4().hex[:8]}.jpg"
                stored_url = upload_to_storage(img_data, path)
                if stored_url:
                    insert_photo({"tree_id": tree_id, "photo_type": "full", "url": stored_url})
                    print(f"  [OK] [full] uploaded")
            time.sleep(0.3)

    print(f"\n[DONE] Import complete! Skipped {skipped} already-imported trees.")


if __name__ == "__main__":
    if not KMZ_PATH.exists():
        print(f"[ERROR] KMZ not found at: {KMZ_PATH}")
        sys.exit(1)
    run()

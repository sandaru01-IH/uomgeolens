"""
UoM GeoLens - Fix Script
1. Deletes duplicate trees (keeps oldest per lat/lng)
2. Re-imports all trees cleanly
3. Stores Google Photos URLs directly in tree_photos (no download needed)
   Browsers can render lh3.googleusercontent.com URLs directly.

Run: python scripts/fix_and_reimport.py
"""
import os, re, sys, uuid, time, zipfile, json
import xml.etree.ElementTree as ET
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv(".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY  = os.environ["SUPABASE_SERVICE_KEY"]
KMZ_PATH     = Path(__file__).parent.parent.parent / "University of Moratuwa Trees.kmz"
NS           = {"kml": "http://www.opengis.net/kml/2.2"}

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

NAME_FIELDS   = {"NAME", "Name", "name"}
HEIGHT_FIELDS = {"HEIGHT", "Height"}
DEPT_FIELDS   = {"DEPT", "Affli_with", "Affliated", "Department", "Which dep"}
DIAM_FIELDS   = {"DBS", "Dia_Trunk", "DBH"}
PHOTO_FIELDS  = {
    "full":   {"F IMAGE", "full image", "Tree_Image"},
    "trunk":  {"TRUNK IMAG", "Trunk_Img", "img trunk"},
    "branch": {"BRANCH", "Branch_IMG", "branch img"},
    "leaves": {"LEAVES", "Leaves_IMG", "leaves img"},
    "flower": {"FLOWERS", "Flo_Frt_IM", "flower"},
}
TREE_FOLDERS = {
    "Group No 1 Trees": "Group 1",
    "Group No 3 Trees": "Group 3",
    "Group No 4 Trees": "Group 4",
    "Group No 5 trees": "Group 5",
    "Mora devide area 2.csv": "Group 2",
}

# ── Supabase helpers ──────────────────────────────────────────────────────────

def api_get(path, params=None):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, params=params)
    return r.json() if r.ok else []

def api_post(path, body):
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={**HEADERS, "Prefer": "return=representation"},
        json=body,
    )
    return r.json() if r.ok else None

def api_delete(path, params):
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, params=params)
    return r.ok

def rpc(fn, body):
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/{fn}",
        headers=HEADERS,
        json=body,
    )
    return r.json() if r.ok else None

# ── KML helpers ───────────────────────────────────────────────────────────────

def get_val(ext, *names):
    for d in ext.findall("kml:Data", NS):
        if d.get("name") in names:
            v = d.find("kml:value", NS)
            if v is not None and v.text and v.text.strip():
                return v.text.strip()
    return None

def get_photo_urls(ext, desc_text=""):
    urls = {}
    # Try typed fields first
    for ptype, fields in PHOTO_FIELDS.items():
        val = get_val(ext, *fields)
        if val and "googleusercontent" in val:
            urls[ptype] = val

    # Collect all from gx_media_links
    gx = get_val(ext, "gx_media_links")
    all_urls = []
    if gx:
        all_urls += [u.strip() for u in gx.split() if "googleusercontent" in u]
    # Also scan description
    all_urls += re.findall(r'https://lh3\.googleusercontent\.com/[^\s"\'<>]+', desc_text)

    # Deduplicate while preserving order
    seen = set(urls.values())
    extra = []
    for u in all_urls:
        if u not in seen:
            seen.add(u)
            extra.append(u)

    return urls, extra  # typed, untyped extras

def parse_kmz():
    with zipfile.ZipFile(KMZ_PATH) as z:
        kml_name = next(n for n in z.namelist() if n.endswith(".kml"))
        with z.open(kml_name) as f:
            root = ET.parse(f).getroot()

    doc = root.find("kml:Document", NS)
    records = []
    for folder in doc.findall("kml:Folder", NS):
        fname = folder.find("kml:name", NS)
        fn = fname.text.strip() if fname is not None else ""
        group = TREE_FOLDERS.get(fn)
        if not group:
            continue
        for pm in folder.findall("kml:Placemark", NS):
            coords = pm.find(".//kml:coordinates", NS)
            if coords is None or not coords.text:
                continue
            parts = coords.text.strip().split(",")
            if len(parts) < 2:
                continue
            try:
                lng, lat = float(parts[0]), float(parts[1])
            except ValueError:
                continue
            ext = pm.find("kml:ExtendedData", NS)
            if ext is None:
                continue
            desc_el = pm.find("kml:description", NS)
            desc_text = (desc_el.text or "") if desc_el is not None else ""
            typed_photos, extra_urls = get_photo_urls(ext, desc_text)
            records.append({
                "tree_name":  get_val(ext, *NAME_FIELDS),
                "height":     get_val(ext, *HEIGHT_FIELDS),
                "diameter":   get_val(ext, *DIAM_FIELDS),
                "department": get_val(ext, *DEPT_FIELDS),
                "group_no":   group,
                "source_group": fn,
                "lat": lat,
                "lng": lng,
                "typed_photos": typed_photos,
                "extra_urls":   extra_urls,
            })
    return records

# ── Step 1: Wipe all existing data ───────────────────────────────────────────

def wipe_all():
    print("[*] Wiping all tree_photos records...")
    # Supabase requires a filter for delete - use neq on a uuid that won't match
    r = requests.delete(
        f"{SUPABASE_URL}/rest/v1/tree_photos",
        headers=HEADERS,
        params={"id": "neq.00000000-0000-0000-0000-000000000000"},
    )
    print(f"    tree_photos: {r.status_code}")

    print("[*] Wiping all incidents records...")
    r = requests.delete(
        f"{SUPABASE_URL}/rest/v1/incidents",
        headers=HEADERS,
        params={"id": "neq.00000000-0000-0000-0000-000000000000"},
    )
    print(f"    incidents: {r.status_code}")

    print("[*] Wiping all trees records...")
    r = requests.delete(
        f"{SUPABASE_URL}/rest/v1/trees",
        headers=HEADERS,
        params={"id": "neq.00000000-0000-0000-0000-000000000000"},
    )
    print(f"    trees: {r.status_code}")
    print("[OK] All data wiped.\n")

# ── Step 2: Batch insert trees ────────────────────────────────────────────────

BATCH_SIZE = 100

def insert_trees_batch(records):
    print(f"[*] Inserting {len(records)} trees in batches of {BATCH_SIZE}...")
    inserted = {}  # (lat, lng) -> id
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i:i+BATCH_SIZE]
        rows = [{
            "tree_name":    r["tree_name"],
            "height":       r["height"],
            "diameter":     r["diameter"],
            "department":   r["department"],
            "group_no":     r["group_no"],
            "source_group": r["source_group"],
            "lat":          r["lat"],
            "lng":          r["lng"],
        } for r in batch]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/trees",
            headers={**HEADERS, "Prefer": "return=representation"},
            json=rows,
        )
        if resp.ok:
            for row, rec in zip(resp.json(), batch):
                inserted[(rec["lat"], rec["lng"])] = row["id"]
            print(f"  Batch {i//BATCH_SIZE + 1}: {len(batch)} trees inserted")
        else:
            print(f"  [WARN] Batch failed: {resp.status_code} {resp.text[:200]}")
    return inserted

# ── Step 3: Insert photo URLs directly ───────────────────────────────────────

def insert_photos(records, tree_id_map):
    print(f"\n[*] Inserting photo URLs directly (no download)...")
    photo_rows = []
    for rec in records:
        tid = tree_id_map.get((rec["lat"], rec["lng"]))
        if not tid:
            continue
        # Typed photos
        for ptype, url in rec["typed_photos"].items():
            photo_rows.append({"tree_id": tid, "photo_type": ptype, "url": url})
        # Extra (use "full" type)
        for url in rec["extra_urls"]:
            photo_rows.append({"tree_id": tid, "photo_type": "full", "url": url})

    if not photo_rows:
        print("  No photos found in KML.")
        return

    # Insert in batches
    for i in range(0, len(photo_rows), BATCH_SIZE):
        batch = photo_rows[i:i+BATCH_SIZE]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/tree_photos",
            headers=HEADERS,
            json=batch,
        )
        if resp.ok:
            print(f"  Photo batch {i//BATCH_SIZE + 1}: {len(batch)} URLs inserted")
        else:
            print(f"  [WARN] Photo batch failed: {resp.status_code} {resp.text[:100]}")

    print(f"[OK] {len(photo_rows)} photo records inserted.\n")

# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    if not KMZ_PATH.exists():
        print(f"[ERROR] KMZ not found: {KMZ_PATH}")
        sys.exit(1)

    print("[*] Parsing KMZ...")
    records = parse_kmz()
    print(f"[OK] {len(records)} tree placemarks parsed.\n")

    wipe_all()

    tree_id_map = insert_trees_batch(records)
    print(f"[OK] {len(tree_id_map)} trees inserted.\n")

    insert_photos(records, tree_id_map)

    # Final counts
    print("[DONE] Import complete! Check Supabase dashboard for final counts.")

if __name__ == "__main__":
    run()

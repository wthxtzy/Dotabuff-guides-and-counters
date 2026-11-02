#!/usr/bin/env python3
"""Build the offline seed dataset used by Dota Draft Assistant 2.0.

The app itself can refresh its data from OpenDota at runtime.  This script is
used to produce a fresh, bundled snapshot for a release, and is also handy for
local development.

Usage:
    python3 tools/build_seed.py --all
    python3 tools/build_seed.py --icons
    python3 tools/build_seed.py --matchups
    python3 tools/build_seed.py --build

Requires Pillow for icon conversion (pip install pillow).
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
MATCHUP_DIR = RAW / "matchups"
WEB = ROOT / "web"
HERO_IMG_DIR = WEB / "heroes"
HERO_ICON_DIR = WEB / "heroes" / "icons"

API = "https://api.opendota.com/api"
CDN = "https://cdn.cloudflare.steamstatic.com"
UA = "DotaDraftAssistant/2.0 (+https://github.com/wthxtzy/Dotabuff-guides-and-counters)"

MATCHUP_DELAY = 1.15  # OpenDota free tier: ~60 requests/minute


def log(*args: object) -> None:
    print("[seed]", *args, flush=True)


def http_get(url: str, attempts: int = 6, timeout: int = 45) -> bytes:
    last: Exception | None = None
    for attempt in range(attempts):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code in (429, 500, 502, 503, 504):
                delay = min(60, 2 ** attempt)
                log(f"HTTP {exc.code} for {url}; retrying in {delay}s")
                time.sleep(delay)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
            last = exc
            delay = min(30, 2 ** attempt)
            log(f"network error for {url}: {exc}; retrying in {delay}s")
            time.sleep(delay)
    raise RuntimeError(f"failed to fetch {url}: {last}")


def get_json(url: str) -> object:
    return json.loads(http_get(url).decode("utf-8"))


def hero_stats(force: bool = False) -> list[dict]:
    path = DATA / "hero_stats.json"
    if path.exists() and not force:
        return json.loads(path.read_text(encoding="utf-8"))
    data = get_json(f"{API}/heroStats")
    assert isinstance(data, list) and len(data) > 100
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    return data


def latest_patch() -> str:
    try:
        patches = get_json(f"{API}/constants/patch")
        if isinstance(patches, list) and patches:
            return str(patches[-1].get("name", ""))
    except Exception as exc:  # pragma: no cover - cosmetic metadata
        log("could not read patch list:", exc)
    return ""


def download_icons(heroes: list[dict], force: bool = False) -> None:
    HERO_IMG_DIR.mkdir(parents=True, exist_ok=True)
    HERO_ICON_DIR.mkdir(parents=True, exist_ok=True)

    def one(hero: dict) -> str:
        hero_id = int(hero["id"])
        wide_path = HERO_IMG_DIR / f"{hero_id}.webp"
        square_path = HERO_ICON_DIR / f"{hero_id}.webp"
        if wide_path.exists() and square_path.exists() and not force:
            return "cached"
        wide_url = CDN + hero["img"].split("?")[0]
        square_url = CDN + hero["icon"].split("?")[0]
        try:
            raw = http_get(wide_url, attempts=4)
            import io

            with Image.open(io.BytesIO(raw)) as im:
                im = im.convert("RGB")
                if im.size != (256, 144):
                    im = im.resize((256, 144), Image.LANCZOS)
                im.save(wide_path, "WEBP", quality=86, method=6)
            raw = http_get(square_url, attempts=4)
            with Image.open(io.BytesIO(raw)) as im:
                im = im.convert("RGBA")
                if im.size != (64, 64):
                    im = im.resize((64, 64), Image.LANCZOS)
                im.save(square_path, "WEBP", quality=88, method=6)
            return "ok"
        except Exception as exc:
            log(f"icon failed for {hero['localized_name']} ({hero_id}): {exc}")
            return "failed"

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(one, heroes))
    log("icons:", {k: results.count(k) for k in set(results)})


def download_matchups(heroes: list[dict], force: bool = False) -> None:
    MATCHUP_DIR.mkdir(parents=True, exist_ok=True)
    pending = []
    for hero in heroes:
        path = MATCHUP_DIR / f"{hero['id']}.json"
        if force or not path.exists() or path.stat().st_size < 50:
            pending.append(hero)
    log(f"matchups: {len(heroes) - len(pending)} cached, {len(pending)} to fetch")
    for index, hero in enumerate(pending, 1):
        hero_id = int(hero["id"])
        path = MATCHUP_DIR / f"{hero_id}.json"
        data = get_json(f"{API}/heroes/{hero_id}/matchups")
        if not isinstance(data, list):
            raise RuntimeError(f"unexpected matchups for {hero_id}: {data!r}")
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data), encoding="utf-8")
        tmp.replace(path)
        log(f"matchups {index}/{len(pending)}: {hero['localized_name']} ({len(data)} rows)")
        if index != len(pending):
            time.sleep(MATCHUP_DELAY)


def build(heroes: list[dict]) -> None:
    generated = datetime.now(timezone.utc).replace(microsecond=0)
    patch = latest_patch()

    hero_rows = []
    matchups_out: dict[str, list[list[int]]] = {}
    total_pub_picks = sum(int(h.get("pub_pick") or 0) for h in heroes) or 1

    for hero in heroes:
        hero_id = int(hero["id"])
        raw_path = MATCHUP_DIR / f"{hero_id}.json"
        if not raw_path.exists():
            raise RuntimeError(f"missing matchups for {hero['localized_name']} ({hero_id})")
        rows = json.loads(raw_path.read_text(encoding="utf-8"))
        pairs = []
        for row in rows:
            enemy = int(row.get("hero_id") or 0)
            games = int(row.get("games_played") or 0)
            wins = int(row.get("wins") or 0)
            if enemy <= 0 or enemy == hero_id or games <= 0:
                continue
            pairs.append([enemy, games, wins])
        pairs.sort(key=lambda item: item[0])

        brackets = []
        for bracket in range(1, 9):
            picks = int(hero.get(f"{bracket}_pick") or 0)
            wins = int(hero.get(f"{bracket}_win") or 0)
            brackets.append([picks, wins])

        pub_pick = int(hero.get("pub_pick") or 0)
        pub_win = int(hero.get("pub_win") or 0)
        high_pick = brackets[5][0] + brackets[6][0]  # Ancient + Divine
        high_win = brackets[5][1] + brackets[6][1]

        hero_rows.append(
            {
                "id": hero_id,
                "key": hero["name"].replace("npc_dota_hero_", ""),
                "name": hero["localized_name"],
                "attr": hero["primary_attr"],
                "attack": hero["attack_type"],
                "roles": hero["roles"],
                "img": f"heroes/{hero_id}.webp",
                "icon": f"heroes/icons/{hero_id}.webp",
                "remoteImg": CDN + hero["img"].split("?")[0],
                "pub": {"picks": pub_pick, "wins": pub_win, "pickShare": round(pub_pick * 100 / total_pub_picks, 5)},
                "high": {"picks": high_pick, "wins": high_win},
                "pro": {
                    "picks": int(hero.get("pro_pick") or 0),
                    "wins": int(hero.get("pro_win") or 0),
                    "bans": int(hero.get("pro_ban") or 0),
                },
                "brackets": brackets,
                "base": {
                    "hp": hero.get("base_health"),
                    "mana": hero.get("base_mana"),
                    "armor": hero.get("base_armor"),
                    "attackMin": hero.get("base_attack_min"),
                    "attackMax": hero.get("base_attack_max"),
                    "range": hero.get("attack_range"),
                    "speed": hero.get("move_speed"),
                    "str": hero.get("base_str"),
                    "agi": hero.get("base_agi"),
                    "int": hero.get("base_int"),
                    "strGain": hero.get("str_gain"),
                    "agiGain": hero.get("agi_gain"),
                    "intGain": hero.get("int_gain"),
                },
            }
        )
        matchups_out[str(hero_id)] = pairs

    hero_rows.sort(key=lambda h: h["name"].lower())
    heroes_out = {
        "schema": 2,
        "generatedAt": generated.isoformat().replace("+00:00", "Z"),
        "patch": patch,
        "source": "OpenDota public matches",
        "attribution": "Data: OpenDota (odota.ai), portraits: Valve / Steam CDN",
        "heroes": hero_rows,
    }
    (DATA / "heroes.json").write_text(
        json.dumps(heroes_out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    matchups_doc = {
        "schema": 2,
        "generatedAt": generated.isoformat().replace("+00:00", "Z"),
        "pairs": matchups_out,
    }
    (DATA / "matchups.json").write_text(
        json.dumps(matchups_doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )

    meta = {
        "schema": 2,
        "generatedAt": generated.isoformat().replace("+00:00", "Z"),
        "patch": patch,
        "source": "OpenDota public matches",
        "totalMatchups": sum(len(p) for p in matchups_out.values()),
        "heroes": len(hero_rows),
    }
    (DATA / "meta.json").write_text(json.dumps(meta, indent=1) + "\n", encoding="utf-8")
    log("built data/heroes.json and data/meta.json", meta)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="icons + matchups + build")
    parser.add_argument("--icons", action="store_true")
    parser.add_argument("--matchups", action="store_true")
    parser.add_argument("--build-only", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if not any([args.all, args.icons, args.matchups, args.build_only]):
        parser.print_help()
        return 1

    heroes = hero_stats(force=args.all and args.force)
    if args.all or args.matchups:
        download_matchups(heroes, force=args.force)
    if args.all or args.icons:
        download_icons(heroes, force=args.force)
    if args.all or args.build_only:
        build(heroes)
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Build a same-origin Pokémon card + price snapshot; no keys or browser proxy.
TCGCSV refreshes daily. Respect its user agent, pacing and timestamp policy.
"""
import html, concurrent.futures, datetime, json, pathlib, threading, time, urllib.request, urllib.error, re
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://tcgcsv.com/'
lock = threading.Lock()
last = 0.0

def get(path, raw=False):
    global last
    for attempt in range(4):
        with lock:
            time.sleep(max(0, .15 - (time.monotonic() - last)))
            last = time.monotonic()
        try:
            req = urllib.request.Request(BASE + path, headers={'User-Agent': 'PokeLens/1.0.0 (daily Pokemon catalog sync)'})
            with urllib.request.urlopen(req, timeout=45) as response:
                data = response.read()
            if raw:
                return data.decode().strip()
            obj = json.loads(data)
            if obj.get('success') is False or not isinstance(obj.get('results'), list):
                raise ValueError('Provider returned unsuccessful result: ' + path)
            return obj['results']
        except (OSError, ValueError) as e:
            if attempt == 3: raise
            time.sleep(2 ** attempt)

def sync():
    dest = ROOT / 'data/catalog.json'
    previous = json.loads(dest.read_text()) if dest.exists() else {}
    stamp = get('last-updated.txt', raw=True)
    if previous.get('sourceUpdated') == stamp and previous.get('cards') and previous.get('version') == 2:
        print('Catalog already current', flush=True)
        return
    groups = get('tcgplayer/3/groups')
    cards = []
    def one(group):
        gid = group['groupId']
        products = get(f'tcgplayer/3/{gid}/products')
        prices = get(f'tcgplayer/3/{gid}/prices')
        byid = {}
        for p in prices:
            v = p.get('marketPrice')
            if isinstance(v, (int, float)) and v >= 0:
                byid.setdefault(p['productId'], []).append({'type': p.get('subTypeName') or 'Standard', 'market': v})
        out = []
        for p in products:
            ext = {x['name'].lower().replace(' ', ''): x.get('value', '') for x in p.get('extendedData', [])}
            number = ext.get('number', '').strip()
            # Include every numbered single, including promos, energies and trainers.
            if not number or number.lower() in ('n/a', 'na', '-'):
                if not ext.get('rarity'): continue
            out.append({'id': p['productId'], 'name': p['name'], 'number': number,
                        'set': group['name'], 'setCode': group.get('abbreviation', ''), 'group': gid,
                        'image': p.get('imageUrl', ''), 'url': p.get('url', ''),
                        'hp': ext.get('hp', ''),
                        'attacks': [html.unescape(re.sub(r'<[^>]+>', ' ', re.split(r'[\r\n]|<br', v, flags=re.I)[0])).strip() for k,v in ext.items() if k.startswith('attack')],
                        'prices': byid.get(p['productId'], [])})
        print(f"{group['name']}: {len(out)} cards", flush=True)
        return out
    # A shared limiter caps requests even with a small worker pool.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for batch in pool.map(one, groups): cards.extend(batch)
    if len(cards) < 10000:
        raise RuntimeError('Incomplete catalog: refusing to replace the previous snapshot')
    if previous.get('cards') and len(cards) < len(previous['cards']) * .9:
        raise RuntimeError('Unexpected catalog shrink: preserving previous snapshot')
    snapshot = {'version': 2, 'source': 'TCGplayer via TCGCSV', 'currency': 'USD',
                'sourceUpdated': stamp, 'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'setCount': len(groups), 'cardCount': len(cards), 'cards': sorted(cards, key=lambda c: c['id'])}
    dest.parent.mkdir(exist_ok=True)
    tmp = dest.with_suffix('.tmp')
    tmp.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')))
    tmp.replace(dest)
    print(f'Saved {len(cards)} cards from {len(groups)} sets', flush=True)

if __name__ == '__main__': sync()

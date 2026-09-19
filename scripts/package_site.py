#!/usr/bin/env python3
"""Package the verified compiled dashboard for GitHub Pages, without rebuilding."""
import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src, out = ROOT / 'app/dist', ROOT / 'docs'
out.mkdir(exist_ok=True)
html = (src / 'index.html').read_text()
assert 'このページは GPT 6 Astro' in html
# Japanese document metadata for the explicitly requested public destination.
html = html.replace('<html lang="en">', '<html lang="ja">')
html = re.sub(r'<title>.*?</title>', '<title>日本の犯罪の推移｜警察庁統計の可視化</title>', html, count=1)
# A local task deep link has no role on the public GitHub Pages destination.
# Remove only this build-time routing metadata; leave the compiled runtime intact.
html = re.sub(r'<meta\s+name="data-app-local-thread"\s+content="[^"<>]+"\s*/?>\s*', '', html)
assert not re.search(r'<meta[^>]+name="data-app-local-thread"', html)
metadata = '''<meta name="description" content="警察庁の白書・確定統計から、日本の刑法犯の1946〜2025年の推移、罪種別、詐欺被害額、47都道府県を可視化。出典・CSV付き。GPT 6 Astroで作成。">
<meta name="author" content="GPT 6 Astro">
<link rel="icon" type="image/svg+xml" href="./favicon.svg">
<link rel="canonical" href="https://katzkawai.org/kklab-japan-crime/">
<meta property="og:title" content="日本の犯罪の推移｜警察庁統計の可視化">
<meta property="og:description" content="長期の減少と近年の増加を、公式統計から読み解く。1946〜2025年の刑法犯・罪種・詐欺・都道府県別の推移。">
<meta property="og:type" content="website">
<meta property="og:locale" content="ja_JP">
'''
html = html.replace('</head>', metadata + '</head>', 1)
(out / 'index.html').write_text(html)
# Only obsolete generated sidecars in docs are removed; never touch source data.
for p in out.glob('snapshot.*.json'):
    if not (src / p.name).exists():
        p.unlink()
for p in src.glob('snapshot.*.json'):
    shutil.copyfile(p, out / p.name)
(out / 'data').mkdir(exist_ok=True)
for p in (ROOT / 'data').glob('*.csv'):
    shutil.copyfile(p, out / 'data' / p.name)
(out / '.nojekyll').write_text('')
(out / 'favicon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#157a7a"/><path d="M12 20L24 13L34 36L44 48L54 39" fill="none" stroke="#fffefa" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>')
manifest = {str(p.relative_to(out)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file() and p.name != 'site-manifest.json'}
(out / 'site-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Packaged {len(manifest)} files in docs/')

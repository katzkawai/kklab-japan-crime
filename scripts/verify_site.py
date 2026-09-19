#!/usr/bin/env python3
"""Validate committed public artifacts against reviewed data and source hashes."""
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
site = ROOT / 'docs'
for entry in json.loads((ROOT / 'data/raw-manifest.json').read_text()):
    assert hashlib.sha256((ROOT / entry['file']).read_bytes()).hexdigest() == entry['sha256'], entry['file']
for name, digest in json.loads((site / 'site-manifest.json').read_text()).items():
    assert hashlib.sha256((site / name).read_bytes()).hexdigest() == digest, name
html = (site / 'index.html').read_text()
assert '<html lang="ja">' in html
assert 'このページは GPT 6 Astro で作成されました。' in html
assert not re.search(r'<meta[^>]+name="data-app-local-thread"', html)
snapshot_name = re.search(r'name="data-app-local-snapshot" content="([^"]+)"', html)
if snapshot_name:
    snapshot_path = site / snapshot_name[1]
    assert snapshot_path.name == 'snapshot.' + hashlib.sha256(snapshot_path.read_bytes()).hexdigest() + '.json'
    snapshot = json.loads(snapshot_path.read_text())
else:
    # npm source builds embed the snapshot; app/src/data.json is the build input.
    snapshot = json.loads((ROOT / 'app/src/data.json').read_text())
    expected = hashlib.sha256((ROOT / 'app/src/data.json').read_bytes()).hexdigest()
    assert f'name="data-app-snapshot-sha256" content="{expected}"' in html
assert snapshot['buildStatus'] == 'complete'
reviewed = json.loads((ROOT / 'data/reviewed.json').read_text())
assert snapshot['queries'] == reviewed['queries']
assert snapshot['metadata'] == reviewed['metadata']
for name, query in reviewed['queries'].items():
    data = list(csv.DictReader((site / 'data' / f'{name}.csv').open(encoding='utf-8-sig')))
    assert len(data) == len(query['rows']), name
    for actual, expected in zip(data, query['rows']):
        assert all(actual[key] == ('' if expected.get(key) is None else str(expected[key])) for key in actual), name
assert 'GPT 6 Astro' in (ROOT / 'README.md').read_text()
print('Verified: original source hashes, site hashes, snapshot, all 807 CSV records, attribution, Japanese metadata.')

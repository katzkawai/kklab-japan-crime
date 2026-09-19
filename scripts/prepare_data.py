#!/usr/bin/env python3
"""Reproduce the reviewed snapshot using only Python's standard library.

Input files are immutable downloads from the National Police Agency. No network
or third-party packages are needed. Fails closed if expected tables change.
"""
import csv
import hashlib
import json
import re
import unicodedata
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw'
OUT = ROOT / 'data'
NPA = 'https://www.npa.go.jp/toukei/seianki/R07/'
INDEX = NPA + 'r07.zuhyosakuin.htm'
PDF = 'https://www.npa.go.jp/publications/statistics/crime/situation/r7_hanzaijyosei_kakuteichi.pdf'
WHITEPAPER = 'https://www.npa.go.jp/hakusyo/r07/honbun/html/bb2211000.html'
RETRIEVED = '2026-09-20'


def norm(v):
    return unicodedata.normalize('NFKC', v).strip()


def year(v):
    v = norm(v).replace('元', '1')
    m = re.fullmatch(r'([SHR])(\d+)', v)
    if not m:
        return None
    return {'S': 1925, 'H': 1988, 'R': 2018}[m[1]] + int(m[2])


def number(v):
    v = norm(v).replace(',', '')
    if v in ('', '-', '…', '－'):
        return None
    n = float(v)
    return int(n) if n.is_integer() else n


raw_rows = list(csv.reader((RAW / 'crime-2025.csv').read_text(encoding='cp932').splitlines()))
sections = {}
current = None
for row in raw_rows:
    m = re.match(r'図表[:：]([^\s(（]+)', norm(row[0]))
    if m:
        current = m[1].replace('－', '-')
        assert current not in sections, current
        sections[current] = []
    if current:
        sections[current].append(row)


def header(row):
    return {i: year(v) for i, v in enumerate(row) if year(v) is not None}


national = {}
fields = [('人口', '人口千人当たり'), ('認知件数', '認知件数'), ('検挙件数', '検挙件数'), ('検挙人員', '検挙人員'), ('検挙率', '検挙率')]
for row in sections['1-1-1']:
    if header(row):
        years = header(row)
    else:
        for prefix, key in fields:
            if norm(row[0]).startswith(prefix):
                for col, y in years.items():
                    national.setdefault(y, {'年': y})[key] = number(row[col])

categories = []
for row in sections['1-2-1']:
    if header(row):
        years = header(row)
    elif row[1] and norm(row[2]).startswith('認知件数'):
        for col, y in years.items():
            categories.append({'年': y, '罪種': row[1], '認知件数': number(row[col])})

details = []
for section in ['1-2-2', '1-2-3', '1-2-4-4', '1-2-5', '1-2-6']:
    for row in sections[section]:
        if header(row):
            years = header(row)
        elif row[1] and norm(row[2]).startswith('認知件数'):
            label = norm(row[1])
            if label not in ['殺人', '強盗', '放火', '不同意性交等', '暴行', '傷害', '自転車盗', '自動車盗', '詐欺', '不同意わいせつ']:
                continue
            for col, y in years.items():
                details.append({'年': y, '罪名': label, '認知件数': number(row[col])})

regions = {}
pref_names = []
for sid, key in [('1-5-1', '認知件数'), ('1-5-2', '人口10万人当たり')]:
    for row in sections[sid]:
        if header(row):
            years = header(row)
        elif row[0].startswith('全国総数'):
            if key == '人口10万人当たり':
                for col, y in years.items():
                    national[y][key] = number(row[col])
        elif (row[1] in ['北海道', '東京']) or (row[2] and row[2] not in ['計', '年次'] and not row[0]):
            name = row[1] if row[1] in ['北海道', '東京'] else row[2]
            if sid == '1-5-1':
                pref_names.append(name)
            for col, y in years.items():
                regions.setdefault((name, y), {'年': y, '都道府県': name})[key] = number(row[col])


def xlsx_sheets(path):
    """Read cached OOXML cell values, preserving exact integer yen values."""
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(path) as z:
        strings = [''.join(s.itertext()) for s in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        for name in z.namelist():
            if not re.fullmatch(r'xl/worksheets/sheet\d+\.xml', name):
                continue
            rows = []
            for row in ET.fromstring(z.read(name)).findall('.//s:row', ns):
                cells = {}
                for cell in row.findall('s:c', ns):
                    value = cell.find('s:v', ns)
                    if value is not None and value.text is not None:
                        cells[re.sub(r'\d', '', cell.get('r'))] = strings[int(value.text)] if cell.get('t') == 's' else value.text
                rows.append(cells)
            yield rows


fraud = {}
for sid, label in [('2-3-6-1', '特殊詐欺'), ('2-3-7-1', 'SNS型投資・ロマンス詐欺')]:
    for row in sections[sid]:
        if header(row):
            years = header(row)
        elif not row[0].startswith('図表') and norm(row[0]).endswith('認知件数'):
            for col, y in years.items():
                fraud[(label, y)] = {'年': y, '分類': label, '認知件数': number(row[col])}
for rows in xlsx_sheets(RAW / 'crime-2025-fraud.xlsx'):
    title = norm(rows[0].get('A', ''))
    if '被害額' not in title:
        continue
    label = 'SNS型投資・ロマンス詐欺' if 'SNS型' in title else '特殊詐欺' if '特殊詐欺' in title else None
    if not label:
        continue
    years = {}
    for row in rows:
        if any(year(v) for v in row.values()):
            years = {c: year(v) for c, v in row.items() if year(v)}
        elif row.get('A', '').startswith(('特殊詐欺被害額', 'ＳＮＳ型投資・ロマンス詐欺被害額')):
            for col, y in years.items():
                yen = number(row[col])
                fraud[(label, y)]['被害額（円）'] = yen
                fraud[(label, y)]['被害額（億円）'] = yen / 100_000_000

national_rows = sorted(national.values(), key=lambda r: r['年'])
region_rows = sorted(regions.values(), key=lambda r: (r['年'], pref_names.index(r['都道府県'])))
fraud_rows = sorted(fraud.values(), key=lambda r: (r['年'], r['分類']))

# Checks against a separately formatted Police White Paper CSV, all 73 overlaps.
white = list(csv.reader((RAW / 'whitepaper-2025-2-1.csv').read_text(encoding='cp932').splitlines()))
white_values = {key: [] for key in ['認知件数', '検挙件数', '検挙人員', '検挙率']}
for row in white:
    for key in white_values:
        if row[0].startswith(key):
            white_values[key].extend(number(v) for v in row[2:] if v.strip())
for key, values in white_values.items():
    assert len(values) == 73, (key, len(values))
    for y, value in zip(range(1952, 2025), values):
        assert national[y][key] == value, (y, key, value)
assert list(national) == list(range(1946, 2026))
assert len(categories) == 24 * 6
assert len(set(pref_names)) == 47
assert len(region_rows) == 470
assert len(details) == 100, sorted(set(r['罪名'] for r in details))
for y in range(2002, 2026):
    assert sum(r['認知件数'] for r in categories if r['年'] == y) == national[y]['認知件数']
for y in range(2016, 2026):
    assert sum(r['認知件数'] for r in region_rows if r['年'] == y) == national[y]['認知件数']
assert national[2025]['認知件数'] == 774142
assert national[2025]['検挙件数'] == 301055
assert national[2025]['検挙率'] == 38.9
assert all('被害額（円）' in r for r in fraud_rows)

CAVEATS = [
    '認知件数は警察が発生を認知した事件の数。未届け・未把握の被害を含む犯罪の実数ではない。',
    '刑法犯は警察統計上の区分。交通関係の業務上過失致死傷等を除き、一部の特別法上の罪を含む。すべての犯罪を網羅する指標ではない。',
    '検挙率は当年の検挙件数÷当年の認知件数。過年度に認知した事件の検挙を含み、当年の事件が解決した割合ではない。',
    '人口当たりの数値は警察庁の公表値。2025年は2024年10月1日現在の人口を使用する（犯罪情勢・本文2頁注3）。',
    '長期比較には法改正、統計の集計範囲、通報・認知の変化が影響しうる。増減の原因はこの集計のみから断定できない。',
    '1972年以前の数値は、1972年5月14日以前の沖縄県の該当分を含まない（警察白書・凡例）。',
]
SEX = '性犯罪は2017年・2023年の法改正により名称・構成要件・対象範囲が変化。旧罪名の数値を含むため、改正前後の単純比較には注意。性的姿態撮影等処罰法の罪は2023年から風俗犯に計上。'
FRAUD_NOTE = '特殊詐欺にはキャッシュカード詐欺盗を含む。詐欺・窃盗等と重なる切り口なので、刑法犯総数や詐欺の件数へ足し合わせない。SNS型ロマンス詐欺の2023年の調査対象は相手が外国人または海外居住者を名乗ったものに限られる。'


def source(label, table, period, caveats=None, excel=False):
    files = [{'label': '令和7年の刑法犯に関する統計資料 ' + table, 'href': INDEX},
             {'label': '警察庁・元データ', 'href': NPA + ('r07_2-3.xlsx' if excel else 'r07.csv')}]
    return {
        'label': label, 'provider': '警察庁', 'description': '全国・暦年の確定値。警察庁が公表した統計を整形。',
        'period': period, 'lastUpdated': RETRIEVED, 'retrievedAt': RETRIEVED,
        'files': files, 'links': files, 'tables': [{'name': table, 'href': INDEX}], 'filters': ['全国', period, '年次・確定値'],
        'caveats': caveats or CAVEATS,
        'metricDefinitions': [{'label': '認知件数', 'definition': CAVEATS[0]}, {'label': '検挙率', 'definition': CAVEATS[2]}],
        'evidenceFlow': [{'title': '一次資料を取得', 'detail': files[1]['href'] + ' を2026年9月20日に取得。原本とSHA-256をリポジトリに保存。'},
                         {'title': '表の整形', 'detail': 'scripts/prepare_data.py: CP932を読解、和暦を西暦に変換、空欄・ハイフンは欠測として保持。' + ('被害額はCSVで桁が丸められているためExcelの正確な整数値を使用。' if excel else '')},
                         {'title': '検証', 'detail': '1952–2024年の全国4指標を警察白書と照合。各年の6罪種・47都道府県の件数を全国総数に照合。'}],
    }


queries = {
    'national': {'rows': national_rows, 'source': source('刑法犯の長期推移', '1-1-1 / 1-5-2', '1946–2025年')},
    'categories': {'rows': categories, 'source': source('包括罪種別の認知件数', '1-2-1', '2002–2025年', [SEX, *CAVEATS[:2]])},
    'offenses': {'rows': details, 'source': source('主な罪名別の認知件数', '1-2-2 / 1-2-3 / 1-2-4-4 / 1-2-5 / 1-2-6', '2016–2025年', [SEX, '殺人の認知件数には未遂を含む。死亡者数ではない。', *CAVEATS[:2]])},
    'prefectures': {'rows': region_rows, 'source': source('47都道府県の認知件数と人口当たり指標', '1-5-1 / 1-5-2', '2016–2025年', [CAVEATS[3], '人口当たりの値は常住人口に対する事件件数。人の流入・通勤・観光等を補正していない。個人の被害確率や地域の安全度を直接示さない。'])},
    'fraud': {'rows': fraud_rows, 'source': source('特殊詐欺とSNS型投資・ロマンス詐欺', '2-3-6-1 / 2-3-6-2 / 2-3-7-1 / 2-3-7-2', '特殊詐欺2016–2025年・SNS型2023–2025年', [FRAUD_NOTE, '被害額は円単位の原値から1億で除して億円表示。2023年以前にさかのぼるSNS型データを0で補完していない。'], excel=True)},
}
for q in queries.values():
    q['methods'] = [{'language': 'text', 'code': 'python3 scripts/prepare_data.py（同梱の原本のみを使用）'}]
    q['source']['metricDefinitions'] = [{'label': '認知件数', 'definition': CAVEATS[0]}]
queries['national']['source']['metricDefinitions'] += [
    {'label': '検挙率', 'definition': CAVEATS[2]},
    {'label': '人口千人当たり', 'definition': CAVEATS[3]},
    {'label': '前年比・基準年比', 'definition': '（当年の認知件数÷比較年の認知件数−1）×100。2002年・2019年・2021年・2024年を明示した比較。'},
    {'label': '万件', 'definition': '認知件数または検挙件数を10,000で割った表示値。原値は件単位で保持。'},
]
queries['categories']['source']['metricDefinitions'] += [
    {'label': '包括罪種', 'definition': '凶悪犯＝殺人・強盗・放火・不同意性交等。粗暴犯＝暴行・傷害・脅迫・恐喝・凶器準備集合。知能犯＝詐欺・横領・偽造・汚職・背任等。風俗犯＝賭博・わいせつ・性的姿態撮影等処罰法違反。'},
    {'label': '2002年=100', 'definition': '各罪種の当年の認知件数÷同じ罪種の2002年の認知件数×100。'},
    {'label': '増減件数', 'definition': '同じ罪種の2025年の認知件数−2024年の認知件数。'},
]
queries['fraud']['source']['metricDefinitions'] += [{'label': '被害額（億円）', 'definition': '公式Excelの被害額（円）を100,000,000で割った値。特殊詐欺とSNS型の対象範囲の違いは注記参照。'}]
queries['prefectures']['source']['metricDefinitions'] += [{'label': '人口10万人当たり', 'definition': CAVEATS[3]}]
snapshot = {
    'id': 'japan-crime-npa-2025', 'surface': 'dashboard', 'title': '日本の犯罪の推移',
    'generatedAt': '2026-09-20T00:00:00Z', 'buildStatus': 'creating', 'status': 'reviewed',
    'filters': [], 'queries': queries,
    'metadata': {'creator': 'このページは GPT 6 Astro で作成されました。', 'dataThrough': 2025, 'retrievedAt': RETRIEVED, 'sources': [INDEX, PDF, WHITEPAPER], 'caveats': CAVEATS, 'sexCaveat': SEX, 'fraudCaveat': FRAUD_NOTE},
}
(OUT / 'reviewed.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
for key, query in queries.items():
    columns = list(dict.fromkeys(k for r in query['rows'] for k in r))
    with (OUT / f'{key}.csv').open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        writer.writerows(query['rows'])

raw_urls = {'crime-2025.csv': NPA+'r07.csv', 'crime-2025-summary.xlsx': NPA+'r07_1.xlsx',
    'crime-2025-fraud.xlsx': NPA+'r07_2-3.xlsx', 'crime-situation-2025-final.pdf': PDF,
    'whitepaper-2025-2-1.csv': 'https://www.npa.go.jp/hakusyo/r07/honbun/csv/bb2z00010.csv',
    'whitepaper-definitions.html': 'https://www.npa.go.jp/hakusyo/r07/honbun/html/bbh000000.html'}
manifest = [{'file': str(p.relative_to(ROOT)), 'url': raw_urls[p.name], 'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'retrievedAt': RETRIEVED} for p in sorted(RAW.iterdir()) if p.is_file()]
(OUT / 'raw-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'checks': 'passed', 'whitepaperComparisons': 292, 'rows': {k: len(v['rows']) for k, v in queries.items()}, 'latest': national[2025]}, ensure_ascii=False, indent=2))

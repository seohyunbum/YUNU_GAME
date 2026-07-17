# 세계 유명 도시로 거점 확장 (18 → 42 육상, 3 → 5 해역).
#
# map_pos 는 **실제 위경도에서 계산**한다 — 눈대중으로 찍으면 도시가 바다에 떨어진다.
#   x = (경도+180)/360*1000 ,  y = (90-위도)/180*500      (등장방형, NASA 지도와 1:1)
#   검증: 한성(37.5665N,126.978E) → (852.7,145.6) ≈ 기존 데이터 (853,146) ✓
import json, io, collections

MAP = 'data/map/world_map.json'
RULES = 'data/config/game_rules.json'

def pos(lat, lon):
    return {"x": round((lon + 180) / 360 * 1000), "y": round((90 - lat) / 180 * 500)}

# (id, 한글, region, lat, lon, terrain, climate, 인구, 금, 식량, 항구, 방어)
CITIES = [
    # ── 동아시아 ──
    ("shanghai",   "상하이",     "east_asia",   31.23,  121.47, "urban",  "temperate", 240000, 160,  90, True,  3),
    ("hong_kong",  "홍콩",       "east_asia",   22.32,  114.17, "urban",  "tropical",  190000, 175,  55, True,  3),
    ("taipei",     "타이베이",   "east_asia",   25.03,  121.56, "urban",  "tropical",  140000, 120,  70, True,  2),
    # ── 남아시아 (신규 region) ──
    ("delhi",      "델리",       "south_asia",  28.61,   77.21, "plains", "temperate", 260000, 130, 140, False, 3),
    ("mumbai",     "뭄바이",     "south_asia",  19.08,   72.88, "urban",  "tropical",  230000, 150,  85, True,  3),
    # ── 동남아시아 (신규 region) ──
    ("bangkok",    "방콕",       "southeast_asia", 13.76, 100.50, "plains", "tropical", 170000, 110, 130, True,  2),
    ("singapore",  "싱가포르",   "southeast_asia",  1.35, 103.82, "urban",  "tropical", 120000, 190,  40, True,  3),
    ("jakarta",    "자카르타",   "southeast_asia", -6.21, 106.85, "plains", "tropical", 200000, 105, 120, True,  2),
    # ── 유럽 ──
    ("berlin",     "베를린",     "europe",      52.52,   13.40, "urban",  "temperate", 190000, 150,  90, False, 3),
    ("madrid",     "마드리드",   "europe",      40.42,   -3.70, "plains", "temperate", 160000, 120,  95, False, 3),
    ("moscow",     "모스크바",   "europe",      55.76,   37.62, "plains", "snow",      230000, 130, 100, False, 4),
    ("vienna",     "빈",         "europe",      48.21,   16.37, "urban",  "temperate", 130000, 135,  75, False, 3),
    ("athens",     "아테네",     "europe",      37.98,   23.73, "urban",  "temperate", 110000, 115,  60, True,  3),
    # ── 중동 ──
    ("tehran",     "테헤란",     "middle_east", 35.69,   51.39, "mountain", "desert",  150000, 120,  60, False, 3),
    ("mecca",      "메카",       "middle_east", 21.42,   39.83, "desert", "desert",     90000, 140,  30, False, 3),
    ("jerusalem",  "예루살렘",   "middle_east", 31.77,   35.21, "urban",  "desert",    100000, 125,  50, False, 4),
    # ── 아프리카 ──
    ("lagos",      "라고스",     "africa",       6.52,    3.38, "plains", "tropical",  180000, 110, 110, True,  2),
    ("nairobi",    "나이로비",   "africa",      -1.29,   36.82, "plains", "tropical",  120000,  95,  95, False, 2),
    ("cape_town",  "케이프타운", "africa",     -33.92,   18.42, "mountain", "oceanic", 100000, 115,  60, True,  3),
    # ── 아메리카 ──
    ("chicago",    "시카고",     "america",     41.88,  -87.63, "plains", "temperate", 200000, 145, 120, False, 3),
    ("los_angeles","로스앤젤레스","america",    34.05, -118.24, "urban",  "desert",    240000, 165,  70, True,  3),
    ("mexico_city","멕시코시티", "america",     19.43,  -99.13, "mountain", "temperate",220000, 125, 100, False, 3),
    ("buenos_aires","부에노스아이레스","america",-34.60,-58.38, "plains", "temperate", 170000, 120, 130, True,  2),
    # ── 오세아니아 ──
    ("auckland",   "오클랜드",   "oceania",    -36.85,  174.76, "plains", "oceanic",    90000, 105,  85, True,  2),
]

# 해역 (current_direction 필수 — 8방위)
SEAS = [
    ("sea_indian",        "인도양", -10.0,  75.0, "sw"),
    ("sea_mediterranean", "지중해",  35.0,  18.0, "e"),
]

# 인접 관계 (양방향으로 자동 반영). 지리적으로 말이 되게 연결한다.
ADJ = {
    "shanghai":    ["nanjing", "beijing", "hong_kong", "sea_east_asia"],
    "hong_kong":   ["shanghai", "taipei", "bangkok", "sea_east_asia"],
    "taipei":      ["hong_kong", "sea_east_asia", "sea_pacific"],
    "delhi":       ["mumbai", "tehran", "chengdu"],
    "mumbai":      ["delhi", "mecca", "sea_indian"],
    "bangkok":     ["hong_kong", "singapore", "chengdu"],
    "singapore":   ["bangkok", "jakarta", "sea_indian"],
    "jakarta":     ["singapore", "sea_indian", "sea_pacific"],
    "berlin":      ["paris", "vienna", "moscow"],
    "madrid":      ["paris", "sea_atlantic", "sea_mediterranean"],
    "moscow":      ["berlin", "istanbul", "tehran"],
    "vienna":      ["berlin", "rome", "istanbul"],
    "athens":      ["rome", "istanbul", "sea_mediterranean"],
    "tehran":      ["baghdad", "moscow", "delhi"],
    "mecca":       ["baghdad", "jerusalem", "mumbai"],
    "jerusalem":   ["cairo", "baghdad", "mecca", "istanbul"],
    "lagos":       ["nairobi", "sea_atlantic"],
    "nairobi":     ["cairo", "lagos", "sea_indian"],
    "cape_town":   ["nairobi", "sea_atlantic", "sea_indian"],
    "chicago":     ["new_york", "los_angeles"],
    "los_angeles": ["chicago", "mexico_city", "sea_pacific"],
    "mexico_city": ["los_angeles", "new_york", "sea_atlantic"],
    "buenos_aires":["rio", "sea_atlantic"],
    "auckland":    ["sydney", "sea_pacific"],
    "sea_indian":       ["mumbai", "singapore", "jakarta", "nairobi", "cape_town", "sea_pacific"],
    "sea_mediterranean":["rome", "athens", "cairo", "istanbul", "madrid", "sea_atlantic"],
}

m = json.load(io.open(MAP, encoding='utf-8'))
byid = {n['id']: n for n in m['nodes']}
sea_ids = {n['id'] for n in m['nodes'] if n['type'] == 'sea'}

# 1) 노드 추가
for (cid, ko, region, lat, lon, terrain, climate, popn, gold, food, port, dfn) in CITIES:
    assert cid not in byid, f'중복 id {cid}'
    n = {
        "id": cid, "type": "land", "name_ko": ko, "region": region, "terrain": terrain,
        "population": popn, "base_production": {"gold": gold, "food": food},
        "facility_slots": 4, "defense_level": dfn, "port": port, "climate": climate,
        "adjacent": [], "map_pos": pos(lat, lon),
    }
    m['nodes'].append(n); byid[cid] = n

for (sid, ko, lat, lon, cur) in SEAS:
    assert sid not in byid, f'중복 id {sid}'
    n = {"id": sid, "type": "sea", "name_ko": ko, "region": "ocean",
         "current_direction": cur, "adjacent": [], "map_pos": pos(lat, lon)}
    m['nodes'].append(n); byid[sid] = n; sea_ids.add(sid)

# 2) 인접 반영 (양방향)
for a, targets in ADJ.items():
    for b in targets:
        assert b in byid, f'{a} → 없는 노드 {b}'
        for x, y in ((a, b), (b, a)):
            if y not in byid[x]['adjacent']:
                byid[x]['adjacent'].append(y)

# 3) 간선 재생성 — adjacent 로부터. type = land(육↔육) / port(육↔해) / sea(해↔해)
pairs = set()
for n in m['nodes']:
    for b in n['adjacent']:
        pairs.add(tuple(sorted((n['id'], b))))
edges = []
for a, b in sorted(pairs):
    sa, sb = a in sea_ids, b in sea_ids
    etype = "sea" if (sa and sb) else ("port" if (sa or sb) else "land")
    edges.append({"from": a, "to": b, "type": etype})
m['edges'] = edges

# 4) 검증 — map_pos 중복(렌더 겹침) · 고립 노드
seen = {}
for n in m['nodes']:
    k = (n['map_pos']['x'], n['map_pos']['y'])
    assert k not in seen, f"map_pos 중복: {n['id']} vs {seen[k]}"
    seen[k] = n['id']
    assert n['adjacent'], f"고립 노드: {n['id']}"

json.dump(m, io.open(MAP, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# 5) region 허용목록 확장
r = json.load(io.open(RULES, encoding='utf-8'))
for reg in ("south_asia", "southeast_asia"):
    if reg not in r['valid_regions']:
        r['valid_regions'].append(reg)
json.dump(r, io.open(RULES, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

land = [n for n in m['nodes'] if n['type'] != 'sea']
sea = [n for n in m['nodes'] if n['type'] == 'sea']
print(f"육상 {len(land)} (이전 18 → {len(land)/18:.1f}배) · 해역 {len(sea)} · 간선 {len(edges)}")
print("region:", dict(collections.Counter(n['region'] for n in land)))
print("valid_regions:", r['valid_regions'])

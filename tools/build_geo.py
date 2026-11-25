#!/usr/bin/env python3
"""Builds data/geo.json for the globe: coastlines, lakes, rivers and urban footprints.

Source: Natural Earth vector data (public domain, naturalearthdata.com), GeoJSON files from
github.com/nvkelso/natural-earth-vector/geojson:
  ne_50m_land, ne_50m_urban_areas, ne_50m_lakes, ne_10m_land, ne_10m_urban_areas, ne_10m_rivers_lake_centerlines,
  ne_10m_roads, ne_10m_railroads, ne_10m_populated_places_simple

  python3 tools/build_geo.py <folder with those .geojson files>

Three levels of detail: the whole world (for the globe texture), a region around each city and the
metro area of each city. Shapes are clipped to their box, simplified and rounded, so the file stays small.
City coordinates come from data/cities.json (lat, lon).
"""
import json, math, sys, os

SRC = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
cities = json.load(open(os.path.join(HERE, '..', 'data', 'cities.json'), encoding='utf-8'))

def load(name):
    return json.load(open(os.path.join(SRC, name + '.geojson'), encoding='utf-8'))['features']

def polys(features):
    """every polygon as a list of rings (outer first)"""
    for f in features:
        g = f['geometry']
        if not g: continue
        if g['type'] == 'Polygon': yield g['coordinates']
        elif g['type'] == 'MultiPolygon':
            for p in g['coordinates']: yield p

def lines(features):
    for f in features:
        g = f['geometry']
        if not g: continue
        if g['type'] == 'LineString': yield g['coordinates'], f['properties']
        elif g['type'] == 'MultiLineString':
            for l in g['coordinates']: yield l, f['properties']

def clip_ring(ring, box):
    """Sutherland-Hodgman: the part of a ring inside box (w, s, e, n)"""
    w, s, e, n = box
    def clip(pts, inside, cross):
        out = []
        for i in range(len(pts)):
            a, b = pts[i - 1], pts[i]
            ia, ib = inside(a), inside(b)
            if ia and ib: out.append(b)
            elif ia and not ib: out.append(cross(a, b))
            elif not ia and ib: out.append(cross(a, b)); out.append(b)
        return out
    def xcross(x):
        return lambda a, b: [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])]
    def ycross(y):
        return lambda a, b: [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y]
    pts = [p[:2] for p in ring]
    if pts and pts[0] == pts[-1]: pts = pts[:-1]
    for inside, cross in ((lambda p: p[0] >= w, xcross(w)), (lambda p: p[0] <= e, xcross(e)), (lambda p: p[1] >= s, ycross(s)), (lambda p: p[1] <= n, ycross(n))):
        if not pts: break
        pts = clip(pts, inside, cross)
    return pts

def clip_line(line, box):
    """pieces of a polyline inside the box (points outside simply end a piece)"""
    w, s, e, n = box
    out, cur = [], []
    for p in line:
        if w <= p[0] <= e and s <= p[1] <= n: cur.append(p[:2])
        else:
            if len(cur) > 1: out.append(cur)
            cur = []
    if len(cur) > 1: out.append(cur)
    return out

def simplify(pts, tol, closed=True):
    """Douglas-Peucker"""
    if len(pts) < 5: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b - a < 2: continue
        ax, ay = pts[a]; bx, by = pts[b]; dx, dy = bx - ax, by - ay; d2 = dx * dx + dy * dy
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if d2 == 0: d = math.hypot(px - ax, py - ay)
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / d2))
                d = math.hypot(px - ax - t * dx, py - ay - t * dy)
            if d > best: best, bi = d, i
        if best > tol: keep[bi] = True; stack.append((a, bi)); stack.append((bi, b))
    return [p for p, k in zip(pts, keep) if k]

def area(pts):
    return abs(sum(pts[i - 1][0] * pts[i][1] - pts[i][0] * pts[i - 1][1] for i in range(len(pts)))) / 2

def flat(pts, nd):
    """integers in units of 10^-nd degrees: the first point, then steps from one point to the next"""
    k = 10 ** nd; out = []; px = py = 0
    for x, y in pts:
        ix, iy = round(x * k), round(y * k)
        if out and ix == px and iy == py: continue
        out += [ix - px, iy - py]; px, py = ix, iy
    return out

def shapes(features, box, tol, nd, min_area):
    """clipped, simplified rings of every polygon that touches the box"""
    out = []
    for rings in polys(features):
        xs = [p[0] for p in rings[0]]; ys = [p[1] for p in rings[0]]
        if box and (max(xs) < box[0] or min(xs) > box[2] or max(ys) < box[1] or min(ys) > box[3]): continue
        for ring in rings:
            pts = clip_ring(ring, box) if box else [p[:2] for p in ring]
            if len(pts) < 3 or area(pts) < min_area: continue
            pts = simplify(pts + [pts[0]], tol)[:-1]
            if len(pts) >= 3: out.append(flat(pts, nd))
    return out

land50, land10 = load('ne_50m_land'), load('ne_10m_land')
urban50, urban10 = load('ne_50m_urban_areas'), load('ne_10m_urban_areas')
lakes50 = load('ne_50m_lakes')
rivers10 = load('ne_10m_rivers_lake_centerlines')
roads10, rail10, places10 = load('ne_10m_roads'), load('ne_10m_railroads'), load('ne_10m_populated_places_simple')
# neighbouring towns named on the close-up (chosen by hand; coordinates from Natural Earth)
NEAR = {'seoul': ['Incheon', 'Suwon', 'Goyang'], 'berlin': ['Potsdam'], 'sf': ['Oakland', 'San Jose', 'Berkeley'], 'tokyo': ['Yokohama', 'Kawasaki']}

def tracks(features, box, tol, nd, keep=lambda props: True):
    return [flat(simplify(piece, tol), nd) for line, props in lines(features) if keep(props) for piece in clip_line(line, box)]

geo = {'source': 'Natural Earth (public domain), naturalearthdata.com. Built by tools/build_geo.py.',
       'encoding': 'Each shape is a list of integers: lon, lat of the first point, then lon, lat steps to each next point, in units of 10^-nd degrees (nd is given per level).',
       'world': {'nd': 2, 'land': shapes(land50, None, 0.07, 2, 0.05), 'lakes': shapes(lakes50, None, 0.07, 2, 0.5)}, 'cities': {}}
# city lights for the whole globe: the centre and size of each urban area
lights = []
for rings in polys(urban50):
    r = rings[0]; a = area(r)
    if a < 0.004: continue
    lights.append([round(sum(p[0] for p in r) / len(r), 2), round(sum(p[1] for p in r) / len(r), 2), round(math.sqrt(a), 3)])
lights.sort(key=lambda l: -l[2]); geo['world']['lights'] = lights[:2600]

for cid, c in cities.items():
    lat, lon = c['lat'], c['lon']
    out = {}
    for level, dx, dy, tol, nd, amin, umin in (('region', 12, 8, 0.012, 3, 0.0006, 0.004), ('metro', 2.4, 1.5, 0.0014, 4, 0.000004, 0.00002)):
        box = (lon - dx, lat - dy, lon + dx, lat + dy)
        out[level] = {
            'nd': nd,
            'box': [round(v, 4) for v in box],
            'land': shapes(land10, box, tol, nd, amin),
            'lakes': shapes(lakes50, box, tol, nd, amin),
            'urban': shapes(urban10, box, tol * 1.2, nd, umin),
            'rivers': tracks(rivers10, box, tol, nd, lambda p: level == 'metro' or (p.get('scalerank') or 9) <= 5),
            # motorways; on the close-up also the smaller roads and the railways
            'roads': tracks(roads10, box, tol, nd, lambda p: p.get('type') == 'Major Highway' and (level == 'metro' or (p.get('scalerank') or 9) <= 4)),
        }
        if level == 'metro':
            out[level]['roads2'] = tracks(roads10, box, tol, nd, lambda p: p.get('type') != 'Major Highway')
            out[level]['rail'] = tracks(rail10, box, tol * 2, nd)
            out[level]['places'] = [[f['properties']['name'], round(f['geometry']['coordinates'][0], 3), round(f['geometry']['coordinates'][1], 3)]
                                    for name in NEAR[cid] for f in places10 if f['properties']['name'] == name and abs(f['geometry']['coordinates'][0] - lon) < dx and abs(f['geometry']['coordinates'][1] - lat) < dy]
    geo['cities'][cid] = out

path = os.path.join(HERE, '..', 'data', 'geo.json')
json.dump(geo, open(path, 'w', encoding='utf-8'), separators=(',', ':'))
n = lambda xs: sum(len(x) for x in xs) // 2
print('world land', len(geo['world']['land']), 'rings', n(geo['world']['land']), 'pts; lights', len(lights[:2600]))
for cid, c in geo['cities'].items():
    print(cid, {lv: {k: (len(v), n(v)) for k, v in c[lv].items() if k not in ('box', 'nd', 'places')} for lv in c}, c['metro']['places'])
print('bytes', os.path.getsize(path))

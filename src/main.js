import * as d3 from 'd3';
import { defaultAspectRatio, runif, voronoi } from './helpers';
import Map from './Map';
import Mesh from './Mesh';
const PriorityQueue = require('js-priority-queue');

const rnorm = ((() => {
    let z2 = null;
    function rnorm() {
        if (z2 != null) {
            const tmp = z2;
            z2 = null;
            return tmp;
        }
        let x1 = 0;
        let x2 = 0;
        let w = 2.0;
        while (w >= 1) {
            x1 = runif(-1, 1);
            x2 = runif(-1, 1);
            w = x1 * x1 + x2 * x2;
        }
        w = Math.sqrt(-2 * Math.log(w) / w);
        z2 = x2 * w;
        return x1 * w;
    }
    return rnorm;
}))();

export function generatePoints(n, aspectRatio=defaultAspectRatio) {
    const pts = [];
    const w = aspectRatio.width/2;
    const h = aspectRatio.height/2;
    for (let i = 0; i < n; i++) {
        pts.push([runif(-w, w), runif(-h, h)]);
    }
    return pts;
}

function centroid(pts) {
    let x = 0;
    let y = 0;
    for (let i = 0; i < pts.length; i++) {
        x += pts[i][0];
        y += pts[i][1];
    }
    return [x/pts.length, y/pts.length];
}

export function improvePoints(pts, n=1, aspectRatio=defaultAspectRatio) {
    for (let i = 0; i < n; i++) {
        pts = voronoi(pts, aspectRatio)
            .polygons(pts)
            .map(centroid);
    }
    return pts;
}

export function generateGoodPoints(n, aspectRatio=defaultAspectRatio) {
    let pts = generatePoints(n, aspectRatio);
    pts = pts.sort((a, b) => a[0] - b[0]);
    return improvePoints(pts, 1, aspectRatio);
}

function generateGoodMesh(n, aspectRatio=defaultAspectRatio) {
    const pts = generateGoodPoints(n, aspectRatio);
    const w = aspectRatio.width / 2;
    const h = aspectRatio.height / 2;

    const viewArea = {
        left: -w,
        right: w,
        top: h,
        bottom: -h
    }

    return new Mesh(pts, viewArea);
}
function isedge(mesh, i) {
    return (mesh.adjacencyIndex[i].length < 3);
}

function isnearedge(mesh, i) {
    const x = mesh.vertices[i][0];
    const y = mesh.vertices[i][1];
    const w = mesh.aspectRatio.width;
    const h = mesh.aspectRatio.height;
    return x < -0.45 * w || x > 0.45 * w || y < -0.45 * h || y > 0.45 * h;
}

function neighbours(mesh, i) {
    const onbs = mesh.adjacencyIndex[i];
    const nbs = [];
    for (var i = 0; i < onbs.length; i++) {
        nbs.push(onbs[i]);
    }
    return nbs;
}

function distance(mesh, i, j) {
    const p = mesh.vertices[i];
    const q = mesh.vertices[j];
    return Math.sqrt((p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]));
}

function quantile(h, q) {
    const sortedh = [];
    for (let i = 0; i < h.length; i++) {
        sortedh[i] = h[i];
    }
    sortedh.sort(d3.ascending);
    return d3.quantile(sortedh, q);
}

function zero(mesh) {
    const z = [];
    for (let i = 0; i < mesh.vertices.length; i++) {
        z[i] = 0;
    }
    z.mesh = mesh;
    return z;
}

function slope(mesh, direction) {
    return mesh.map(x => x[0] * direction[0] + x[1] * direction[1]);
}

function cone(mesh, slope) {
    return mesh.map(x => (x[0] * x[0] + x[1] * x[1]) ** 0.5 * slope);
}

function map(h, f) {
    const newh = h.map(f);
    newh.mesh = h.mesh;
    return newh;
}

function normalize(h) {
    const lo = d3.min(h);
    const hi = d3.max(h);
    return map(h, x => (x - lo) / (hi - lo));
}

function peaky(h) {
    return map(normalize(h), Math.sqrt);
}

function add() {
    const n = arguments[0].length;
    const newvals = zero(arguments[0].mesh);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < arguments.length; j++) {
            newvals[i] += arguments[j][i];
        }
    }
    return newvals;
}

function mountains(mesh, n, r=0.05) {
    const mounts = [];
    for (var i = 0; i < n; i++) {
        mounts.push([mesh.aspectRatio.width * (Math.random() - 0.5), mesh.aspectRatio.height * (Math.random() - 0.5)]);
    }
    const newvals = zero(mesh);
    for (var i = 0; i < mesh.vertices.length; i++) {
        const p = mesh.vertices[i];
        for (let j = 0; j < n; j++) {
            const m = mounts[j];
            newvals[i] += Math.exp(-((p[0] - m[0]) * (p[0] - m[0]) + (p[1] - m[1]) * (p[1] - m[1])) / (2 * r * r)) ** 2;
        }
    }
    return newvals;
}

function relax(h) {
    const newh = zero(h.mesh);
    for (let i = 0; i < h.length; i++) {
        const nbs = neighbours(h.mesh, i);
        if (nbs.length < 3) {
            newh[i] = 0;
            continue;
        }
        newh[i] = d3.mean(nbs.map(j => h[j]));
    }
    return newh;
}

function downhill(h) {
    if (h.downhill) return h.downhill;
    function downfrom(i) {
        if (isedge(h.mesh, i)) return -2;
        let best = -1;
        let besth = h[i];
        const nbs = neighbours(h.mesh, i);
        for (let j = 0; j < nbs.length; j++) {
            if (h[nbs[j]] < besth) {
                besth = h[nbs[j]];
                best = nbs[j];
            }
        }
        return best;
    }
    const downs = [];
    for (let i = 0; i < h.length; i++) {
        downs[i] = downfrom(i);
    }
    h.downhill = downs;
    return downs;
}

function findSinks(h) {
    const dh = downhill(h);
    const sinks = [];
    for (let i = 0; i < dh.length; i++) {
        let node = i;
        while (true) {
            if (isedge(h.mesh, node)) {
                sinks[i] = -2;
                break;
            }
            if (dh[node] == -1) {
                sinks[i] = node;
                break;
            }
            node = dh[node];
        }
    }
}

function fillSinks(h, epsilon=1e-5) {
    const infinity = 999999;
    const newh = zero(h.mesh);
    for (var i = 0; i < h.length; i++) {
        if (isnearedge(h.mesh, i)) {
            newh[i] = h[i];
        } else {
            newh[i] = infinity;
        }
    }
    while (true) {
        let changed = false;
        for (var i = 0; i < h.length; i++) {
            if (newh[i] == h[i]) continue;
            const nbs = neighbours(h.mesh, i);
            for (let j = 0; j < nbs.length; j++) {
                if (h[i] >= newh[nbs[j]] + epsilon) {
                    newh[i] = h[i];
                    changed = true;
                    break;
                }
                const oh = newh[nbs[j]] + epsilon;
                if ((newh[i] > oh) && (oh > h[i])) {
                    newh[i] = oh;
                    changed = true;
                }
            }
        }
        if (!changed) return newh;
    }
}

function getFlux(h) {
    const dh = downhill(h);
    const idxs = [];
    const flux = zero(h.mesh);
    for (var i = 0; i < h.length; i++) {
        idxs[i] = i;
        flux[i] = 1/h.length;
    }
    idxs.sort((a, b) => h[b] - h[a]);
    for (var i = 0; i < h.length; i++) {
        const j = idxs[i];
        if (dh[j] >= 0) {
            flux[dh[j]] += flux[j];
        }
    }
    return flux;
}

function getSlope(h) {
    const dh = downhill(h);
    const slope = zero(h.mesh);
    for (let i = 0; i < h.length; i++) {
        const s = trislope(h, i);
        slope[i] = Math.sqrt(s[0] * s[0] + s[1] * s[1]);
        continue;
        if (dh[i] < 0) {
            slope[i] = 0;
        } else {
            slope[i] = (h[i] - h[dh[i]]) / distance(h.mesh, i, dh[i]);
        }
    }
    return slope;
}

function erosionRate(h) {
    const flux = getFlux(h);
    const slope = getSlope(h);
    const newh = zero(h.mesh);
    for (let i = 0; i < h.length; i++) {
        const river = Math.sqrt(flux[i]) * slope[i];
        const creep = slope[i] * slope[i];
        let total = 1000 * river + creep;
        total = total > 200 ? 200 : total;
        newh[i] = total;
    }
    return newh;
}

function erode(h, amount) {
    const er = erosionRate(h);
    const newh = zero(h.mesh);
    const maxr = d3.max(er);
    for (let i = 0; i < h.length; i++) {
        newh[i] = h[i] - amount * (er[i] / maxr);
    }
    return newh;
}

function doErosion(h, amount, n=1) {
    h = fillSinks(h);
    for (let i = 0; i < n; i++) {
        h = erode(h, amount);
        h = fillSinks(h);
    }
    return h;
}

function setSeaLevel(h, q) {
    const newh = zero(h.mesh);
    const delta = quantile(h, q);
    for (let i = 0; i < h.length; i++) {
        newh[i] = h[i] - delta;
    }
    return newh;
}

function cleanCoast(h, iters) {
    for (let iter = 0; iter < iters; iter++) {
        let changed = 0;
        let newh = zero(h.mesh);
        for (var i = 0; i < h.length; i++) {
            newh[i] = h[i];
            var nbs = neighbours(h.mesh, i);
            if (h[i] <= 0 || nbs.length != 3) continue;
            var count = 0;
            var best = -999999;
            for (var j = 0; j < nbs.length; j++) {
                if (h[nbs[j]] > 0) {
                    count++;
                } else if (h[nbs[j]] > best) {
                    best = h[nbs[j]];
                }
            }
            if (count > 1) continue;
            newh[i] = best / 2;
            changed++;
        }
        h = newh;
        newh = zero(h.mesh);
        for (var i = 0; i < h.length; i++) {
            newh[i] = h[i];
            var nbs = neighbours(h.mesh, i);
            if (h[i] > 0 || nbs.length != 3) continue;
            var count = 0;
            var best = 999999;
            for (var j = 0; j < nbs.length; j++) {
                if (h[nbs[j]] <= 0) {
                    count++;
                } else if (h[nbs[j]] < best) {
                    best = h[nbs[j]];
                }
            }
            if (count > 1) continue;
            newh[i] = best / 2;
            changed++;
        }
        h = newh;
    }
    return h;
}

function trislope(h, i) {
    const nbs = neighbours(h.mesh, i);
    if (nbs.length != 3) return [0,0];
    const p0 = h.mesh.vertices[nbs[0]];
    const p1 = h.mesh.vertices[nbs[1]];
    const p2 = h.mesh.vertices[nbs[2]];

    const x1 = p1[0] - p0[0];
    const x2 = p2[0] - p0[0];
    const y1 = p1[1] - p0[1];
    const y2 = p2[1] - p0[1];

    const det = x1 * y2 - x2 * y1;
    const h1 = h[nbs[1]] - h[nbs[0]];
    const h2 = h[nbs[2]] - h[nbs[0]];

    return [(y2 * h1 - y1 * h2) / det,
            (-x2 * h1 + x1 * h2) / det];
}

function cityScore(h, cities) {
    const score = map(getFlux(h), Math.sqrt);
    for (let i = 0; i < h.length; i++) {
        if (h[i] <= 0 || isnearedge(h.mesh, i)) {
            score[i] = -999999;
            continue;
        }
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vertices[i][0]) - h.mesh.aspectRatio.width/2)
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vertices[i][1]) - h.mesh.aspectRatio.height/2)
        for (let j = 0; j < cities.length; j++) {
            score[i] -= 0.02 / (distance(h.mesh, cities[j], i) + 1e-9);
        }
    }
    return score;
}
function placeCity(render) {
    render.cities = render.cities || [];
    const score = cityScore(render.h, render.cities);
    const newcity = d3.scan(score, d3.descending);
    render.cities.push(newcity);
}

function placeCities(render) {
    const params = render.params;
    const h = render.h;
    const n = params.ncities;
    for (let i = 0; i < n; i++) {
        placeCity(render);
    }
}

function contour(h, level=0) {
    const edges = [];

    for (const e of h.mesh.edges) {
        if (e[3] == undefined) continue;
        if (isnearedge(h.mesh, e[0]) || isnearedge(h.mesh, e[1])) continue;
        if ((h[e[0]] > level && h[e[1]] <= level) ||
            (h[e[1]] > level && h[e[0]] <= level)) {
            edges.push([e[2], e[3]]);
        }
    }

    return mergeSegments(edges);
}

function getRivers(h, limit) {
    const dh = downhill(h);
    const flux = getFlux(h);
    const links = [];
    let above = 0;
    for (var i = 0; i < h.length; i++) {
        if (h[i] > 0) above++;
    }
    limit *= above / h.length;
    for (var i = 0; i < dh.length; i++) {
        if (isnearedge(h.mesh, i)) continue;
        if (flux[i] > limit && h[i] > 0 && dh[i] >= 0) {
            const up = h.mesh.vertices[i];
            const down = h.mesh.vertices[dh[i]];
            if (h[dh[i]] > 0) {
                links.push([up, down]);
            } else {
                links.push([up, [(up[0] + down[0])/2, (up[1] + down[1])/2]]);
            }
        }
    }
    return mergeSegments(links).map(relaxPath);
}

function getTerritories(render) {
    const h = render.h;
    const cities = render.cities;
    let n = render.params.nterrs;
    if (n > render.cities.length) n = render.cities.length;
    const flux = getFlux(h);
    const terr = [];
    const queue = new PriorityQueue({comparator(a, b) {return a.score - b.score}});
    function weight(u, v) {
        const horiz = distance(h.mesh, u, v);
        let vert = h[v] - h[u];
        if (vert > 0) vert /= 10;
        let diff = 1 + 0.25 * (vert/horiz ** 2);
        diff += 100 * Math.sqrt(flux[u]);
        if (h[u] <= 0) diff = 100;
        if ((h[u] > 0) != (h[v] > 0)) return 1000;
        return horiz * diff;
    }
    for (var i = 0; i < n; i++) {
        terr[cities[i]] = cities[i];
        var nbs = neighbours(h.mesh, cities[i]);
        for (let j = 0; j < nbs.length; j++) {
            queue.queue({
                score: weight(cities[i], nbs[j]),
                city: cities[i],
                vx: nbs[j]
            });
        }
    }
    while (queue.length) {
        const u = queue.dequeue();
        if (terr[u.vx] != undefined) continue;
        terr[u.vx] = u.city;
        var nbs = neighbours(h.mesh, u.vx);
        for (var i = 0; i < nbs.length; i++) {
            const v = nbs[i];
            if (terr[v] != undefined) continue;
            const newdist = weight(u.vx, v);
            queue.queue({
                score: u.score + newdist,
                city: u.city,
                vx: v
            });
        }
    }
    terr.mesh = h.mesh;
    return terr;
}

function getBorders(render) {
    const terr = render.terr;
    const h = render.h;
    const edges = [];

    for (const e of terr.mesh.edges) {
        if (e[3] == undefined) continue;
        if (isnearedge(terr.mesh, e[0]) || isnearedge(terr.mesh, e[1])) continue;
        if (h[e[0]] < 0 || h[e[1]] < 0) continue;
        if (terr[e[0]] != terr[e[1]]) {
            edges.push([e[2], e[3]]);
        }
    }

    return mergeSegments(edges).map(relaxPath);
}

function mergeSegments(segs) {
    const adj = {};
    for (var i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const a0 = adj[seg[0]] || [];
        const a1 = adj[seg[1]] || [];
        a0.push(seg[1]);
        a1.push(seg[0]);
        adj[seg[0]] = a0;
        adj[seg[1]] = a1;
    }
    const done = [];
    const paths = [];
    let path = null;
    while (true) {
        if (path == null) {
            for (var i = 0; i < segs.length; i++) {
                if (done[i]) continue;
                done[i] = true;
                path = [segs[i][0], segs[i][1]];
                break;
            }
            if (path == null) break;
        }
        let changed = false;
        for (var i = 0; i < segs.length; i++) {
            if (done[i]) continue;
            if (adj[path[0]].length == 2 && segs[i][0] == path[0]) {
                path.unshift(segs[i][1]);
            } else if (adj[path[0]].length == 2 && segs[i][1] == path[0]) {
                path.unshift(segs[i][0]);
            } else if (adj[path[path.length - 1]].length == 2 && segs[i][0] == path[path.length - 1]) {
                path.push(segs[i][1]);
            } else if (adj[path[path.length - 1]].length == 2 && segs[i][1] == path[path.length - 1]) {
                path.push(segs[i][0]);
            } else {
                continue;
            }
            done[i] = true;
            changed = true;
            break;
        }
        if (!changed) {
            paths.push(path);
            path = null;
        }
    }
    return paths;
}

function relaxPath(path) {
    const newpath = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        const newpt = [0.25 * path[i-1][0] + 0.5 * path[i][0] + 0.25 * path[i+1][0],
                     0.25 * path[i-1][1] + 0.5 * path[i][1] + 0.25 * path[i+1][1]];
        newpath.push(newpt);
    }
    newpath.push(path[path.length - 1]);
    return newpath;
}

export function visualizePoints(svg, pts) {
    const circle = svg.selectAll('circle').data(pts);
    circle.enter()
        .append('circle');
    circle.exit().remove();
    d3.selectAll('circle')
        .attr('cx', d => 1000*d[0])
        .attr('cy', d => 1000*d[1])
        .attr('r', 100 / Math.sqrt(pts.length));
}

function makeD3Path(path) {
    const p = d3.path();
    p.moveTo(1000*path[0][0], 1000*path[0][1]);
    for (let i = 1; i < path.length; i++) {
        p.lineTo(1000*path[i][0], 1000*path[i][1]);
    }
    return p.toString();
}

export function visualizeVoronoi(svg, field, lo, hi) {
    if (hi == undefined) hi = d3.max(field) + 1e-9;
    if (lo == undefined) lo = d3.min(field) - 1e-9;
    const mappedvals = field.map(x => x > hi ? 1 : x < lo ? 0 : (x - lo) / (hi - lo));

    drawPaths(svg, 'field', field.mesh.triangles);
    svg.selectAll('path.field')
        .style('fill', (d, i) => d3.interpolateViridis(mappedvals[i]));
}

function visualizeDownhill(h) {
    const links = getRivers(h, 0.01);
    drawPaths('river', links);
}

export function drawPaths(svg, cls, paths) {
    var paths = svg.selectAll(`path.${cls}`).data(paths)
    paths.enter()
            .append('path')
            .classed(cls, true)
    paths.exit()
            .remove();
    svg.selectAll(`path.${cls}`)
        .attr('d', makeD3Path);
}

function visualizeSlopes(svg, render) {
    const h = render.h;
    const strokes = [];
    const r = 0.25 / Math.sqrt(h.length);
    for (let i = 0; i < h.length; i++) {
        if (h[i] <= 0 || isnearedge(h.mesh, i)) continue;
        const nbs = neighbours(h.mesh, i);
        nbs.push(i);
        let s = 0;
        let s2 = 0;
        for (var j = 0; j < nbs.length; j++) {
            const slopes = trislope(h, nbs[j]);
            s += slopes[0] / 10;
            s2 += slopes[1];
        }
        s /= nbs.length;
        s2 /= nbs.length;
        if (Math.abs(s) < runif(0.1, 0.4)) continue;
        let l = r * runif(1, 2) * (1 - 0.2 * (Math.atan(s) ** 2)) * Math.exp(s2/100);
        const x = h.mesh.vertices[i][0];
        const y = h.mesh.vertices[i][1];
        if (Math.abs(l*s) > 2 * r) {
            let n = Math.floor(Math.abs(l*s/r));
            l /= n;
            if (n > 4) n = 4;
            for (var j = 0; j < n; j++) {
                const u = rnorm() * r;
                const v = rnorm() * r;
                strokes.push([[x+u-l, y+v+l*s], [x+u+l, y+v-l*s]]);
            }
        } else {
            strokes.push([[x-l, y+l*s], [x+l, y-l*s]]);
        }
    }
    const lines = svg.selectAll('line.slope').data(strokes);
    lines.enter()
            .append('line')
            .classed('slope', true);
    lines.exit()
            .remove();
    svg.selectAll('line.slope')
        .attr('x1', d => 1000*d[0][0])
        .attr('y1', d => 1000*d[0][1])
        .attr('x2', d => 1000*d[1][0])
        .attr('y2', d => 1000*d[1][1])
}


function visualizeContour(h, level=0) {
    const links = contour(h, level);
    drawPaths('coast', links);
}

function visualizeBorders(h, cities, n) {
    const links = getBorders(h, getTerritories(h, cities, n));
    drawPaths('border', links);
}


function visualizeCities(svg, render) {
    const cities = render.cities;
    const h = render.h;
    const n = render.params.nterrs;

    const circs = svg.selectAll('circle.city').data(cities);
    circs.enter()
            .append('circle')
            .classed('city', true);
    circs.exit()
            .remove();
    svg.selectAll('circle.city')
        .attr('cx', d => 1000*h.mesh.vertices[d][0])
        .attr('cy', d => 1000*h.mesh.vertices[d][1])
        .attr('r', (d, i) => i >= n ? 4 : 10)
        .style('fill', 'white')
        .style('stroke-width', 5)
        .style('stroke-linecap', 'round')
        .style('stroke', 'black')
        .raise();
}

function dropEdge(h, p=4) {
    const newh = zero(h.mesh);
    for (let i = 0; i < h.length; i++) {
        const v = h.mesh.vertices[i];
        const x = 2.4*v[0] / h.mesh.aspectRatio.width;
        const y = 2.4*v[1] / h.mesh.aspectRatio.height;
        newh[i] = h[i] - Math.exp(10*((x ** p + y ** p) ** (1 / p) - 1));
    }
    return newh;
}

function randomVector(scale) {
    return [scale * rnorm(), scale * rnorm()];
}

function generateCoast(params) {
    const mesh = generateGoodMesh(params.npts, params.aspectRatio);
    let h = add(
            slope(mesh, randomVector(4)),
            cone(mesh, runif(-1, 1)),
            mountains(mesh, 50)
            );
    for (let i = 0; i < 10; i++) {
        h = relax(h);
    }
    h = peaky(h);
    h = doErosion(h, runif(0, 0.1), 5);
    h = setSeaLevel(h, runif(0.2, 0.6));
    h = fillSinks(h);
    h = cleanCoast(h, 3);
    return h;
}

function terrCenter(h, terr, city, landOnly) {
    let x = 0;
    let y = 0;
    let n = 0;
    for (let i = 0; i < terr.length; i++) {
        if (terr[i] != city) continue;
        if (landOnly && h[i] <= 0) continue;
        x += terr.mesh.vertices[i][0];
        y += terr.mesh.vertices[i][1];
        n++;
    }
    return [x/n, y/n];
}

function drawLabels(svg, render) {
    const params = render.params;
    const h = render.h;
    const terr = render.terr;
    const cities = render.cities;
    const nterrs = render.params.nterrs;
    const avoids = [render.rivers, render.coasts, render.borders];
    const lang = makeRandomLanguage();
    const citylabels = [];
    function penalty(label) {
        let pen = 0;
        if (label.x0 < -0.45 * h.mesh.aspectRatio.width) pen += 100;
        if (label.x1 > 0.45 * h.mesh.aspectRatio.width) pen += 100;
        if (label.y0 < -0.45 * h.mesh.aspectRatio.height) pen += 100;
        if (label.y1 > 0.45 * h.mesh.aspectRatio.height) pen += 100;
        for (var i = 0; i < citylabels.length; i++) {
            const olabel = citylabels[i];
            if (label.x0 < olabel.x1 && label.x1 > olabel.x0 &&
                label.y0 < olabel.y1 && label.y1 > olabel.y0) {
                pen += 100;
            }
        }

        for (var i = 0; i < cities.length; i++) {
            const c = h.mesh.vertices[cities[i]];
            if (label.x0 < c[0] && label.x1 > c[0] && label.y0 < c[1] && label.y1 > c[1]) {
                pen += 100;
            }
        }
        for (var i = 0; i < avoids.length; i++) {
            const avoid = avoids[i];

            for (const avpath of avoid) {
                for (const pt of avpath) {
                    if (pt[0] > label.x0 && pt[0] < label.x1 && pt[1] > label.y0 && pt[1] < label.y1) {
                        pen++;
                    }
                }
            }
        }
        return pen;
    }
    for (var i = 0; i < cities.length; i++) {
        const x = h.mesh.vertices[cities[i]][0];
        const y = h.mesh.vertices[cities[i]][1];
        var text = makeName(lang, 'city');
        const size = i < nterrs ? params.fontsizes.city : params.fontsizes.town;
        var sx = 0.65 * size/1000 * text.length;
        var sy = size/1000;
        const posslabels = [
        {
            x: x + 0.8 * sy,
            y: y + 0.3 * sy,
            align: 'start',
            x0: x + 0.7 * sy,
            y0: y - 0.6 * sy,
            x1: x + 0.7 * sy + sx,
            y1: y + 0.6 * sy
        },
        {
            x: x - 0.8 * sy,
            y: y + 0.3 * sy,
            align: 'end',
            x0: x - 0.9 * sy - sx,
            y0: y - 0.7 * sy,
            x1: x - 0.9 * sy,
            y1: y + 0.7 * sy
        },
        {
            x,
            y: y - 0.8 * sy,
            align: 'middle',
            x0: x - sx/2,
            y0: y - 1.9*sy,
            x1: x + sx/2,
            y1: y - 0.7 * sy
        },
        {
            x,
            y: y + 1.2 * sy,
            align: 'middle',
            x0: x - sx/2,
            y0: y + 0.1*sy,
            x1: x + sx/2,
            y1: y + 1.3*sy
        }
        ];
        var label = posslabels[d3.scan(posslabels, (a, b) => penalty(a) - penalty(b))];
        label.text = text;
        label.size = size;
        citylabels.push(label);
    }
    let texts = svg.selectAll('text.city').data(citylabels);
    texts.enter()
        .append('text')
        .classed('city', true);
    texts.exit()
        .remove();
    svg.selectAll('text.city')
        .attr('x', d => 1000*d.x)
        .attr('y', d => 1000*d.y)
        .style('font-size', d => d.size)
        .style('text-anchor', d => d.align)
        .text(d => d.text)
        .raise();

    const reglabels = [];
    for (var i = 0; i < nterrs; i++) {
        const city = cities[i];
        var text = makeName(lang, 'region');
        var sy = params.fontsizes.region / 1000;
        var sx = 0.6 * text.length * sy;
        const lc = terrCenter(h, terr, city, true);
        const oc = terrCenter(h, terr, city, false);
        let best = 0;
        let bestscore = -999999;
        for (let j = 0; j < h.length; j++) {
            let score = 0;
            const v = h.mesh.vertices[j];
            score -= 3000 * Math.sqrt((v[0] - lc[0]) * (v[0] - lc[0]) + (v[1] - lc[1]) * (v[1] - lc[1]));
            score -= 1000 * Math.sqrt((v[0] - oc[0]) * (v[0] - oc[0]) + (v[1] - oc[1]) * (v[1] - oc[1]));
            if (terr[j] != city) score -= 3000;
            for (var k = 0; k < cities.length; k++) {
                const u = h.mesh.vertices[cities[k]];
                if (Math.abs(v[0] - u[0]) < sx &&
                    Math.abs(v[1] - sy/2 - u[1]) < sy) {
                    score -= k < nterrs ? 4000 : 500;
                }
                if (v[0] - sx/2 < citylabels[k].x1 &&
                    v[0] + sx/2 > citylabels[k].x0 &&
                    v[1] - sy < citylabels[k].y1 &&
                    v[1] > citylabels[k].y0) {
                    score -= 5000;
                }
            }
            for (var k = 0; k < reglabels.length; k++) {
                var label = reglabels[k];
                if (v[0] - sx/2 < label.x + label.width/2 &&
                    v[0] + sx/2 > label.x - label.width/2 &&
                    v[1] - sy < label.y &&
                    v[1] > label.y - label.size) {
                    score -= 20000;
                }
            }
            if (h[j] <= 0) score -= 500;
            if (v[0] + sx/2 > 0.5 * h.mesh.aspectRatio.width) score -= 50000;
            if (v[0] - sx/2 < -0.5 * h.mesh.aspectRatio.width) score -= 50000;
            if (v[1] > 0.5 * h.mesh.aspectRatio.height) score -= 50000;
            if (v[1] - sy < -0.5 * h.mesh.aspectRatio.height) score -= 50000;
            if (score > bestscore) {
                bestscore = score;
                best = j;
            }
        }
        reglabels.push({
            text,
            x: h.mesh.vertices[best][0],
            y: h.mesh.vertices[best][1],
            size:sy,
            width:sx
        });
    }
    texts = svg.selectAll('text.region').data(reglabels);
    texts.enter()
        .append('text')
        .classed('region', true);
    texts.exit()
        .remove();
    svg.selectAll('text.region')
        .attr('x', d => 1000*d.x)
        .attr('y', d => 1000*d.y)
        .style('font-size', d => 1000*d.size)
        .style('text-anchor', 'middle')
        .text(d => d.text)
        .raise();
}

function drawMap(svg, render) {
    render.rivers = getRivers(render.h, 0.01);
    render.coasts = contour(render.h, 0);
    render.terr = getTerritories(render);
    render.borders = getBorders(render);
    drawPaths(svg, 'river', render.rivers);
    drawPaths(svg, 'coast', render.coasts);
    drawPaths(svg, 'border', render.borders);
    visualizeSlopes(svg, render);
    visualizeCities(svg, render);
    drawLabels(svg, render);
}

export function doMap(svg, params = defaultParams) {
    const render = {
        params
    };
    const width = svg.attr('width');
    svg.attr('height', width * params.aspectRatio.height / params.aspectRatio.width);
    svg.attr('viewBox', `${-1000 * params.aspectRatio.width/2} ${-1000 * params.aspectRatio.height/2} ${1000 * params.aspectRatio.width} ${1000 * params.aspectRatio.height}`);
    svg.selectAll().remove();
    render.h = params.generator(params);
    placeCities(render);
    drawMap(svg, render);
}

const defaultParams = {
    aspectRatio: defaultAspectRatio,
    generator: generateCoast,
    numPoints: 16384,
    ncities: 15,
    nterrs: 5,
    fontsizes: {
        region: 40,
        city: 25,
        town: 20
    }
};

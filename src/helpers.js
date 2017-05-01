import * as d3 from 'd3';

export const defaultExtent = {
    width: 1,
    height: 1
};

export function runif(lo, hi) {
    return lo + Math.random() * (hi - lo);
}

export function voronoi(pts, extent = defaultExtent) {
    const w = extent.width/2;
    const h = extent.height/2;
    return d3.voronoi().extent([[-w, -h], [w, h]])(pts);
}

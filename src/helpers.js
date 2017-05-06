import * as d3 from 'd3';

export const defaultAspectRatio = {
    width: 1,
    height: 1
};

export function runif(lo, hi) {
    return lo + Math.random() * (hi - lo);
}

export function voronoi(pts, aspectRatio = defaultAspectRatio) {
    const w = aspectRatio.width/2;
    const h = aspectRatio.height/2;
    return d3.voronoi().aspectRatio([[-w, -h], [w, h]])(pts);
}

export function getRandomNormal() {
    let xVector;
    let yVector;
    let hypotenuseSquared = 2.0;
    while (hypotenuseSquared >= 1) {
        xVector = runif(-1, 1);
        yVector = runif(-1, 1);
        hypotenuseSquared = xVector * xVector + yVector * yVector;
    }
    const zVector = Math.sqrt(-2 * Math.log(hypotenuseSquared) / hypotenuseSquared);

    return [xVector * zVector, yVector * zVector];
}

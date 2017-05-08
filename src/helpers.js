import * as d3 from 'd3';

const defaultAspectRatio = {
    width: 1,
    height: 1
};

export const defaultParams = {
    aspectRatio: defaultAspectRatio,
    numPoints: 4096, // Will generate a mesh with ~5x the number of triangles
    ncities: 15,
    nterrs: 5,
    fontsizes: {
        region: 40,
        city: 25,
        town: 20
    }
};

export function getRandomNumber(low, high) {
    return low + Math.random() * (high - low);
}

export function voronoi(pts, aspectRatio = defaultAspectRatio) {
    const w = aspectRatio.width/2;
    const h = aspectRatio.height/2;
    return d3.voronoi().extent([[-w, -h], [w, h]])(pts);
}

export function getRandomNormal() {
    let xVector;
    let yVector;
    let hypotenuseSquared = 2.0;
    while (hypotenuseSquared >= 1) {
        xVector = getRandomNumber(-1, 1);
        yVector = getRandomNumber(-1, 1);
        hypotenuseSquared = xVector * xVector + yVector * yVector;
    }
    const zVector = Math.sqrt(-2 * Math.log(hypotenuseSquared) / hypotenuseSquared);

    return [xVector * zVector, yVector * zVector];
}

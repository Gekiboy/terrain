import { voronoi } from './helpers';
import { X_POS, Y_POS } from './constants';
import Mesh from './Mesh';

export default class Map {
    constructor(params) {
        this.params = params;
    }

    generate() {
        this.generateMesh();
        this.generateBasicShape();
    }

    generateMesh(viewArea) {
        viewArea || (viewArea = this.getViewArea());
        const points = this.generatePoints(viewArea);

        this.mesh = new Mesh(points, viewArea);
    }

    generateBasicShape() {
        // Extend
    }

    generatePoints(viewArea) {
        const [left, right, top, bottom] = viewArea;
        let points = [];

        // Generate a set of random points
        for (let i = 0; i < this.params.numPoints; i++) {
            points.push([runif(left, right), runif(bottom, top)]);
        }
        // Sort them based on their X position (why?)
        points = points.sort((a, b) => a[X_POS] - b[X_POS]);
        // Find the center of the Voronoi polygons and use those to reduce clumping of points
        const voronoi = d3.voronoi().extent([[left, bottom], [right, top]])(points);
        return voronoi.polygons().map(voronoiPolygon => {
            let x = 0;
            let y = 0;
            for (let i = 0; i < voronoiPolygon.length; i++) {
                x += voronoiPolygon[i][X_POS];
                y += voronoiPolygon[i][Y_POS];
            }
            return [x / voronoiPolygon.length, y/voronoiPolygon.length];
        });
    }

    getViewArea() {
        const w = this.aspectRatio.width / 2;
        const h = this.aspectRatio.height / 2;

        return {
            left: -w,
            right: w,
            top: h,
            bottom: -h
        }
    }
}

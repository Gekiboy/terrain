import * as d3 from 'd3';
import { getRandomNumber } from './helpers';
import { X_POS, Y_POS } from './constants';
import Mesh from './Mesh';

export default class BaseMap {
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
        const {left, right, top, bottom} = viewArea;
        let points = [];

        // Generate a set of random points
        for (let i = 0; i < this.params.numPoints; i++) {
            points.push([getRandomNumber(left, right), getRandomNumber(bottom, top)]);
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
        const w = this.params.aspectRatio.width / 2;
        const h = this.params.aspectRatio.height / 2;

        return {
            left: -w,
            right: w,
            top: h,
            bottom: -h
        }
    }

    renderTo(svg) {
        const scale = 1000;
        const viewBoxWidth = this.params.aspectRatio.width * scale;
        const viewBoxHeight = this.params.aspectRatio.height * scale;
        const viewBox = [
            -1 * viewBoxWidth / 2, // Min X
            -1 * viewBoxHeight / 2, // Min Y
            viewBoxWidth, // Width
            viewBoxHeight // Height
        ];

        svg.setAttribute('viewBox', viewBox.join(' '));
        svg = d3.select(svg);
        // render here
        // this.visualizePoints(svg);
        this.visualizeVoronoi(svg, -1, 1);
    }

    visualizePoints(svg) {
        const circle = svg.selectAll('circle').data(this.mesh.vertices);
        circle.enter()
            .append('circle');
        circle.exit().remove();
        d3.selectAll('circle')
            .attr('cx', d => 1000*d[0])
            .attr('cy', d => 1000*d[1])
            .attr('r', 100 / Math.sqrt(this.mesh.vertices.length));
    }

    visualizeVoronoi(svg, low, high) {
        high != undefined || (high = d3.max(this.mesh.heights) + 1e-9);
        low != undefined || (low = d3.min(this.mesh.heights) + 1e-9);
        const mappedHeights = this.mesh.heights.map(height => height > high ? 1 : height < low ? 0 : (height - low) / (high - low));

        this.drawPaths(svg, 'field', this.mesh.triangles);
        svg.selectAll('path.field').style('fill', (d, i) => d3.interpolateViridis(mappedHeights[i]));
    }

    drawPaths(svg, cls, paths) {
        var paths = svg.selectAll(`path.${cls}`).data(paths)
        paths.enter()
                .append('path')
                .classed(cls, true)
        paths.exit()
                .remove();
        svg.selectAll(`path.${cls}`)
            .attr('d', this.makeD3Path);
    }

    makeD3Path(path) {
        const p = d3.path();
        p.moveTo(1000*path[0][0], 1000*path[0][1]);
        for (let i = 1; i < path.length; i++) {
            p.lineTo(1000*path[i][0], 1000*path[i][1]);
        }
        return p.toString();
    }
}

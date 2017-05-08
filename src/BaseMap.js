import * as d3 from 'd3';
import { defaultParams, getRandomNumber } from './helpers';
import { X_POS, Y_POS } from './constants';
import Mesh from './Mesh';

export default class BaseMap {
    constructor(params = {}) {
        this.params = {
            ...defaultParams,
            ...params
        };
    }

    generate() {
        this.generateMesh();
        this.generateBasicShape();
    }

    generateMesh(viewArea) {
        this.mesh = new Mesh(this.params.numPoints, this.params.aspectRatio);
    }

    generateBasicShape() {
        // Extend
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
        this.visualizeVoronoi(svg, -1, 1);
        // this.visualizePoints(svg);
    }

    visualizePoints(svg) {
        const pointCircles = svg.selectAll('circle.points').data(this.mesh.points);
        pointCircles.enter()
            .append('circle')
            .classed('points', true);
        pointCircles.exit().remove();
        d3.selectAll('circle.points')
            .attr('cx', d => 1000*d[0])
            .attr('cy', d => 1000*d[1])
            .attr('r', 100 / Math.sqrt(this.mesh.points.length));

        const vertexCircles = svg.selectAll('circle.vertices').data(this.mesh.triangleCenters);
        vertexCircles.enter()
            .append('circle')
            .classed('vertices', true);
        vertexCircles.exit().remove();
        d3.selectAll('circle.vertices')
            .attr('cx', d => 1000*d[0])
            .attr('cy', d => 1000*d[1])
            .attr('r', 100 / Math.sqrt(this.mesh.triangleCenters.length))
            .attr('fill', 'red');
    }

    visualizeVoronoi(svg, low, high) {
        high != undefined || (high = d3.max(this.mesh.heights) + 1e-9);
        low != undefined || (low = d3.min(this.mesh.heights) + 1e-9);
        const mappedHeights = this.mesh.heights.map(height => height > high ? 1 : height < low ? 0 : (height - low) / (high - low));

        this.drawPaths(svg, 'field', this.mesh.triangles);
        svg.selectAll('path.field').style('fill', (d, i) => d3.interpolateViridis(mappedHeights[i]));
    }

    drawPaths(svg, className, paths) {
        paths = svg.selectAll(`path.${className}`).data(paths);
        paths.enter()
            .append('path')
            .classed(className, true);
        paths.exit()
            .remove();
        svg.selectAll(`path.${className}`)
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

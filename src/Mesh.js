import * as d3 from 'd3';
import { getRandomNumber } from './helpers';
import { X_POS, Y_POS } from './constants';

export default class Mesh {
    viewArea = {}
    adjacencyIndex = [] // Index of which points are considered adjacent to another
    edges = [] // List of edges including the triangles they border
    triangles = [] //
    triangleCenters = []
    heights = []

    constructor(numPoints, aspectRatio) {
        this.viewArea = this.getViewArea(aspectRatio);
        const points = this.getRandomPoints(numPoints);
        this.generateTriangles(points);
    }

    getViewArea(aspectRatio) {
        const w = aspectRatio.width / 2;
        const h = aspectRatio.height / 2;

        return {
            left: -w,
            right: w,
            top: h,
            bottom: -h
        }
    }

    getRandomPoints(numPoints) {
        const {left, right, top, bottom} = this.viewArea;

        // Generate a set of random points
        const points = [];
        for (let i = 0; i < numPoints; i++) {
            points.push([getRandomNumber(left, right), getRandomNumber(bottom, top)]);
        }
        // Generate a voronoi diagram from the points and use the center of each polygon instead to reduce clumping
        const voronoiDiagram = d3.voronoi().extent([[left, bottom], [right, top]])(points);
        return voronoiDiagram.polygons().map(polygon => this.getMean(polygon));
    }

    generateTriangles(points) {
        const {left, right, top, bottom} = this.viewArea;
        const voronoiDiagram = d3.voronoi().extent([
            [left, bottom],
            [right, top]
        ])(points);

        // this.points = points;
        // Temporary to support old logic
        this.aspectRatio = {
            width: right - left,
            height: top - bottom
        }

        const triangleLookup = {};
        voronoiDiagram.edges.forEach(voronoiEdge => {
            if (voronoiEdge == undefined) return;

            const {
                0: firstVertex,
                1: secondVertex,
                left: leftSide,
                right: rightSide
            } = voronoiEdge;

            const firstTriangleReference = this.addTriangle(leftSide, firstVertex, secondVertex);
            this.checkForEdge(triangleLookup, [leftSide, firstVertex], firstTriangleReference);
            this.checkForEdge(triangleLookup, [leftSide, secondVertex], firstTriangleReference);

            if (rightSide) {
                const secondTriangleReference = this.addTriangle(rightSide, firstVertex, secondVertex);
                this.addEdge(firstTriangleReference, secondTriangleReference, firstVertex, secondVertex);
                this.checkForEdge(triangleLookup, [rightSide, firstVertex], secondTriangleReference);
                this.checkForEdge(triangleLookup, [rightSide, secondVertex], secondTriangleReference);
            }
        });
    }

    addTriangle(firstVertex, secondVertex, thirdVertex) {
        const triangle = [firstVertex, secondVertex, thirdVertex];

        const reference = this.triangles.push(triangle) - 1;
        this.triangleCenters.push(this.getMean(triangle));
        this.heights.push(0);

        return reference;
    }

    getMean(vertices) {
        return [
            d3.mean(vertices.map(vertex => vertex[X_POS])),
            d3.mean(vertices.map(vertex => vertex[Y_POS]))
        ]
    }

    checkForEdge(lookup, [firstVertex, secondVertex], triangleReference) {
        // Given an edge of a triangle, check to see if there is a previously created triangle that shares them
        if (lookup[firstVertex] && lookup[firstVertex][secondVertex]) {
            this.addEdge(triangleReference, lookup[firstVertex][secondVertex], firstVertex, secondVertex);
        }
        else {
            lookup[firstVertex] || (lookup[firstVertex] = {});
            lookup[firstVertex][secondVertex] = triangleReference;
        }
    }

    addEdge(firstTriangleReference, secondTriangleReference, firstVertex, secondVertex) {
        // Track the edge between the triangles and that they are adjacent
        this.edges.push([firstTriangleReference, secondTriangleReference, firstVertex, secondVertex]);
        this.addAdjacencyReferences(firstTriangleReference, secondTriangleReference);
    }

    addAdjacencyReferences(firstTriangleReference, secondTriangleReference) {
        // Track which triangles are adjacent to each other
        this.adjacencyIndex[firstTriangleReference] || (this.adjacencyIndex[firstTriangleReference] = []);
        this.adjacencyIndex[secondTriangleReference] || (this.adjacencyIndex[secondTriangleReference] = []);
        this.adjacencyIndex[firstTriangleReference].push(secondTriangleReference);
        this.adjacencyIndex[secondTriangleReference].push(firstTriangleReference);
    }

    addTriangleReferences(position, side) {
        this.triangles[position] || (this.triangles[position] = []);
        side && !this.triangles[position].includes(side) && this.triangles[position].push(side);
    }

    map(property, f) {
        this[property] = this[property].map(f);
    }
}

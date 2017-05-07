import * as d3 from 'd3';
import { defaultAspectRatio, voronoi } from './helpers';
import { X_POS, Y_POS } from './constants';

export default class Mesh {
    constructor(points, viewArea) {
        const {left, right, top, bottom} = viewArea;
        const voronoi = d3.voronoi().extent([
            [left, bottom],
            [right, top]
        ])(points);
        // Temporary to support old logic
        this.aspectRatio = {
            width: right - left,
            height: top - bottom
        }

        this.vertices = [];
        this.verticeIndex = {};
        this.adjacencyIndex = [];
        this.edges = [];
        this.triangles = [];
        this.heights = [];

        voronoi.edges.forEach(voronoiEdge => {
            if (voronoiEdge == undefined) return;

            const {
                0: firstVertice,
                1: secondVertice,
                left: leftSide,
                right: rightSide
            } = voronoiEdge;

            const firstVerticePosition = this.addVertice(firstVertice);
            const secondVerticePosition = this.addVertice(secondVertice);
            this.addAdjacencyReferences(firstVerticePosition, secondVerticePosition);
            // TODO: Pay attention to how these are used
            this.edges.push([firstVerticePosition, secondVerticePosition, leftSide, rightSide]);
            this.addTriangleReferences(firstVerticePosition, leftSide);
            this.addTriangleReferences(firstVerticePosition, rightSide);
            this.addTriangleReferences(secondVerticePosition, leftSide);
            this.addTriangleReferences(secondVerticePosition, rightSide);
        });
    }

    addVertice(vertice) {
        // Only add it if it's new, otherwise just return its position
        let position = this.verticeIndex[vertice];
        if (!position) {
            position = this.vertices.push(vertice) - 1;
            this.heights.push(0);
            this.verticeIndex[vertice] = position;
        }
        return position;
    }

    addAdjacencyReferences(firstPosition, secondPosition) {
        // Track which positions of adjacent vertices
        this.adjacencyIndex[firstPosition] || (this.adjacencyIndex[firstPosition] = []);
        this.adjacencyIndex[secondPosition] || (this.adjacencyIndex[secondPosition] = []);
        this.adjacencyIndex[firstPosition].push(secondPosition);
        this.adjacencyIndex[secondPosition].push(firstPosition);
    }

    addTriangleReferences(position, side) {
        this.triangles[position] || (this.triangles[position] = []);
        side && !this.triangles[position].includes(side) && this.triangles[position].push(side);
    }

    // Temporary to support old functionality
    map(property, f) {
        this[property] = this[property].map(f);
    }
}

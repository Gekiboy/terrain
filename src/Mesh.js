import { defaultExtent, voronoi } from './helpers';

export default class Mesh {
    constructor(points, extent = defaultExtent) {
        this.vor = voronoi(points, extent);
        this.vxs = [];
        this.adj = [];
        this.edges = [];
        this.triangles = [];

        const vxids = {};

        for (const e of this.vor.edges) {
            if (e == undefined) continue;
            let e0 = vxids[e[0]];
            let e1 = vxids[e[1]];
            if (e0 == undefined) {
                e0 = vxs.length;
                vxids[e[0]] = e0;
                this.vxs.push(e[0]);
            }
            if (e1 == undefined) {
                e1 = this.vxs.length;
                vxids[e[1]] = e1;
                this.vxs.push(e[1]);
            }
            this.adj[e0] = this.adj[e0] || [];
            this.adj[e0].push(e1);
            this.adj[e1] = this.adj[e1] || [];
            this.adj[e1].push(e0);
            this.edges.push([e0, e1, e.left, e.right]);

            this.triangles[e0] = this.triangles[e0] || [];
            if (!this.triangles[e0].includes(e.left)) this.triangles[e0].push(e.left);
            if (e.right && !this.triangles[e0].includes(e.right)) this.triangles[e0].push(e.right);
            this.triangles[e1] = this.triangles[e1] || [];
            if (!this.triangles[e1].includes(e.left)) this.triangles[e1].push(e.left);
            if (e.right && !this.triangles[e1].includes(e.right)) this.triangles[e1].push(e.right);
        }
    }

    map(f) {
        const mapped = vxs.map(f);
        mapped.mesh = mesh;
        return mapped;
    }
}

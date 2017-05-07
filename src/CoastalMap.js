import BaseMap from './BaseMap';
import { getRandomNormal, defaultParams } from './helpers';

export default class CoastalMap extends BaseMap {
    constructor(params = defaultParams) {
        super(params);
    }

    generateBasicShape() {
        this.generateInitialSlope();
    }

    generateInitialSlope() {
        const [xVector, yVector] = getRandomNormal();
        const scale = 4;

        this.mesh.map('heights', (height, index) => (
            this.mesh.vertices[index][0] * xVector * scale + this.mesh.vertices[index][1] * yVector * scale
        ));
    }
}

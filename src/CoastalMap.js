import BaseMap from './BaseMap';
import { getRandomNormal } from './helpers';

export default class CoastalMap extends BaseMap {
    constructor(params) {
        super(params);
    }

    generateBasicShape() {
        this.generateInitialSlope();
    }

    generateInitialSlope() {
        const [xVector, yVector] = getRandomNormal();
        const scale = 4;

        this.mesh.map('heights', (height, index) => (
            this.mesh.triangleCenters[index][0] * xVector * scale + this.mesh.triangleCenters[index][1] * yVector * scale
        ));
    }
}

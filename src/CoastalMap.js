import Map from './Map';
import { getRandomNormal } from '.helpers';

export default class CoastalMap extends Map {
    constructor(aspectRatio = defaultAspectRatio) {
        super(aspectRatio);
    }

    generateBasicShape() {
        this.generateInitialSlope();
    }

    generateInitialSlope() {
        const [xVector, yVector] = getRandomNormal();
        const scale = 4;
        [scale * rnorm(), scale * rnorm()];
        return this.mesh.map(vertex => vertex[0] * xVector * scale + vertex[1] * yVector * scale);
    }
}

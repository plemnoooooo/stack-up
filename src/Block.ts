import * as THREE from "three";
import { Box } from "./types";
import { roundToNearest } from "./utils";

export default class Block extends THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial> {
    static readonly STARTING_WIDTH = 12;
    static readonly STARTING_DEPTH = 12;
    static readonly HEIGHT = 1.2;

    static readonly COLOR = 0xf0f0f0;
    static readonly FIX_VALUE = 0.24;

    constructor(width: number, depth: number) {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshLambertMaterial({ color: Block.COLOR });
        
        super(geometry, material);

        this.setSize(width, depth);
    }

    static createStartingBlock() {
        const block = new Block(this.STARTING_WIDTH, this.STARTING_DEPTH);
        return block;
    }

    setPosition(x: number, y: number, z: number) {
        x = roundToNearest(x, Block.FIX_VALUE);
        y = roundToNearest(y, Block.FIX_VALUE);
        z = roundToNearest(z, Block.FIX_VALUE);

        this.position.set(x, y, z);
    }

    setSize(width: number, depth: number) {
        width = roundToNearest(width, Block.FIX_VALUE);
        depth = roundToNearest(depth, Block.FIX_VALUE);

        const newGeometry = new THREE.BoxGeometry(width, Block.HEIGHT, depth);
        this.geometry.copy(newGeometry);

        this.geometry.translate(width / 2, 0, depth / 2);
    }

    getBoundingBox(): Box {
        this.geometry.computeBoundingBox();
        this.geometry.boundingBox!.translate(this.position);
        
        const { min, max } = this.geometry.boundingBox!;
        
        const {
            x: left,
            y: bottom,
            z: back
        } = min;

        const {
            x: right,
            y: top,
            z: front
        } = max;

        const width = right - left;
        const height = top - bottom;
        const depth = front - back;
        
        return { top, left, bottom, right, front, back, width, height, depth };
    }
}
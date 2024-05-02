import * as THREE from "three";

export class Block extends THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial> {
    static readonly STARTING_WIDTH = 10;
    static readonly STARTING_DEPTH = 10;
    static readonly HEIGHT = 1;
    static readonly DECIMAL_POINTS = 1;

    static readonly MOVE_STEP = 0.1;
    static readonly OPACITY_STEP = -0.02;
    static readonly COLOR = 0xf0f0f0;

    constructor(width: number, depth: number) {
        width = +width.toFixed(Block.DECIMAL_POINTS);
        depth = +depth.toFixed(Block.DECIMAL_POINTS);

        const geometry = new THREE.BoxGeometry(width, Block.HEIGHT, depth);
        const material = new THREE.MeshLambertMaterial({ color: Block.COLOR });

        geometry.translate(width / 2, 0, depth / 2);
        
        super(geometry, material);
    }
    
    getSidePositions() {
        const { x, y, z } = this.position;
        const { width, height, depth } = this.geometry.parameters;

        return {
            top: y + height,
            left: x,
            bottom: y,
            right: x + width,
            front: z + depth,
            back: z
        };
    }

    setPosition(x: number, y: number, z: number) {
        x = +x.toFixed(Block.DECIMAL_POINTS);
        y = +y.toFixed(Block.DECIMAL_POINTS);
        z = +z.toFixed(Block.DECIMAL_POINTS);

        this.position.set(x, y, z);
    }
}
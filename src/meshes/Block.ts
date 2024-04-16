import * as THREE from "three";

export class Block extends THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial> {
    static readonly HEIGHT = 1;
    static readonly COLOR = 0xf0f0f0;

    constructor(width: number, depth: number) {
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
}
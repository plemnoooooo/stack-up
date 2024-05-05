import * as THREE from "three";

export function getMeshSides({ position, geometry }: THREE.Mesh<THREE.BoxGeometry>) {
    geometry.computeBoundingBox();
    geometry.boundingBox!.translate(position);
    
    const { min, max } = geometry.boundingBox!;
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
    
    return { top, left, bottom, right, front, back };
}
import * as THREE from "three";

export function colorToHSL(color: THREE.Color) {
    const emptyHSL: THREE.HSL = {
        h: 0,
        s: 0,
        l: 0
    };

    color.getHSL(emptyHSL);

    return emptyHSL;
}
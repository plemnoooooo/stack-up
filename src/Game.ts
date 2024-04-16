import * as THREE from "three";
import $ from "jquery";
import { Block } from "./meshes";

export default class Game {
    static readonly STARTING_WIDTH = 10;
    static readonly STARTING_DEPTH = 10;
    static readonly KEY_TO_STACK_BLOCK = " ";

    scene!: THREE.Scene;
    canvas!: JQuery<HTMLCanvasElement>;
    renderer!: THREE.WebGLRenderer;

    camera!: THREE.PerspectiveCamera;
    ambientLight!: THREE.AmbientLight;
    directionalLight!: THREE.DirectionalLight;

    movement: number;
    blocks: Block[];
    movingBlock!: Block;
    
    constructor() {
        this.movement = 0;
        this.blocks = [];

        this.init();
        this.animate();
    }

    init() {
        this.scene = new THREE.Scene();
        this.canvas = $("#game-canvas");
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas[0] });

        this.scene.background = new THREE.Color(0x72b5d6);
        $(document.body).css("background-color", "#72b5d6");

        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.ambientLight = new THREE.AmbientLight();
        this.directionalLight = new THREE.DirectionalLight();

        this.camera.position.setScalar(20);
        this.camera.lookAt(new THREE.Vector3());

        this.directionalLight.position.set(20, 60, 20);
        this.directionalLight.lookAt(new THREE.Vector3());

        this.scene.add(this.ambientLight, this.directionalLight);

        const startingBlock = new Block(Game.STARTING_WIDTH, Game.STARTING_DEPTH);
        this.movingBlock = new Block(Game.STARTING_WIDTH, Game.STARTING_DEPTH);
        
        this.blocks.push(startingBlock);
        this.scene.add(startingBlock, this.movingBlock);

        this.resetMovingBlock();

        $(window).on("resize", this.onResize.bind(this))
        
        this.canvas.on("keydown pointerdown", ({ type, key }) => {
            if ((type === "keydown") && (key !== Game.KEY_TO_STACK_BLOCK)) return;

            this.stackBlock();
        });
    }

    animate() {
        this.updateMovingBlock();
        
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate.bind(this));
    }

    reset() {
        this.movement = 0;

        const removedBlocks = this.blocks.splice(1);
        this.scene.remove(...removedBlocks);
        
        this.resetMovingBlock();
    }

    updateMovingBlock() {
        const { x, z } = this.movingBlock.position;
        const isDirectionChanging = [x, z].some((val) => Math.abs(val) > 10);

        this.movement ^= +isDirectionChanging;

        const isZMoving = !!(this.movement & 2);
        const moveMultiplier = (~this.movement & 1) || -1;

        const positionArray = this.movingBlock.position.toArray();
        positionArray[+isZMoving * 2] += 0.1 * moveMultiplier;
        
        this.movingBlock.position.fromArray(positionArray);
    }

    stackBlock() {
        console.log("//")
        const {
            left: l1,
            right: r1,
            front: f1,
            back: b1
        } = this.movingBlock.getSidePositions();

        const {
            top: y,
            left: l2,
            right: r2,
            front: f2,
            back: b2
        } = this.blocks.slice(-1)[0].getSidePositions();

        const left = THREE.MathUtils.clamp(l1, l2, r2);
        const right = THREE.MathUtils.clamp(r1, l2, r2);
        const front = THREE.MathUtils.clamp(f1, b2, f2); // THREE.MathUtils.clamp(x2, x1, x1 + w1) - x;
        const back = THREE.MathUtils.clamp(b1, b2, f2);
        
        const width = +(right - left).toFixed(1);
        const depth = +(front - back).toFixed(1);
        if ([width, depth].some((val) => val <= 0)) return;// THREE.MathUtils.clamp(z2, z1, z1 + d1) - z;

        const block = new Block(width, depth);

        block.position.set(left, y, back);

        this.blocks.push(block);
        this.scene.add(block);

        this.movement ^= 2;

        this.resetMovingBlock();
    }

    resetMovingBlock() {
        const isZMoving = !!(this.movement & 2);
        const moveMultiplier = (this.movement & 1) || -1;
        
        const topMostBlock = this.blocks.slice(-1)[0]!;
        const { x, y, z } = topMostBlock.position;
        const { width, depth } = topMostBlock.geometry.parameters;
        
        this.movingBlock.position.set(isZMoving ? x : moveMultiplier * 10, y + Block.HEIGHT, isZMoving ? moveMultiplier * 10 : z);
        
        const newGeometry = new THREE.BoxGeometry(width, Block.HEIGHT, depth);
        this.movingBlock.geometry.copy(newGeometry);
        this.movingBlock.geometry.translate(width / 2, 0, depth / 2);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
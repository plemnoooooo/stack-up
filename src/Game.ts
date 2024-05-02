import * as THREE from "three";
import $ from "jquery";
import { Block } from "./meshes";
import { clampOutside } from "./utils";

export default class Game {
    static readonly CANVAS_ID = "game-canvas";
    static readonly SCORE_ID = "score";

    static readonly FOV = 60;
    static readonly NEAR = 0.1;
    static readonly FAR = 1000;

    static readonly CAMERA_TRANSLATION = 20;
    static readonly CAMERA_TRANSLATION_Y = 30;
    static readonly CAMERA_DAMPING = 6;

    static readonly BACKGROUND_COLOR = 0x72bed6;
    static readonly GRAVITY = 0.1;
    static readonly KEY_TO_STACK_BLOCK = " ";

    canvas!: JQuery<HTMLCanvasElement>;
    score!: JQuery<HTMLParagraphElement>;

    scene!: THREE.Scene;
    renderer!: THREE.WebGLRenderer;

    camera!: THREE.PerspectiveCamera;
    ambientLight!: THREE.AmbientLight;
    directionalLight!: THREE.DirectionalLight;

    gameOver: boolean;
    movement: number;

    blocks: Block[];
    movingBlock!: Block;
    cutOffBlock!: Block;
    
    constructor() {
        this.movement = 0;
        this.gameOver = false;
        this.blocks = [];

        this.init();
        this.animate();
    }

    init() {
        this.canvas = $(`#${Game.CANVAS_ID}`);
        this.score = $(`#${Game.SCORE_ID}`);

        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas[0] });

        const backgroundColor = new THREE.Color(Game.BACKGROUND_COLOR);
        this.scene.background = backgroundColor;
        $(document.body).css("background-color", `#${backgroundColor.getHexString()}`);

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        $(window).on("resize", this.onResize.bind(this));

        this.camera = new THREE.PerspectiveCamera(Game.FOV, window.innerWidth / window.innerHeight, Game.NEAR, Game.FAR);
        this.ambientLight = new THREE.AmbientLight();
        this.directionalLight = new THREE.DirectionalLight();

        this.camera.position.set(Game.CAMERA_TRANSLATION, Game.CAMERA_TRANSLATION_Y,Game.CAMERA_TRANSLATION);
        this.camera.lookAt(new THREE.Vector3());
        this.camera.userData.targetY = 1;

        this.directionalLight.position.set(20, 60, 20);
        this.directionalLight.lookAt(new THREE.Vector3());

        this.scene.add(this.ambientLight, this.directionalLight);

        const startingBlock = new Block(Block.STARTING_WIDTH, Block.STARTING_DEPTH);
        this.blocks.push(startingBlock);

        this.movingBlock = new Block(0, 0);
        this.resetMovingBlock();

        this.cutOffBlock = new Block(0, 0);
        this.cutOffBlock.material.opacity = 0;
        this.cutOffBlock.material.transparent = true;
        this.cutOffBlock.userData.velocity = 0;

        this.scene.add(startingBlock, this.movingBlock, this.cutOffBlock);

        $(window).on("keydown pointerdown", ({ type, key }) => !this.gameOver && !((type === "keydown") && (key !== Game.KEY_TO_STACK_BLOCK)) && this.stackNewBlock());
    }

    animate() {
        this.updateMovingBlock();
        this.updateCutOffBlock();

        this.camera.position.y += ((this.camera.userData.targetY + Game.CAMERA_TRANSLATION_Y) - this.camera.position.y) / Game.CAMERA_DAMPING;
        
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate.bind(this));
    }

    reset() {
        this.movement = 0;

        const removedBlocks = this.blocks.splice(1);
        this.scene.remove(...removedBlocks);
        
        this.movingBlock.visible = true;
        this.resetMovingBlock();
    }

    stackNewBlock() {
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
        const front = THREE.MathUtils.clamp(f1, b2, f2);
        const back = THREE.MathUtils.clamp(b1, b2, f2);
        
        const width = right - left;
        const depth = front - back;

        this.resetCutOffBlock();
        
        if ([width, depth].some((val) => val <= 0)) {
            this.movingBlock.visible = false;
            this.gameOver = true;

            return;
        };

        const block = new Block(width, depth);
        block.setPosition(left, y, back);
        this.blocks.push(block);
        this.scene.add(block);

        this.movement ^= 2;
        this.resetMovingBlock();

        const scoreIncrement = (+(Object.is([l1, r1, f1, b1], [l2, r2, f2, b2])) * 2) + 1;
        this.score.html(`${+this.score.html()! + scoreIncrement}`);

        this.camera.userData.targetY = this.movingBlock.position.y;
    }

    updateMovingBlock() {
        const { x, y, z } = this.movingBlock.position;
        const isDirectionChanging = [x, z].some((val) => Math.abs(val) > 10);

        this.movement ^= +isDirectionChanging;

        const isZMoving = !!(this.movement & 2);
        const moveMultiplier = (~this.movement & 1) || -1;
        const moveStep = Block.MOVE_STEP * moveMultiplier;

        this.movingBlock.setPosition(x + (moveStep * +!isZMoving), y, z + (moveStep * +isZMoving));
    }

    resetMovingBlock() {
        const isZMoving = !!(this.movement & 2);
        const moveMultiplier = (this.movement & 1) || -1;
        
        const topMostBlock = this.blocks.slice(-1)[0];
        const { x, y, z } = topMostBlock.position;
        const { width, depth } = topMostBlock.geometry.parameters;
        
        this.movingBlock.setPosition(isZMoving ? x : moveMultiplier * 10, y + Block.HEIGHT, isZMoving ? moveMultiplier * 10 : z);
        
        const newGeometry = new THREE.BoxGeometry(width, Block.HEIGHT, depth);
        this.movingBlock.geometry.copy(newGeometry);
        this.movingBlock.geometry.translate(width / 2, 0, depth / 2);
    }

    updateCutOffBlock() {
        if (this.cutOffBlock.material.opacity <= 0) return;
        
        this.cutOffBlock.userData.velocity -= Game.GRAVITY;
        this.cutOffBlock.position.y += this.cutOffBlock.userData.velocity;
        
        this.cutOffBlock.material.opacity += Block.OPACITY_STEP;
        this.cutOffBlock.material.needsUpdate = true;
    }

    resetCutOffBlock() {
        const {
            left: l1,
            right: r1,
            front: f1,
            back: b1
        } = this.movingBlock.getSidePositions();

        const {
            left: l2,
            right: r2,
            bottom: y,
            front: f2,
            back: b2
        } = this.blocks.slice(-1)[0].getSidePositions();

        const left = clampOutside(l1, l2, r2);
        const right = clampOutside(r1, l2, r2, true);
        const front = clampOutside(f1, b2, f2, true);
        const back = clampOutside(b1, b2, f2);

        const width = right - left;
        const depth = front - back;

        this.cutOffBlock.setPosition(left, y, back);
        this.cutOffBlock.userData.velocity = 0;
        
        this.cutOffBlock.geometry.copy(new THREE.BoxGeometry(width, Block.HEIGHT, depth));
        this.cutOffBlock.material.opacity = 1;
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
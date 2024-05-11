import * as THREE from "three";
import $ from "jquery";
import { clampOutside, getMeshSides, roundToNearest } from "./utils";

export default class Game {
    static readonly FOV = 60;
    static readonly NEAR = 0.1;
    static readonly FAR = 1000;

    static readonly CAMERA_X = 24;
    static readonly CAMERA_Z = 24;
    static readonly CAMERA_GAME_OVER_Z = -60;
    static readonly CAMERA_TRANSLATION_Y = 36;
    static readonly CAMERA_DAMPING = 6;

    static readonly LIGHT_X = 20;
    static readonly LIGHT_Z = 20;
    static readonly LIGHT_TRANSLATION_Y = 60;

    static readonly BLOCK_STARTING_WIDTH = 10;
    static readonly BLOCK_STARTING_DEPTH = 10;
    static readonly BLOCK_HEIGHT = 1;
    static readonly BLOCK_COLOR = 0xf0f0f0;

    static readonly FIX_POSITION_VALUE = 0.2;
    static readonly STARTING_MOVE_SPEED = 0.1;
    static readonly MAX_MOVE_SPEED = 0.4;
    static readonly MOVE_SPEED_DECREASE = 0.2;
    static readonly MOVE_SPEED_DECREASE_INTERVAL = 8;
    static readonly MOVE_DAMPING = 18;
    static readonly FALL_SPEED = 0.1;
    static readonly VISIBILITY_DECREASE = 0.04;

    static readonly BACKGROUND_COLOR = 0x72bed6;
    static readonly KEY_TO_STACK_BLOCK = " ";

    static readonly HOVER_DURATION = 300;
    static readonly FINAL_SCORE_DELAY = 400;
    static readonly FADE_DURATION = 800;
    static readonly FADE_DELAY = 400;
    static readonly END_SCREEN_FADE_IN = 800;
    static readonly STOP_GAME_DELAY = 2000;

    gameOver: boolean;
    movement: number;
    score: number;

    scene!: THREE.Scene;
    renderer!: THREE.WebGLRenderer;

    camera!: THREE.PerspectiveCamera;
    ambientLight!: THREE.AmbientLight;
    directionalLight!: THREE.DirectionalLight;

    blocks: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>[];
    movingBlock!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
    cutOffBlock!: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;

    constructor() {
        this.gameOver = false;
        this.movement = 0;
        this.score = 0;
        this.blocks = [];

        this.init();
        this.animate();
    }

    init() {
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ canvas: $("#game-canvas")[0] });

        const backgroundColor = new THREE.Color(Game.BACKGROUND_COLOR);
        this.scene.background = backgroundColor;
        $(document.body).css("background-color", `#${backgroundColor.getHexString()}`);

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        $(window).on("resize", this.resize.bind(this));

        this.camera = new THREE.PerspectiveCamera(Game.FOV, window.innerWidth / window.innerHeight, Game.NEAR, Game.FAR);
        this.ambientLight = new THREE.AmbientLight();
        this.directionalLight = new THREE.DirectionalLight();

        this.camera.position.set(Game.CAMERA_X, Game.CAMERA_TRANSLATION_Y, Game.CAMERA_Z);
        this.camera.lookAt(Game.BLOCK_STARTING_WIDTH / 2, Game.BLOCK_HEIGHT, Game.BLOCK_STARTING_DEPTH / 2);
        this.camera.userData.targetY = Game.BLOCK_HEIGHT;
        this.camera.userData.targetZ = Game.CAMERA_Z;

        this.directionalLight.position.set(Game.LIGHT_X, Game.LIGHT_TRANSLATION_Y, Game.LIGHT_Z);
        this.directionalLight.lookAt(new THREE.Vector3());

        this.scene.add(this.ambientLight, this.directionalLight);

        const startingBlock = this.createBlock(Game.BLOCK_STARTING_WIDTH, Game.BLOCK_STARTING_DEPTH);
        this.blocks.push(startingBlock);

        this.movingBlock = this.createBlock(0, 0);
        this.movingBlock.userData.speed = Game.STARTING_MOVE_SPEED;
        this.resetMovingBlock();

        this.cutOffBlock = this.createBlock(0, 0);
        this.cutOffBlock.material.opacity = 0;
        this.cutOffBlock.material.transparent = true;

        this.scene.add(startingBlock, this.movingBlock, this.cutOffBlock);

        $(window).on("keydown pointerdown", ({ type, key }) => {
            if (this.gameOver || ((type === "keydown") && (key !== Game.KEY_TO_STACK_BLOCK))) return;
            this.stackBlock();

            ($("#start-menu").css("opacity") === "1") && this.fadeWhenFirst();
        });

        $("#final-score").data({
            showScore: false,
            unrounded: 0
        });

        $("#reset").on("click", () => {
            this.gameOver && this.reset();
        }).on("pointerover", function () {
            $(this).stop(true).css({
                color: `#${Game.BACKGROUND_COLOR.toString(16)}`,
                backgroundColor: "white"
            }).animate({
                width: "12.8rem",
                height: "4.2rem",

                borderRadius: "2.1rem",
            }, 300);
        }).on("pointerout", function () {
            $(this).stop(true).css({
                color: "white",
                backgroundColor: "transparent"
            }).animate({
                width: "12rem",
                height: "4rem",

                borderRadius: "2rem"
            }, 300);
        });
    }

    animate() {
        this.updateMovingBlock();
        this.updateCutOffBlock();

        this.camera.position.y += ((this.camera.userData.targetY + Game.CAMERA_TRANSLATION_Y) - this.camera.position.y) / Game.CAMERA_DAMPING;
        this.camera.position.z += 1.6 * Math.sin((Math.PI / ((Game.CAMERA_Z - Game.CAMERA_GAME_OVER_Z) * 1.01)) * (this.camera.userData.targetZ - this.camera.position.z));

        const unroundedScore = $("#final-score").data("unrounded");
        $("#final-score").data("show-score") && $("#final-score").data("unrounded", unroundedScore + ((this.score / 30) * Math.sin(Math.PI / (this.score * 1.01) * (this.score - unroundedScore)))).text(Math.floor(roundToNearest($("#final-score").data("unrounded"), 0.1)));
        $("#final-score").data("show-score") && console.log(unroundedScore)

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate.bind(this));
    }

    reset() {
        this.gameOver = false;
        this.movement = 0;
        this.score = 0;

        this.camera.userData.targetY = Game.BLOCK_HEIGHT;
        this.camera.userData.targetZ = Game.CAMERA_Z;

        const removedBlocks = this.blocks.splice(1);
        this.scene.remove(...removedBlocks);

        this.movingBlock.visible = true;
        this.movingBlock.userData.speed = Game.STARTING_MOVE_SPEED;
        this.resetMovingBlock();

        $("#score").text(0);
        $("#final-score").data("show-score", false);

        this.fadeEndMenu(true);
    }

    stackBlock() {
        const {
            left: l1,
            right: r1,
            front: f1,
            back: b1
        } = getMeshSides(this.movingBlock);

        const {
            left: l2,
            right: r2,
            front: f2,
            back: b2
        } = getMeshSides(this.blocks.slice(-1)[0]);

        const left = THREE.MathUtils.clamp(l1, l2, r2);
        const right = THREE.MathUtils.clamp(r1, l2, r2);
        const front = THREE.MathUtils.clamp(f1, b2, f2);
        const back = THREE.MathUtils.clamp(b1, b2, f2);

        const width = roundToNearest(right - left, Game.FIX_POSITION_VALUE);
        const depth = roundToNearest(front - back, Game.FIX_POSITION_VALUE);

        this.resetCutOffBlock();

        if ([width, depth].some((val) => val <= 0)) {
            this.stop();

            return;
        };

        const block = this.createBlock(width, depth);
        this.moveBlock(block, left, this.movingBlock.position.y, back);
        this.blocks.push(block);
        this.scene.add(block);

        this.movement ^= 2;
        this.resetMovingBlock();

        this.score += (+!this.cutOffBlock.material.opacity * 2) + 1;

        this.camera.userData.targetY = this.movingBlock.position.y;
        this.directionalLight.position.y = this.movingBlock.position.y + Game.LIGHT_TRANSLATION_Y;

        $("#score").text(this.score);
    }

    updateMovingBlock() {
        const { x, y, z } = this.movingBlock.position;
        const isDirectionChanging = [x, z].some((val) => Math.abs(val) > 10);

        this.movement ^= +isDirectionChanging;

        const isZMoving = !!(this.movement & 2);
        const moveMultiplier = (~this.movement & 1) || -1;
        const moveStep = this.movingBlock.userData.speed * moveMultiplier;

        this.movingBlock.position.set(x + (moveStep * +!isZMoving), y, z + (moveStep * +isZMoving));
    }

    resetMovingBlock() {
        const isZMoving = !!(this.movement & 2);
        const moveMultiplier = (this.movement & 1) || -1;

        const mostTopBlock = this.blocks.slice(-1)[0];
        const { left, right, back, front } = getMeshSides(mostTopBlock);
        const width = right - left;
        const depth = front - back;

        this.moveBlock(this.movingBlock, isZMoving ? left : moveMultiplier * Game.BLOCK_STARTING_WIDTH, mostTopBlock.position.y + Game.BLOCK_HEIGHT, isZMoving ? moveMultiplier * Game.BLOCK_STARTING_DEPTH : back);
        this.resizeBlock(this.movingBlock, width, depth);

        this.movingBlock.userData.speed += (Game.MAX_MOVE_SPEED - this.movingBlock.userData.speed) / Game.MOVE_DAMPING;
        this.movingBlock.userData.speed /= 1 + (+!(this.movingBlock.position.y % Game.MOVE_SPEED_DECREASE_INTERVAL) * Game.MOVE_SPEED_DECREASE);
    }

    updateCutOffBlock() {
        if (this.cutOffBlock.material.opacity <= 0) return;
        this.cutOffBlock.position.y -= Game.FALL_SPEED;
        this.cutOffBlock.material.opacity -= Game.VISIBILITY_DECREASE;
    }

    resetCutOffBlock() {
        const isZMoving = !!(this.movement & 2);

        const {
            left: l1,
            right: r1,
            front: f1,
            back: b1
        } = getMeshSides(this.movingBlock);

        const {
            left: l2,
            right: r2,
            front: f2,
            back: b2
        } = getMeshSides(this.blocks.slice(-1)[0]);

        const left = clampOutside(l1, l2, r2);
        const right = clampOutside(r1, l2, r2, true);
        const front = clampOutside(f1, b2, f2, true);
        const back = clampOutside(b1, b2, f2);

        const width = right - left;
        const depth = front - back;

        this.moveBlock(this.cutOffBlock, isZMoving ? this.movingBlock.position.x : left, this.movingBlock.position.y, isZMoving ? back : this.movingBlock.position.z);
        this.resizeBlock(this.cutOffBlock, width, depth);

        this.cutOffBlock.material.opacity = +!!(roundToNearest(width, Game.FIX_POSITION_VALUE) && roundToNearest(depth, Game.FIX_POSITION_VALUE));
    }

    createBlock(width: number, depth: number) {
        width = roundToNearest(width, Game.FIX_POSITION_VALUE);
        depth = roundToNearest(depth, Game.FIX_POSITION_VALUE);

        const geometry = new THREE.BoxGeometry(width, Game.BLOCK_HEIGHT, depth);
        const material = new THREE.MeshLambertMaterial({ color: Game.BLOCK_COLOR });

        geometry.translate(width / 2, 0, depth / 2);

        return new THREE.Mesh(geometry, material);
    }

    moveBlock(block: THREE.Mesh, x: number, y: number, z: number) {
        x = roundToNearest(x, Game.FIX_POSITION_VALUE);
        y = roundToNearest(y, Game.FIX_POSITION_VALUE);
        z = roundToNearest(z, Game.FIX_POSITION_VALUE);

        block.position.set(x, y, z);
    }

    resizeBlock(block: THREE.Mesh, width: number, depth: number) {
        width = roundToNearest(width, Game.FIX_POSITION_VALUE);
        depth = roundToNearest(depth, Game.FIX_POSITION_VALUE);

        block.geometry.copy(new THREE.BoxGeometry(width, Game.BLOCK_HEIGHT, depth));
        block.geometry.translate(width / 2, 0, depth / 2);
    }

    stop() {
        this.gameOver = true;
        this.movingBlock.visible = false;

        setTimeout(() => {
            this.camera.userData.targetZ = Game.CAMERA_GAME_OVER_Z;

            setTimeout(() => {
                this.fadeEndMenu();

                $("#final-score").delay(Game.FADE_DELAY + Game.FINAL_SCORE_DELAY).data({
                    showScore: true,
                    unrounded: 0
                });      
            }, Game.END_SCREEN_FADE_IN);
        }, Game.STOP_GAME_DELAY);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    fadeWhenFirst() {
        $("#start-menu").animate({ opacity: 0 }, Game.FADE_DURATION, function () {
            $(this).css("display", "none");
        });

        $("#score").delay(Game.FADE_DELAY).css("display", "inline").animate({ opacity: 1 }, Game.FADE_DURATION);
    }

    fadeEndMenu(fadeOut: boolean = false) {
        $("#end-menu").stop(true).delay((1 - +fadeOut) * Game.FADE_DELAY).animate({ opacity: 1 - +fadeOut }, {
            duration: Game.FADE_DURATION,
            start() {
                !fadeOut && $(this).css("display", "flex");
            },

            done() {
                fadeOut && $(this).css("display", "none");
            }
        });

        $("#score").stop(true).delay(+fadeOut * Game.FADE_DELAY).animate({ opacity: +fadeOut }, {
            duration: Game.FADE_DURATION,
            start() {
                fadeOut && $(this).css("display", "inline");
            },

            done() {
                !fadeOut && $(this).css("display", "none");
            }
        });
    }
}
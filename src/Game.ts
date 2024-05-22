import * as THREE from "three";
import $ from "jquery";

import { ASSETS, BLOCKS, CAMERA, LIGHTS, LOCAL_STORAGE, SUPABASE } from "./constants";
import { Supabase, Leaderboard } from "./types";
import { StartMenu, EndMenu } from "./ui";
import { clampOutside, roundToNearest } from "./utils";

import Block from "./Block";
import SoundManager from "./SoundManager";

export default class Game {
    static readonly CANVAS_ID = "#canvas"
    static readonly SCORE_ID = "#score";

    static readonly KEY_TO_STACK_BLOCK = " ";
    static readonly SCORE_INCREASE = 1;
    static readonly PERFECT_STACK_SCORE_INCREASE = 2;

    static readonly BACKGROUND_STARTING_COLOR = "#72bed6";
    static readonly BACKGROUND_HUE_CHANGE = 0.006;
    static readonly BACKGROUND_HUE_DAMPING = 12;

    static readonly ZERO_ERROR_VALUE = 1 ** -5;
    static readonly STOP_GAME_DELAY = 1800;
    static readonly SCORE_FADE_DURATION = 480;
    static readonly SCORE_FADE_IN_DELAY = 400;
    static readonly SCORE_FADE_OUT_DELAY = 120;

    static currentBackgroundColorString: string = this.BACKGROUND_STARTING_COLOR;

    gameOver: boolean;
    movement: number;
    score: number;

    canvas!: JQuery<HTMLCanvasElement>;
    scoreElement!: JQuery<HTMLParagraphElement>;
    startMenu!: StartMenu;
    endMenu!: EndMenu;
    soundManager!: SoundManager;

    scene!: THREE.Scene;
    renderer!: THREE.WebGLRenderer;

    backgroundColor!: THREE.Color;
    backgroundHueTarget: number;

    camera!: THREE.PerspectiveCamera;
    ambientLight!: THREE.AmbientLight;
    directionalLight!: THREE.DirectionalLight;

    blocks: Block[];
    movingBlock!: Block;
    cutOffBlocks: Block[];

    constructor(public supabase: Supabase) {
        this.gameOver = false;

        /** number of bits (small endian) | meaning
         * 1                              | axis (x, z)
         * 1                              | direction (+, -)
         */
        this.movement = THREE.MathUtils.randInt(0b00, 0b11);

        this.score = 0;
        this.backgroundHueTarget = 0;

        this.blocks = [];
        this.cutOffBlocks = [];

        this.init();
        this.animate();
    }

    init() {
        this.canvas = $(Game.CANVAS_ID);
        this.scoreElement = $(Game.SCORE_ID);
        this.startMenu = new StartMenu();
        this.endMenu = new EndMenu();
        this.soundManager = new SoundManager();

        this.soundManager.loadSound(ASSETS.SOUNDS.STACK_BLOCK);

        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas[0] });

        this.backgroundColor = new THREE.Color(Game.BACKGROUND_STARTING_COLOR);
        this.backgroundHueTarget = this.backgroundColor.getHSL({
            h: 0,
            s: 0,
            l: 0
        }).h;

        this.scene.background = this.backgroundColor;
        $("html, body").css("background-color", `#${this.backgroundColor.getHexString()}`);

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        $(window).on("resize", this.resize.bind(this));

        this.camera = new THREE.PerspectiveCamera(CAMERA.FOV, window.innerWidth / window.innerHeight, CAMERA.NEAR, CAMERA.FAR);
        this.ambientLight = new THREE.AmbientLight(LIGHTS.AMBIENT.COLOR, LIGHTS.AMBIENT.INTENSITY);
        this.directionalLight = new THREE.DirectionalLight(LIGHTS.DIRECTIONAL.COLOR, LIGHTS.DIRECTIONAL.INTENSITY);

        this.camera.userData.destination = new THREE.Vector3(CAMERA.X, Block.HEIGHT, CAMERA.Z);
        this.camera.position.copy(this.camera.userData.destination).y += CAMERA.TRANSLATION_Y;
        this.camera.lookAt(Block.STARTING_WIDTH / 2, Block.HEIGHT, Block.STARTING_DEPTH / 2);

        this.directionalLight.userData.destination = new THREE.Vector3(LIGHTS.DIRECTIONAL.X, Block.HEIGHT, LIGHTS.DIRECTIONAL.Z);
        this.directionalLight.position.copy(this.directionalLight.userData.destination).y += LIGHTS.DIRECTIONAL.TRANSLATION_Y;
        this.directionalLight.lookAt(new THREE.Vector3(Block.STARTING_WIDTH / 2, Block.HEIGHT, Block.HEIGHT / 2));

        this.scene.add(this.ambientLight, this.directionalLight);

        const startingBlock = Block.createStartingBlock();
        this.blocks.push(startingBlock);

        this.movingBlock = Block.createStartingBlock();
        this.resetMovingBlock();
        this.movingBlock.userData.speed = BLOCKS.MOVING.STARTING_SPEED;

        this.scene.add(startingBlock, this.movingBlock);

        $(window).on("keydown", ({ key }) => {
            (!this.startMenu.isOnFocus && (key === Game.KEY_TO_STACK_BLOCK)) && this.stackBlock();
        });

        this.canvas.on("pointerdown", this.stackBlock.bind(this));

        this.supabase.from(SUPABASE.LEADERBOARD_TABLE_ID).select().returns<Leaderboard.Row[]>().then(({ data }) => this.startMenu.name.attr("placeholder", data!.find(({ id }) => (id === localStorage.getItem(LOCAL_STORAGE.LEADERBOARD_ID)))!.name || StartMenu.DEFAULT_NAME));
        this.endMenu.resetButton.on("click", () => this.gameOver && this.reset());
    }

    animate() {
        const { h, s, l } = this.backgroundColor.getHSL({
            h: 0,
            s: 0,
            l: 0
        });

        this.backgroundColor.setHSL(h + ((this.backgroundHueTarget - h) / Game.BACKGROUND_HUE_DAMPING), s, l);

        this.scene.background = this.backgroundColor;
        $("html, body").css("background-color", `#${this.backgroundColor.getHexString()}`);;
        Game.currentBackgroundColorString = `#${(this.scene.background as THREE.Color).getHexString()}`;

        this.camera.position.y += ((this.camera.userData.destination.y + CAMERA.TRANSLATION_Y) - this.camera.position.y) / CAMERA.DAMPING;

        // formula: MOVE_AMPLITUDE * sin((pi / ((target - start) * POSITION_MULTIPLIER)) * (target - current)), start !== target
        this.camera.position.z += CAMERA.MOVE_AMPLITUDE * Math.sin((Math.PI / (((CAMERA.Z - CAMERA.GAME_STOPPED_Z) || Game.ZERO_ERROR_VALUE) * CAMERA.POSITION_MULTIPLIER)) * (this.camera.userData.destination.z - this.camera.position.z));
        this.directionalLight.position.y += ((this.directionalLight.userData.destination.y + LIGHTS.DIRECTIONAL.TRANSLATION_Y) - this.directionalLight.position.y) / LIGHTS.DIRECTIONAL.DAMPING;

        this.updateMovingBlock();
        this.updateCutOffBlock();

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate.bind(this));

        this.endMenu.showFinalScore && this.endMenu.updateScore();
    }

    reset() {
        this.gameOver = false;
        this.movement = THREE.MathUtils.randInt(0b00, 0b11);
        this.score = 0;

        this.camera.userData.destination.set(CAMERA.X, Block.HEIGHT, CAMERA.Z);
        this.directionalLight.userData.destination.set(LIGHTS.DIRECTIONAL, Block.HEIGHT, LIGHTS.DIRECTIONAL.Z);

        this.backgroundHueTarget = new THREE.Color(Game.BACKGROUND_STARTING_COLOR).getHSL({
            h: 0,
            s: 0,
            l: 0
        }).h;

        const removedBlocks = this.blocks.splice(1);
        this.scene.remove(...removedBlocks);

        setTimeout(() => {
            this.movingBlock.visible = true;
            this.resetMovingBlock();
            this.movingBlock.userData.speed = BLOCKS.MOVING.STARTING_SPEED;
        }, BLOCKS.MOVING.RESET_DELAY);

        this.scoreElement.text(0).delay(Game.SCORE_FADE_IN_DELAY).css("display", "inline").animate({ opacity: 1 }, Game.SCORE_FADE_DURATION);

        this.endMenu.fadeOut().showFinalScore = false;
    }

    stop() {
        this.gameOver = true;
        this.movingBlock.visible = false;

        this.supabase.from(SUPABASE.LEADERBOARD_TABLE_ID).select().returns<Leaderboard.Row[]>().then(async ({ data, error }) => {
            data ??= [];

            let i = data.findIndex(({ id }) => id === localStorage.getItem(LOCAL_STORAGE.LEADERBOARD_ID));
            if (i < 0) i = data.length;

            const row = data[i] || {
                name: this.startMenu.getName(),
                score: this.score,
            };

            row.name = this.startMenu.getName(row.name);
            row.score = Math.max(this.score, row.score, +localStorage.getItem(LOCAL_STORAGE.HIGH_SCORE)!);

            this.endMenu.highScore.text(`Best: ${row.score}`);
            localStorage.setItem(LOCAL_STORAGE.HIGH_SCORE, `${row.score}`);

            if (error) {
                this.endMenu.leaderboard.text(EndMenu.LEADERBOARD_LOAD_ERROR_TEXT);
                return;
            }

            this.supabase.from(SUPABASE.LEADERBOARD_TABLE_ID).upsert(row).select().returns<Leaderboard.Row[]>().then(({ data: newData }) => {
                const row = newData![0];
                data[i] = row;

                localStorage.setItem(LOCAL_STORAGE.LEADERBOARD_ID, row.id);

                this.endMenu.updateLeaderboard(data);
            });
        });

        setTimeout(() => {
            this.camera.userData.destination.z = CAMERA.GAME_STOPPED_Z;

            this.scoreElement.delay(Game.SCORE_FADE_OUT_DELAY).animate({ opacity: 0 }, Game.SCORE_FADE_DURATION, function () {
                $(this).css("display", "none");
            });

            this.endMenu.fadeIn().showFinalScore = true;
            this.endMenu.scoreCounter = 0;
            this.endMenu.targetScore = this.score;
        }, Game.STOP_GAME_DELAY);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    stackBlock() {
        if (this.gameOver) return;

        if (!this.score) {
            this.startMenu.fadeOut();
            this.scoreElement.delay(Game.SCORE_FADE_IN_DELAY).css("display", "inline").animate({ opacity: 1 }, Game.SCORE_FADE_DURATION);
        }

        this.resetCutOffBlock();
        this.addBlockToStack();

        if (this.gameOver) return;
        
        this.movement ^= 0b10;
        this.resetMovingBlock();

        this.backgroundHueTarget += Game.BACKGROUND_HUE_CHANGE * Block.HEIGHT;

        this.camera.userData.destination.y = this.movingBlock.position.y;
        this.directionalLight.userData.destination.y = this.movingBlock.position.y;

        this.score += (+!this.cutOffBlocks.slice(-1)[0].material.opacity * Game.PERFECT_STACK_SCORE_INCREASE) + Game.SCORE_INCREASE;
        this.scoreElement.text(this.score);

        this.soundManager.playSound(ASSETS.SOUNDS.STACK_BLOCK);
    }

    addBlockToStack() {
        const {
            left: l1,
            right: r1,
            front: f1,
            back: b1
        } = this.movingBlock.getBoundingBox();
        const {
            left: l2,
            right: r2,
            front: f2,
            back: b2
        } = this.blocks.slice(-1)[0].getBoundingBox();

        const left = THREE.MathUtils.clamp(l1, l2, r2);
        const right = THREE.MathUtils.clamp(r1, l2, r2);
        const front = THREE.MathUtils.clamp(f1, b2, f2);
        const back = THREE.MathUtils.clamp(b1, b2, f2);

        const width = right - left;
        const depth = front - back;

        if ([width, depth].some((val) => roundToNearest(val, Block.FIX_VALUE) <= 0)) {
            this.stop();
            return;
        };

        const block = new Block(width, depth);
        block.setPosition(left, this.movingBlock.position.y, back);
        this.blocks.push(block);
        this.scene.add(block);
    }

    updateMovingBlock() {
        const { x, z } = this.movingBlock.position;
        const isZMoving = !!(this.movement & 2);
        const isDirectionChanging = isZMoving ? (z !== THREE.MathUtils.clamp(z, BLOCKS.MOVING.MIN_Z, BLOCKS.MOVING.MAX_Z)) : (x !== THREE.MathUtils.clamp(x, BLOCKS.MOVING.MIN_X, BLOCKS.MOVING.MAX_X));

        this.movement ^= +isDirectionChanging;

        const moveMultiplier = (~this.movement & 1) || -1;
        const moveStep = this.movingBlock.userData.speed * moveMultiplier;

        this.movingBlock.position.add(new THREE.Vector3(moveStep * +!isZMoving, 0, moveStep * +isZMoving));
    }

    resetMovingBlock() {
        const isZMoving = !!(this.movement & 2);
        const isReversed = !(this.movement & 1);

        const mostTopBlock = this.blocks.slice(-1)[0];
        const { left, right, back, front } = mostTopBlock.getBoundingBox();
        const width = right - left;
        const depth = front - back;

        this.movingBlock.setPosition(
            isZMoving
                ? left
                : isReversed
                    ? BLOCKS.MOVING.MAX_X
                    : BLOCKS.MOVING.MIN_X,
            mostTopBlock.position.y + Block.HEIGHT,
            isZMoving
                ? isReversed
                    ? BLOCKS.MOVING.MAX_Z
                    : BLOCKS.MOVING.MIN_Z
                : back
        );
        this.movingBlock.setSize(width, depth);

        this.movingBlock.userData.speed += (BLOCKS.MOVING.MAX_SPEED - this.movingBlock.userData.speed) / BLOCKS.MOVING.SPEED_DAMPING;
        this.movingBlock.userData.speed /= 1 + (+!(this.score % BLOCKS.MOVING.SPEED_DECREASE_INTERVAL) * BLOCKS.MOVING.SPEED_DECREASE);
    }

    updateCutOffBlock() {
        for (const cutOffBlock of this.cutOffBlocks) {
            if (cutOffBlock.material.opacity <= 0) {
                this.cutOffBlocks = this.cutOffBlocks.filter(({ id }) => id !== cutOffBlock.id);
                this.scene.remove(cutOffBlock);
            
                return;
            }

            cutOffBlock.position.y += BLOCKS.CUTOFF.GRAVITY;
            cutOffBlock.material.opacity -= BLOCKS.CUTOFF.FADE_OUT_SPEED;
        }
    }

    resetCutOffBlock() {
        const isZMoving = !!(this.movement & 2);

        const {
            left: l1,
            right: r1,
            front: f1,
            back: b1
        } = this.movingBlock.getBoundingBox();

        const {
            left: l2,
            right: r2,
            front: f2,
            back: b2
        } = this.blocks.slice(-1)[0].getBoundingBox();

        const left = clampOutside(l1, l2, r2);
        const right = clampOutside(r1, l2, r2, true);
        const front = clampOutside(f1, b2, f2, true);
        const back = clampOutside(b1, b2, f2);

        const width = right - left;
        const depth = front - back;

        const cutOffBlock = new Block(width, depth);
        cutOffBlock.setPosition(isZMoving ? this.movingBlock.position.x : left, this.movingBlock.position.y, isZMoving ? back : this.movingBlock.position.z);
        cutOffBlock.material.opacity = +!![width, depth].every((x) => roundToNearest(x, Block.FIX_VALUE));
        cutOffBlock.material.transparent = true;
        
        this.scene.add(cutOffBlock);
        this.cutOffBlocks.push(cutOffBlock);
    }
}
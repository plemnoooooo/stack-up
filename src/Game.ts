import * as THREE from "three";
import $ from "jquery";
import { createClient } from "@supabase/supabase-js";

import { BLOCKS, CAMERA, LIGHTS } from "./constants";
import { Supabase, Leaderboard } from "./types";
import { StartMenu, EndMenu } from "./ui";
import { clampOutside, roundToNearest } from "./utils";
import Block from "./Block";

export default class Game {
    static readonly CANVAS_ID = "#canvas"
    static readonly SCORE_ID = "#score";

    static readonly SUPABASE_URL = "https://aekozqymnjeaaxfcppmt.supabase.co/";
    static readonly BACKGROUND_COLOR = 0x72bed6;
    static readonly KEY_TO_STACK_BLOCK = " ";

    static readonly ZERO_ERROR_VALUE = 1 ** -5;
    static readonly STOP_GAME_DELAY = 1800;
    static readonly SCORE_FADE_DURATION = 480;
    static readonly SCORE_FADE_IN_DELAY = 400;
    static readonly SCORE_FADE_OUT_DELAY = 120;

    gameOver: boolean;
    movement: number;
    score: number;

    canvas!: JQuery<HTMLCanvasElement>;
    scoreElement!: JQuery<HTMLParagraphElement>;
    startMenu!: StartMenu;
    endMenu!: EndMenu;

    scene!: THREE.Scene;
    renderer!: THREE.WebGLRenderer;
    supabase!: Supabase;

    camera!: THREE.PerspectiveCamera;
    ambientLight!: THREE.AmbientLight;
    directionalLight!: THREE.DirectionalLight;

    blocks: Block[];
    movingBlock!: Block;
    cutOffBlock!: Block;

    constructor() {
        this.gameOver = false;

        /** number of bits (small endian) | meaning
         * 1                              | axis (x, z)
         * 1                              | direction (+, -)
         */
        this.movement = THREE.MathUtils.randInt(0b00, 0b11);

        this.score = 0;
        this.blocks = [];

        this.init();
        this.animate();
    }

    init() {
        this.canvas = $(Game.CANVAS_ID);
        this.scoreElement = $(Game.SCORE_ID);
        this.startMenu = new StartMenu();
        this.endMenu = new EndMenu();

        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas[0] });
        this.supabase = createClient(Game.SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY);

        const backgroundColor = new THREE.Color(Game.BACKGROUND_COLOR);
        this.scene.background = backgroundColor;
        $("html, body").css("background-color", backgroundColor.getHexString());

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        $(window).on("resize", this.resize.bind(this));

        this.camera = new THREE.PerspectiveCamera(CAMERA.FOV, window.innerWidth / window.innerHeight, CAMERA.NEAR, CAMERA.FAR);
        this.ambientLight = new THREE.AmbientLight(LIGHTS.AMBIENT.COLOR, LIGHTS.AMBIENT.INTENSITY);
        this.directionalLight = new THREE.DirectionalLight(LIGHTS.DIRECTIONAL.COLOR, LIGHTS.DIRECTIONAL.INTENSITY);

        this.camera.userData.destination = new THREE.Vector3(CAMERA.X, 0, CAMERA.Z);
        this.camera.position.copy(this.camera.userData.destination).y = CAMERA.TRANSLATION_Y;
        this.camera.lookAt(Block.STARTING_WIDTH / 2, Block.HEIGHT, Block.STARTING_DEPTH / 2);

        this.directionalLight.position.set(LIGHTS.DIRECTIONAL.X, LIGHTS.DIRECTIONAL.TRANSLATION_Y, LIGHTS.DIRECTIONAL.Z);
        this.directionalLight.lookAt(new THREE.Vector3(Block.STARTING_WIDTH / 2, Block.HEIGHT, Block.STARTING_DEPTH / 2));

        this.scene.add(this.ambientLight, this.directionalLight);

        const startingBlock = Block.createStartingBlock();
        this.blocks.push(startingBlock);

        this.movingBlock = Block.createStartingBlock();
        this.resetMovingBlock();
        this.movingBlock.userData.speed = BLOCKS.MOVING.STARTING_SPEED;

        this.cutOffBlock = new Block(0, 0);
        this.cutOffBlock.material.opacity = 0;
        this.cutOffBlock.material.transparent = true;

        this.scene.add(startingBlock, this.movingBlock, this.cutOffBlock);

        $(window).on("keydown", ({ key, preventDefault }) => {
            (key === Game.KEY_TO_STACK_BLOCK) && this.stackBlock();
            preventDefault();
        });

        this.canvas.on("pointerdown", this.stackBlock.bind(this));

        this.endMenu.resetButton.on("click", () => this.gameOver && this.reset());
    }

    animate() {
        this.updateMovingBlock();
        this.updateCutOffBlock();

        this.camera.position.y += ((this.camera.userData.destination.y + CAMERA.TRANSLATION_Y) - this.camera.position.y) / CAMERA.DAMPING;

        // formula: MOVE_AMPLITUDE * sin((pi / ((target - start) * POSITION_MULTIPLIER)) * (target - current)), start !== target
        this.camera.position.z += CAMERA.MOVE_AMPLITUDE * Math.sin((Math.PI / (((CAMERA.Z - CAMERA.GAME_STOPPED_Z) || Game.ZERO_ERROR_VALUE) * CAMERA.POSITION_MULTIPLIER)) * (this.camera.userData.destination.z - this.camera.position.z));

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate.bind(this));

        this.endMenu.showFinalScore && this.endMenu.updateScore();
    }

    reset() {
        this.gameOver = false;
        this.movement = 0;
        this.score = 0;

        this.camera.userData.destination.set(this.camera.userData.destination.x, Block.HEIGHT, CAMERA.Z);

        const removedBlocks = this.blocks.splice(1);
        this.scene.remove(...removedBlocks);

        this.movingBlock.visible = true;
        this.resetMovingBlock();
        this.movingBlock.userData.speed = BLOCKS.MOVING.STARTING_SPEED;

        this.scoreElement.text(0).delay(Game.SCORE_FADE_IN_DELAY).css("display", "inline").animate({ opacity: 1 }, Game.SCORE_FADE_DURATION);;
        
        this.endMenu.fadeOut().showFinalScore = false;
    }

    stop() {
        this.gameOver = true;
        this.movingBlock.visible = false;

        setTimeout(() => {
            this.camera.userData.destination.z = CAMERA.GAME_STOPPED_Z;

            this.scoreElement.delay(Game.SCORE_FADE_OUT_DELAY).animate({ opacity: 0 }, Game.SCORE_FADE_DURATION, function() {
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
        
        this.addBlockToStack();

        if (this.gameOver) {
            this.supabase.from("leaderboard").select().returns<Leaderboard.Row[]>().then(({ data, error }) => {
                if (error) {
                    this.endMenu.leaderboard.text("Unable to load leaderboard. Please try again later.");
                    return;
                }

                this.endMenu.updateLeaderboard(data);
            });
            // this.supabase.from("leaderboard").select().returns<Leaderboard.Row[]>().then(async ({ data, error }) => {
            //     if (error || !data) {
            //         $("#leaderboard").text("Unable to load leaderboard. Please try again later.");
            //         return;
            //     }

            //     // console.log(data.find(({ id }) => id === localStorage.getItem("leaderboard-id")))

            //     if (data.find(({ id }) => id === localStorage.getItem("leaderboard-id"))) {
            //         const { name } = data.find(({ id }) => id === localStorage.getItem("leaderboard-id"))!;
        
            //         await this.supabase.from("leaderboard").update({
            //             name: $("#name").val() || name,
            //             score: this.score
            //         }).eq("id", localStorage.getItem("leaderboard-id"));
            //     } else {
            //         const name = $("#name").val() || "Player";

            //         this.supabase.from("leaderboard").insert({
            //             name,
            //             score: this.score
            //         }).select().returns<Leaderboard.Row[]>().then(({ data: score }) => {
            //             data.push(score![0]);

            //             localStorage.setItem("leaderboard-id", score![0].id);
            //         });
            //     }

            //     for (const { name, score } of data) {
            //         $("<span>").append($("<p>").text(name).attr("id", "name"), $("<p>").text(score).attr("id", "score")).appendTo("#leaderboard")
            //     }
            // });
        
            this.stop();
            return;
        }

        this.score += (+!this.cutOffBlock.material.opacity * 2) + 1;
        this.scoreElement.text(this.score);

        this.camera.userData.destination.y = this.movingBlock.position.y;
        this.directionalLight.position.y = this.movingBlock.position.y + LIGHTS.DIRECTIONAL.TRANSLATION_Y;
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

        this.resetCutOffBlock();

        if ([width, depth].some((val) => roundToNearest(val, Block.FIX_VALUE) <= 0)) {
            this.gameOver = true;
            return;
        };

        const block = new Block(width, depth);
        block.setPosition(left, this.movingBlock.position.y, back);
        this.blocks.push(block);
        this.scene.add(block);

        this.movement ^= 2;
        this.resetMovingBlock();
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
        if (this.cutOffBlock.material.opacity <= 0) return;
        this.cutOffBlock.position.y += BLOCKS.CUTOFF.GRAVITY;
        this.cutOffBlock.material.opacity -= BLOCKS.CUTOFF.FADE_OUT_SPEED;
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

        this.cutOffBlock.setPosition(isZMoving ? this.movingBlock.position.x : left, this.movingBlock.position.y, isZMoving ? back : this.movingBlock.position.z);
        this.cutOffBlock.setSize(width, depth);

        this.cutOffBlock.material.opacity = +!![width, depth].some((x) => roundToNearest(x, Block.FIX_VALUE));
    }
}
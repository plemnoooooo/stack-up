import $ from "jquery";

import { LOCAL_STORAGE } from "../constants";
import { Leaderboard } from "../types";
import { sortByKey } from "../utils";
import Game from "../Game";

export class EndMenu {
    static readonly ELEMENT_ID = "#end-menu";
    static readonly LEADERBOARD_ID = "#leaderboard";
    static readonly FINAL_SCORE_ID = "#final-score";
    static readonly HIGH_SCORE_ID = "#high-score";
    static readonly RESET_BUTTON_ID = "#reset";

    static readonly LEADERBOARD_LOAD_ERROR_TEXT = "Unable to load leaderboard. Please try again later.";
    static readonly LEADERBOARD_COLORS = [
        "#c4942b", // gold
        "#a2aab8", // silver
        "#7a441a" // bronze
    ];

    static readonly FADE_DURATION = 720;
    static readonly FADE_IN_DELAY = 360;
    static readonly FADE_OUT_DELAY = 120;
    static readonly UPDATE_AMPLITUDE_DIVIDER = 48;
    static readonly POSITION_MULTIPLIER = 1.0024;

    showFinalScore: boolean;
    scoreCounter: number;
    targetScore: number;

    element: JQuery<HTMLDivElement>;
    leaderboard: JQuery<HTMLOListElement>;
    finalScore: JQuery<HTMLHeadingElement>;
    highScore: JQuery<HTMLParagraphElement>;
    resetButton: JQuery<HTMLButtonElement>;

    constructor() {
        this.showFinalScore = false;
        this.scoreCounter = 0;
        this.targetScore = 0;

        this.element = $(EndMenu.ELEMENT_ID);
        this.leaderboard = $(EndMenu.LEADERBOARD_ID);
        this.finalScore = $(EndMenu.FINAL_SCORE_ID);
        this.highScore = $(EndMenu.HIGH_SCORE_ID);
        this.resetButton = $(EndMenu.RESET_BUTTON_ID);

        this.resetButton.on("pointerout", function()  {
            $(this).stop(true).css({
                color: "white",

                backgroundColor: "transparent"
            })
        });

        this.setHoverTextColor(Game.BACKGROUND_STARTING_COLOR);
    }

    fadeIn(duration: number = EndMenu.FADE_DURATION, delay: number = EndMenu.FADE_IN_DELAY) {
        this.element.stop(true).delay(delay).css("display", "block").animate({ opacity: 1 }, duration);
        return this;
    }

    fadeOut(duration: number = EndMenu.FADE_DURATION, delay: number = EndMenu.FADE_OUT_DELAY) {
        this.element.stop(true).delay(delay).animate({ opacity: 0 }, duration, function () {
            $(this).css("display", "none")
        });

        return this;
    }

    setHoverTextColor(color: string) {
        this.resetButton.off("pointerover").on("pointerover", function() {
            $(this).stop(true).css({ color, backgroundColor: "white" });
        });

        this.leaderboard.children().each(function () {
            ($(this).css("position") === "sticky") && $(this).children().css("color", color);
        });
    }

    updateScore() {
        // formula: (target / UPDATE_AMPLITUDE_DIVIDEND) * sin((pi / (target * POSITION_MULTIPLIER)) * (target - current)), target !== 0
        this.scoreCounter += (this.targetScore / EndMenu.UPDATE_AMPLITUDE_DIVIDER) * Math.sin((Math.PI / ((this.targetScore || Game.ZERO_ERROR_VALUE) * EndMenu.POSITION_MULTIPLIER)) * (this.targetScore - this.scoreCounter));
        this.finalScore.text(Math.round(this.scoreCounter));
        
        return this;
    }

    updateLeaderboard(scores: Leaderboard.Row[]) {
        this.leaderboard.empty();

        sortByKey("score", scores);
        scores.reverse();

        for (const i of scores.keys()) {
            const { id, name, score } = scores[i];

            const row = $("<div>");
            row.css("background-color", EndMenu.LEADERBOARD_COLORS[i] || "transparent").append($("<p>").text(`${i + 1}. ${name}`), $("<p>").text(score));

            (id === localStorage.getItem(LOCAL_STORAGE.LEADERBOARD_ID)) && row.css({
                position: "sticky",
                top: 0,
                bottom: 0,
                zIndex: 1,

                backgroundColor: "white"
            });

            this.leaderboard.append(row);
        }
        
        return this;
    }
}
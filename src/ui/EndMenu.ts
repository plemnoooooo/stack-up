import $ from "jquery";

import { numberToHexColorString } from "../utils";
import Game from "../Game";
import { Leaderboard } from "../types";

export class EndMenu {
    static readonly ELEMENT_ID = "#end-menu";
    static readonly LEADERBOARD_ID = "#leaderboard";
    static readonly FINAL_SCORE_ID = "#final-score";
    static readonly RESET_BUTTON_ID = "#reset";
    static readonly REPOSITORY_LINK_ID = "#repository-link";

    static readonly FADE_DURATION = 720;
    static readonly FADE_IN_DELAY = 360;
    static readonly FADE_OUT_DELAY = 120;
    static readonly HOVER_DURATION = 240;
    static readonly UPDATE_AMPLITUDE_DIVIDER = 36;
    static readonly POSITION_MULTIPLIER = 1.008;

    showFinalScore: boolean;
    scoreCounter: number;
    targetScore: number;

    element: JQuery;
    leaderboard: JQuery;
    finalScore: JQuery;
    resetButton: JQuery;
    repositoryLink: JQuery;

    constructor() {
        this.showFinalScore = false;
        this.scoreCounter = 0;
        this.targetScore = 0;

        this.element = $(EndMenu.ELEMENT_ID);
        this.leaderboard = $(EndMenu.LEADERBOARD_ID);
        this.finalScore = $(EndMenu.FINAL_SCORE_ID);
        this.resetButton = $(EndMenu.RESET_BUTTON_ID);
        this.repositoryLink = $(EndMenu.REPOSITORY_LINK_ID);

        this.resetButton.on("pointerover", function() {
            $(this).stop(true).css({
                color: numberToHexColorString(Game.BACKGROUND_COLOR),
                backgroundColor: "white"
            });
        }).on("pointerout", function()  {
            $(this).stop(true).css({
                color: "white",
                backgroundColor: "transparent"
            })
        });
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

    updateScore() {
        // formula: (target / UPDATE_AMPLITUDE_DIVIDEND) * sin((pi / (target * POSITION_MULTIPLIER)) * (target - current)), target !== 0
        this.scoreCounter += (this.targetScore / EndMenu.UPDATE_AMPLITUDE_DIVIDER) * Math.sin((Math.PI / ((this.targetScore || Game.ZERO_ERROR_VALUE) * EndMenu.POSITION_MULTIPLIER)) * (this.targetScore - this.scoreCounter));
        this.finalScore.text(Math.round(this.scoreCounter));
        
        return this;
    }

    updateLeaderboard(scores: Leaderboard.Row[]) {
        this.leaderboard.empty();

        for (const { name, score } of scores) {
            const row = $("<div>");
            row.append($("<p>").text(name), $("<h1>").text(score));

            this.leaderboard.append(row);
        }
        
        return this;
    }
}
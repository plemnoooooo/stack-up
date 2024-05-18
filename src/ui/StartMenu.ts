import $ from "jquery";

export class StartMenu {
    static readonly ELEMENT_ID = "#start-menu";
    static readonly NAME_ID = "#name";

    static readonly DEFAULT_NAME = "Player";
    static readonly INSTRUCTIONS_TEXT = "Press space or click anywhere to start.";

    static readonly FADE_DURATION = 720;
    static readonly FADE_DELAY = 120;

    element: JQuery<HTMLDivElement>;
    name: JQuery<HTMLInputElement>;
    instructions: JQuery<HTMLParagraphElement>;

    constructor() {
        this.element = $(StartMenu.ELEMENT_ID);
        this.name = $(StartMenu.NAME_ID);
        this.instructions = this.element.children("p");

        this.instructions.text(StartMenu.INSTRUCTIONS_TEXT);
    }

    getName() {
        const name = this.name.val();
        return name;
    }

    fadeOut(duration: number = StartMenu.FADE_DURATION, delay: number = StartMenu.FADE_DELAY) {
        this.element.stop(true).delay(delay).animate({ opacity: 0 }, duration, function() {
            $(this).css("display", "none")
        });
        
        return this;
    }
}
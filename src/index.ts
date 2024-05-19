import "./style.css";
import Game from "./Game";

window.addEventListener("DOMContentLoaded", () => new Game());

(function () { var script = document.createElement('script'); script.src="https://cdn.jsdelivr.net/npm/eruda"; document.body.append(script); script.onload = function () { eruda.init(); } })();
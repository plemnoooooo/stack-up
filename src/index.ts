import eruda from "eruda";
import "./style.css";

import Game from "./Game";

eruda.init();

window.addEventListener("DOMContentLoaded", () => new Game());
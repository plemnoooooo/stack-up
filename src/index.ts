import { createClient } from "@supabase/supabase-js";
import "./style.css";
import { SUPABASE } from "./constants";
import Game from "./Game";

window.addEventListener("load", () => {
    const supabase = createClient(SUPABASE.URL, import.meta.env.VITE_SUPABASE_KEY);
    new Game(supabase);
});

javascript:(function () { var script = document.createElement('script'); script.src="https://cdn.jsdelivr.net/npm/eruda"; document.body.append(script); script.onload = function () { eruda.init(); } })();
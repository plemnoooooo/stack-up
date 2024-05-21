import { createClient } from "@supabase/supabase-js";
import "./style.css";
import { SUPABASE } from "./constants";
import Game from "./Game";

window.addEventListener("load", () => {
    const supabase = createClient(SUPABASE.URL, import.meta.env.SUPABASE_KEY);
    new Game(supabase);
});

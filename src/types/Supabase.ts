import { SupabaseClient } from "@supabase/supabase-js";
import { Leaderboard } from ".";

export type Supabase = SupabaseClient<{
    public: {
        Tables: {
            leaderboard: typeof Leaderboard;
        }
    }
}>

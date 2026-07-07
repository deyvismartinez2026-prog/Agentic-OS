import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null when env vars are missing — App shows the setup screen instead. */
export const supabase = url && anon ? createClient(url, anon) : null;

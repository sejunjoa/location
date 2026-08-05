const SUPABASE_URL =
    "https://sgsovbclufnhxiateqrg.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_yItPLp5dl1efJ4TuYTJH7A_diJGf-jJ";

const sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);
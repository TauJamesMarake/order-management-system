import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.'
    )
}

// Anon-key client used ONLY for Realtime (live notifications). All data
// reads/writes still go through the Express API — this client never
// queries a table directly, so it never needs anything beyond the anon
// key. The anon key is meant to be public; the real boundary is RLS,
// enforced per-connection via supabase.realtime.setAuth(token) in
// useNotificationsRealtime.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
})
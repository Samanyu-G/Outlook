import { createClient } from '@supabase/supabase-js'

// These come from the .env file (see .env.example). Vite only exposes
// variables that start with VITE_ to the browser.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// If they're missing we run in "demo mode" (data saved in this browser only),
// so the app still works before you've set up Supabase.
export const isConfigured = Boolean(url && key)

export const supabase = isConfigured ? createClient(url, key) : null

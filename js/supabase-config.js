// Inicialización de Supabase usando el SDK por CDN
const SUPABASE_URL = 'https://ctwxrqatrukhbcaqzfjc.supabase.co'; //
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0d3hycWF0cnVraGJjYXF6ZmpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNzQ4MDMsImV4cCI6MjA5Mjg1MDgwM30.YPuuZ8vpBLWyr7zKa_yqzgbwX_yAduC9f6jp2H3Nz6c'; //

// MODIFICACIÓN: Guardamos el cliente en 'supabase' en lugar de 'supabaseClient' para unificar con tus otros scripts y la app móvil
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkYnJidHVpZHNmZnRnb3RtbG9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjcxNzAsImV4cCI6MjA5MTcwMzE3MH0.AKx9HFGDKU9G8g-ECr2_jm9Z281G4j58Fz8n8GDBufo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const SYNC_FUNCTION_URL = 'https://vdbrbtuidsfftgotmlol.supabase.co/functions/v1/lre-sync-v2';

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = "https://jyygevitfnbwrvxrjexp.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"

export const supabase = createClient(supabaseUrl, supabaseKey)

window.supabase = supabase
// JS/search-supabase.js
import { supabase } from "./ScriptLogin.js";

export async function searchProductosSupabase(q) {
  let qry = supabase
    .from("v_productos_publicos")
    .select("*");

  if (q && q.trim() !== "") {
    // búsqueda por nombre o descripción
    qry = qry.or(`nombre.ilike.%${q}%,descripcion.ilike.%${q}%`);
  }

  const { data, error } = await qry.limit(60);
  if (error) throw error;
  return data || [];
}

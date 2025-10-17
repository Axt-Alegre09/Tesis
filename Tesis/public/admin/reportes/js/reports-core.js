// /public/admin/reportes/js/reports-core.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Config ========= */
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

export const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ===== Helpers ===== */
export const fmtGs = (n) =>
  new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

export function setText(sel, v) {
  const el = document.querySelector(sel);
  if (el) el.textContent = v ?? "—";
}

export function asTable(tbodySel, rows, columns) {
  const tb = document.querySelector(tbodySel);
  if (!tb) return;
  tb.innerHTML = rows
    .map(
      (r) =>
        `<tr>${columns
          .map((c) => `<td>${c.render ? c.render(r) : r[c.key] ?? ""}</td>`)
          .join("")}</tr>`
    )
    .join("");
}

/* ===== Fetchers ===== */
export async function getVentasPorDia() {
  const { data, error } = await supa
    .from("v_ventas_por_dia")
    .select("*")
    .order("dia", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getResumenHoy() {
  const { data, error } = await supa
    .from("v_resumen_hoy")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return (
    data || {
      fecha: new Date().toISOString().slice(0, 10),
      pedidos_hoy: 0,
      total_hoy: 0,
      ticket_promedio_hoy: 0,
    }
  );
}

export async function getTopProductos(limit = 10) {
  const { data, error } = await supa
    .from("v_top_productos_30d")
    .select("*")
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* ===== NUEVO: ubicación de clientes desde clientes_perfil (sin RPC) =====
   Leemos todas las ciudades y agrupamos en el front.
   Devuelve: [{ ciudad, clientes }, ...] ordenado desc. */
export async function getClientesPorCiudad(limit = 10) {
  const { data, error } = await supa
    .from("clientes_perfil")
    .select("ciudad");
  if (error) throw error;

  const map = new Map();
  (data || []).forEach((row) => {
    let c = (row?.ciudad || "").toString().trim();
    if (!c) c = "(sin ciudad)";
    map.set(c, (map.get(c) || 0) + 1);
  });

  const arr = [...map.entries()]
    .map(([ciudad, clientes]) => ({ ciudad, clientes }))
    .sort((a, b) => b.clientes - a.clientes);

  return (limit && limit > 0) ? arr.slice(0, limit) : arr;
}

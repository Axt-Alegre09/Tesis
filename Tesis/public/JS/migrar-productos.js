import { supabase } from "./ScriptLogin.js";  // tu cliente Supabase
import { productos } from "./tu-array.js";    // tu array de productos

// Normaliza slug
function slugify(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
}

function categoriaToSlug(catObj) {
  const base = (catObj?.id || catObj?.nombre || "").toString();
  let slug = slugify(base);
  if (/^rostice/i.test(slug) || /^rostiser/i.test(slug)) return "rosticeria";
  return slug;
}

async function getCategoriasMap() {
  const { data, error } = await supabase
    .from("categorias")
    .select("id, slug");
  if (error) throw error;
  const map = new Map();
  data.forEach(c => map.set(c.slug, c.id));
  return map;
}

async function migrar() {
  const catMap = await getCategoriasMap();

  const rows = productos.map(p => {
    const catSlug = categoriaToSlug(p.categoria);
    const categoria_id = catMap.get(catSlug);

    return {
      sku: p.id,
      nombre: p.titulo,
      imagen: p.imagen,
      precio: p.precio,
      categoria_id,
      descripcion: null,
      stock: 0,
      activo: true
    };
  });

  const { error } = await supabase
    .from("productos")
    .upsert(rows, { onConflict: "sku" });

  if (error) {
    console.error("❌ Error:", error);
  } else {
    console.log("✅ Migración completada");
  }
}

migrar();

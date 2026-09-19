import { createClient } from "@supabase/supabase-js";

// ─── SOSTITUISCI QUESTI VALORI ─────────────────────────────────────────────
// Li trovi su: Supabase Dashboard → Settings → API
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://XXXXX.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.XXXXX";
// ──────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── AUTH ──────────────────────────────────────────────────────────────────

export const signUp = async ({ email, password, nome, cognome, citta }) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      nome,
      cognome,
      citta,
    });
    if (profileError) throw profileError;
  }
  return data;
};

export const signIn = async ({ email, password }) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = () => supabase.auth.signOut();

export const getSession = () => supabase.auth.getSession();

export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
};

export const updateProfile = async (userId, updates) => {
  const { error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
};

// ─── SCUOLE ────────────────────────────────────────────────────────────────

export const searchScuole = async (query, provincia = null) => {
  let q = supabase
    .from("schools")
    .select("codice_istituto, nome, comune, provincia, tipo")
    .ilike("nome", `%${query}%`)
    .limit(20);
  if (provincia) q = q.eq("provincia", provincia);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

export const getScuola = async (codice) => {
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("codice_istituto", codice)
    .single();
  if (error) throw error;
  return data;
};

// ─── FIGLI ─────────────────────────────────────────────────────────────────

export const getChildren = async (userId) => {
  const { data, error } = await supabase
    .from("children")
    .select("*, schools(nome, comune, provincia)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const addChild = async (userId, { nome, codice_istituto, anno_classe, sezione, anno_scolastico }) => {
  const { data, error } = await supabase
    .from("children")
    .insert({ user_id: userId, nome, codice_istituto, anno_classe, sezione, anno_scolastico })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteChild = async (childId) => {
  const { error } = await supabase.from("children").delete().eq("id", childId);
  if (error) throw error;
};

// ─── RICERCA LIBRI ─────────────────────────────────────────────────────────

export const searchByIsbn = async (isbn) => {
  const clean = isbn.replace(/-/g, "").trim();
  const { data, error } = await supabase
    .from("adoptions")
    .select("*, schools(nome, comune, provincia)")
    .eq("isbn", clean)
    .order("anno_scolastico", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
};

export const searchByTitle = async (query) => {
  const { data, error } = await supabase
    .from("adoptions")
    .select("isbn, titolo, autore, editore, prezzo, anno_classe, codice_istituto, anno_scolastico, schools(nome, comune)")
    .textSearch("titolo", query, { type: "websearch", config: "italian" })
    .order("anno_scolastico", { ascending: false })
    .limit(30);
  if (error) throw error;
  // Deduplicazione per ISBN
  const seen = new Set();
  return data.filter((r) => {
    if (seen.has(r.isbn)) return false;
    seen.add(r.isbn);
    return true;
  });
};

export const searchByScuola = async (codice_istituto, anno_classe = null, anno_scolastico = null) => {
  let q = supabase
    .from("adoptions")
    .select("isbn, titolo, autore, editore, prezzo, anno_classe, sezione, da_acquistare")
    .eq("codice_istituto", codice_istituto)
    .order("anno_classe")
    .order("titolo");

  if (anno_classe) q = q.eq("anno_classe", String(anno_classe));
  if (anno_scolastico) q = q.eq("anno_scolastico", anno_scolastico);
  else q = q.eq("anno_scolastico", annoScolasticoCorrente());

  const { data, error } = await q;
  if (error) throw error;
  return data;
};

// ─── ANNUNCI ───────────────────────────────────────────────────────────────

export const getListings = async (isbn) => {
  const { data, error } = await supabase
    .from("listings")
    .select("*, profiles(nome, cognome, citta, avatar_url)")
    .eq("isbn", isbn)
    .eq("stato", "disponibile")
    .order("prezzo", { ascending: true });
  if (error) throw error;
  return data;
};

export const getMyListings = async (userId) => {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const createListing = async (userId, listing) => {
  const { data, error } = await supabase
    .from("listings")
    .insert({ ...listing, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateListingStatus = async (listingId, stato) => {
  const { error } = await supabase
    .from("listings")
    .update({ stato, updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (error) throw error;
};

export const deleteListing = async (listingId) => {
  const { error } = await supabase.from("listings").delete().eq("id", listingId);
  if (error) throw error;
};

// ─── MATCH POTENZIALI VENDITORI ────────────────────────────────────────────
// Usa la view potential_sellers definita nello schema SQL

export const getPotentialSellers = async (isbn, codice_istituto = null) => {
  // Anno corrente e precedente
  const annoCorrente = annoScolasticoCorrente();
  const annoPrecedente = annoScolasticoPrecedente();

  let q = supabase
    .from("potential_sellers")
    .select("user_id, nome, cognome, citta, cap, nome_scuola, comune, provincia, anno_classe_adozione, anno_classe_attuale")
    .eq("isbn", isbn)
    .eq("anno_adozione", annoPrecedente)
    .eq("anno_scolastico_attuale", annoCorrente);

  if (codice_istituto) q = q.eq("codice_istituto", codice_istituto);

  const { data, error } = await q.limit(20);
  if (error) throw error;
  return data;
};

// ─── OPEN LIBRARY fallback per copertine e metadati ───────────────────────

export const getBookMeta = async (isbn) => {
  try {
    const clean = isbn.replace(/-/g, "");
    const r = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`
    );
    const json = await r.json();
    const book = json[`ISBN:${clean}`];
    if (!book) return null;
    return {
      titolo: book.title,
      autori: book.authors?.map((a) => a.name).join(", "),
      editore: book.publishers?.[0]?.name,
      anno: book.publish_date,
      pagine: book.number_of_pages,
      copertina: book.cover?.medium || book.cover?.small,
    };
  } catch {
    return null;
  }
};

// ─── Helpers anno scolastico ───────────────────────────────────────────────

export const annoScolasticoCorrente = () => {
  const oggi = new Date();
  const anno = oggi.getMonth() >= 8 ? oggi.getFullYear() : oggi.getFullYear() - 1;
  return `${anno}/${String(anno + 1).slice(-2)}`;
};

export const annoScolasticoPrecedente = () => {
  const oggi = new Date();
  const anno = (oggi.getMonth() >= 8 ? oggi.getFullYear() : oggi.getFullYear() - 1) - 1;
  return `${anno}/${String(anno + 1).slice(-2)}`;
};

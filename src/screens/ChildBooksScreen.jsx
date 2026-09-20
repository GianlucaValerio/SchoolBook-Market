import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

const C = {
  indigo: "#3D52A0", indigoLight: "#E8ECFF", indigoDark: "#2A3870",
  teal: "#1D9E75", tealLight: "#E1F5EE",
  amber: "#BA7517", amberLight: "#FAEEDA",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1A1F36", muted: "#6B7280", border: "#E2E6F0",
  surface: "#F7F8FC", card: "#FFFFFF",
};

const STATUS = {
  cerca:  { label: "Cerco",     color: C.amber,  bg: C.amberLight, icon: "🔍" },
  ho:     { label: "Ce l'ho",   color: C.teal,   bg: C.tealLight,  icon: "✅" },
  neutro: { label: "",          color: C.muted,  bg: "#F3F4F6",    icon: "" },
};

function BookRow({ book, status, onToggle }) {
  const st = STATUS[status] || STATUS.neutro;
  return (
    <div style={{
      background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
      padding: "12px 14px", marginBottom: 8, display: "flex",
      alignItems: "flex-start", gap: 12,
      borderLeft: status !== "neutro" ? `4px solid ${st.color}` : `1px solid ${C.border}`,
    }}>
      {/* Cover placeholder */}
      <div style={{
        width: 44, height: 60, borderRadius: 6, flexShrink: 0,
        background: C.indigoLight, display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 20,
      }}>📘</div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: C.text, marginBottom: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {book.titolo || "Titolo non disponibile"}
        </div>
        <div style={{ fontSize: 12, color: C.muted }}>{book.autore}</div>
        <div style={{ fontSize: 12, color: C.muted }}>{book.editore}</div>
        {book.prezzo_copertina && (
          <div style={{ fontSize: 12, color: C.indigo, fontWeight: 600, marginTop: 4 }}>
            Nuovo: €{Number(book.prezzo_copertina).toFixed(2)}
          </div>
        )}
        {book.disciplina && (
          <div style={{ display: "inline-block", marginTop: 4, padding: "2px 8px",
            borderRadius: 20, background: C.indigoLight, color: C.indigo, fontSize: 11 }}>
            {book.disciplina}
          </div>
        )}
      </div>

      {/* Toggle buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => onToggle(book.isbn, "cerca")}
          style={{
            height: 30, padding: "0 10px", borderRadius: 8, border: "none",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: status === "cerca" ? C.amberLight : "#F3F4F6",
            color: status === "cerca" ? C.amber : C.muted,
            outline: status === "cerca" ? `1.5px solid ${C.amber}` : "none",
          }}>
          🔍 Cerco
        </button>
        <button
          onClick={() => onToggle(book.isbn, "ho")}
          style={{
            height: 30, padding: "0 10px", borderRadius: 8, border: "none",
            fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            background: status === "ho" ? C.tealLight : "#F3F4F6",
            color: status === "ho" ? C.teal : C.muted,
            outline: status === "ho" ? `1.5px solid ${C.teal}` : "none",
          }}>
          ✅ Ho
        </button>
      </div>
    </div>
  );
}

export default function ChildBooksScreen() {
  const navigate = useNavigate();
  const child = JSON.parse(sessionStorage.getItem("selected_child") || "{}");

  const [books, setBooks] = useState([]);
  const [statuses, setStatuses] = useState({}); // isbn → "cerca"|"ho"|"neutro"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("tutti"); // tutti|cerca|ho
  const [search, setSearch] = useState("");

  // Carica libri dal DB MIM per scuola+classe del figlio
  useEffect(() => {
    if (!child.codice_istituto || !child.anno_classe) {
      setLoading(false);
      return;
    }
    const load = async () => {
      // Adozioni per questa scuola e classe, anno corrente
      const { data: adozioni, error } = await supabase
        .from("adoptions")
        .select("isbn, disciplina, da_acquistare, consigliato, anno_scolastico")
        .eq("codice_istituto", child.codice_istituto)
        .eq("anno_classe", String(child.anno_classe))
        .order("disciplina");

      if (error) { console.error(error); setLoading(false); return; }
      if (!adozioni?.length) { setLoading(false); return; }

      // Recupera dettagli libri dalla tabella books
      const isbns = [...new Set(adozioni.map(a => a.isbn).filter(Boolean))];
      const { data: bookData } = await supabase
        .from("books")
        .select("isbn, titolo, autore, editore, prezzo_copertina")
        .in("isbn", isbns);

      // Merge adozioni + dettagli libro
      const bookMap = Object.fromEntries((bookData || []).map(b => [b.isbn, b]));
      const merged = adozioni.map(a => ({
        ...bookMap[a.isbn],
        isbn: a.isbn,
        disciplina: a.disciplina,
        da_acquistare: a.da_acquistare,
        consigliato: a.consigliato,
      })).filter(b => b.isbn);

      setBooks(merged);

      // Carica stati salvati per questo figlio
      const { data: saved } = await supabase
        .from("child_books")
        .select("isbn, status")
        .eq("child_id", child.id);

      if (saved) {
        const map = {};
        saved.forEach(r => { map[r.isbn] = r.status; });
        setStatuses(map);
      }

      setLoading(false);
    };
    load();
  }, [child.id]);

  const handleToggle = (isbn, newStatus) => {
    setStatuses(prev => ({
      ...prev,
      [isbn]: prev[isbn] === newStatus ? "neutro" : newStatus,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const records = Object.entries(statuses)
        .filter(([, s]) => s !== "neutro")
        .map(([isbn, status]) => ({
          child_id: child.id,
          user_id: user.id,
          isbn,
          status,
        }));

      // Cancella e reinserisce per semplicità
      await supabase.from("child_books").delete().eq("child_id", child.id);
      if (records.length > 0) {
        await supabase.from("child_books").insert(records);
      }
      alert("✅ Lista salvata!");
    } catch (e) {
      alert("Errore: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Filtri
  const filtered = books.filter(b => {
    const matchFilter = filter === "tutti" || statuses[b.isbn] === filter;
    const matchSearch = !search || 
      b.titolo?.toLowerCase().includes(search.toLowerCase()) ||
      b.autore?.toLowerCase().includes(search.toLowerCase()) ||
      b.disciplina?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const countCerca = Object.values(statuses).filter(s => s === "cerca").length;
  const countHo = Object.values(statuses).filter(s => s === "ho").length;
  const countTotale = books.length;

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={() => navigate("/profilo")}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 16 }}>Libri di {child.nome}</h1>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>
            {child.anno_classe}ª · {child.anno_scolastico}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            height: 34, padding: "0 14px", background: C.indigo, color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>
          {saving ? "…" : "Salva"}
        </button>
      </div>

      <div style={{ padding: "12px 20px 0" }}>
        {/* Riepilogo */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 12,
        }}>
          {[
            { key: "tutti",  label: `Tutti (${countTotale})`,  color: C.indigo  },
            { key: "cerca",  label: `Cerco (${countCerca})`,   color: C.amber   },
            { key: "ho",     label: `Ho (${countHo})`,         color: C.teal    },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{
              flex: 1, height: 34, border: "none", borderRadius: 8,
              background: filter === f.key ? f.color : "#F3F4F6",
              color: filter === f.key ? "#fff" : C.muted,
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Ricerca */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>🔍</span>
          <input
            style={{
              width: "100%", height: 38, border: `1px solid ${C.border}`,
              borderRadius: 10, paddingLeft: 34, fontSize: 14,
              fontFamily: "inherit", color: C.text, background: C.card,
              boxSizing: "border-box",
            }}
            placeholder="Cerca per materia, titolo, autore..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="content" style={{ paddingTop: 0 }}>
        {loading ? (
          <div className="spinner" />
        ) : books.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📚</div>
            <div className="empty-title">Nessun libro trovato</div>
            <div className="empty-text">
              {!child.codice_istituto
                ? "Questo figlio non ha una scuola associata. Modifica il profilo."
                : "Non ci sono adozioni registrate per questa scuola e classe nel database MIM."}
            </div>
          </div>
        ) : (
          <>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, padding: 32, fontSize: 14 }}>
                Nessun libro corrisponde al filtro
              </div>
            )}
            {filtered.map(book => (
              <BookRow
                key={book.isbn}
                book={book}
                status={statuses[book.isbn] || "neutro"}
                onToggle={handleToggle}
              />
            ))}

            {/* Banner trova venditori */}
            {countCerca > 0 && (
              <div style={{
                background: C.indigoLight, borderRadius: 14, padding: "14px 16px",
                marginTop: 8, marginBottom: 8,
              }}>
                <div style={{ fontWeight: 600, color: C.indigoDark, fontSize: 14, marginBottom: 4 }}>
                  🔍 Stai cercando {countCerca} {countCerca === 1 ? "libro" : "libri"}
                </div>
                <div style={{ fontSize: 13, color: C.indigo, marginBottom: 10 }}>
                  Trova chi li vende nella tua zona o nella stessa scuola
                </div>
                <button
                  onClick={() => navigate("/cerca")}
                  style={{
                    height: 38, width: "100%", background: C.indigo, color: "#fff",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                  Cerca venditori →
                </button>
              </div>
            )}
          </>
        )}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

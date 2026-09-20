import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, getBookMeta } from "../lib/supabase";

const C = {
  indigo:"#3D52A0", indigoLight:"#E8ECFF", indigoDark:"#2A3870",
  teal:"#1D9E75", tealLight:"#E1F5EE",
  amber:"#BA7517", amberLight:"#FAEEDA",
  red:"#A32D2D", text:"#1A1F36", muted:"#6B7280",
  border:"#E2E6F0", surface:"#F7F8FC", card:"#FFFFFF",
};

// ── Componente singola riga libro ─────────────────────────────────────────────
function BookRow({ book, status, onToggle }) {
  const isManuale = book.manuale;
  return (
    <div style={{
      background: C.card, borderRadius:12,
      border:`1px solid ${C.border}`,
      borderLeft: status==="cerca" ? `4px solid ${C.amber}`
                : status==="ho"   ? `4px solid ${C.teal}`
                : `1px solid ${C.border}`,
      padding:"12px 14px", marginBottom:8,
      display:"flex", alignItems:"flex-start", gap:12,
    }}>
      <div style={{
        width:44, height:60, borderRadius:6, flexShrink:0,
        background: isManuale ? "#F3F4F6" : C.indigoLight,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
      }}>{isManuale ? "📎" : "📘"}</div>

      <div style={{flex:1, minWidth:0}}>
        <div style={{fontWeight:600, fontSize:14, color:C.text, marginBottom:2,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
          {book.titolo || book.isbn}
        </div>
        {book.autore && <div style={{fontSize:12, color:C.muted}}>{book.autore}</div>}
        {book.editore && <div style={{fontSize:12, color:C.muted}}>{book.editore}</div>}
        <div style={{display:"flex", gap:6, marginTop:4, flexWrap:"wrap"}}>
          {book.disciplina && (
            <span style={{padding:"2px 8px", borderRadius:20, background:C.indigoLight,
              color:C.indigo, fontSize:11}}>{book.disciplina}</span>
          )}
          {book.prezzo_copertina && (
            <span style={{fontSize:12, color:C.indigo, fontWeight:600}}>
              Nuovo: €{Number(book.prezzo_copertina).toFixed(2)}
            </span>
          )}
          {isManuale && (
            <span style={{padding:"2px 8px", borderRadius:20, background:"#F3F4F6",
              color:C.muted, fontSize:11}}>aggiunto manualmente</span>
          )}
        </div>
      </div>

      <div style={{display:"flex", flexDirection:"column", gap:6, flexShrink:0}}>
        <button onClick={()=>onToggle(book.isbn, "cerca")} style={{
          height:30, padding:"0 10px", borderRadius:8, border:"none",
          fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
          background: status==="cerca" ? C.amberLight : "#F3F4F6",
          color: status==="cerca" ? C.amber : C.muted,
          outline: status==="cerca" ? `1.5px solid ${C.amber}` : "none",
        }}>🔍 Cerco</button>
        <button onClick={()=>onToggle(book.isbn, "ho")} style={{
          height:30, padding:"0 10px", borderRadius:8, border:"none",
          fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
          background: status==="ho" ? C.tealLight : "#F3F4F6",
          color: status==="ho" ? C.teal : C.muted,
          outline: status==="ho" ? `1.5px solid ${C.teal}` : "none",
        }}>✅ Ho</button>
      </div>
    </div>
  );
}

// ── Modale aggiungi libro manuale ─────────────────────────────────────────────
function AddManualModal({ onAdd, onClose }) {
  const [isbn, setIsbn] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookInfo, setBookInfo] = useState(null);

  const cerca = async () => {
    if (isbn.length < 10) return;
    setLoading(true);
    const meta = await getBookMeta(isbn);
    setBookInfo(meta);
    setLoading(false);
  };

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
      display:"flex", alignItems:"flex-end", justifyContent:"center",
      zIndex:1000,
    }} onClick={onClose}>
      <div style={{
        background:C.card, borderRadius:"16px 16px 0 0",
        padding:24, width:"100%", maxWidth:480,
      }} onClick={e=>e.stopPropagation()}>
        <div style={{fontWeight:700, fontSize:16, marginBottom:16}}>
          Aggiungi libro manualmente
        </div>
        <div style={{display:"flex", gap:8, marginBottom:12}}>
          <input
            style={{flex:1, height:44, border:`1px solid ${C.border}`, borderRadius:10,
              padding:"0 12px", fontSize:15, fontFamily:"inherit", color:C.text}}
            placeholder="ISBN (es. 9788806228473)"
            value={isbn}
            onChange={e=>setIsbn(e.target.value.replace(/-/g,""))}
            inputMode="numeric"
            onKeyDown={e=>e.key==="Enter"&&cerca()}
          />
          <button onClick={cerca} disabled={loading||isbn.length<10} style={{
            height:44, padding:"0 16px", background:C.indigo, color:"#fff",
            border:"none", borderRadius:10, fontSize:14, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit",
          }}>{loading?"…":"Cerca"}</button>
        </div>

        {bookInfo && (
          <div style={{
            background:C.indigoLight, borderRadius:10, padding:"12px 14px", marginBottom:12,
          }}>
            <div style={{fontWeight:600, fontSize:14}}>{bookInfo.titolo}</div>
            {bookInfo.autori && <div style={{fontSize:12, color:C.muted}}>{bookInfo.autori}</div>}
          </div>
        )}

        <button
          onClick={()=>onAdd({
            isbn: isbn.replace(/-/g,""),
            titolo: bookInfo?.titolo,
            autore: bookInfo?.autori,
            editore: bookInfo?.editore,
            manuale: true,
          })}
          disabled={!isbn || isbn.length < 10}
          style={{
            width:"100%", height:48, background:C.indigo, color:"#fff",
            border:"none", borderRadius:12, fontSize:15, fontWeight:600,
            cursor:"pointer", fontFamily:"inherit",
          }}>
          Aggiungi alla lista
        </button>
        <button onClick={onClose} style={{
          width:"100%", marginTop:8, height:44, background:"none",
          border:"none", color:C.muted, fontSize:14, cursor:"pointer", fontFamily:"inherit",
        }}>Annulla</button>
      </div>
    </div>
  );
}

// ── Schermata principale ──────────────────────────────────────────────────────
export default function ChildBooksScreen() {
  const navigate = useNavigate();
  const child = JSON.parse(sessionStorage.getItem("selected_child") || "{}");

  const [books, setBooks] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("tutti");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!child.codice_istituto || !child.anno_classe) { setLoading(false); return; }
    const load = async () => {
      // Query 1: libri con sezione specifica del figlio
      const q1 = supabase
        .from("adoptions")
        .select("isbn, disciplina, sezione, da_acquistare")
        .eq("codice_istituto", child.codice_istituto)
        .eq("anno_classe", String(child.anno_classe));

      // Applica filtro sezione solo se il figlio ha una sezione
      if (child.sezione) {
        q1.eq("sezione", child.sezione);
      }

      // Query 2: libri senza sezione (materie comuni)
      const q2 = supabase
        .from("adoptions")
        .select("isbn, disciplina, sezione, da_acquistare")
        .eq("codice_istituto", child.codice_istituto)
        .eq("anno_classe", String(child.anno_classe))
        .or("sezione.is.null,sezione.eq.");

      const [{ data: d1 }, { data: d2 }] = await Promise.all([q1, q2]);

      // Merge e deduplicazione per ISBN
      const allAdozioni = [...(d1||[]), ...(d2||[])];
      const seen = new Set();
      const unique = allAdozioni.filter(a => {
        if (!a.isbn || seen.has(a.isbn)) return false;
        seen.add(a.isbn);
        return true;
      });

      if (!unique.length) { setLoading(false); return; }

      // Recupera dettagli libri
      const isbns = unique.map(a => a.isbn);
      const { data: bookData } = await supabase
        .from("books")
        .select("isbn, titolo, autore, editore, prezzo_copertina")
        .in("isbn", isbns);

      const bookMap = Object.fromEntries((bookData||[]).map(b=>[b.isbn,b]));
      const merged = unique.map(a => ({
        ...bookMap[a.isbn],
        isbn: a.isbn,
        disciplina: a.disciplina,
        sezione: a.sezione,
        da_acquistare: a.da_acquistare,
      })).sort((a,b) => (a.disciplina||"").localeCompare(b.disciplina||""));

      setBooks(merged);

      // Carica stati salvati
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

  const handleAddManual = (book) => {
    if (!books.find(b => b.isbn === book.isbn)) {
      setBooks(prev => [...prev, book]);
    }
    setShowModal(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const records = Object.entries(statuses)
        .filter(([, s]) => s && s !== "neutro")
        .map(([isbn, status]) => ({ child_id: child.id, user_id: user.id, isbn, status }));
      await supabase.from("child_books").delete().eq("child_id", child.id);
      if (records.length > 0) await supabase.from("child_books").insert(records);
      alert("✅ Lista salvata!");
    } catch(e) { alert("Errore: " + e.message); }
    finally { setSaving(false); }
  };

  const countCerca = Object.values(statuses).filter(s=>s==="cerca").length;
  const countHo    = Object.values(statuses).filter(s=>s==="ho").length;

  const filtered = books.filter(b => {
    const matchFilter = filter==="tutti" || (statuses[b.isbn]||"neutro")===filter
      || (filter==="neutro" && !statuses[b.isbn]);
    const matchSearch = !search ||
      b.titolo?.toLowerCase().includes(search.toLowerCase()) ||
      b.disciplina?.toLowerCase().includes(search.toLowerCase()) ||
      b.autore?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={()=>navigate("/profilo")}>←</button>
        <div style={{flex:1}}>
          <h1 style={{fontSize:16}}>Libri di {child.nome}</h1>
          <div style={{fontSize:12, color:C.muted, fontWeight:400}}>
            {child.anno_classe}ª {child.sezione ? `· ${child.sezione}` : ""} · {child.anno_scolastico}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          height:34, padding:"0 14px", background:C.indigo, color:"#fff",
          border:"none", borderRadius:8, fontSize:13, fontWeight:600,
          cursor:"pointer", fontFamily:"inherit",
        }}>{saving?"…":"Salva"}</button>
      </div>

      <div style={{padding:"12px 20px 0"}}>
        {/* Filtri */}
        <div style={{display:"flex", gap:8, marginBottom:12}}>
          {[
            {key:"tutti",  label:`Tutti (${books.length})`,  color:C.indigo},
            {key:"cerca",  label:`Cerco (${countCerca})`,    color:C.amber},
            {key:"ho",     label:`Ho (${countHo})`,          color:C.teal},
          ].map(f=>(
            <button key={f.key} onClick={()=>setFilter(f.key)} style={{
              flex:1, height:34, border:"none", borderRadius:8,
              background: filter===f.key ? f.color : "#F3F4F6",
              color: filter===f.key ? "#fff" : C.muted,
              fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Ricerca */}
        <div style={{position:"relative", marginBottom:12}}>
          <span style={{position:"absolute", left:10, top:"50%", transform:"translateY(-50%)"}}>🔍</span>
          <input style={{
            width:"100%", height:38, border:`1px solid ${C.border}`,
            borderRadius:10, paddingLeft:34, fontSize:14, fontFamily:"inherit",
            color:C.text, background:C.card, boxSizing:"border-box",
          }} placeholder="Cerca per materia, titolo..." value={search}
            onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div className="content" style={{paddingTop:0}}>
        {loading ? <div className="spinner"/> :
        books.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📚</div>
            <div className="empty-title">Nessun libro trovato</div>
            <div className="empty-text">
              {!child.codice_istituto
                ? "Questo figlio non ha una scuola associata."
                : "Nessuna adozione trovata per questa combinazione scuola/classe/sezione."}
            </div>
            <button onClick={()=>setShowModal(true)} style={{
              marginTop:16, height:44, padding:"0 20px", background:C.indigo,
              color:"#fff", border:"none", borderRadius:10, fontSize:14,
              fontWeight:600, cursor:"pointer", fontFamily:"inherit",
            }}>+ Aggiungi libro manualmente</button>
          </div>
        ) : (
          <>
            {filtered.map(book=>(
              <BookRow key={book.isbn} book={book}
                status={statuses[book.isbn]||"neutro"}
                onToggle={handleToggle} />
            ))}

            {/* Bottone aggiungi manuale */}
            <button onClick={()=>setShowModal(true)} style={{
              width:"100%", height:44, border:`1.5px dashed ${C.border}`,
              borderRadius:12, background:"none", color:C.muted,
              fontSize:14, cursor:"pointer", fontFamily:"inherit", marginTop:4,
            }}>+ Aggiungi libro non in lista</button>

            {/* Banner cerca venditori */}
            {countCerca > 0 && (
              <div style={{
                background:C.indigoLight, borderRadius:14,
                padding:"14px 16px", marginTop:12,
              }}>
                <div style={{fontWeight:600, color:C.indigoDark, fontSize:14, marginBottom:4}}>
                  🔍 Stai cercando {countCerca} {countCerca===1?"libro":"libri"}
                </div>
                <div style={{fontSize:13, color:C.indigo, marginBottom:10}}>
                  Trova chi li vende nella tua zona o nella stessa scuola
                </div>
                <button onClick={()=>navigate("/cerca")} style={{
                  height:38, width:"100%", background:C.indigo, color:"#fff",
                  border:"none", borderRadius:10, fontSize:14, fontWeight:600,
                  cursor:"pointer", fontFamily:"inherit",
                }}>Cerca venditori →</button>
              </div>
            )}
          </>
        )}
        <div style={{height:40}}/>
      </div>

      {showModal && (
        <AddManualModal onAdd={handleAddManual} onClose={()=>setShowModal(false)} />
      )}
    </div>
  );
}

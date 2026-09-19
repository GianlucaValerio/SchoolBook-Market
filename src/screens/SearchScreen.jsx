import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { searchByIsbn, searchByTitle, searchByScuola, searchScuole, getBookMeta } from "../lib/supabase";

export default function SearchScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("isbn");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [scuoleList, setScuoleList] = useState([]);
  const [selectedScuola, setSelectedScuola] = useState(null);
  const [annoClasse, setAnnoClasse] = useState("");
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const reset = () => { setResults([]); setScuoleList([]); setSelectedScuola(null); setQuery(""); setNotFound(false); };

  const goToBook = (libro) => {
    sessionStorage.setItem("libro", JSON.stringify(libro));
    navigate("/cerca/libro");
  };

  const cercaIsbn = useCallback(async () => {
    const clean = query.replace(/-/g, "").trim();
    if (clean.length < 10) return;
    setLoading(true); setNotFound(false);
    try {
      const [adozioni, meta] = await Promise.all([searchByIsbn(clean), getBookMeta(clean)]);
      if (!adozioni.length && !meta) { setNotFound(true); return; }
      goToBook({
        isbn: clean,
        titolo: meta?.titolo || adozioni[0]?.titolo || "Titolo non disponibile",
        autore: meta?.autori || adozioni[0]?.autore,
        editore: meta?.editore || adozioni[0]?.editore,
        copertina: meta?.copertina,
        prezzo: adozioni[0]?.prezzo,
        adozioni,
      });
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  }, [query]);

  const cercaTitolo = useCallback(async () => {
    if (query.trim().length < 3) return;
    setLoading(true); setNotFound(false);
    try {
      const data = await searchByTitle(query.trim());
      setResults(data);
      if (!data.length) setNotFound(true);
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  }, [query]);

  const cercaScuoleHandler = useCallback(async (q) => {
    setQuery(q);
    if (q.length < 2) { setScuoleList([]); return; }
    const data = await searchScuole(q);
    setScuoleList(data);
  }, []);

  const selezionaScuola = async (sc) => {
    setSelectedScuola(sc); setScuoleList([]); setQuery("");
    setLoading(true);
    try {
      const data = await searchByScuola(sc.codice_istituto, annoClasse || null);
      setResults(data);
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  };

  const handleKey = (e) => { if (e.key === "Enter") tab === "isbn" ? cercaIsbn() : tab === "titolo" ? cercaTitolo() : null; };

  return (
    <div className="screen">
      <div className="top-bar"><h1>Cerca libri</h1></div>
      <div className="content">

        {/* Tab switcher */}
        <div className="tab-switcher">
          {[["isbn","📷 ISBN"],["titolo","🔤 Titolo"],["scuola","🏫 Scuola"]].map(([k,l]) => (
            <button key={k} className={`tab-switcher-item ${tab===k?"active":""}`} onClick={() => { setTab(k); reset(); }}>{l}</button>
          ))}
        </div>

        {/* ── ISBN ── */}
        {tab === "isbn" && (
          <>
            <div className="scan-box">
              <div className="scan-corners">
                <div className="scan-corner sc-tl"/><div className="scan-corner sc-tr"/>
                <div className="scan-corner sc-bl"/><div className="scan-corner sc-br"/>
              </div>
              <div className="scan-line"/>
              <div className="scan-label">Inquadra il codice a barre</div>
              <div style={{color:"rgba(255,255,255,0.3)",fontSize:11}}>Scanner attivo su mobile con fotocamera</div>
            </div>
            <div style={{textAlign:"center",color:"var(--muted)",fontSize:13,marginBottom:12}}>oppure inserisci manualmente</div>
            <div style={{display:"flex",gap:8}}>
              <input className="field" style={{flex:1}} placeholder="ISBN (es. 9788806228473)" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={handleKey} inputMode="numeric" />
              <button className="btn-sm btn-sm-primary" onClick={cercaIsbn} disabled={loading}>{loading?"…":"Cerca"}</button>
            </div>
            {notFound && <div style={{color:"var(--red)",fontSize:13,marginTop:8}}>Nessun libro trovato con questo ISBN</div>}
          </>
        )}

        {/* ── TITOLO ── */}
        {tab === "titolo" && (
          <>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              <input className="field" style={{flex:1}} placeholder="es. Matematica.blu 2.0" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={handleKey} />
              <button className="btn-sm btn-sm-primary" onClick={cercaTitolo} disabled={loading}>{loading?"…":"Cerca"}</button>
            </div>
            {loading && <div className="spinner"/>}
            {results.map((r,i) => (
              <div key={r.isbn||i} className="card card-row" style={{cursor:"pointer"}} onClick={() => goToBook(r)}>
                <div style={{width:52,height:70,borderRadius:6,background:"var(--indigo-light)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>📘</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{r.titolo}</div>
                  <div style={{fontSize:12,color:"var(--muted)"}}>{r.autore}</div>
                  <div style={{fontSize:12,color:"var(--muted)"}}>{r.editore}</div>
                  {r.prezzo && <div style={{fontSize:12,color:"var(--indigo)",fontWeight:600,marginTop:4}}>Nuovo: €{Number(r.prezzo).toFixed(2)}</div>}
                </div>
              </div>
            ))}
            {notFound && <div className="empty"><div className="empty-icon">🔍</div><div className="empty-title">Nessun risultato</div></div>}
          </>
        )}

        {/* ── SCUOLA ── */}
        {tab === "scuola" && (
          <>
            {selectedScuola ? (
              <div className="selected-scuola">
                <div>
                  <div style={{fontWeight:600,color:"var(--indigo-dark)",fontSize:14}}>🏫 {selectedScuola.nome}</div>
                  <div style={{fontSize:12,color:"var(--indigo)"}}>{selectedScuola.comune} ({selectedScuola.provincia})</div>
                </div>
                <button onClick={()=>{setSelectedScuola(null);setResults([]);}} style={{background:"none",border:"none",color:"var(--indigo)",fontSize:13,cursor:"pointer",fontWeight:600}}>Cambia</button>
              </div>
            ) : (
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input className="field" placeholder="Cerca scuola per nome o città…" value={query} onChange={e=>cercaScuoleHandler(e.target.value)} />
              </div>
            )}

            {selectedScuola && (
              <div className="pill-group">
                {["","1","2","3","4","5"].map(a => (
                  <button key={a} className={`pill ${annoClasse===a?"active":""}`} onClick={()=>{setAnnoClasse(a); selezionaScuola(selectedScuola);}}>
                    {a?`${a}ª`:"Tutti"}
                  </button>
                ))}
              </div>
            )}

            {scuoleList.map(sc => (
              <div key={sc.codice_istituto} className="card" style={{cursor:"pointer"}} onClick={()=>selezionaScuola(sc)}>
                <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>🏫 {sc.nome}</div>
                <div style={{fontSize:12,color:"var(--muted)"}}>{sc.comune} · {sc.codice_istituto}</div>
              </div>
            ))}

            {loading && <div className="spinner"/>}

            {results.map((r,i) => (
              <div key={`${r.isbn}-${i}`} className="card card-row" style={{cursor:"pointer"}} onClick={()=>goToBook(r)}>
                <div style={{width:44,height:60,borderRadius:6,background:"var(--indigo-light)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📘</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:14}}>{r.titolo}</div>
                  <div style={{fontSize:12,color:"var(--muted)"}}>{r.autore} · {r.anno_classe}ª</div>
                  {r.prezzo && <div style={{fontSize:12,color:"var(--indigo)",fontWeight:600,marginTop:2}}>€{Number(r.prezzo).toFixed(2)}</div>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

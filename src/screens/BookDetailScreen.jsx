import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getListings, getPotentialSellers, supabase } from "../lib/supabase";

const COND_CLASS = { ottimo:"badge-ottimo", buono:"badge-buono", discreto:"badge-discreto", usato:"badge-usato" };
const AVATAR_COLORS = ["#3D52A0","#1D9E75","#BA7517","#6366F1","#A32D2D"];

export default function BookDetailScreen() {
  const navigate = useNavigate();
  const libro = JSON.parse(sessionStorage.getItem("libro") || "{}");
  const [activeTab, setActiveTab] = useState("annunci");
  const [listings, setListings] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [loadingL, setLoadingL] = useState(true);
  const [loadingS, setLoadingS] = useState(true);

  const codiceIstituto = libro.adozioni?.[0]?.codice_istituto;

  useEffect(() => {
    if (!libro.isbn) return;
    getListings(libro.isbn).then(setListings).finally(() => setLoadingL(false));
    getPotentialSellers(libro.isbn, codiceIstituto).then(setSellers).finally(() => setLoadingS(false));
  }, [libro.isbn]);

  const notifySeller = async (seller) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("notifications").insert({
        from_user_id: user.id, to_user_id: seller.user_id,
        isbn: libro.isbn, titolo: libro.titolo,
        message: `Qualcuno è interessato ad acquistare "${libro.titolo}". Vuoi venderlo?`,
      });
      alert(`✅ Notifica inviata a ${seller.nome}`);
    } catch (e) { alert(e.message); }
  };

  const scuoleAdozione = libro.adozioni
    ? [...new Map(libro.adozioni.map(a => [a.codice_istituto, a])).values()]
    : [];

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1 style={{fontSize:16,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{libro.titolo}</h1>
      </div>
      <div className="content">

        {/* Info libro */}
        <div className="info-box info-box-indigo">
          <div style={{fontWeight:700,fontSize:16,color:"var(--indigo-dark)",marginBottom:2}}>{libro.titolo}</div>
          {libro.autore && <div style={{fontSize:13,color:"var(--indigo)"}}>{libro.autore}</div>}
          {libro.editore && <div style={{fontSize:13,color:"var(--indigo)"}}>{libro.editore}</div>}
          <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>ISBN {libro.isbn}</div>
          {libro.prezzo && <div style={{fontSize:13,fontWeight:600,color:"var(--amber)",marginTop:6}}>Prezzo di copertina: €{Number(libro.prezzo).toFixed(2)}</div>}
          {scuoleAdozione.length > 0 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:10}}>
              {scuoleAdozione.slice(0,3).map(a => (
                <span key={a.codice_istituto} className="chip">📍 {a.schools?.nome || a.codice_istituto} · {a.anno_classe}ª</span>
              ))}
              {scuoleAdozione.length > 3 && <span className="chip">+{scuoleAdozione.length-3}</span>}
            </div>
          )}
        </div>

        {/* Tab */}
        <div className="inline-tabs">
          <button className={`inline-tab ${activeTab==="annunci"?"active":""}`} onClick={()=>setActiveTab("annunci")}>
            📦 Annunci ({listings.length})
          </button>
          <button className={`inline-tab ${activeTab==="match"?"active":""}`} onClick={()=>setActiveTab("match")}>
            ✨ Match ({sellers.length})
          </button>
        </div>

        {/* ── ANNUNCI ── */}
        {activeTab === "annunci" && (
          loadingL ? <div className="spinner"/> :
          listings.length > 0 ? listings.map(l => {
            const risparmio = l.prezzo_nuovo ? Math.round(((l.prezzo_nuovo - l.prezzo) / l.prezzo_nuovo) * 100) : null;
            const initials = `${l.profiles?.nome?.[0]||""}${l.profiles?.cognome?.[0]||""}`.toUpperCase();
            const color = AVATAR_COLORS[l.user_id?.charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0];
            return (
              <div key={l.id} className="card">
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div className="avatar" style={{background:color}}>{initials||"?"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{l.profiles?.nome} {l.profiles?.cognome}</div>
                    <div style={{fontSize:12,color:"var(--muted)"}}>📍 {l.profiles?.citta||l.citta}</div>
                  </div>
                  <span className={`badge ${COND_CLASS[l.condizione]||""}`}>{l.condizione}</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                  <div>
                    <span className="price-big">€{Number(l.prezzo).toFixed(2)}</span>
                    {l.prezzo_nuovo && <> <span className="price-old">€{Number(l.prezzo_nuovo).toFixed(2)}</span> {risparmio && <span className="price-save">-{risparmio}%</span>}</>}
                  </div>
                  <a href={`mailto:?subject=Libro: ${libro.titolo}`} className="btn-sm btn-sm-primary" style={{textDecoration:"none",display:"flex",alignItems:"center"}}>Contatta</a>
                </div>
                {l.note && <div style={{fontSize:12,color:"var(--muted)",marginTop:8,fontStyle:"italic"}}>💬 {l.note}</div>}
              </div>
            );
          }) : (
            <div className="empty">
              <div className="empty-icon">📭</div>
              <div className="empty-title">Nessun annuncio attivo</div>
              <div className="empty-text">Prova il tab Match per trovare chi potrebbe averlo</div>
            </div>
          )
        )}

        {/* ── MATCH ── */}
        {activeTab === "match" && (
          <>
            <div className="info-box info-box-amber" style={{marginBottom:12}}>
              <div style={{fontWeight:600,color:"var(--amber)",fontSize:13}}>✨ Come funziona il match</div>
              <div style={{fontSize:12,color:"var(--amber)",marginTop:4,lineHeight:1.6}}>
                Questi utenti erano nella classe precedente nella stessa scuola l'anno scorso — potrebbero avere i libri che cerchi. Li notifichiamo chiedendo se vogliono vendere.
              </div>
            </div>

            {loadingS ? <div className="spinner"/> :
            sellers.length > 0 ? sellers.map((s,i) => {
              const initials = `${s.nome?.[0]||""}${s.cognome?.[0]||""}`.toUpperCase();
              const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <div key={`${s.user_id}-${i}`} className="card card-row">
                  <div className="avatar" style={{background:color}}>{initials||"?"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{s.nome} {s.cognome}</div>
                    <div style={{fontSize:12,color:"var(--muted)"}}>{s.nome_scuola}</div>
                    <div style={{fontSize:12,color:"var(--muted)"}}>Era in {s.anno_classe_adozione}ª → ora {s.anno_classe_attuale}ª · 📍 {s.citta||s.comune}</div>
                  </div>
                  <button className="btn-sm btn-sm-outline" onClick={()=>notifySeller(s)}>Notifica</button>
                </div>
              );
            }) : (
              <div className="empty">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">Nessun match trovato</div>
                <div className="empty-text">Non ci sono utenti registrati che potrebbero avere questo libro</div>
              </div>
            )}
          </>
        )}
        <div style={{height:32}}/>
      </div>

      <button className="fab" onClick={() => { sessionStorage.setItem("prefill", JSON.stringify({isbn:libro.isbn,titolo:libro.titolo,prezzo_nuovo:libro.prezzo})); navigate("/pubblica"); }}>
        + Vendi questo libro
      </button>
    </div>
  );
}

// ── ListingsScreen ───────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, getChildren, addChild, searchScuole, getMyListings, createListing, updateListingStatus, deleteListing, signOut, annoScolasticoCorrente } from "../lib/supabase";

const AVATAR_COLORS = ["#3D52A0","#1D9E75","#BA7517","#6366F1","#A32D2D"];
const COND_CLASS = { ottimo:"badge-ottimo", buono:"badge-buono", discreto:"badge-discreto", usato:"badge-usato" };

export function ListingsScreen() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("listings").select("*, profiles(nome, cognome, citta)").eq("stato","disponibile").order("created_at",{ascending:false}).limit(40)
      .then(({data}) => { setListings(data||[]); setLoading(false); });
  }, []);

  const goToBook = (l) => { sessionStorage.setItem("libro", JSON.stringify({isbn:l.isbn,titolo:l.titolo})); navigate("/cerca/libro"); };

  return (
    <div className="screen">
      <div className="top-bar"><h1>Annunci</h1></div>
      <div className="content">
        {loading ? <div className="spinner"/> : listings.length === 0 ? (
          <div className="empty"><div className="empty-icon">📭</div><div className="empty-title">Nessun annuncio</div></div>
        ) : listings.map(l => {
          const color = AVATAR_COLORS[l.user_id?.charCodeAt(0) % AVATAR_COLORS.length] || AVATAR_COLORS[0];
          const initials = `${l.profiles?.nome?.[0]||""}${l.profiles?.cognome?.[0]||""}`.toUpperCase();
          return (
            <div key={l.id} className="card card-row" style={{cursor:"pointer"}} onClick={()=>goToBook(l)}>
              <div style={{width:52,height:70,borderRadius:6,background:"var(--indigo-light)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>📘</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.titolo||l.isbn}</div>
                <div style={{fontSize:12,color:"var(--muted)",display:"flex",alignItems:"center",gap:6,marginTop:2}}>
                  <div className="avatar" style={{background:color,width:18,height:18,fontSize:9}}>{initials}</div>
                  {l.profiles?.nome} · {l.profiles?.citta}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                  <span style={{fontSize:18,fontWeight:700,color:"var(--indigo)"}}>€{Number(l.prezzo).toFixed(2)}</span>
                  <span className={`badge ${COND_CLASS[l.condizione]||""}`}>{l.condizione}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ProfileScreen ─────────────────────────────────────────────────────────────
export function ProfileScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [children, setChildren] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: prof }, kids, listings] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        getChildren(user.id),
        getMyListings(user.id),
      ]);
      setProfile(prof); setChildren(kids); setMyListings(listings); setLoading(false);
    };
    load();
  }, []);

  const handleDeleteListing = async (id) => {
    if (!confirm("Eliminare questo annuncio?")) return;
    await deleteListing(id);
    setMyListings(p => p.filter(l => l.id !== id));
  };

  const toggleStatus = async (l) => {
    const newStatus = l.stato === "disponibile" ? "venduto" : "disponibile";
    await updateListingStatus(l.id, newStatus);
    setMyListings(p => p.map(x => x.id === l.id ? {...x, stato: newStatus} : x));
  };

  if (loading) return <div className="screen"><div className="top-bar"><h1>Profilo</h1></div><div className="spinner"/></div>;

  const initials = `${profile?.nome?.[0]||""}${profile?.cognome?.[0]||""}`.toUpperCase();

  return (
    <div className="screen">
      <div className="top-bar"><h1>Profilo</h1></div>
      <div className="content">
        {/* Avatar */}
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          <div className="avatar" style={{background:"var(--indigo)",width:56,height:56,fontSize:20,borderRadius:"50%"}}>{initials||"?"}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:700}}>{profile?.nome} {profile?.cognome}</div>
            <div style={{fontSize:13,color:"var(--muted)"}}>{profile?.citta}</div>
          </div>
          <button onClick={signOut} style={{background:"none",border:"none",color:"var(--red)",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:500}}>Esci</button>
        </div>

        {/* Figli */}
        <div className="section-label">I miei figli</div>
        {children.map(c => (
          <div key={c.id} className="card card-row">
            <div className="avatar" style={{background:"#6366F1"}}>{c.nome[0]}</div>
            <div style={{flex:1,marginLeft:10}}>
              <div style={{fontWeight:600,fontSize:14}}>{c.nome}</div>
              <div style={{fontSize:12,color:"var(--muted)"}}>{c.anno_classe}ª {c.sezione} · {c.schools?.nome}</div>
              <div style={{fontSize:11,color:"var(--muted)"}}>{c.anno_scolastico}</div>
            </div>
          </div>
        ))}
        <button className="btn btn-secondary" style={{marginBottom:24}} onClick={()=>navigate("/profilo/aggiungi-figlio")}>
          + Aggiungi figlio
        </button>

        {/* Annunci */}
        <div className="section-label">I miei annunci ({myListings.length})</div>
        {myListings.map(l => (
          <div key={l.id} className="card" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:4}}>{l.titolo||l.isbn}</div>
              <span className={`badge badge-${l.stato}`}>{l.stato}</span>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10}}>
              <span style={{fontSize:16,fontWeight:700,color:"var(--indigo)",marginRight:8}}>€{Number(l.prezzo).toFixed(2)}</span>
              <button className="btn-sm btn-sm-outline" onClick={()=>toggleStatus(l)}>{l.stato==="disponibile"?"Venduto":"Riattiva"}</button>
              <button className="btn-sm btn-sm-danger" onClick={()=>handleDeleteListing(l.id)}>✕</button>
            </div>
          </div>
        ))}
        <button className="btn btn-primary" style={{marginTop:4}} onClick={()=>navigate("/pubblica")}>
          + Pubblica annuncio
        </button>
        <div style={{height:40}}/>
      </div>
    </div>
  );
}

// ── AddChildScreen ────────────────────────────────────────────────────────────
export function AddChildScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ nome:"", anno_classe:"", sezione:"", codice_istituto:"", anno_scolastico: annoScolasticoCorrente() });
  const [scuoleList, setScuoleList] = useState([]);
  const [selectedScuola, setSelectedScuola] = useState(null);
  const [queryScuola, setQueryScuola] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p => ({...p,[k]:v}));

  const cercaScuole = async (q) => {
    setQueryScuola(q);
    if (q.length < 2) { setScuoleList([]); return; }
    const data = await searchScuole(q);
    setScuoleList(data);
  };

  const salva = async (e) => {
    e.preventDefault();
    if (!form.nome || !form.anno_classe || !form.codice_istituto) { alert("Nome, anno e scuola sono obbligatori"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await addChild(user.id, form);
      navigate("/profilo");
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={()=> step===1 ? navigate("/profilo") : setStep(1)}>←</button>
        <h1>Aggiungi figlio</h1>
      </div>
      <div className="content">
        <div className="step-bar">
          {[1,2].map(n => <div key={n} className={`step-seg ${step>=n?"done":""}`}/>)}
        </div>

        {step === 1 && (
          <form onSubmit={e=>{e.preventDefault();setStep(2);}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:20}}>Chi è tuo figlio?</div>
            <div className="field-group">
              <label className="field-label">Nome</label>
              <input className="field" placeholder="es. Giulia" value={form.nome} onChange={e=>set("nome",e.target.value)} required autoCapitalize="words" />
            </div>
            <div className="field-group">
              <label className="field-label">Anno di corso</label>
              <div className="pill-group">
                {["1","2","3","4","5"].map(a => (
                  <button type="button" key={a} className={`pill ${form.anno_classe===a?"active":""}`} onClick={()=>set("anno_classe",a)}>{a}ª</button>
                ))}
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">Sezione (opzionale)</label>
              <input className="field" placeholder="es. A" maxLength={2} value={form.sezione} onChange={e=>set("sezione",e.target.value)} style={{width:80}} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!form.nome||!form.anno_classe}>Avanti →</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={salva}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:20}}>Quale scuola frequenta?</div>
            {selectedScuola ? (
              <div className="selected-scuola">
                <div>
                  <div style={{fontWeight:600,color:"var(--indigo-dark)"}}>🏫 {selectedScuola.nome}</div>
                  <div style={{fontSize:12,color:"var(--indigo)"}}>{selectedScuola.comune} ({selectedScuola.provincia})</div>
                </div>
                <button type="button" onClick={()=>{setSelectedScuola(null);set("codice_istituto","");}} style={{background:"none",border:"none",color:"var(--indigo)",cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>Cambia</button>
              </div>
            ) : (
              <div className="field-group">
                <label className="field-label">Cerca scuola</label>
                <input className="field" placeholder="Nome scuola o città..." value={queryScuola} onChange={e=>cercaScuole(e.target.value)} />
              </div>
            )}
            {scuoleList.map(sc => (
              <div key={sc.codice_istituto} className="card" style={{cursor:"pointer"}} onClick={()=>{setSelectedScuola(sc);set("codice_istituto",sc.codice_istituto);setScuoleList([]);setQueryScuola("");}}>
                <div style={{fontWeight:600,fontSize:14}}>🏫 {sc.nome}</div>
                <div style={{fontSize:12,color:"var(--muted)"}}>{sc.comune} · {sc.codice_istituto}</div>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button type="button" className="btn btn-secondary" style={{flex:1}} onClick={()=>setStep(1)}>← Indietro</button>
              <button type="submit" className="btn btn-primary" style={{flex:2}} disabled={saving||!form.codice_istituto}>
                {saving?"Salvo…":"Salva figlio"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── CreateListingScreen ───────────────────────────────────────────────────────
export function CreateListingScreen() {
  const navigate = useNavigate();
  const prefill = JSON.parse(sessionStorage.getItem("prefill")||"{}");
  const [form, setForm] = useState({ isbn:prefill.isbn||"", titolo:prefill.titolo||"", prezzo:"", prezzo_nuovo:prefill.prezzo_nuovo?String(prefill.prezzo_nuovo):"", condizione:"buono", note:"", citta:"" });
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(p => ({...p,[k]:v}));

  const salva = async (e) => {
    e.preventDefault();
    if (!form.isbn||!form.prezzo) { alert("ISBN e prezzo sono obbligatori"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await createListing(user.id, { ...form, prezzo: parseFloat(form.prezzo), prezzo_nuovo: form.prezzo_nuovo ? parseFloat(form.prezzo_nuovo) : null });
      sessionStorage.removeItem("prefill");
      alert("✅ Annuncio pubblicato!");
      navigate("/profilo");
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="screen">
      <div className="top-bar">
        <button className="back-btn" onClick={()=>navigate(-1)}>←</button>
        <h1>Pubblica annuncio</h1>
      </div>
      <div className="content">
        <form onSubmit={salva}>
          <div className="field-group">
            <label className="field-label">ISBN</label>
            <input className="field" placeholder="9788806228473" value={form.isbn} onChange={e=>set("isbn",e.target.value)} inputMode="numeric" required />
          </div>
          <div className="field-group">
            <label className="field-label">Titolo</label>
            <input className="field" placeholder="Titolo del libro" value={form.titolo} onChange={e=>set("titolo",e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Tuo prezzo (€)</label>
              <input className="field" type="number" step="0.01" min="0" placeholder="12.00" value={form.prezzo} onChange={e=>set("prezzo",e.target.value)} required />
            </div>
            <div className="field-group">
              <label className="field-label">Prezzo nuovo (€)</label>
              <input className="field" type="number" step="0.01" min="0" placeholder="28.50" value={form.prezzo_nuovo} onChange={e=>set("prezzo_nuovo",e.target.value)} />
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Condizione</label>
            <div className="pill-group">
              {["ottimo","buono","discreto","usato"].map(c => (
                <button type="button" key={c} className={`pill ${form.condizione===c?"active":""}`} onClick={()=>set("condizione",c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Città</label>
            <input className="field" placeholder="Roma" value={form.citta} onChange={e=>set("citta",e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Note (opzionale)</label>
            <textarea className="field" rows={3} placeholder="Es. pagine non scritte, copertina integra..." value={form.note} onChange={e=>set("note",e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving} style={{marginTop:8}}>
            {saving?"Pubblicazione…":"Pubblica annuncio"}
          </button>
          <div style={{height:40}}/>
        </form>
      </div>
    </div>
  );
}

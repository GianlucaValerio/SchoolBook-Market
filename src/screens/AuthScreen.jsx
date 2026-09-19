import { useState } from "react";
import { signIn, signUp } from "../lib/supabase";

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nome: "", cognome: "", email: "", password: "", citta: "" });
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: null })); };

  const validate = () => {
    const e = {};
    if (!form.email.includes("@")) e.email = "Email non valida";
    if (form.password.length < 6) e.password = "Minimo 6 caratteri";
    if (mode === "registra" && !form.nome.trim()) e.nome = "Obbligatorio";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === "login") await signIn({ email: form.email, password: form.password });
      else await signUp({ email: form.email, password: form.password, nome: form.nome, cognome: form.cognome, citta: form.citta });
      onAuth();
    } catch (err) {
      setErrors({ _global: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen" style={{ paddingBottom: 0 }}>
      <div className="auth-hero">
        <div className="auth-hero-emoji">📚</div>
        <div className="auth-hero-title">LibroScambio</div>
        <div className="auth-hero-sub">Vendi e acquista libri scolastici usati</div>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {["login", "registra"].map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{ flex: 1, height: 44, border: "none", background: "none", fontSize: 14, fontWeight: mode === m ? 600 : 400, color: mode === m ? "var(--indigo)" : "var(--muted)", borderBottom: mode === m ? "2px solid var(--indigo)" : "2px solid transparent", cursor: "pointer", fontFamily: "inherit" }}>
            {m === "login" ? "Accedi" : "Registrati"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} style={{ padding: "24px 20px", flex: 1 }}>
        {errors._global && <div style={{ background: "var(--red-light)", color: "var(--red)", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>{errors._global}</div>}

        {mode === "registra" && (
          <div className="field-row">
            <div className="field-group">
              <label className="field-label">Nome</label>
              <input className={`field ${errors.nome ? "error" : ""}`} placeholder="Mario" value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              {errors.nome && <div className="field-error">{errors.nome}</div>}
            </div>
            <div className="field-group">
              <label className="field-label">Cognome</label>
              <input className="field" placeholder="Rossi" value={form.cognome} onChange={(e) => set("cognome", e.target.value)} />
            </div>
          </div>
        )}

        <div className="field-group">
          <label className="field-label">Email</label>
          <input className={`field ${errors.email ? "error" : ""}`} type="email" placeholder="mario@email.it" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
          {errors.email && <div className="field-error">{errors.email}</div>}
        </div>

        <div className="field-group">
          <label className="field-label">Password</label>
          <input className={`field ${errors.password ? "error" : ""}`} type="password" placeholder="••••••••" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {errors.password && <div className="field-error">{errors.password}</div>}
        </div>

        {mode === "registra" && (
          <div className="field-group">
            <label className="field-label">Città</label>
            <input className="field" placeholder="Roma" value={form.citta} onChange={(e) => set("citta", e.target.value)} />
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? "Caricamento…" : mode === "login" ? "Entra" : "Crea account"}
        </button>
      </form>
    </div>
  );
}

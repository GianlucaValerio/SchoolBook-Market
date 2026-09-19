import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import AuthScreen from "./screens/AuthScreen";
import SearchScreen from "./screens/SearchScreen";
import BookDetailScreen from "./screens/BookDetailScreen";
import ListingsScreen from "./screens/ListingsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AddChildScreen from "./screens/AddChildScreen";
import CreateListingScreen from "./screens/CreateListingScreen";

// Tab bar condivisa
function TabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tabs = [
    { path: "/cerca", icon: "🔍", label: "Cerca" },
    { path: "/annunci", icon: "📦", label: "Annunci" },
    { path: "/profilo", icon: "👤", label: "Profilo" },
  ];
  const active = tabs.find((t) => pathname.startsWith(t.path))?.path;

  return (
    <nav className="tab-bar">
      {tabs.map((t) => (
        <button key={t.path} className={`tab-item ${active === t.path ? "active" : ""}`} onClick={() => navigate(t.path)}>
          <span className="tab-icon">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// Layout con tab bar
function AppLayout() {
  return (
    <>
      <Routes>
        <Route path="/cerca" element={<SearchScreen />} />
        <Route path="/cerca/libro" element={<BookDetailScreen />} />
        <Route path="/annunci" element={<ListingsScreen />} />
        <Route path="/profilo" element={<ProfileScreen />} />
        <Route path="/profilo/aggiungi-figlio" element={<AddChildScreen />} />
        <Route path="/pubblica" element={<CreateListingScreen />} />
        <Route path="*" element={<Navigate to="/cerca" replace />} />
      </Routes>
      <TabBar />
    </>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="app-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <HashRouter>
        {session ? <AppLayout /> : <AuthScreen onAuth={() => {}} />}
      </HashRouter>
    </div>
  );
}

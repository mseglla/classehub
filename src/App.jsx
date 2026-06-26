import { useEffect, useState } from "react";
import AdminPage from "./pages/AdminPage";
import PublicApp from "./pages/PublicApp";
import FamilySignupPage from "./pages/FamilySignupPage";
import { supabase } from "./lib/supabase";

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!email || !password) {
      setMessage("Introdueix email i contrasenya.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      console.error(error);
      setMessage("No s'ha pogut iniciar sessió. Revisa les credencials.");
      return;
    }

    onLogin(data.session);
  }

  return (
    <main className="page admin-login-page">
      <section className="admin-login-card">
        <p className="eyebrow">ClasseHub Admin</p>
        <h1>Accés administració</h1>
        <p>
          Inicia sessió per crear, editar i gestionar els esdeveniments de la classe.
        </p>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@exemple.com"
            />
          </label>

          <label>
            Contrasenya
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Entrant..." : "Entrar"}
          </button>
        </form>

        {message && <p className="admin-message">{message}</p>}
      </section>
    </main>
  );
}

function AdminAuthGate() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session || null);
      setCheckingSession(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
  }

  if (checkingSession) {
    return (
      <main className="page">
        <div className="loading">Comprovant accés...</div>
      </main>
    );
  }

  if (!session) {
    return <AdminLogin onLogin={setSession} />;
  }

  return (
    <>
      <div className="admin-session-bar">
        <span>Admin connectat</span>
        <button type="button" onClick={handleLogout}>
          Tancar sessió
        </button>
      </div>

      <AdminPage session={session} />
    </>
  );
}

function App() {
  const pathname = window.location.pathname;
  const isAdmin = pathname.startsWith("/admin");
  const isFamilySignup = /^\/classe\/[^/]+\/alta\/?$/.test(pathname);

  if (isAdmin) {
    return <AdminAuthGate />;
  }

  if (isFamilySignup) {
    return <FamilySignupPage />;
  }

  return <PublicApp />;
}

export default App;

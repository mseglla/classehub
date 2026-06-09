import AdminPage from "./pages/AdminPage";
import PublicApp from "./pages/PublicApp";

function App() {
  const isAdmin = window.location.pathname.startsWith("/admin");

  if (isAdmin) {
    return <AdminPage />;
  }

  return <PublicApp />;
}

export default App;

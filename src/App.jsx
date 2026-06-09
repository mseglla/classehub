import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Home,
  PartyPopper,
  Vote,
} from "lucide-react";
import { supabase } from "./lib/supabase";
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
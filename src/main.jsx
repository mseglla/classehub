import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./App.css";
import { Analytics } from "@vercel/analytics/react";

createRoot(document.getElementById("root")).render(
    <>
      <App />
      <Analytics />
    </>
  );

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No s'ha pogut registrar el service worker:", error);
    });
  });
}

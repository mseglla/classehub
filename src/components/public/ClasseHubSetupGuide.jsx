import { Bell, Check, CheckCircle2, Share2, Smartphone, X } from "lucide-react";
import "./ClasseHubSetupGuide.css";

export default function ClasseHubSetupGuide({
  onClose,
  onInstall,
  onEnableNotifications,
  canPromptInstall,
  isStandalone,
  notificationsActive,
  notificationsSupported,
  notificationsDenied,
  loading = false,
  statusMessage = "",
}) {
  const userAgent = navigator.userAgent || "";
  const isIos = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const installed = isStandalone;
  const finished = installed && notificationsActive;

  return (
    <div className="ch-setup-backdrop" onClick={onClose}>
      <section
        className="ch-setup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ch-setup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="ch-setup-close"
          onClick={onClose}
          aria-label="Tancar la guia"
        >
          <X size={20} />
        </button>

        <div className="ch-setup-intro">
          <span className="ch-setup-eyebrow">CONFIGURA CLASSEHUB</span>

          <span className="ch-setup-icon">
            {finished ? <CheckCircle2 size={28} /> : <Bell size={28} />}
          </span>

          <h2 id="ch-setup-title">
            {finished ? "Tot a punt!" : "ClasseHub, sempre a mà."}
          </h2>

          <p>
            {finished
              ? "Ja tens ClasseHub instal·lada i les notificacions activades."
              : "Dos petits passos per tenir la classe més a prop."}
          </p>
        </div>

        <div className="ch-setup-steps">
          <div className={`ch-setup-step ${installed ? "is-complete" : "is-current"}`}>
            <span className="ch-setup-step-icon">
              {installed ? <Check size={19} /> : <Smartphone size={19} />}
            </span>
            <div>
              <strong>1. Posa ClasseHub al mòbil</strong>
              <p>
                {installed
                  ? "Ja la tens a la pantalla d'inici."
                  : "Obre-la com qualsevol altra aplicació."}
              </p>
            </div>
            {installed && <CheckCircle2 className="ch-setup-check" size={20} />}
          </div>

          <div
            className={`ch-setup-step ${
              notificationsActive ? "is-complete" : installed ? "is-current" : ""
            }`}
          >
            <span className="ch-setup-step-icon">
              {notificationsActive ? <Check size={19} /> : <Bell size={19} />}
            </span>
            <div>
              <strong>2. Activa les notificacions</strong>
              <p>
                {notificationsActive
                  ? "Els avisos estan activats."
                  : "Permet que ClasseHub t'enviï avisos."}
              </p>
            </div>
            {notificationsActive && (
              <CheckCircle2 className="ch-setup-check" size={20} />
            )}
          </div>
        </div>

        {!installed && (
          <div className="ch-setup-instructions">
            {canPromptInstall ? (
              <>
                <p>Només has de prémer el botó per instal·lar-la.</p>
                <button type="button" className="ch-setup-primary" onClick={onInstall}>
                  Instal·lar ClasseHub
                </button>
              </>
            ) : isIos ? (
              <>
                <strong>Des del navegador del teu iPhone:</strong>
                <p><Share2 size={16} /> Toca el botó de compartir.</p>
                <p>Selecciona «Afegir a la pantalla d'inici».</p>
                <div className="ch-setup-open-app">
                  <strong>Important: obre la nova aplicació!</strong>
                  <p>
                    Torna a la pantalla d'inici de l'iPhone i toca la icona
                    de ClasseHub per continuar amb les notificacions.
                  </p>
                </div>
              </>
            ) : isAndroid ? (
              <>
                <strong>Des de Chrome al teu Android:</strong>
                <p>Obre el menú de tres punts del navegador.</p>
                <p>Selecciona «Instal·lar aplicació» o «Afegir a la pantalla d'inici».</p>
                <div className="ch-setup-open-app">
                  <strong>Important: obre la nova aplicació!</strong>
                  <p>
                    Torna a la pantalla d'inici i toca la icona de ClasseHub
                    per continuar amb les notificacions.
                  </p>
                </div>
              </>
            ) : (
              <>
                <strong>Instal·la ClasseHub al dispositiu</strong>
                <p>Busca l'opció «Instal·lar» o «Afegir a la pantalla d'inici» al menú del navegador.</p>
              </>
            )}
          </div>
        )}

        {installed && !notificationsActive && (
          <div className="ch-setup-instructions">
            {notificationsDenied ? (
              <p>
                Les notificacions estan bloquejades. Hauràs de permetre-les
                des de la configuració del dispositiu o navegador.
              </p>
            ) : notificationsSupported ? (
              <>
                <p>Només falta activar els avisos en aquest dispositiu.</p>
                <button
                  type="button"
                  className="ch-setup-primary"
                  onClick={onEnableNotifications}
                  disabled={loading}
                >
                  {loading ? "Activant..." : "Activar notificacions"}
                </button>
              </>
            ) : (
              <p>Les notificacions no estan disponibles en aquest dispositiu o navegador.</p>
            )}
          </div>
        )}

        {statusMessage && (
          <p className="ch-setup-status" role="status">{statusMessage}</p>
        )}

        <button type="button" className="ch-setup-later" onClick={onClose}>
          {finished ? "Tancar" : "Ara no"}
        </button>
      </section>
    </div>
  );
}

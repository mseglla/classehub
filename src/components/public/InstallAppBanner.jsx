export default function InstallAppBanner({ onInstall, onDismiss }) {
  return (
    <section className="install-app-banner">
      <div>
        <strong>📲 Porta ClasseHub al mòbil</strong>
        <p>Afegeix-la a la pantalla d'inici i tindràs l'agenda sempre a mà.</p>
      </div>

      <div className="install-app-actions">
        <button type="button" onClick={onInstall}>
          Instal·lar
        </button>

        <button type="button" className="ghost-install-button" onClick={onDismiss}>
          Ara no
        </button>
      </div>
    </section>
  );
}

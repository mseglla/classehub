import InstallAppBanner from "./InstallAppBanner";

const familyHelpWhatsappUrl = [
  "https://",
  "wa",
  ".me",
  "/34607931880",
  "?text=Hola%2C%20tinc%20problemes%20per%20accedir%20a%20ClasseHub%20Orenetes",
].join("");

export default function FamilyPinAccessScreen({
  displayClassName,
  displaySchoolYear,
  pinInput,
  setPinInput,
  pinError,
  onSubmit,
  accessEmail,
  setAccessEmail,
  accessEmailStatus,
  accessEmailSending,
  showAccessEmailForm,
  setShowAccessEmailForm,
  onRequestAccessLink,
  showInstallBanner,
  onInstallApp,
  onDismissInstallBanner,
  signupUrl = "/classe/orenetes/alta",
}) {
  return (
    <main className="family-access-page">
      {showInstallBanner && (
        <InstallAppBanner
          onInstall={onInstallApp}
          onDismiss={onDismissInstallBanner}
        />
      )}

      <section className="family-access-card">
        <div className="family-access-logo-row">
          <img src="/icons/logo-base.png" alt="ClasseHub" />
        </div>

        <h1>{displayClassName}</h1>
        <p className="family-access-year">Curs {displaySchoolYear}</p>

        <p className="family-access-intro">
          Entra amb el PIN familiar per veure l'agenda i confirmar activitats.
        </p>

        <form className="family-pin-form" onSubmit={onSubmit}>
          <label>
            PIN familiar
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value)}
              placeholder="Ex. 1638"
              maxLength={8}
            />
          </label>

          {pinError && <p className="family-pin-error">{pinError}</p>}

          <button type="submit">Entrar a ClasseHub</button>
        </form>

        <div className="family-access-recovery">
          <button
            type="button"
            className="family-access-recovery-toggle"
            onClick={() => setShowAccessEmailForm(!showAccessEmailForm)}
          >
            No recordo el PIN
          </button>

          {showAccessEmailForm && (
            <form className="family-access-email-form" onSubmit={onRequestAccessLink}>
              <label>
                Email familiar
                <input
                  type="email"
                  value={accessEmail}
                  onChange={(event) => setAccessEmail(event.target.value)}
                  placeholder="el.teu@email.com"
                />
              </label>

              <button type="submit" disabled={accessEmailSending}>
                {accessEmailSending ? "Enviant..." : "Enviar-me l'enllaç"}
              </button>

              {accessEmailStatus && (
                <p className="family-access-email-status">{accessEmailStatus}</p>
              )}
            </form>
          )}
        </div>

        <div className="family-login-secondary">
          <p>Encara no tens accés?</p>

          <a className="family-register-link" href={signupUrl}>
            Donar-me d'alta com a família
          </a>
        </div>

        <div className="family-login-help">
          <p>Problemes per entrar?</p>

          <a
            className="family-help-whatsapp-link"
            href={familyHelpWhatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            Necessito ajuda per WhatsApp
          </a>
        </div>

        <a className="delegate-access-link family-delegate-link" href="/admin">
          Accés delegats
        </a>
      </section>
    </main>
  );
}

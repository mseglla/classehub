import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Home,
  MessageCircle,
  PartyPopper,
  Vote,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Card, SectionTitle } from "../components/LayoutComponents";
import { daysUntil, formatDate, shortDate } from "../utils/dateHelpers";
import { eventToDetail, typeMeta } from "../utils/eventHelpers";

function getSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const classIndex = parts.indexOf("classe");
  if (classIndex >= 0 && parts[classIndex + 1]) return parts[classIndex + 1];
  return "orenetes";
}

function getFamilyAccessPin(slug) {
  const storageKey = `classehub-family-pin-${slug}`;
  const params = new URLSearchParams(window.location.search);
  const urlPin = params.get("pin")?.trim();

  if (urlPin) {
    window.localStorage.setItem(storageKey, urlPin);
    return urlPin;
  }

  return window.localStorage.getItem(storageKey) || "";
}

function saveFamilyAccessPin(slug, pin) {
  const storageKey = `classehub-family-pin-${slug}`;
  window.localStorage.setItem(storageKey, pin);
}

function formatCalendarDate(date, time) {
  if (!date) return "";
  const cleanTime = time ? time.replace(":", "").slice(0, 4) : "0900";
  return `${date.replaceAll("-", "")}T${cleanTime}00`;
}

function downloadCalendarEvent(item) {
  if (!item?.date) return;

  const startTime = item.time || "09:00";
  const [hours, minutes] = startTime.split(":").map(Number);
  const endTime = `${String(hours + 1).padStart(2, "0")}:${String(minutes || 0).padStart(2, "0")}`;

  const startDate = formatCalendarDate(item.date, startTime);
  const endDate = formatCalendarDate(item.date, endTime);

  const calendarContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ClasseHub//CA",
    "BEGIN:VEVENT",
    `SUMMARY:${item.title}`,
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    item.location ? `LOCATION:${item.location}` : "",
    item.description || item.details ? `DESCRIPTION:${item.description || item.details}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([calendarContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${item.title || "classehub-event"}.ics`;
  link.click();

  URL.revokeObjectURL(url);
}

function InstallAppBanner({ onInstall, onDismiss }) {
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

function FamilyPinAccessScreen({
  displayClassName,
  displaySchoolYear,
  pinInput,
  setPinInput,
  pinError,
  onSubmit,
  showInstallBanner,
  onInstallApp,
  onDismissInstallBanner,
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
        <div className="family-access-badge">ClasseHub</div>

        <div className="family-access-icon">🎒</div>

        <h1>{displayClassName}</h1>
        <p className="family-access-year">{displaySchoolYear}</p>

        <p className="family-access-intro">
          Introdueix el teu PIN familiar per veure l'agenda, confirmar assistència
          i gestionar les inscripcions de la família.
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

        <p className="family-access-help">
          No saps el PIN? Demana'l al delegat o delegada de la classe.
        </p>

        <a className="delegate-access-link" href="/admin">
          Accés delegats
        </a>
      </section>
    </main>
  );
}

function FeedbackModal({
  feedbackType,
  setFeedbackType,
  feedbackMessage,
  setFeedbackMessage,
  feedbackStatus,
  onSubmit,
  onClose,
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal feedback-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>Tancar</button>

        <p className="eyebrow">Bústia de suggeriments</p>
        <h2>Ajuda'ns a millorar ClasseHub</h2>
        <p className="modal-intro">
          Explica'ns qualsevol idea, dubte o error. Ho revisarem per seguir millorant l'espai de la classe.
        </p>

        <form className="registration-form" onSubmit={onSubmit}>
          <label>
            Tipus de missatge
            <select
              value={feedbackType}
              onChange={(event) => setFeedbackType(event.target.value)}
            >
              <option value="millora">Millora</option>
              <option value="error">Error</option>
              <option value="idea">Idea</option>
            </select>
          </label>

          <label className="span-all">
            Missatge
            <textarea
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              placeholder="Explica'ns què milloraries, quin error has trobat o quina idea tens..."
            />
          </label>

          <button className="span-all" type="submit">
            Enviar missatge
          </button>
        </form>

        {feedbackStatus && <p className="admin-message">{feedbackStatus}</p>}
      </article>
    </div>
  );
}


function PrivacyModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal privacy-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>Tancar</button>

        <p className="eyebrow">Privacitat</p>
        <h2>Com fem servir les dades a ClasseHub?</h2>

        <p className="modal-intro">
          ClasseHub és una eina per ajudar les famílies i delegats a organitzar millor les activitats de la classe.
        </p>

        <div className="privacy-content">
          <section>
            <h3>Quines dades es poden utilitzar?</h3>
            <p>
              Podem fer servir el nom de l'infant o família, la classe, les confirmacions d'assistència,
              les inscripcions a activitats, les votacions i els missatges enviats a la bústia.
            </p>
          </section>

          <section>
            <h3>Per a què es fan servir?</h3>
            <p>
              Només per coordinar activitats de la classe: agenda, assistència, inscripcions,
              votacions i comunicacions relacionades amb l'organització.
            </p>
          </section>

          <section>
            <h3>Qui pot veure la informació?</h3>
            <p>
              La informació necessària per coordinar una activitat pot ser visible dins l'espai de la classe.
              Els missatges de la bústia i els detalls de gestió es reserven per als delegats o administradors.
            </p>
          </section>

          <section>
            <h3>Com demanar canvis?</h3>
            <p>
              Si alguna família vol corregir o eliminar alguna dada, pot contactar amb els delegats de la classe.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}

function DetailModal({ item, checklist, onClose }) {
  if (!item) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>Tancar</button>

        <p className="eyebrow">{item.kindLabel}</p>
        <h2>{item.icon} {item.title}</h2>

        {item.date && (
          <div className="detail-grid">
            <div>
              <span>Data</span>
              <strong>{formatDate(item.date)}</strong>
            </div>

            {item.time && (
              <div>
                <span>Hora</span>
                <strong>{item.time}</strong>
              </div>
            )}

            {item.location && (
              <div>
                <span>Lloc</span>
                <strong>{item.location}</strong>
              </div>
            )}
          </div>
        )}

        {item.kind === "event" && item.date && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => downloadCalendarEvent(item)}
          >
            Afegir al calendari
          </button>
        )}

        {item.description && <p className="detail-text">{item.description}</p>}
        {item.details && <p className="detail-text preline">{item.details}</p>}

        {checklist?.length > 0 && (
          <div className="checklist-box">
            <h3>Què cal tenir en compte?</h3>
            <ul>
              {checklist.map((entry) => (
                <li key={entry.id}>
                  <CheckCircle2 size={18} /> {entry.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
    </div>
  );
}

function PollCard({ poll, families, votes, activeFamily, onVote, onOpenResults }) {
  const [familyId, setFamilyId] = useState("");
  const [optionId, setOptionId] = useState("");

  const pollVotes = votes.filter((vote) => vote.poll_id === poll.id);
  const votedFamilies = new Set(pollVotes.map((vote) => vote.family_id));

  async function submitVote(e) {
    e.preventDefault();

    const selectedFamilyId = activeFamily?.id || Number(familyId);

    if (!selectedFamilyId || !optionId) return;

    await onVote(poll.id, Number(optionId), selectedFamilyId);

    if (!activeFamily) {
      setFamilyId("");
    }

    setOptionId("");
  }

  return (
    <div className="poll-card">
      <div>
        <p className="tag">Votació</p>
        <h3>{poll.question}</h3>
        {poll.description && <p>{poll.description}</p>}
        <small>
          {votedFamilies.size}/{families.length} famílies han votat
        </small>
      </div>

      <form className="registration-form" onSubmit={submitVote}>
        {activeFamily ? (
          <div className="span-all linked-family-box">
            <span>Família identificada</span>
            <strong>{activeFamily.student_name}</strong>
          </div>
        ) : (
          <label className="span-all">
            Família
            <select value={familyId} onChange={(e) => setFamilyId(e.target.value)}>
              <option value="">Selecciona família</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {votedFamilies.has(family.id) ? "✓ " : ""}
                  {family.student_name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="span-all">
          Resposta
          <select value={optionId} onChange={(e) => setOptionId(e.target.value)}>
            <option value="">Tria opció</option>
            {poll.ch_poll_options?.map((option) => (
              <option key={option.id} value={option.id}>
                {option.text}
              </option>
            ))}
          </select>
        </label>

        <button className="span-all">Votar</button>
      </form>

      <button className="secondary-action" onClick={() => onOpenResults(poll)}>
        Veure resultats
      </button>
    </div>
  );
}
function PollResultsModal({ poll, families, votes, onClose }) {
  if (!poll) return null;

  const pollVotes = votes.filter((vote) => vote.poll_id === poll.id);
  const votedFamilies = new Set(pollVotes.map((vote) => vote.family_id));

  const pendingFamilies = families.filter(
    (family) => !votedFamilies.has(family.id)
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          Tancar
        </button>

        <p className="eyebrow">Resultats de la votació</p>

        <h3 className="poll-results-title">
  🗳️ Resultats
</h3>

<p className="poll-question">
  {poll.question}
</p>

        {poll.description && <p className="detail-text">{poll.description}</p>}

        <div className="organization-results">
          {poll.ch_poll_options?.map((option) => {
            const optionVotes = pollVotes.filter(
              (vote) => vote.option_id === option.id
            );

            return (
              <div className="result-column" key={option.id}>
                <strong>
                  {option.text} ({optionVotes.length})
                </strong>

                <div className="people-grid">
                  {optionVotes.length === 0 ? (
                    <span className="empty-result">Cap vot encara</span>
                  ) : (
                    optionVotes.map((vote) => {
                      const family = families.find(
                        (entry) => entry.id === vote.family_id
                      );

                      return (
                        <span className="person-card" key={vote.id}>
                          {family?.student_name || "Família"}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          <div className="result-column pending">
            <strong>Pendents ({pendingFamilies.length})</strong>
            <span className="empty-result">
              {pendingFamilies.length} famílies encara no han votat
            </span>
          </div>
        </div>
      </article>
    </div>
  );
}
function getAttendanceData(organization, families, participants, responses) {
  const participantFamilyIds = new Set(
    participants
      .filter((item) => item.organization_id === organization.id)
      .map((item) => item.family_id)
  );

  const availableFamilies = families.filter((family) =>
    participantFamilyIds.has(family.id)
  );

  const orgResponses = responses.filter(
    (item) => item.organization_id === organization.id
  );

  const responseByFamily = new Map(
    orgResponses.map((item) => [item.family_id, item.response])
  );

  const yesFamilies = availableFamilies.filter(
    (family) => responseByFamily.get(family.id) === "sí"
  );

  const noFamilies = availableFamilies.filter(
    (family) => responseByFamily.get(family.id) === "no"
  );

  const pendingFamilies = availableFamilies.filter(
    (family) => !responseByFamily.has(family.id)
  );

  return {
    availableFamilies,
    responseByFamily,
    yesFamilies,
    noFamilies,
    pendingFamilies,
  };
}

function AttendanceOrganizationCard({
  organization,
  families,
  participants,
  responses,
  onOpen,
}) {
  const { yesFamilies, noFamilies, pendingFamilies } = getAttendanceData(
    organization,
    families,
    participants,
    responses
  );

  return (
    <div className="attendance-card">
      <div className="attendance-header">
        <p className="tag">Confirmació</p>
        <h3>{organization.title}</h3>
        {organization.description && <p>{organization.description}</p>}
        {organization.event_date && (
  <small className="org-date">
    {shortDate(organization.event_date)} · {daysUntil(organization.event_date)}
  </small>
)}
      </div>

      <div className="attendance-summary">
        <p className="action-summary">
          <strong>{yesFamilies.length + noFamilies.length}</strong> famílies han respost
        </p>

        <button onClick={() => onOpen(organization)}>
          Respondre
        </button>
      </div>
    </div>
  );
}

function AttendanceOrganizationModal({
  organization,
  families,
  participants,
  responses,
  activeFamily,
  onRespond,
  onClose,
}) {
  const [familyId, setFamilyId] = useState("");
  const [response, setResponse] = useState("");

  if (!organization) return null;

  const {
    availableFamilies,
    responseByFamily,
    yesFamilies,
    noFamilies,
    pendingFamilies,
  } = getAttendanceData(organization, families, participants, responses);

  const activeAvailableFamily =
    activeFamily &&
    availableFamilies.some((family) => family.id === activeFamily.id)
      ? activeFamily
      : null;

  async function submitResponse(event) {
    event.preventDefault();

    const selectedFamilyId = activeAvailableFamily?.id || Number(familyId);

    if (!selectedFamilyId || !response) return;

    await onRespond(organization.id, Number(selectedFamilyId), response);

    if (!activeAvailableFamily) {
      setFamilyId("");
    }

    setResponse("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>Tancar</button>

        <p className="eyebrow">Confirmació</p>
        <h2>🎉 {organization.title}</h2>

        <div className="detail-grid">
          {organization.event_date && (
            <div>
              <span>Data</span>
              <strong>{formatDate(organization.event_date)}</strong>
            </div>
          )}

          {organization.close_date && (
            <div>
              <span>Termini</span>
              <strong>{formatDate(organization.close_date)}</strong>
            </div>
          )}

          {organization.location && (
            <div>
              <span>Lloc</span>
              <strong>{organization.location}</strong>
            </div>
          )}
        </div>

        {organization.description && (
          <p className="detail-text">{organization.description}</p>
        )}

        {organization.question && (
          <div className="checklist-box">
            <h3>{organization.question}</h3>

            <form className="registration-form" onSubmit={submitResponse}>
  {activeAvailableFamily ? (
    <div className="span-all linked-family-box">
      <span>Família identificada</span>
      <strong>{activeAvailableFamily.student_name}</strong>
    </div>
  ) : (
    <label className="span-all">
      Alumne
      <select
        value={familyId}
        onChange={(event) => setFamilyId(event.target.value)}
      >
        <option value="">Selecciona alumne</option>

        {availableFamilies.map((family) => (
          <option key={family.id} value={family.id}>
            {responseByFamily.has(family.id) ? "✓ " : ""}
            {family.student_name}
          </option>
        ))}
      </select>
    </label>
  )}

  <label className="span-all">
    Resposta
    <select
      value={response}
      onChange={(event) => setResponse(event.target.value)}
    >
      <option value="">Selecciona resposta</option>
      <option value="sí">Sí</option>
      <option value="no">No</option>
    </select>
  </label>

  <button className="span-all">
    Guardar resposta
  </button>
</form>
          </div>
        )}

        <div className="organization-results">
          <div className="result-column yes">
            <strong>{yesFamilies.length + noFamilies.length} famílies han respost</strong>
            <span>{yesFamilies.length} sí · {noFamilies.length} no</span>
          </div>
        </div>
      </article>
    </div>
  );
}
function RegistrationOrganizationCard({
  organization,
  families,
  participants,
  registrations,
  onOpen,
  onOpenResults,
}) {
  const participantFamilyIds = new Set(
    participants
      .filter((item) => item.organization_id === organization.id)
      .map((item) => item.family_id)
  );

  const availableFamilies = families.filter((family) =>
    participantFamilyIds.has(family.id)
  );

  const orgRegistrations = registrations.filter(
    (item) => item.organization_id === organization.id
  );

  const totalAdults = orgRegistrations.reduce(
    (sum, item) => sum + (item.adults_count || 0),
    0
  );

  const totalChildren = orgRegistrations.reduce(
    (sum, item) => sum + (item.children_count || 0),
    0
  );

  const totalUnder3 = orgRegistrations.reduce(
    (sum, item) => sum + (item.under3_count || 0),
    0
  );

  const pendingCount = Math.max(availableFamilies.length - orgRegistrations.length, 0);

  return (
    <div className="attendance-card registration-public-card">
      <div className="attendance-header">
        <p className="tag">Inscripció</p>
        <h3>{organization.title}</h3>
        {organization.description && <p>{organization.description}</p>}
        {organization.event_date && (
          <small className="org-date">
            {shortDate(organization.event_date)} · {daysUntil(organization.event_date)}
          </small>
        )}
      </div>

      <div className="attendance-summary registration-card-summary">
        <div className="registration-main-stat">
          <strong>{totalAdults + totalChildren}</strong>
          <span>persones inscrites</span>
        </div>

        <div className="registration-meta-row">
          <span>{orgRegistrations.length} famílies</span>
          <span>{pendingCount} pendents</span>
        </div>

        <div className="pending-action-buttons registration-card-actions">
          <button onClick={() => onOpen(organization)}>
            Inscriure'm
          </button>

          <button
            className="secondary-pending-button"
            onClick={() => onOpenResults(organization)}
          >
            Veure confirmats
          </button>
        </div>
      </div>
    </div>
  );
}
function RegistrationResultsModal({
  organization,
  families,
  participants,
  registrations,
  onClose,
}) {
  if (!organization) return null;

  const participantFamilyIds = new Set(
    participants
      .filter((item) => item.organization_id === organization.id)
      .map((item) => item.family_id)
  );

  const availableFamilies = families.filter((family) =>
    participantFamilyIds.has(family.id)
  );

  const orgRegistrations = registrations.filter(
    (item) => item.organization_id === organization.id
  );

  const registrationByFamily = new Map(
    orgRegistrations.map((item) => [item.family_id, item])
  );

  const confirmedRegistrations = orgRegistrations
    .map((registration) => ({
      ...registration,
      family: families.find((family) => family.id === registration.family_id),
    }))
    .filter((registration) => registration.family);

  const pendingFamilies = availableFamilies.filter(
    (family) => !registrationByFamily.has(family.id)
  );

  const totalAdults = orgRegistrations.reduce(
    (sum, item) => sum + (item.adults_count || 0),
    0
  );

  const totalChildren = orgRegistrations.reduce(
    (sum, item) => sum + (item.children_count || 0),
    0
  );

  const totalUnder3 = orgRegistrations.reduce(
    (sum, item) => sum + (item.under3_count || 0),
    0
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>Tancar</button>

        <p className="eyebrow">Confirmats</p>
        <h2>🎉 {organization.title}</h2>

        <div className="organization-results">
          <div className="result-column adults">
            <strong>{orgRegistrations.length}</strong>
            <span>famílies</span>
          </div>

          <div className="result-column adults">
            <strong>{totalAdults}</strong>
            <span>adults</span>
          </div>

          <div className="result-column children">
            <strong>{totalChildren}</strong>
            <span>infants</span>
          </div>

          <div className="result-column children">
            <strong>{totalUnder3}</strong>
            <span>menors de 3</span>
          </div>
        </div>

        {confirmedRegistrations.length > 0 ? (
          <div className="confirmed-families-box">
            <div className="confirmed-families-header">
              <h3>Famílies confirmades</h3>
              <span>{confirmedRegistrations.length} respostes</span>
            </div>

            <div className="confirmed-families-list">
              {confirmedRegistrations.map((registration) => (
                <div className="confirmed-family-row" key={registration.id}>
                  <strong>{registration.family.student_name}</strong>

                  <span>
                    {registration.adults_count || 0} adults ·{" "}
                    {registration.children_count || 0} infants ·{" "}
                    {registration.under3_count || 0} menors de 3
                  </span>

                  {registration.comment && (
                    <small>{registration.comment}</small>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="detail-text">Encara no hi ha cap família confirmada.</p>
        )}

        {pendingFamilies.length > 0 && (
          <div className="confirmed-families-box">
            <div className="confirmed-families-header">
              <h3>Pendents</h3>
              <span>{pendingFamilies.length} famílies</span>
            </div>

            <div className="confirmed-families-list">
              {pendingFamilies.map((family) => (
                <div className="confirmed-family-row" key={family.id}>
                  <strong>{family.student_name}</strong>
                  <span>Pendent de resposta</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

function RegistrationOrganizationModal({
  organization,
  families,
  participants,
  registrations,
  activeFamily,
  onRegister,
  onClose,
}) {
  const [familyId, setFamilyId] = useState("");
  const [adultsCount, setAdultsCount] = useState(0);
  const [childrenCount, setChildrenCount] = useState(0);
  const [under3Count, setUnder3Count] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!organization || !activeFamily) return;

    const existingRegistration = registrations.find(
      (registration) =>
        registration.organization_id === organization.id &&
        registration.family_id === activeFamily.id
    );

    if (existingRegistration) {
      setAdultsCount(existingRegistration.adults_count || 0);
      setChildrenCount(existingRegistration.children_count || 0);
      setUnder3Count(existingRegistration.under3_count || 0);
      setComment(existingRegistration.comment || "");
    } else {
      setAdultsCount(0);
      setChildrenCount(0);
      setUnder3Count(0);
      setComment("");
    }
  }, [organization?.id, activeFamily?.id, registrations]);

  if (!organization) return null;

  const participantFamilyIds = new Set(
    participants
      .filter((item) => item.organization_id === organization.id)
      .map((item) => item.family_id)
  );

  const availableFamilies = families.filter((family) =>
    participantFamilyIds.has(family.id)
  );

  const orgRegistrations = registrations.filter(
    (item) => item.organization_id === organization.id
  );

  const registrationByFamily = new Map(
    orgRegistrations.map((item) => [item.family_id, item])
  );

  const totalAdults = orgRegistrations.reduce(
    (sum, item) => sum + (item.adults_count || 0),
    0
  );

  const totalChildren = orgRegistrations.reduce(
    (sum, item) => sum + (item.children_count || 0),
    0
  );

  const totalUnder3 = orgRegistrations.reduce(
    (sum, item) => sum + (item.under3_count || 0),
    0
  );

  const pendingFamilies = availableFamilies.filter(
    (family) => !registrationByFamily.has(family.id)
  );

  const activeAvailableFamily =
    activeFamily &&
    availableFamilies.some((family) => family.id === activeFamily.id)
      ? activeFamily
      : null;

  function handleFamilyChange(value) {
    setFamilyId(value);

    const existingRegistration = registrationByFamily.get(Number(value));

    if (existingRegistration) {
      setAdultsCount(existingRegistration.adults_count || 0);
      setChildrenCount(existingRegistration.children_count || 0);
      setUnder3Count(existingRegistration.under3_count || 0);
      setComment(existingRegistration.comment || "");
    } else {
      setAdultsCount(0);
      setChildrenCount(0);
      setUnder3Count(0);
      setComment("");
    }
  }

  async function submitRegistration(event) {
    event.preventDefault();

    const selectedFamilyId = activeAvailableFamily?.id || Number(familyId);

    if (!selectedFamilyId) return;

    await onRegister(
      organization.id,
      selectedFamilyId,
      Number(adultsCount),
      Number(childrenCount),
      Number(under3Count),
      comment
    );

    if (!activeAvailableFamily) {
      setFamilyId("");
      setAdultsCount(0);
      setChildrenCount(0);
      setUnder3Count(0);
      setComment("");
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>Tancar</button>

        <p className="eyebrow">Inscripció</p>
        <h2>🎉 {organization.title}</h2>

        <div className="detail-grid">
          {organization.event_date && (
            <div>
              <span>Data</span>
              <strong>{formatDate(organization.event_date)}</strong>
            </div>
          )}

          {organization.close_date && (
            <div>
              <span>Termini</span>
              <strong>{formatDate(organization.close_date)}</strong>
            </div>
          )}

          {organization.location && (
            <div>
              <span>Lloc</span>
              <strong>{organization.location}</strong>
            </div>
          )}
        </div>

        {organization.description && (
          <p className="detail-text">{organization.description}</p>
        )}

        <div className="checklist-box">
          <h3>Inscripció familiar</h3>

          <form className="registration-form" onSubmit={submitRegistration}>
  {activeAvailableFamily ? (
    <div className="span-all linked-family-box">
      <span>Família identificada</span>
      <strong>{activeAvailableFamily.student_name}</strong>
    </div>
  ) : (
    <label className="span-all">
      Família
      <select value={familyId} onChange={(event) => handleFamilyChange(event.target.value)}>
        <option value="">Selecciona alumne</option>
        {availableFamilies.map((family) => (
          <option key={family.id} value={family.id}>
            {registrationByFamily.has(family.id) ? "✓ " : ""}
            {family.student_name}
          </option>
        ))}
      </select>
    </label>
  )}

  <label>
    Adults
    <input type="number" min="0" value={adultsCount} onChange={(event) => setAdultsCount(Number(event.target.value))}/>
  </label>

  <label>
    Infants
    <input type="number" min="0" value={childrenCount} onChange={(event) => setChildrenCount(Number(event.target.value))} />
  </label>

  <label>
    Menors de 3 anys
    <input type="number" min="0" value={under3Count} onChange={(event) => setUnder3Count(Number(event.target.value))} />
  </label>

  <label className="span-all">
    Comentari opcional
    <input
      type="text"
      value={comment}
      onChange={(event) => setComment(event.target.value)}
      placeholder="Al·lèrgies, dubtes, observacions..."
    />
  </label>

  <button className="span-all">Guardar inscripció</button>
</form>
        </div>

      </article>
    </div>
  );
}

export default function PublicApp() {
  const [slug] = useState(getSlug());
  const [classInfo, setClassInfo] = useState(null);
  const [families, setFamilies] = useState([]);
  const [events, setEvents] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [polls, setPolls] = useState([]);
  const [votes, setVotes] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [organizationParticipants, setOrganizationParticipants] = useState([]);
  const [organizationResponses, setOrganizationResponses] = useState([]);
  const [organizationRegistrations, setOrganizationRegistrations] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [selectedRegistrationResults, setSelectedRegistrationResults] = useState(null);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackType, setFeedbackType] = useState("millora");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [familyAccessPin, setFamilyAccessPin] = useState(() => getFamilyAccessPin(slug));
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");

    const { data: classData, error: classError } = await supabase
      .from("ch_classes")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (classError || !classData) {
      setError("No s'ha trobat aquesta classe.");
      setLoading(false);
      return;
    }

    setClassInfo(classData);

    const classId = classData.id;

    const [
      familiesRes,
      eventsRes,
      checklistRes,
      pollsRes,
      votesRes,
      orgsRes,
      participantsRes,
      responsesRes,
      registrationsRes,
    ] = await Promise.all([
      supabase
        .from("ch_families")
        .select("*")
        .eq("class_id", classId)
        .order("student_name"),
      supabase
        .from("ch_events")
        .select("*")
        .or(`class_id.eq.${classId},and(event_type.eq.escola,class_id.is.null)`)
        .order("start_date"),
      supabase.from("ch_checklist_items").select("*"),
      supabase
        .from("ch_polls")
        .select("*, ch_poll_options(*)")
        .eq("class_id", classId)
        .eq("is_active", true)
        .order("close_date"),
      supabase.from("ch_poll_votes").select("*"),
      supabase
        .from("ch_organizations")
        .select("*")
        .eq("class_id", classId)
        .eq("is_active", true)
        .order("event_date"),
      supabase.from("ch_organization_participants").select("*"),
      supabase.from("ch_organization_responses").select("*"),
      supabase.from("ch_organization_registrations").select("*"),
    ]);

    const firstError = [
      familiesRes,
      eventsRes,
      checklistRes,
      pollsRes,
      votesRes,
      orgsRes,
      participantsRes,
      responsesRes,
      registrationsRes,
    ].find((response) => response.error)?.error;

    if (firstError) {
      console.error(firstError);
      setError("No s'han pogut carregar les dades.");
    } else {
      setFamilies(familiesRes.data || []);
      setEvents(eventsRes.data || []);
      setChecklist(checklistRes.data || []);
      setPolls(pollsRes.data || []);
      setVotes(votesRes.data || []);
      setOrganizations(orgsRes.data || []);
      setOrganizationParticipants(participantsRes.data || []);
      setOrganizationResponses(responsesRes.data || []);
      setOrganizationRegistrations(registrationsRes.data || []);
    }

    setLoading(false);
  }

  async function submitFeedback(event) {
    event.preventDefault();

    if (!feedbackMessage.trim()) {
      setFeedbackStatus("Escriu un missatge abans d'enviar.");
      return;
    }

    const { error } = await supabase.from("ch_feedback").insert({
      class_id: classInfo?.id || null,
      feedback_type: feedbackType,
      message: feedbackMessage.trim(),
    });

    if (error) {
      setFeedbackStatus("No s'ha pogut enviar el missatge. Torna-ho a provar.");
      return;
    }

    setFeedbackMessage("");
    setFeedbackType("millora");
    setFeedbackStatus("Gràcies! Hem rebut el teu missatge.");
  }

  useEffect(() => {
    loadData();
  }, [slug]);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    const dismissedInstallBanner =
      window.localStorage.getItem("classehub-install-banner-dismissed") === "true";

    if (!isStandalone && !dismissedInstallBanner) {
      setShowInstallBanner(true);
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPromptEvent(event);

      if (!dismissedInstallBanner) {
        setShowInstallBanner(true);
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const activeFamily = useMemo(() => {
    if (!familyAccessPin) return null;

    return (
      families.find(
        (family) =>
          String(family.access_pin || "").trim() === String(familyAccessPin).trim()
      ) || null
    );
  }, [families, familyAccessPin]);

  function submitFamilyPin(event) {
    event.preventDefault();

    const cleanPin = pinInput.trim();

    if (!cleanPin) {
      setPinError("Escriu el teu PIN familiar.");
      return;
    }

    const matchedFamily = families.find(
      (family) => String(family.access_pin || "").trim() === cleanPin
    );

    if (!matchedFamily) {
      setPinError("Aquest PIN no coincideix amb cap família de la classe.");
      return;
    }

    saveFamilyAccessPin(slug, cleanPin);
    setFamilyAccessPin(cleanPin);
    setPinInput("");
    setPinError("");
  }

  const futureEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events
      .filter((event) => new Date(`${event.start_date}T00:00:00`) >= today)
      .sort(
        (a, b) =>
          new Date(`${a.start_date}T12:00:00`) -
          new Date(`${b.start_date}T12:00:00`)
      );
  }, [events]);

  const nextEvent = futureEvents[0];

  const nextEventAttendanceOrganization = nextEvent
    ? organizations.find(
        (org) =>
          org.event_id === nextEvent.id &&
          org.organization_type === "attendance"
      )
    : null;

  const nextEventRegistrationOrganization = nextEvent
    ? organizations.find(
        (org) =>
          org.event_id === nextEvent.id &&
          org.organization_type === "registration"
      )
    : null;

  const nextEventActionOrganization =
    nextEventAttendanceOrganization || nextEventRegistrationOrganization;

  const nextEventActionLabel = nextEventAttendanceOrganization
    ? "Confirmar"
    : "Inscriure'm";

  const displayClassName = classInfo?.name
    ? classInfo.name.charAt(0).toUpperCase() + classInfo.name.slice(1)
    : "Orenetes";

  const displaySchoolYear = classInfo?.school_year || "2025-2026";

const visibleEvents = showFullCalendar
  ? futureEvents.slice(1)
  : futureEvents.slice(1, 5);
    async function handleOrganizationRegistration(
      organizationId,
      familyId,
      adultsCount,
      childrenCount,
      under3Count,
      comment
    ) {
      if (!familyAccessPin) {
        alert("Cal accedir amb el PIN familiar per guardar la inscripció.");
        return;
      }

      const registrationRequest = supabase.rpc("register_organization_with_pin", {
        p_organization_id: organizationId,
        p_access_pin: familyAccessPin,
        p_adults_count: adultsCount,
        p_children_count: childrenCount,
        p_under3_count: under3Count,
        p_comment: comment || "",
      });

      const { error: registrationError } = await registrationRequest;
    
      if (registrationError) {
        alert("No s'ha pogut guardar la inscripció.");
        console.error(registrationError);
        return;
      }
    
      await loadData();
    }
  async function handleOrganizationResponse(organizationId, familyId, response) {
    if (!familyAccessPin) {
      alert("Cal accedir amb el PIN familiar per guardar la resposta.");
      return;
    }

    const responseRequest = supabase.rpc("respond_organization_with_pin", {
      p_organization_id: organizationId,
      p_access_pin: familyAccessPin,
      p_response: response,
    });

    const { error: responseError } = await responseRequest;

    if (responseError) {
      alert("No s'ha pogut guardar la resposta.");
      console.error(responseError);
      return;
    }

    await loadData();
  }

  async function handleInstallApp() {
    if (installPromptEvent) {
      installPromptEvent.prompt();

      const result = await installPromptEvent.userChoice;

      if (result.outcome === "accepted") {
        setShowInstallBanner(false);
        window.localStorage.setItem("classehub-install-banner-dismissed", "true");
      }

      setInstallPromptEvent(null);
      return;
    }

    setShowIosInstallHelp(true);
  }

  function dismissInstallBanner() {
    setShowInstallBanner(false);
    window.localStorage.setItem("classehub-install-banner-dismissed", "true");
  }

  async function handleVote(pollId, optionId) {
    if (!familyAccessPin) {
      alert("Cal accedir amb el PIN familiar per votar.");
      return;
    }

    const { error: voteError } = await supabase.rpc("vote_poll_with_pin", {
      p_poll_id: pollId,
      p_option_id: optionId,
      p_access_pin: familyAccessPin,
    });

    if (voteError) {
      alert("No s'ha pogut guardar el vot.");
      console.error(voteError);
      return;
    }

    await loadData();
  }

  const selectedChecklist =
    selectedItem?.kind === "event"
      ? checklist.filter((item) => item.event_id === selectedItem.id)
      : [];

  if (loading) {
    return (
      <main className="page">
        <div className="loading">Carregant l'agenda de les Orenetes...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <div className="loading">{error}</div>
      </main>
    );
  }

  if (!activeFamily) {
    return (
      <FamilyPinAccessScreen
        displayClassName={displayClassName}
        displaySchoolYear={displaySchoolYear}
        pinInput={pinInput}
        setPinInput={setPinInput}
        pinError={
          familyAccessPin && families.length > 0
            ? "El PIN guardat no és vàlid per aquesta classe. Torna'l a introduir."
            : pinError
        }
        onSubmit={submitFamilyPin}
        showInstallBanner={showInstallBanner}
        onInstallApp={handleInstallApp}
        onDismissInstallBanner={dismissInstallBanner}
      />
    );
  }
  
  return (
    <main className="page">
      {showInstallBanner && (
        <InstallAppBanner
          onInstall={handleInstallApp}
          onDismiss={dismissInstallBanner}
        />
      )}

      <header className="hero class-hero">
        <div className="hero-main class-hero-main">
          <div className="class-hero-copy">
            <h1>{displayClassName}</h1>
            <p>{displaySchoolYear}</p>

            {activeFamily && (
              <div className="family-session-banner">
                <span>👋 Benvinguda, família de {activeFamily.student_name}</span>
                <small>Esteu accedint amb el vostre PIN familiar.</small>
              </div>
            )}
          </div>

          <button
            className="suggestion-button"
            type="button"
            onClick={() => setShowFeedbackModal(true)}
          >
            <MessageCircle size={17} />
            <span>Bústia</span>
          </button>
        </div>
      </header>
    
  
      <section className="layout">
        <Card className="span-2 next-event-card clean-next-event-card">
          <div className="next-event-heading">
            <p className="eyebrow">Proper esdeveniment</p>
            {nextEvent && <span>{daysUntil(nextEvent.start_date)}</span>}
          </div>
  
          {nextEvent ? (
            <article className="next-event clean-next-event">
              <div className="next-event-date">
                <strong>{shortDate(nextEvent.start_date)}</strong>
                <span>
                  {nextEvent.start_time
                    ? nextEvent.start_time.slice(0, 5)
                    : "Hora pendent"}
                </span>
              </div>
  
              <div className="next-event-content">
                <span className="event-type-pill">
                  {typeMeta[nextEvent.event_type]?.icon}{" "}
                  {typeMeta[nextEvent.event_type]?.label || "Esdeveniment"}
                </span>

                <h2>{nextEvent.title}</h2>

                <small>
                  {nextEvent.location || "Ubicació pendent"}
                </small>
              </div>
  
              <div className="quick-actions">
                <button
                  className="quick-action"
                  type="button"
                  onClick={() => setSelectedItem(eventToDetail(nextEvent))}
                >
                  + info
                </button>

                {nextEventActionOrganization && (
                  <button
                    className="quick-action quick-action-primary"
                    type="button"
                    onClick={() => {
                      if (nextEventAttendanceOrganization) {
                        setSelectedOrganization(nextEventAttendanceOrganization);
                      } else {
                        setSelectedRegistration(nextEventRegistrationOrganization);
                      }
                    }}
                  >
                    {nextEventActionLabel}
                  </button>
                )}

                {nextEventRegistrationOrganization && (
                  <button
                    className="quick-action"
                    type="button"
                    onClick={() => setSelectedRegistrationResults(nextEventRegistrationOrganization)}
                  >
                    Confirmats
                  </button>
                )}

              </div>
            </article>
          ) : (
            <p>No hi ha cap esdeveniment proper.</p>
          )}
        </Card>
  
        <Card className="span-2">
        <div className="section-title-row">
  <SectionTitle
    icon={<CalendarDays size={22} />}
    title="Agenda d'Orenetes"
    subtitle="Tot el que vols saber, quan ho vols saber."
  />
</div>

<div className="timeline">
  {visibleEvents.map((event) => {
    const linkedAttendanceOrganization = organizations.find(
      (org) => org.event_id === event.id && org.organization_type === "attendance"
    );

    const linkedRegistrationOrganization = organizations.find(
      (org) => org.event_id === event.id && org.organization_type === "registration"
    );

    const linkedActionOrganization =
      linkedAttendanceOrganization || linkedRegistrationOrganization;

    const linkedActionLabel = linkedAttendanceOrganization
      ? "Confirmar"
      : "Inscriure'm";

    return (
      <div
  key={event.id}
  className="timeline-row"
  role="button"
  tabIndex={0}
  onClick={() => setSelectedItem(eventToDetail(event))}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      setSelectedItem(eventToDetail(event));
    }
  }}
>
        <span>
          {shortDate(event.start_date)}
          {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}
        </span>

        <strong>
          {typeMeta[event.event_type]?.icon} {event.title}
        </strong>

        <div className="timeline-actions">
          {linkedActionOrganization && (
            <button
              className="confirm-button"
              type="button"
              onClick={(e) => {
                e.stopPropagation();

                if (linkedAttendanceOrganization) {
                  setSelectedOrganization(linkedAttendanceOrganization);
                } else {
                  setSelectedRegistration(linkedRegistrationOrganization);
                }
              }}
            >
              {linkedActionLabel}
            </button>
          )}

          {linkedRegistrationOrganization && (
            <button
              className="timeline-info-button"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRegistrationResults(linkedRegistrationOrganization);
              }}
            >
              Confirmats
            </button>
          )}

          <button
            className="timeline-calendar-button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              downloadCalendarEvent(eventToDetail(event));
            }}
          >
            + calendari
          </button>

          <button
            className="timeline-info-button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItem(eventToDetail(event));
            }}
          >
            + info
          </button>
        </div>
      </div>
    );
  })}
</div>

<button
  className="secondary-action calendar-more-button"
  onClick={() => setShowFullCalendar((value) => !value)}
>
  {showFullCalendar ? "Veure menys" : "Veure més"}
</button>
        </Card>

        {organizations.length > 0 && (
          <Card className="span-2">
            <SectionTitle
              icon={<PartyPopper size={22} />}
              title="Accions pendents"
              subtitle="Confirma, inscriu-te o revisa el que cal fer."
            />
    
            <div className="org-list">
              {organizations.map((org) =>
                org.organization_type === "attendance" ? (
                  <AttendanceOrganizationCard
                    key={org.id}
                    organization={org}
                    families={families}
                    participants={organizationParticipants}
                    responses={organizationResponses}
                    onOpen={setSelectedOrganization}
                  />
                ) : org.organization_type === "registration" ? (
                  <RegistrationOrganizationCard
                    key={org.id}
                    organization={org}
                    families={families}
                    participants={organizationParticipants}
                    registrations={organizationRegistrations}
                    onOpen={setSelectedRegistration}
                    onOpenResults={setSelectedRegistrationResults}
                  />
                ) : (
                  <a
                    key={org.id}
                    className="org-row"
                    href={org.external_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div>
                      <strong>{org.title}</strong>
                      <p>{org.description}</p>
                    </div>
    
                    {org.external_url && <ExternalLink size={18} />}
                  </a>
                )
              )}
            </div>
          </Card>
        )}
  
  
        {polls.length > 0 && (
          <Card className="span-2">
            <SectionTitle
              icon={<Vote size={22} />}
              title="Votacions obertes"
              subtitle="Decisions sense perdre's al WhatsApp."
            />
    
            <div className="polls">
              {polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  families={families}
                  votes={votes}
                  activeFamily={activeFamily}
                  onVote={handleVote}
                  onOpenResults={setSelectedPoll}
                />
              ))}
            </div>
          </Card>
        )}

      </section>
  
      <footer className="footer">
        <span>
          <Home size={16} /> Ara no hi ha excusa per no estar al dia de tot!
        </span>

        <button
          type="button"
          className="footer-link"
          onClick={() => setShowPrivacyModal(true)}
        >
          Privacitat
        </button>
      </footer>
  
      {showFeedbackModal && (
        <FeedbackModal
          feedbackType={feedbackType}
          setFeedbackType={setFeedbackType}
          feedbackMessage={feedbackMessage}
          setFeedbackMessage={setFeedbackMessage}
          feedbackStatus={feedbackStatus}
          onSubmit={submitFeedback}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}

      {showPrivacyModal && (
        <PrivacyModal onClose={() => setShowPrivacyModal(false)} />
      )}

      {showIosInstallHelp && (
        <div className="modal-backdrop" onClick={() => setShowIosInstallHelp(false)}>
          <article className="modal install-help-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowIosInstallHelp(false)}>
              Tancar
            </button>

            <p className="eyebrow">Instal·lar ClasseHub</p>
            <h2>📲 Afegeix ClasseHub a la pantalla d'inici</h2>

            <div className="install-help-steps">
              <p><strong>iPhone / Safari</strong></p>
              <ol>
                <li>Prem el botó de compartir.</li>
                <li>Tria “Afegir a pantalla d'inici”.</li>
                <li>Confirma amb “Afegir”.</li>
              </ol>

              <p><strong>Android / Chrome</strong></p>
              <ol>
                <li>Obre el menú del navegador.</li>
                <li>Tria “Instal·lar app” o “Afegir a pantalla d'inici”.</li>
              </ol>
            </div>
          </article>
        </div>
      )}

      <DetailModal
        item={selectedItem}
        checklist={selectedChecklist}
        onClose={() => setSelectedItem(null)}
      />
  
      <AttendanceOrganizationModal
        organization={selectedOrganization}
        families={families}
        participants={organizationParticipants}
        responses={organizationResponses}
        activeFamily={activeFamily}
        onRespond={handleOrganizationResponse}
        onClose={() => setSelectedOrganization(null)}
      />
  
      <RegistrationOrganizationModal
        organization={selectedRegistration}
        families={families}
        participants={organizationParticipants}
        registrations={organizationRegistrations}
        activeFamily={activeFamily}
        onRegister={handleOrganizationRegistration}
        onClose={() => setSelectedRegistration(null)}
      />

      <RegistrationResultsModal
        organization={selectedRegistrationResults}
        families={families}
        participants={organizationParticipants}
        registrations={organizationRegistrations}
        onClose={() => setSelectedRegistrationResults(null)}
      />
  
      <PollResultsModal
        poll={selectedPoll}
        families={families}
        votes={votes}
        onClose={() => setSelectedPoll(null)}
      />
    </main>
  );
  }

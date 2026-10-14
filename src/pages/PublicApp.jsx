import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  ExternalLink,
  Home,
  MessageCircle,
  PartyPopper,
  Vote,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import PollCard from "../components/public/PollCard";
import RegistrationOrganizationCard from "../components/public/RegistrationOrganizationCard";
import FamilyPinChangeModal from "../components/public/FamilyPinChangeModal";
import FamilyPinAccessScreen from "../components/public/FamilyPinAccessScreen";
import InstallAppBanner from "../components/public/InstallAppBanner";
import { Card, SectionTitle } from "../components/LayoutComponents";
import { daysUntil, formatDate, shortDate } from "../utils/dateHelpers";
import { eventToDetail, typeMeta } from "../utils/eventHelpers";
import {
  clearFamilyAccessPin,
  getFamilyAccessPin,
  getPublicClassSlug,
  saveFamilyAccessPin,
} from "../utils/familyAccess";
import {
  birthdayPeriods,
  formatBirthdayDate,
  getBirthdayMonthDay,
} from "../utils/birthdayHelpers";
import {
  getNotificationPermission,
  isPushSupported,
  subscribeToPushNotifications,
} from "../utils/pushNotifications";

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

const INLINE_CHECKLIST_LIMIT = 6;

function ChecklistItemsList({
  checklist,
  completedChecklistItemIds = new Set(),
  onToggleChecklistItem,
  className = "checklist-list",
}) {
  return (
    <ul className={className}>
      {checklist.map((entry) => {
        const isDone = completedChecklistItemIds.has(entry.id);
        const canToggle = Boolean(onToggleChecklistItem);

        return (
          <li className={isDone ? "is-done" : ""} key={entry.id}>
            {canToggle ? (
              <button
                className="checklist-toggle-button"
                type="button"
                onClick={() => onToggleChecklistItem(entry.id, !isDone)}
              >
                {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                <span>{entry.text}</span>
              </button>
            ) : (
              <>
                <CheckCircle2 size={18} /> <span>{entry.text}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ChecklistFullModal({
  item,
  checklist,
  completedChecklistItemIds,
  onToggleChecklistItem,
  onClose,
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article
        className="modal checklist-full-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>Tancar</button>

        <p className="eyebrow">Llista</p>
        <h2>{item.icon} {item.title}</h2>
        <p className="checklist-full-intro">
          {completedChecklistItemIds.size} de {checklist.length} punts completats.
        </p>

        <ChecklistItemsList
          checklist={checklist}
          completedChecklistItemIds={completedChecklistItemIds}
          onToggleChecklistItem={onToggleChecklistItem}
          className="checklist-full-list"
        />
      </article>
    </div>
  );
}

function ChecklistSection({
  item,
  checklist,
  completedChecklistItemIds,
  onToggleChecklistItem,
}) {
  const [isFullChecklistOpen, setIsFullChecklistOpen] = useState(false);

  if (!checklist?.length) return null;

  const isLongChecklist = checklist.length > INLINE_CHECKLIST_LIMIT;

  if (!isLongChecklist) {
    return (
      <div className="checklist-box">
        <h3>Què cal tenir en compte?</h3>
        <ChecklistItemsList
          checklist={checklist}
          completedChecklistItemIds={completedChecklistItemIds}
          onToggleChecklistItem={onToggleChecklistItem}
        />
      </div>
    );
  }

  return (
    <>
      <div className="checklist-box checklist-summary-box">
        <button
          className="checklist-open-button"
          type="button"
          onClick={() => setIsFullChecklistOpen(true)}
        >
          Veure llista ({completedChecklistItemIds.size}/{checklist.length})
        </button>
      </div>

      {isFullChecklistOpen && (
        <ChecklistFullModal
          item={item}
          checklist={checklist}
          completedChecklistItemIds={completedChecklistItemIds}
          onToggleChecklistItem={onToggleChecklistItem}
          onClose={() => setIsFullChecklistOpen(false)}
        />
      )}
    </>
  );
}

function DetailModal({
  item,
  checklist,
  completedChecklistItemIds,
  onToggleChecklistItem,
  onClose,
}) {
  if (!item) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>Tancar</button>

        <p className="eyebrow">{item.kindLabel}</p>
        <h2>{item.icon} {item.title}</h2>

        {item.date && (
          <div className="detail-meta">
            <p>
              <span aria-hidden="true">📅</span>
              <strong>{formatDate(item.date)}</strong>
            </p>

            {item.time && (
              <p>
                <span aria-hidden="true">🕘</span>
                <strong>{item.time}</strong>
              </p>
            )}

            {item.location && (
              <p>
                <span aria-hidden="true">📍</span>
                <strong>{item.location}</strong>
              </p>
            )}
          </div>
        )}

        {item.description && <p className="detail-text">{item.description}</p>}
        {item.details && <p className="detail-text preline">{item.details}</p>}

        <ChecklistSection
          item={item}
          checklist={checklist}
          completedChecklistItemIds={completedChecklistItemIds}
          onToggleChecklistItem={onToggleChecklistItem}
        />

        {item.kind === "event" && item.date && (
          <button
            className="secondary-button detail-calendar-button"
            type="button"
            onClick={() => downloadCalendarEvent(item)}
          >
            Afegir al calendari
          </button>
        )}
      </article>
    </div>
  );
}

function PollVoteModal({ poll, activeFamily, onVote, onClose }) {
  const [optionId, setOptionId] = useState("");
  const [selectedOptionIds, setSelectedOptionIds] = useState([]);

  if (!poll) return null;

  const allowsMultipleVotes = poll.allows_multiple_votes === true;

  function toggleSelectedOption(optionId) {
    setSelectedOptionIds((currentOptionIds) => {
      if (currentOptionIds.includes(optionId)) {
        return currentOptionIds.filter((currentOptionId) => currentOptionId !== optionId);
      }

      return [...currentOptionIds, optionId];
    });
  }

  async function submitVote(event) {
    event.preventDefault();

    const selectedVotes = allowsMultipleVotes
      ? selectedOptionIds
      : optionId
        ? [Number(optionId)]
        : [];

    if (selectedVotes.length === 0) return;

    const saved = await onVote(poll.id, selectedVotes);

    if (saved) {
      setOptionId("");
      setSelectedOptionIds([]);
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          Tancar
        </button>

        <p className="eyebrow">Votació</p>
        <h2>🗳️ {poll.question}</h2>

        {poll.description && (
          <p className="detail-text">{poll.description}</p>
        )}

        <div className="checklist-box">
          <h3>{allowsMultipleVotes ? "Pots triar més d’una opció" : "Tria una opció"}</h3>

          <form className="registration-form" onSubmit={submitVote}>
            {activeFamily && (
              <div className="span-all identified-family-compact">
                <span>Família identificada</span>
                <strong>{activeFamily.student_name}</strong>
              </div>
            )}

            {allowsMultipleVotes ? (
              <div className="span-all checkbox-options">
                {poll.ch_poll_options?.map((option) => (
                  <label className="checkbox-row" key={option.id}>
                    <input
                      type="checkbox"
                      checked={selectedOptionIds.includes(option.id)}
                      onChange={() => toggleSelectedOption(option.id)}
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>
            ) : (
              <label className="span-all">
                Resposta
                <select value={optionId} onChange={(event) => setOptionId(event.target.value)}>
                  <option value="">Tria opció</option>
                  {poll.ch_poll_options?.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.text}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button className="span-all">
              Guardar vot
            </button>
          </form>
        </div>
      </article>
    </div>
  );
}

function PollResultsModal({ poll, families, votes, onClose }) {
  const [expandedOptionIds, setExpandedOptionIds] = useState([]);

  if (!poll) return null;

  const pollOptions = [...(poll.ch_poll_options || [])].sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  );

  const pollVotes = votes.filter((vote) => vote.poll_id === poll.id);
  const votedFamilyIds = new Set(pollVotes.map((vote) => vote.family_id));
  const votedFamiliesCount = votedFamilyIds.size;
  const totalFamilies = families.length;
  const pendingFamilies = families.filter(
    (family) => !votedFamilyIds.has(family.id)
  );

  const allowsMultipleVotes = poll.allows_multiple_votes === true;
  const maxVotes = Math.max(
    1,
    ...pollOptions.map(
      (option) =>
        pollVotes.filter((vote) => vote.option_id === option.id).length
    )
  );

  const closeDateText = poll.close_date
    ? new Date(`${poll.close_date}T00:00:00`).toLocaleDateString("ca-ES", {
        day: "numeric",
        month: "short",
      })
    : "Sense data";

  const resultRows = pollOptions
    .map((option) => {
      const optionVotes = pollVotes.filter(
        (vote) => vote.option_id === option.id
      );

      const optionFamilies = optionVotes
        .map((vote) => families.find((family) => family.id === vote.family_id))
        .filter(Boolean)
        .sort((a, b) => a.student_name.localeCompare(b.student_name, "ca"));

      const votedPercentage =
        votedFamiliesCount === 0
          ? 0
          : Math.round((optionVotes.length / votedFamiliesCount) * 100);

      const barPercentage = Math.round((optionVotes.length / maxVotes) * 100);

      return {
        ...option,
        optionVotes,
        optionFamilies,
        votedPercentage,
        barPercentage,
      };
    })
    .sort((a, b) => {
      if (b.optionVotes.length !== a.optionVotes.length) {
        return b.optionVotes.length - a.optionVotes.length;
      }

      return (a.sort_order || 0) - (b.sort_order || 0);
    });

  function toggleExpandedOption(optionId) {
    setExpandedOptionIds((currentOptionIds) => {
      if (currentOptionIds.includes(optionId)) {
        return currentOptionIds.filter(
          (currentOptionId) => currentOptionId !== optionId
        );
      }

      return [...currentOptionIds, optionId];
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal poll-results-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          Tancar
        </button>

        <p className="eyebrow">Resultats de la votació</p>

        <h2 className="poll-results-heading">🗳️ {poll.question}</h2>

        {poll.description && <p className="detail-text">{poll.description}</p>}

        <section className="poll-results-summary" aria-label="Resum de la votació">
          <div>
            <span>Participació</span>
            <strong>
              {votedFamiliesCount}/{totalFamilies}
            </strong>
          </div>

          <div>
            <span>Tancament</span>
            <strong>{closeDateText}</strong>
          </div>

          <div>
            <span>Tipus</span>
            <strong>{allowsMultipleVotes ? "Vot múltiple" : "Vot únic"}</strong>
          </div>
        </section>

        {allowsMultipleVotes && (
          <p className="poll-results-note">
            Cada família pot marcar més d’una opció. Els percentatges són sobre
            les famílies que ja han votat.
          </p>
        )}

        <section className="poll-results-list" aria-label="Opcions més votades">
          {resultRows.map((option, index) => {
            const isExpanded = expandedOptionIds.includes(option.id);
            const isTopOption =
              option.optionVotes.length > 0 &&
              option.optionVotes.length === resultRows[0]?.optionVotes.length;

            return (
              <article
                className={`poll-result-row ${isTopOption ? "poll-result-row-leading" : ""}`}
                key={option.id}
              >
                <div className="poll-result-row-header">
                  <div className="poll-result-option-title">
                    <span className="poll-result-rank">{index + 1}</span>
                    <strong>{option.text}</strong>
                  </div>

                  <div className="poll-result-count">
                    <strong>{option.optionVotes.length}</strong>
                    <span>
                      {option.optionVotes.length === 1 ? "vot" : "vots"}
                    </span>
                  </div>
                </div>

                <div className="poll-result-bar-track" aria-hidden="true">
                  <div
                    className="poll-result-bar"
                    style={{ width: `${option.barPercentage}%` }}
                  />
                </div>

                <div className="poll-result-row-footer">
                  <span>{option.votedPercentage}% de famílies votants</span>

                  <button
                    type="button"
                    className="poll-result-toggle"
                    onClick={() => toggleExpandedOption(option.id)}
                  >
                    {isExpanded ? "Amagar famílies" : `Veure famílies (${option.optionFamilies.length})`}
                  </button>
                </div>

                {isExpanded && (
                  <div className="poll-result-families">
                    {option.optionFamilies.length === 0 ? (
                      <span className="poll-result-empty">Cap vot encara</span>
                    ) : (
                      option.optionFamilies.map((family) => (
                        <span className="person-card" key={family.id}>
                          {family.student_name}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="poll-results-pending">
          <div className="poll-results-pending-header">
            <strong>Famílies pendents</strong>
            <span>{pendingFamilies.length}</span>
          </div>

          {pendingFamilies.length === 0 ? (
            <p>Totes les famílies ja han votat.</p>
          ) : (
            <div className="poll-result-families">
              {pendingFamilies.map((family) => (
                <span className="person-card" key={family.id}>
                  {family.student_name}
                </span>
              ))}
            </div>
          )}
        </section>
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
  activeFamily,
  onOpen,
}) {
  const { availableFamilies, responseByFamily, yesFamilies, noFamilies } = getAttendanceData(
    organization,
    families,
    participants,
    responses
  );

  const answeredCount = yesFamilies.length + noFamilies.length;
  const activeFamilyResponse = activeFamily
    ? responseByFamily.get(activeFamily.id)
    : null;

  return (
    <div className="attendance-card">
      <div className="attendance-header">
        <p className="tag">Confirmació</p>
        <h3>{organization.title}</h3>
        {organization.event_date && (
  <small className="org-date">
    {shortDate(organization.event_date)} · {daysUntil(organization.event_date)}
  </small>
)}
      </div>

      <div className="attendance-summary">
        <p className="action-summary">
          <strong>
            {answeredCount}/{availableFamilies.length}
          </strong>{" "}
          famílies han respost
        </p>

        {activeFamily && (
          <div
            className={`span-all linked-family-box ${
              activeFamilyResponse ? "" : "linked-family-box-pending"
            }`}
          >
            <span>
              {activeFamilyResponse ? "✅ Ja has respost" : "Encara no has respost"}
            </span>
          </div>
        )}

        <div className="pending-action-buttons registration-card-actions">
          <button onClick={() => onOpen(organization)}>
            {activeFamilyResponse ? "Canviar resposta" : "Respondre"}
          </button>

          <button
            className="secondary-pending-button"
            onClick={() => onOpen(organization)}
          >
            Veure respostes
          </button>
        </div>
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

  const answeredCount = yesFamilies.length + noFamilies.length;

  const activeAvailableFamily =
    activeFamily &&
    availableFamilies.some((family) => family.id === activeFamily.id)
      ? activeFamily
      : null;

  async function submitResponse(event) {
    event.preventDefault();

    const selectedFamilyId = activeAvailableFamily?.id || Number(familyId);

    if (!selectedFamilyId || !response) return;

    const saved = await onRespond(organization.id, Number(selectedFamilyId), response);

    if (!saved) return;

    if (!activeAvailableFamily) {
      setFamilyId("");
    }

    setResponse("");
    onClose();
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
    <div className="span-all identified-family-compact">
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

        <p className="action-summary modal-action-summary">
          <strong>{answeredCount}/{availableFamilies.length}</strong>{" "}
          famílies han respost
        </p>
      </article>
    </div>
  );
}
function RegistrationResultsModal({
  organization,
  families,
  participants,
  registrations,
  responses,
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

  const orgResponses = responses.filter(
    (item) => item.organization_id === organization.id
  );

  const registrationByFamily = new Map(
    orgRegistrations.map((item) => [item.family_id, item])
  );

  const responseByFamily = new Map(
    orgResponses.map((item) => [item.family_id, item.response])
  );

  const confirmedRegistrations = orgRegistrations
    .map((registration) => ({
      ...registration,
      family: families.find((family) => family.id === registration.family_id),
    }))
    .filter((registration) => registration.family);

  const notAttendingFamilies = availableFamilies.filter(
    (family) => responseByFamily.get(family.id) === "no"
  );

  const pendingFamilies = availableFamilies.filter(
    (family) => !responseByFamily.has(family.id)
  );

  const totalResponses = confirmedRegistrations.length + notAttendingFamilies.length;

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

  const totalFamilies = availableFamilies.length;
  const pendingCount = pendingFamilies.length;
  const responseProgress =
    totalFamilies > 0 ? Math.round((totalResponses / totalFamilies) * 100) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <article className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>Tancar</button>

        <p className="eyebrow">Respostes</p>
        <h2>🎉 {organization.title}</h2>

        <div className="registration-results-dashboard">
          <section className="registration-progress-card">
            <div className="registration-progress-header">
              <strong>
                {totalResponses}/{totalFamilies} famílies han respost
              </strong>
            </div>

            <div className="registration-progress-track">
              <div
                className="registration-progress-fill"
                style={{ width: `${responseProgress}%` }}
              />
            </div>

            <div className="registration-response-summary">
              <span>
                <strong>{confirmedRegistrations.length}</strong> vindran
              </span>
              <span>
                <strong>{notAttendingFamilies.length}</strong> no vindran
              </span>
            </div>
          </section>

          <section className="registration-attendance-summary">
            <div className="registration-attendance-heading">
              <span>Assistència prevista</span>
            </div>

            <div className="registration-attendance-grid">
              <div className="registration-attendance-card">
                <span>Adults</span>
                <strong>{totalAdults}</strong>
              </div>

              <div className="registration-attendance-card">
                <span>Infants</span>
                <strong>{totalChildren}</strong>
              </div>

              <div className="registration-attendance-card">
                <span>Menors de 3</span>
                <strong>{totalUnder3}</strong>
              </div>
            </div>
          </section>
        </div>

        {confirmedRegistrations.length > 0 && (
          <div className="confirmed-families-box">
            <div className="confirmed-families-header">
              <h3>Famílies inscrites</h3>
              <span>{confirmedRegistrations.length} famílies</span>
            </div>

            <div className="confirmed-families-list">
              {confirmedRegistrations.map((registration) => (
                <div className="confirmed-family-row" key={registration.id}>
                  <div className="confirmed-family-title">
                    <strong>{registration.family.student_name}</strong>
                    {registration.family.grade_label && (
                      <span className="class-birthday-badge">
                        {registration.family.grade_label}
                      </span>
                    )}
                  </div>

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
        )}

        {notAttendingFamilies.length > 0 && (
          <div className="confirmed-families-box">
            <div className="confirmed-families-header">
              <h3>No vindran</h3>
              <span>{notAttendingFamilies.length} famílies</span>
            </div>

            <div className="confirmed-families-list">
              {notAttendingFamilies.map((family) => (
                <div className="confirmed-family-row" key={family.id}>
                  <div className="confirmed-family-title">
                    <strong>{family.student_name}</strong>
                    {family.grade_label && (
                      <span className="class-birthday-badge">
                        {family.grade_label}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                  <div className="confirmed-family-title">
                    <strong>{family.student_name}</strong>
                    {family.grade_label && (
                      <span className="class-birthday-badge">
                        {family.grade_label}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

function CountStepper({ label, value, onChange, min = 0, max = 5 }) {
  function decrease() {
    onChange(Math.max(min, Number(value || 0) - 1));
  }

  function increase() {
    onChange(Math.min(max, Number(value || 0) + 1));
  }

  return (
    <div className="count-stepper">
      <span>{label}</span>

      <div className="count-stepper-controls">
        <button
          type="button"
          onClick={decrease}
          disabled={Number(value || 0) <= min}
          aria-label={`Restar ${label.toLowerCase()}`}
        >
          −
        </button>

        <strong>{Number(value || 0)}</strong>

        <button
          type="button"
          onClick={increase}
          disabled={Number(value || 0) >= max}
          aria-label={`Sumar ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function RegistrationOrganizationModal({
  organization,
  families,
  participants,
  registrations,
  responses,
  activeFamily,
  onRegister,
  onRespond,
  onClose,
}) {
  const [familyId, setFamilyId] = useState("");
  const [attendanceChoice, setAttendanceChoice] = useState("attending");
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

    const existingResponse = responses.find(
      (response) =>
        response.organization_id === organization.id &&
        response.family_id === activeFamily.id
    );

    if (existingRegistration) {
      setAttendanceChoice("attending");
      setAdultsCount(existingRegistration.adults_count || 0);
      setChildrenCount(existingRegistration.children_count || 0);
      setUnder3Count(existingRegistration.under3_count || 0);
      setComment(existingRegistration.comment || "");
    } else {
      setAttendanceChoice(existingResponse?.response === "no" ? "not_attending" : "attending");
      setAdultsCount(1);
      setChildrenCount(0);
      setUnder3Count(0);
      setComment("");
    }
  }, [organization?.id, activeFamily?.id, registrations, responses]);

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

  function selectAttendanceChoice(choice) {
    setAttendanceChoice(choice);

    if (choice === "attending" && Number(adultsCount) < 1) {
      setAdultsCount(1);
    }
  }

  function handleFamilyChange(value) {
    setFamilyId(value);

    const existingRegistration = registrationByFamily.get(Number(value));

    if (existingRegistration) {
      setAdultsCount(existingRegistration.adults_count || 0);
      setChildrenCount(existingRegistration.children_count || 0);
      setUnder3Count(existingRegistration.under3_count || 0);
      setComment(existingRegistration.comment || "");
    } else {
      setAdultsCount(1);
      setChildrenCount(0);
      setUnder3Count(0);
      setComment("");
    }
  }

  async function submitRegistration(event) {
    event.preventDefault();

    const selectedFamilyId = activeAvailableFamily?.id || Number(familyId);

    if (!selectedFamilyId) return;

    if (Number(adultsCount) < 1) {
      alert("Cal indicar com a mínim 1 adult per guardar la inscripció.");
      return;
    }

    const saved = await onRegister(
      organization.id,
      selectedFamilyId,
      Number(adultsCount),
      Number(childrenCount),
      Number(under3Count),
      comment
    );

    if (!saved) return;

    if (!activeAvailableFamily) {
      setFamilyId("");
      setAdultsCount(0);
      setChildrenCount(0);
      setUnder3Count(0);
      setComment("");
    }

    onClose();
  }

  async function submitNotAttending() {
    const selectedFamilyId = activeAvailableFamily?.id || Number(familyId);

    if (!selectedFamilyId) return;

    const saved = await onRespond(
      organization.id,
      selectedFamilyId,
      "no",
      "Resposta guardada correctament."
    );

    if (!saved) return;

    if (!activeAvailableFamily) {
      setFamilyId("");
    }

    setAdultsCount(0);
    setChildrenCount(0);
    setUnder3Count(0);
    setComment("");
    onClose();
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

        {activeAvailableFamily && (
          <div className="identified-family-compact">
            <span>Família identificada</span>
            <strong>{activeAvailableFamily.student_name}</strong>
          </div>
        )}

        <div className="checklist-box registration-response-box">
          <h3>Resposta familiar</h3>

          <form className="registration-form" onSubmit={submitRegistration}>
            {!activeAvailableFamily && (
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

            <div className="span-all registration-choice-grid">
              <button
                className={`registration-choice-button ${
                  attendanceChoice === "attending" ? "registration-choice-button-active attending" : ""
                }`}
                type="button"
                onClick={() => selectAttendanceChoice("attending")}
              >
                <strong>Vindrem!</strong>
              </button>

              <button
                className={`registration-choice-button ${
                  attendanceChoice === "not_attending" ? "registration-choice-button-active not-attending" : ""
                }`}
                type="button"
                onClick={() => selectAttendanceChoice("not_attending")}
              >
                <strong>No podrem venir</strong>
              </button>
            </div>

            {attendanceChoice === "attending" ? (
              <>
                <CountStepper
                  label="Adults"
                  value={adultsCount}
                  onChange={setAdultsCount}
                  min={1}
                  max={4}
                />

                <CountStepper
                  label="Infants"
                  value={childrenCount}
                  onChange={setChildrenCount}
                  max={5}
                />

                <CountStepper
                  label="Menors de 3 anys"
                  value={under3Count}
                  onChange={setUnder3Count}
                  max={3}
                />

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
              </>
            ) : (
              <div className="span-all not-attending-box">
                <p>La família no podrà assistir-hi.</p>

                <button type="button" onClick={submitNotAttending}>
                  Guardar resposta
                </button>
              </div>
            )}
          </form>
        </div>

      </article>
    </div>
  );
}

export default function PublicApp() {
  const [slug] = useState(getPublicClassSlug());
  const [classInfo, setClassInfo] = useState(null);
  const [families, setFamilies] = useState([]);
  const [events, setEvents] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [checklistItemStatus, setChecklistItemStatus] = useState([]);
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
  const [selectedPollVote, setSelectedPollVote] = useState(null);
  const [directPollHandled, setDirectPollHandled] = useState(false);
  const [directOrganizationHandled, setDirectOrganizationHandled] = useState(false);

  const directPollId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const pollParam = params.get("poll");
    const orgParam = params.get("org");
    const parsedPollId = Number(pollParam);

    return Number.isFinite(parsedPollId) && parsedPollId > 0
      ? parsedPollId
      : null;
  }, [slug]);

  const directOrganizationId = useMemo(() => {
    const orgParam = new URLSearchParams(window.location.search).get("org");
    const parsedOrganizationId = Number(orgParam);

    return Number.isFinite(parsedOrganizationId) && parsedOrganizationId > 0
      ? parsedOrganizationId
      : null;
  }, [slug]);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackType, setFeedbackType] = useState("millora");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [actionStatusMessage, setActionStatusMessage] = useState("");
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [familyAccessPin, setFamilyAccessPin] = useState(() => getFamilyAccessPin(slug));
  const [activeFamilyFromPin, setActiveFamilyFromPin] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [accessEmailStatus, setAccessEmailStatus] = useState("");
  const [accessEmailSending, setAccessEmailSending] = useState(false);
  const [showAccessEmailForm, setShowAccessEmailForm] = useState(false);
  const [showPinChangeModal, setShowPinChangeModal] = useState(false);
  const [currentFamilyPin, setCurrentFamilyPin] = useState("");
  const [newFamilyPin, setNewFamilyPin] = useState("");
  const [repeatFamilyPin, setRepeatFamilyPin] = useState("");
  const [pinChangeStatus, setPinChangeStatus] = useState("");
  const [pinChangeLoading, setPinChangeLoading] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);
  const [pushStatus, setPushStatus] = useState(() => getNotificationPermission());
  const [pushLoading, setPushLoading] = useState(false);
  const [activePublicSection, setActivePublicSection] = useState("agenda");

  const agendaSectionRef = useRef(null);
  const actionsSectionRef = useRef(null);
  const pollsSectionRef = useRef(null);
  const classSectionRef = useRef(null);

  function scrollToPublicSection(sectionRef, sectionId) {
    setActivePublicSection(sectionId);

    sectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function loadData({ showLoading = true } = {}) {
    if (showLoading) {
      setLoading(true);
    }

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
      checklistStatusRes,
    ] = await Promise.all([
      supabase.rpc("get_public_families_for_class", {
        p_class_id: classId,
      }),
      supabase
        .from("ch_events")
        .select("*")
        .or(`class_id.eq.${classId},and(event_type.eq.escola,class_id.is.null)`)
        .order("start_date"),
      supabase
        .from("ch_checklist_items")
        .select("*")
        .order("event_id", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
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
      familyAccessPin
        ? supabase.rpc("get_checklist_item_status_with_pin", {
            p_class_id: classId,
            p_access_pin: familyAccessPin,
          })
        : Promise.resolve({ data: [], error: null }),
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
      checklistStatusRes,
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
      setChecklistItemStatus(checklistStatusRes.data || []);
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
    function updateActivePublicSection() {
      const sections = [
        { id: "agenda", ref: agendaSectionRef },
        { id: "actions", ref: actionsSectionRef },
        { id: "polls", ref: pollsSectionRef },
        { id: "class", ref: classSectionRef },
      ];

      const currentSection = sections
        .map((section) => ({
          id: section.id,
          top: section.ref.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
        }))
        .filter((section) => section.top <= 160)
        .sort((a, b) => b.top - a.top)[0];

      if (currentSection) {
        setActivePublicSection(currentSection.id);
      }
    }

    updateActivePublicSection();
    window.addEventListener("scroll", updateActivePublicSection, { passive: true });
    window.addEventListener("resize", updateActivePublicSection);

    return () => {
      window.removeEventListener("scroll", updateActivePublicSection);
      window.removeEventListener("resize", updateActivePublicSection);
    };
  }, [loading]);

  useEffect(() => {
    setDirectPollHandled(false);
  }, [slug, directPollId]);

  useEffect(() => {
    setDirectOrganizationHandled(false);
  }, [slug, directOrganizationId]);

  useEffect(() => {
    if (!directPollId || directPollHandled || loading || polls.length === 0) {
      return;
    }

    const directPoll = polls.find((poll) => poll.id === directPollId);

    if (!directPoll) {
      return;
    }

    setSelectedPollVote(directPoll);
    setDirectPollHandled(true);

    window.setTimeout(() => {
      scrollToPublicSection(pollsSectionRef, "polls");
    }, 100);
  }, [directPollId, directPollHandled, loading, polls]);

  useEffect(() => {
    if (
      !directOrganizationId ||
      directOrganizationHandled ||
      loading ||
      organizations.length === 0
    ) {
      return;
    }

    const directOrganization = organizations.find(
      (organization) => organization.id === directOrganizationId
    );

    if (!directOrganization) {
      return;
    }

    if (directOrganization.organization_type === "attendance") {
      setSelectedOrganization(directOrganization);
    } else if (directOrganization.organization_type === "registration") {
      setSelectedRegistration(directOrganization);
    } else {
      return;
    }

    setDirectOrganizationHandled(true);

    window.setTimeout(() => {
      scrollToPublicSection(actionsSectionRef, "actions");
    }, 100);
  }, [
    directOrganizationId,
    directOrganizationHandled,
    loading,
    organizations,
  ]);

  useEffect(() => {
    loadData();
  }, [slug]);

  useEffect(() => {
    async function loadFamilyFromSavedPin() {
      if (!classInfo?.id || !familyAccessPin || activeFamilyFromPin) return;

      const { data, error } = await supabase.rpc("get_family_by_pin", {
        p_class_id: classInfo.id,
        p_access_pin: familyAccessPin,
      });

      const matchedFamily = data?.[0] || null;

      if (error || !matchedFamily) {
        clearFamilyAccessPin(slug);
        setFamilyAccessPin("");
        setActiveFamilyFromPin(null);
        setPinError("");
        return;
      }

      setActiveFamilyFromPin(matchedFamily);
      setPinError("");
    }

    loadFamilyFromSavedPin();
  }, [classInfo?.id, familyAccessPin, activeFamilyFromPin]);

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

  const activeFamily = activeFamilyFromPin;

  const pushStatusLabel = {
    granted: "Notificacions activades",
    "test-sent": "Push de prova enviada",
    denied: "Permís de notificacions denegat",
    "PERMISSION_DENIED": "Permís de notificacions denegat",
    unsupported: "Aquest dispositiu no suporta notificacions web",
    NOT_SUPPORTED: "Aquest dispositiu no suporta notificacions web",
    MISSING_VAPID_PUBLIC_KEY: "Falta configurar la clau pública de notificacions",
    SAVE_FAILED: "No s'han pogut guardar les notificacions",
    NO_ACTIVE_SUBSCRIPTIONS: "No hi ha cap dispositiu subscrit",
    MISSING_VAPID_KEYS: "Falten claus VAPID al servidor",
    TEST_PUSH_FAILED: "No s'ha pogut enviar la push de prova",
    "missing-family": "Cal entrar amb el PIN familiar",
    error: "No s'han pogut activar les notificacions",
  }[pushStatus];

  function hasActiveFamilyResponded(organization) {
    if (!activeFamily || !organization) return false;

    return organizationResponses.some(
      (response) =>
        response.organization_id === organization.id &&
        response.family_id === activeFamily.id
    );
  }

  function hasActiveFamilyRegistered(organization) {
    if (!activeFamily || !organization) return false;

    return organizationRegistrations.some(
      (registration) =>
        registration.organization_id === organization.id &&
        registration.family_id === activeFamily.id
    );
  }

  function getAgendaActionState(attendanceOrganization, registrationOrganization) {
    if (attendanceOrganization) {
      const completed = hasActiveFamilyResponded(attendanceOrganization);

      return {
        completed,
        label: completed ? "Ja has confirmat" : "Confirmar",
      };
    }

    if (registrationOrganization) {
      const completed = hasActiveFamilyRegistered(registrationOrganization);

      return {
        completed,
        label: completed ? "Ja t'has inscrit" : "Inscriure'm",
      };
    }

    return {
      completed: false,
      label: "",
    };
  }

  async function handleEnablePushNotifications() {
    if (!activeFamily || !classInfo?.id) {
      setPushStatus("missing-family");
      return;
    }

    if (!isPushSupported()) {
      setPushStatus("unsupported");
      return;
    }

    setPushLoading(true);
    setPushStatus("");

    try {
      const result = await subscribeToPushNotifications({
        familyId: activeFamily.id,
        classId: classInfo.id,
      });

      if (result.success) {
        setPushStatus("granted");
      } else {
        setPushStatus(result.error || "error");
      }
    } catch (error) {
      console.error("Push subscription error:", error);
      setPushStatus("error");
    } finally {
      setPushLoading(false);
    }
  }

  async function handleSendTestPushNotification() {
    if (!activeFamily) {
      setPushStatus("missing-family");
      return;
    }

    setPushLoading(true);
    setPushStatus("");

    try {
      const response = await fetch("/api/send-test-push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          familyId: activeFamily.id,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setPushStatus(payload.error || "TEST_PUSH_FAILED");
        return;
      }

      setPushStatus("test-sent");
    } catch (error) {
      console.error("Test push error:", error);
      setPushStatus("TEST_PUSH_FAILED");
    } finally {
      setPushLoading(false);
    }
  }

  async function submitFamilyPin(event) {
    event.preventDefault();

    const cleanPin = pinInput.trim();

    if (!cleanPin) {
      setPinError("Escriu el teu PIN familiar.");
      return;
    }

    if (!classInfo?.id) {
      setPinError("Encara no s'ha carregat la classe. Torna-ho a provar.");
      return;
    }

    const { data, error } = await supabase.rpc("get_family_by_pin", {
      p_class_id: classInfo.id,
      p_access_pin: cleanPin,
    });

    const matchedFamily = data?.[0] || null;

    if (error || !matchedFamily) {
      setPinError("Aquest PIN no coincideix amb cap família de la classe.");
      return;
    }

    setActiveFamilyFromPin(matchedFamily);
    saveFamilyAccessPin(slug, cleanPin);
    setFamilyAccessPin(cleanPin);
    setPinInput("");
    setPinError("");
  }

  async function requestFamilyAccessLink(event) {
    event.preventDefault();

    const cleanEmail = accessEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setAccessEmailStatus("Escriu el teu email.");
      return;
    }

    setAccessEmailSending(true);
    setAccessEmailStatus("");

    const pollParam = new URLSearchParams(window.location.search).get("poll");

    try {
      await fetch("/api/send-family-access-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          classSlug: slug,
          email: cleanEmail,
          pollId: pollParam ? Number(pollParam) : null,
          organizationId: orgParam ? Number(orgParam) : null,
        }),
      });

      setAccessEmail("");
      setAccessEmailStatus(
        "Si aquest correu està registrat, rebràs un enllaç d'accés en uns minuts."
      );
    } catch (error) {
      console.error(error);
      setAccessEmailStatus(
        "No s'ha pogut enviar l'enllaç ara mateix. Torna-ho a provar."
      );
    } finally {
      setAccessEmailSending(false);
    }
  }

  async function changeFamilyPin(event) {
    event.preventDefault();

    const cleanCurrentPin = currentFamilyPin.trim();
    const cleanNewPin = newFamilyPin.trim();
    const cleanRepeatPin = repeatFamilyPin.trim();

    if (!/^\d{4}$/.test(cleanCurrentPin)) {
      setPinChangeStatus("Escriu el PIN actual de 4 números.");
      return;
    }

    if (!/^\d{4}$/.test(cleanNewPin)) {
      setPinChangeStatus("El nou PIN ha de tenir exactament 4 números.");
      return;
    }

    if (cleanNewPin !== cleanRepeatPin) {
      setPinChangeStatus("Els dos PIN no coincideixen.");
      return;
    }

    if (cleanNewPin === cleanCurrentPin) {
      setPinChangeStatus("El nou PIN ha de ser diferent de l'actual.");
      return;
    }

    if (!classInfo?.id || !familyAccessPin) {
      setPinChangeStatus("No s'ha pogut validar l'accés familiar.");
      return;
    }

    setPinChangeLoading(true);
    setPinChangeStatus("");

    const { data, error } = await supabase.rpc("change_family_access_pin", {
      p_class_id: classInfo.id,
      p_current_pin: cleanCurrentPin,
      p_new_pin: cleanNewPin,
    });

    const result = data?.[0];

    if (error || !result?.success) {
      const errorMessages = {
        CURRENT_PIN_NOT_FOUND: "El PIN actual ja no és vàlid. Torna a entrar.",
        NEW_PIN_INVALID: "El nou PIN ha de tenir exactament 4 números.",
        PIN_UNCHANGED: "El nou PIN ha de ser diferent de l'actual.",
        NEW_PIN_ALREADY_USED: "Aquest PIN ja l'està fent servir una altra família de la classe.",
      };

      setPinChangeStatus(
        errorMessages[result?.message] || "No s'ha pogut canviar el PIN."
      );
      setPinChangeLoading(false);
      return;
    }

    saveFamilyAccessPin(slug, cleanNewPin);
    setFamilyAccessPin(cleanNewPin);
    setCurrentFamilyPin("");
    setNewFamilyPin("");
    setRepeatFamilyPin("");
    setPinChangeStatus("PIN actualitzat correctament.");

    window.setTimeout(() => {
      setShowPinChangeModal(false);
      setPinChangeStatus("");
    }, 900);

    setPinChangeLoading(false);
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

  const visibleOrganizations = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eventById = new Map(events.map((event) => [event.id, event]));

    return organizations.filter((organization) => {
      if (organization.close_date) {
        const closeDate = new Date(`${organization.close_date}T23:59:59`);
        if (closeDate < today) {
          return false;
        }
      }

      if (!organization.event_id) {
        return true;
      }

      const linkedEvent = eventById.get(organization.event_id);

      if (!linkedEvent?.start_date) {
        return false;
      }

      const eventDate = new Date(`${linkedEvent.start_date}T00:00:00`);
      return eventDate >= today;
    });
  }, [events, organizations]);

  const nextEvent = futureEvents[0];

  const nextEventAttendanceOrganization = nextEvent
    ? visibleOrganizations.find(
        (org) =>
          org.event_id === nextEvent.id &&
          org.organization_type === "attendance"
      )
    : null;

  const nextEventRegistrationOrganization = nextEvent
    ? visibleOrganizations.find(
        (org) =>
          org.event_id === nextEvent.id &&
          org.organization_type === "registration"
      )
    : null;

  const nextEventActionOrganization =
    nextEventAttendanceOrganization || nextEventRegistrationOrganization;

  const nextEventActionState = getAgendaActionState(
    nextEventAttendanceOrganization,
    nextEventRegistrationOrganization
  );

  const displayClassName = classInfo?.name
    ? classInfo.name.charAt(0).toUpperCase() + classInfo.name.slice(1)
    : "Orenetes";

  const displaySchoolYear = classInfo?.school_year || "";
  const agendaTitle = displayClassName.match(/^[AEIOUÀÈÉÍÒÓÚH]/i)
    ? `Agenda d'${displayClassName}`
    : `Agenda de ${displayClassName}`;

const visibleEvents = showFullCalendar
  ? futureEvents.slice(1)
  : futureEvents.slice(1, 5);

  const birthdayGroups = useMemo(
    () =>
      birthdayPeriods.map((period) => {
        const periodFamilies = families
          .filter((family) => {
            const birthday = getBirthdayMonthDay(family.child_birth_date);
            return (
              birthday &&
              birthday.month >= period.startMonth &&
              birthday.month <= period.endMonth
            );
          })
          .sort((a, b) => {
            const birthdayA = getBirthdayMonthDay(a.child_birth_date);
            const birthdayB = getBirthdayMonthDay(b.child_birth_date);

            return (
              birthdayA.month - birthdayB.month ||
              birthdayA.day - birthdayB.day ||
              a.student_name.localeCompare(b.student_name)
            );
          });

        return {
          ...period,
          families: periodFamilies,
        };
      }),
    [families]
  );

  const familiesWithoutBirthday = families
    .filter((family) => !getBirthdayMonthDay(family.child_birth_date))
    .sort((a, b) => a.student_name.localeCompare(b.student_name));

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
        return false;
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
        return false;
      }
    
      await loadData({ showLoading: false });
      showActionStatus("Inscripció guardada correctament.");
      return true;
    }
  async function handleOrganizationResponse(
    organizationId,
    familyId,
    response,
    successMessage = "Confirmació guardada correctament."
  ) {
    if (!familyAccessPin) {
      alert("Cal accedir amb el PIN familiar per guardar la resposta.");
      return false;
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
      return false;
    }

    await loadData({ showLoading: false });
    showActionStatus(successMessage);
    return true;
  }

  async function handleToggleChecklistItem(checklistItemId, isDone) {
    if (!familyAccessPin || !classInfo?.id) {
      alert("Cal accedir amb el PIN familiar per guardar la llista.");
      return;
    }

    const { error: checklistStatusError } = await supabase.rpc(
      "set_checklist_item_status_with_pin",
      {
        p_class_id: classInfo.id,
        p_access_pin: familyAccessPin,
        p_checklist_item_id: checklistItemId,
        p_is_done: isDone,
      }
    );

    if (checklistStatusError) {
      alert("No s'ha pogut guardar aquest punt de la llista.");
      console.error(checklistStatusError);
      return;
    }

    setChecklistItemStatus((currentStatus) => {
      const withoutCurrentItem = currentStatus.filter(
        (status) =>
          !(
            status.family_id === activeFamily?.id &&
            status.checklist_item_id === checklistItemId
          )
      );

      if (!isDone || !activeFamily?.id) {
        return withoutCurrentItem;
      }

      return [
        ...withoutCurrentItem,
        {
          checklist_item_id: checklistItemId,
          family_id: activeFamily.id,
          is_done: true,
        },
      ];
    });
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

  function showActionStatus(message) {
    setActionStatusMessage(message);

    window.setTimeout(() => {
      setActionStatusMessage("");
    }, 4000);
  }

  async function handleVote(pollId, optionIds) {
    if (!familyAccessPin) {
      alert("Cal accedir amb el PIN familiar per votar.");
      return false;
    }

    const selectedOptionIds = Array.isArray(optionIds) ? optionIds : [optionIds];

    const { error: voteError } = await supabase.rpc("vote_poll_with_pin_options", {
      p_poll_id: pollId,
      p_option_ids: selectedOptionIds,
      p_access_pin: familyAccessPin,
    });

    if (voteError) {
      alert("No s'ha pogut guardar el vot.");
      console.error(voteError);
      return false;
    }

    await loadData({ showLoading: false });
    showActionStatus("Votació guardada correctament.");
    return true;
  }

  function checklistHasGroups(items) {
    return items.some(
      (item) => Array.isArray(item.target_groups) && item.target_groups.length > 0
    );
  }

  function getVisibleChecklistItems(items, gradeLabel) {
    const hasGroups = checklistHasGroups(items);

    if (!hasGroups) {
      return items;
    }

    if (!gradeLabel) {
      return items;
    }

    return items.filter((item) => {
      const groups = item.target_groups || [];
      return groups.length === 0 || groups.includes(gradeLabel);
    });
  }

  const eventChecklist =
    selectedItem?.kind === "event"
      ? checklist.filter((item) => item.event_id === selectedItem.id)
      : [];

  const selectedChecklist = getVisibleChecklistItems(
    eventChecklist,
    activeFamily?.grade_label
  );

  const completedChecklistItemIds = new Set(
    checklistItemStatus
      .filter((status) => status.family_id === activeFamily?.id && status.is_done)
      .map((status) => status.checklist_item_id)
  );

  if (loading) {
    return (
      <main className="page">
        <div className="loading">
          Carregant l'agenda de {slug === "senglars" ? "Senglars" : "Orenetes"}...
        </div>
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
        accessEmail={accessEmail}
        setAccessEmail={setAccessEmail}
        accessEmailStatus={accessEmailStatus}
        accessEmailSending={accessEmailSending}
        showAccessEmailForm={showAccessEmailForm}
        setShowAccessEmailForm={setShowAccessEmailForm}
        onRequestAccessLink={requestFamilyAccessLink}
        showInstallBanner={showInstallBanner}
        onInstallApp={handleInstallApp}
        onDismissInstallBanner={dismissInstallBanner}
      />
    );
  }
  
  return (
    <main className="page">
      {actionStatusMessage && (
        <div className="action-toast" role="status" aria-live="polite">
          {actionStatusMessage}
        </div>
      )}

      {showInstallBanner && (
        <InstallAppBanner
          onInstall={handleInstallApp}
          onDismiss={dismissInstallBanner}
        />
      )}

      <header className="hero class-hero">
        <div className="hero-main class-hero-main">
          <div className="class-hero-copy">
            <h1>
              {displayClassName}
              {displaySchoolYear && <span> · Curs {displaySchoolYear}</span>}
            </h1>

            {activeFamily && (
              <div className="family-session-banner">
                <span>Família de {activeFamily.student_name}</span>
              </div>
            )}
          </div>

          <button
            className="suggestion-button"
            type="button"
            aria-label="Obrir bústia de suggeriments"
            onClick={() => setShowFeedbackModal(true)}
          >
            <MessageCircle size={15} />
            <span>Bústia</span>
          </button>
        </div>
      </header>
    
  
      <section className="layout">
        <div ref={agendaSectionRef} className="public-section-anchor" />
        <Card className="span-2 next-event-card clean-next-event-card public-section-card public-section-agenda">
          <div className="section-title-row">
            <SectionTitle
              icon={<CalendarDays size={22} />}
              title={agendaTitle}
              subtitle="Tot el que vols saber, quan ho vols saber."
            />
          </div>

          <div className="next-event-heading">
            <p className="eyebrow">Proper esdeveniment</p>
            {nextEvent && <span>{daysUntil(nextEvent.start_date)}</span>}
          </div>
  
          {nextEvent ? (
            <article className="next-event clean-next-event">
              <div className="next-event-content">
                <div className="timeline-meta-row next-event-meta-row">
                  <span className="timeline-date">
                    {shortDate(nextEvent.start_date)}
                    {nextEvent.start_time ? ` · ${nextEvent.start_time.slice(0, 5)}` : ""}
                  </span>

                  <span className={`event-type-pill event-type-pill-${nextEvent.event_type || "default"}`}>
                    {typeMeta[nextEvent.event_type]?.label || "Esdeveniment"}
                  </span>
                </div>

                <h2>{nextEvent.title}</h2>

                {nextEvent.location && (
                  <small>{nextEvent.location}</small>
                )}
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
                    className={`quick-action quick-action-primary ${
                      nextEventActionState.completed ? "action-button-completed" : ""
                    }`}
                    type="button"
                    onClick={() => {
                      if (nextEventAttendanceOrganization) {
                        setSelectedOrganization(nextEventAttendanceOrganization);
                      } else {
                        setSelectedRegistration(nextEventRegistrationOrganization);
                      }
                    }}
                  >
                    {nextEventActionState.label}
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

          <div className="agenda-list-heading">
            <p className="eyebrow">Més endavant</p>
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

    const linkedActionState = getAgendaActionState(
      linkedAttendanceOrganization,
      linkedRegistrationOrganization
    );

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
        <div className="timeline-meta-row">
          <span className="timeline-date">
            {shortDate(event.start_date)}
            {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}
          </span>

          <span className={`event-type-pill timeline-event-type-pill event-type-pill-${event.event_type || "default"}`}>
            {typeMeta[event.event_type]?.label || "Esdeveniment"}
          </span>
        </div>

        <strong>{event.title}</strong>

        <div className="timeline-actions">
          {linkedActionOrganization && (
            <button
              className={`confirm-button ${
                linkedActionState.completed ? "action-button-completed" : ""
              }`}
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
              {linkedActionState.label}
            </button>
          )}

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

        <div ref={actionsSectionRef} className="public-section-anchor" />
        <Card className="span-2 public-section-card public-section-actions">
          <SectionTitle
            icon={<PartyPopper size={22} />}
            title="Accions pendents"
            subtitle="Confirma, inscriu-te o revisa el que cal fer."
          />

          {visibleOrganizations.length === 0 ? (
            <div className="public-empty-state">
              <strong>No hi ha accions pendents</strong>
              <p>Quan calgui confirmar assistència, inscriure’s o revisar alguna acció, apareixerà aquí.</p>
            </div>
          ) : (
            <div className="org-list">
              {visibleOrganizations.map((org) =>
                org.organization_type === "attendance" ? (
                  <AttendanceOrganizationCard
                    key={org.id}
                    organization={org}
                    families={families}
                    participants={organizationParticipants}
                    responses={organizationResponses}
                    activeFamily={activeFamily}
                    onOpen={setSelectedOrganization}
                  />
                ) : org.organization_type === "registration" ? (
                  <RegistrationOrganizationCard
                    key={org.id}
                    organization={org}
                    families={families}
                    participants={organizationParticipants}
                    registrations={organizationRegistrations}
                    responses={organizationResponses}
                    activeFamily={activeFamily}
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
          )}
        </Card>
  
  
        <div ref={pollsSectionRef} className="public-section-anchor" />
        <Card className="span-2 public-section-card public-section-polls">
          <SectionTitle
            icon={<Vote size={22} />}
            title="Votacions obertes"
            subtitle="Decisions sense perdre's al WhatsApp."
          />

          {polls.length === 0 ? (
            <div className="public-empty-state">
              <strong>No hi ha votacions obertes</strong>
              <p>Quan hi hagi alguna decisió o consulta de classe, la podràs votar des d’aquí.</p>
            </div>
          ) : (
            <div className="polls">
              {polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  families={families}
                  votes={votes}
                  activeFamily={activeFamily}
                  onOpenVote={setSelectedPollVote}
                  onOpenResults={setSelectedPoll}
                />
              ))}
            </div>
          )}
        </Card>

        <div ref={classSectionRef} className="public-section-anchor" />
        <Card className="span-2 public-class-card public-section-card public-section-class">
          <SectionTitle
            icon={<Home size={22} />}
            title="Classe"
            subtitle="Infants i aniversaris organitzats per trimestre."
          />

          <div className="class-birthday-groups">
            {birthdayGroups.map((group) => (
              <section className="class-birthday-group" key={group.id}>
                <h3>{group.title}</h3>

                {group.families.length === 0 ? (
                  <p className="class-birthday-empty">Cap aniversari informat.</p>
                ) : (
                  <div className="class-birthday-list">
                    {group.families.map((family) => (
                      <div className="class-birthday-row" key={family.id}>
                        <div className="class-birthday-child">
                          <strong>{family.student_name}</strong>
                          {family.grade_label && (
                            <span className="class-birthday-badge">
                              {family.grade_label}
                            </span>
                          )}
                        </div>
                        <span>{formatBirthdayDate(family.child_birth_date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

            {familiesWithoutBirthday.length > 0 && (
              <section className="class-birthday-group">
                <h3>Sense data informada</h3>

                <div className="class-birthday-list">
                  {familiesWithoutBirthday.map((family) => (
                    <div className="class-birthday-row" key={family.id}>
                      <div className="class-birthday-child">
                        <strong>{family.student_name}</strong>
                        {family.grade_label && (
                          <span className="class-birthday-badge">
                            {family.grade_label}
                          </span>
                        )}
                      </div>
                      <span>Data pendent</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </Card>

      </section>

      <nav className="public-bottom-nav" aria-label="Navegació pública">
        <button
          type="button"
          className={activePublicSection === "agenda" ? "public-bottom-nav-active" : ""}
          onClick={() => scrollToPublicSection(agendaSectionRef, "agenda")}
        >
          Agenda
        </button>

        <button
          type="button"
          className={activePublicSection === "actions" ? "public-bottom-nav-active" : ""}
          onClick={() => scrollToPublicSection(actionsSectionRef, "actions")}
        >
          Accions
        </button>

        <button
          type="button"
          className={activePublicSection === "polls" ? "public-bottom-nav-active" : ""}
          onClick={() => scrollToPublicSection(pollsSectionRef, "polls")}
        >
          Votacions
        </button>

        <button
          type="button"
          className={activePublicSection === "class" ? "public-bottom-nav-active" : ""}
          onClick={() => scrollToPublicSection(classSectionRef, "class")}
        >
          Classe
        </button>
      </nav>
  
      <footer className="footer">
        <span>
          <Home size={16} /> Ara no hi ha excusa per no estar al dia de tot!
        </span>

        {activeFamily && pushStatus !== "granted" && (
          <button
            type="button"
            className="footer-link"
            onClick={handleEnablePushNotifications}
            disabled={pushLoading}
          >
            {pushLoading ? "Activant..." : "Activar notificacions"}
          </button>
        )}

        {activeFamily && (pushStatus === "granted" || pushStatus === "test-sent") && (
          <button
            type="button"
            className="footer-link"
            onClick={handleSendTestPushNotification}
            disabled={pushLoading}
          >
            {pushLoading ? "Enviant..." : "Enviar prova push"}
          </button>
        )}

        {activeFamily && pushStatusLabel && (
          <span className="footer-status">{pushStatusLabel}</span>
        )}

        <button
          type="button"
          className="footer-link"
          onClick={() => setShowPinChangeModal(true)}
        >
          Canviar PIN
        </button>

        <button
          type="button"
          className="footer-link"
          onClick={() => setShowPrivacyModal(true)}
        >
          Privacitat
        </button>
      </footer>
  
      {showPinChangeModal && activeFamily && (
        <FamilyPinChangeModal
          currentFamilyName={activeFamily.student_name}
          currentFamilyPin={currentFamilyPin}
          setCurrentFamilyPin={setCurrentFamilyPin}
          newFamilyPin={newFamilyPin}
          setNewFamilyPin={setNewFamilyPin}
          repeatFamilyPin={repeatFamilyPin}
          setRepeatFamilyPin={setRepeatFamilyPin}
          pinChangeStatus={pinChangeStatus}
          pinChangeLoading={pinChangeLoading}
          onSubmit={changeFamilyPin}
          onClose={() => {
            setShowPinChangeModal(false);
            setCurrentFamilyPin("");
            setNewFamilyPin("");
            setRepeatFamilyPin("");
            setPinChangeStatus("");
          }}
        />
      )}

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
        completedChecklistItemIds={completedChecklistItemIds}
        onToggleChecklistItem={handleToggleChecklistItem}
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
        responses={organizationResponses}
        activeFamily={activeFamily}
        onRegister={handleOrganizationRegistration}
        onRespond={handleOrganizationResponse}
        onClose={() => setSelectedRegistration(null)}
      />

      <RegistrationResultsModal
        organization={selectedRegistrationResults}
        families={families}
        participants={organizationParticipants}
        registrations={organizationRegistrations}
        responses={organizationResponses}
        onClose={() => setSelectedRegistrationResults(null)}
      />
  
      <PollVoteModal
        poll={selectedPollVote}
        activeFamily={activeFamily}
        onVote={handleVote}
        onClose={() => setSelectedPollVote(null)}
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

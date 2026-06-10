import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Home,
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

function PollCard({ poll, families, votes, onVote, onOpenResults }) {
  const [familyId, setFamilyId] = useState("");
  const [optionId, setOptionId] = useState("");

  const pollVotes = votes.filter((vote) => vote.poll_id === poll.id);
  const votedFamilies = new Set(pollVotes.map((vote) => vote.family_id));

  async function submitVote(e) {
    e.preventDefault();
    if (!familyId || !optionId) return;

    await onVote(poll.id, Number(optionId), Number(familyId));
    setFamilyId("");
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

  async function submitResponse(event) {
    event.preventDefault();

    if (!familyId || !response) return;

    await onRespond(organization.id, Number(familyId), response);
    setFamilyId("");
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
    <strong>Sí ({yesFamilies.length})</strong>
    <div className="people-grid">
      {yesFamilies.length === 0 ? (
        <span className="empty-result">Cap resposta encara</span>
      ) : (
        yesFamilies.map((family) => (
          <span className="person-card" key={family.id}>
            {family.student_name}
          </span>
        ))
      )}
    </div>
  </div>

  <div className="result-column no">
    <strong>No ({noFamilies.length})</strong>
    <div className="people-grid">
      {noFamilies.length === 0 ? (
        <span className="empty-result">Cap resposta encara</span>
      ) : (
        noFamilies.map((family) => (
          <span className="person-card" key={family.id}>
            {family.student_name}
          </span>
        ))
      )}
    </div>
  </div>

  <div className="result-column pending">
    <strong>Pendents ({pendingFamilies.length})</strong>
    <div className="people-grid">
      {pendingFamilies.map((family) => (
        <span className="person-card pending" key={family.id}>
          {family.student_name}
        </span>
      ))}
    </div>
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

  const pendingCount = availableFamilies.length - orgRegistrations.length;

  return (
    <div className="attendance-card">
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

      <div className="attendance-summary">
        <p className="action-summary">
          <strong>{totalAdults + totalChildren}</strong> persones inscrites · {orgRegistrations.length} famílies
        </p>

        <button onClick={() => onOpen(organization)}>
          Inscriure'm
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
  onRegister,
  onClose,
}) {
  const [familyId, setFamilyId] = useState("");
  const [adultsCount, setAdultsCount] = useState(0);
  const [childrenCount, setChildrenCount] = useState(0);
  const [under3Count, setUnder3Count] = useState(0);
  const [comment, setComment] = useState("");

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

    if (!familyId) return;

    await onRegister(
      organization.id,
      Number(familyId),
      Number(adultsCount),
      Number(childrenCount),
      Number(under3Count),
      comment
    );

    setFamilyId("");
    setAdultsCount(0);
    setChildrenCount(0);
    setUnder3Count(0);
    setComment("");
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

        <div className="organization-results">
  <div className="result-column adults">
    <strong>Adults ({totalAdults})</strong>
    <div className="people-grid">
      {orgRegistrations.length === 0 ? (
        <span className="empty-result">Cap inscripció encara</span>
      ) : (
        orgRegistrations.map((item) => {
          const family = families.find((entry) => entry.id === item.family_id);
          return (
            <span className="person-card" key={item.id}>
              {family?.student_name || "Família"} · {item.adults_count || 0}
            </span>
          );
        })
      )}
    </div>
  </div>

  <div className="result-column children">
    <strong>Infants ({totalChildren})</strong>
    <div className="people-grid">
      {orgRegistrations.length === 0 ? (
        <span className="empty-result">Cap inscripció encara</span>
      ) : (
        orgRegistrations.map((item) => {
          const family = families.find((entry) => entry.id === item.family_id);
          return (
            <span className="person-card" key={item.id}>
              {family?.student_name || "Família"} · {item.children_count || 0}
              {item.under3_count ? ` (${item.under3_count} menors de 3)` : ""}
            </span>
          );
        })
      )}
    </div>
  </div>

  <div className="result-column pending">
    <strong>Pendents ({pendingFamilies.length})</strong>
    <div className="people-grid">
      {pendingFamilies.map((family) => (
        <span className="person-card pending" key={family.id}>
          {family.student_name}
        </span>
      ))}
    </div>
  </div>
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
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackType, setFeedbackType] = useState("millora");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const { data: classData, error: classError } = await supabase
      .from("ch_classes")
      .select("*")
      .eq("slug", slug)
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
      const { error: registrationError } = await supabase
        .from("ch_organization_registrations")
        .upsert(
          {
            organization_id: organizationId,
            family_id: familyId,
            adults_count: adultsCount,
            children_count: childrenCount,
            under3_count: under3Count,
            comment,
          },
          { onConflict: "organization_id,family_id" }
        );
    
      if (registrationError) {
        alert("No s'ha pogut guardar la inscripció.");
        console.error(registrationError);
        return;
      }
    
      await loadData();
    }
  async function handleOrganizationResponse(organizationId, familyId, response) {
    const { error: responseError } = await supabase
      .from("ch_organization_responses")
      .upsert(
        {
          organization_id: organizationId,
          family_id: familyId,
          response,
        },
        { onConflict: "organization_id,family_id" }
      );

    if (responseError) {
      alert("No s'ha pogut guardar la resposta.");
      console.error(responseError);
      return;
    }

    await loadData();
  }

  async function handleVote(pollId, optionId, familyId) {
    const { error: voteError } = await supabase
      .from("ch_poll_votes")
      .upsert(
        { poll_id: pollId, option_id: optionId, family_id: familyId },
        { onConflict: "poll_id,family_id" }
      );

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
  
  return (
    <main className="page">
      <header className="hero">
        <div className="hero-main">
          <div>
            <p className="eyebrow">Curs {classInfo.school_year}</p>
            <h1>
              {classInfo.emoji} {classInfo.name}
            </h1>
          </div>
  
          <div className="hero-badge">✨ Sempre al dia</div>
        </div>
      </header>
    
  
      <section className="layout">
        <Card className="span-2 next-event-card">
          <p className="eyebrow">Proper esdeveniment</p>
  
          {nextEvent ? (
            <button
              className="next-event"
              onClick={() => setSelectedItem(eventToDetail(nextEvent))}
            >
              <div className="next-event-date">
                <strong>{shortDate(nextEvent.start_date)}</strong>
                <span>{daysUntil(nextEvent.start_date)}</span>
              </div>
  
              <div>
                <h2>
                  {typeMeta[nextEvent.event_type]?.icon} {nextEvent.title}
                </h2>
                <small>
                  {nextEvent.start_time
                    ? `${nextEvent.start_time.slice(0, 5)} · `
                    : ""}
                  {nextEvent.location || typeMeta[nextEvent.event_type]?.label}
                </small>
              </div>
  
              <span className="info-link">Veure detalls</span>
            </button>
          ) : (
            <p>No hi ha cap esdeveniment proper.</p>
          )}
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
    const linkedOrganization = organizations.find(
      (org) => org.event_id === event.id
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
        <span>
          {shortDate(event.start_date)}
          {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}
        </span>

        <strong>
          {typeMeta[event.event_type]?.icon} {event.title}
        </strong>

        <div className="timeline-actions">
          {linkedOrganization && (
            <button
              type="button"
              className="event-action"
              onClick={(e) => {
                e.stopPropagation();

                if (linkedOrganization.organization_type === "attendance") {
                  setSelectedOrganization(linkedOrganization);
                }

                if (linkedOrganization.organization_type === "registration") {
                  setSelectedRegistration(linkedOrganization);
                }
              }}
            >
              Confirmar assistència
            </button>
          )}

          <span className="info-link">+ Info</span>
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
                  onVote={handleVote}
                  onOpenResults={setSelectedPoll}
                />
              ))}
            </div>
          </Card>
        )}

        <Card className="span-2">
          <SectionTitle
            icon={<Home size={22} />}
            title="Tens alguna millora o error a reportar?"
            subtitle="Ajuda'ns a millorar ClasseHub amb qualsevol idea, dubte o problema."
          />

          <form className="registration-form" onSubmit={submitFeedback}>
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
        </Card>
      </section>
  
      <footer className="footer">
        <Home size={16} /> Ara no hi ha excusa per no estar al dia de tot!
      </footer>
  
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
        onRespond={handleOrganizationResponse}
        onClose={() => setSelectedOrganization(null)}
      />
  
      <RegistrationOrganizationModal
        organization={selectedRegistration}
        families={families}
        participants={organizationParticipants}
        registrations={organizationRegistrations}
        onRegister={handleOrganizationRegistration}
        onClose={() => setSelectedRegistration(null)}
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

import { useEffect, useState } from "react";
import { CalendarDays, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Card, SectionTitle } from "../components/LayoutComponents";
import { shortDate } from "../utils/dateHelpers";
import { typeMeta } from "../utils/eventHelpers";

export default function AdminPage() {
  const [classes, setClasses] = useState([]);
  const [families, setFamilies] = useState([]);
  const [adminEvents, setAdminEvents] = useState([]);
  const [adminOrganizations, setAdminOrganizations] = useState([]);
  const [organizationResponses, setOrganizationResponses] = useState([]);
  const [organizationRegistrations, setOrganizationRegistrations] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [showFamilyFormModal, setShowFamilyFormModal] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [familySaving, setFamilySaving] = useState(false);
  const [editingFamilyId, setEditingFamilyId] = useState(null);
  const [familyDeleteInfo, setFamilyDeleteInfo] = useState(null);
  const [familyDeleting, setFamilyDeleting] = useState(false);
  const [pinUpdatingFamilyId, setPinUpdatingFamilyId] = useState(null);
  const [bulkPinGenerating, setBulkPinGenerating] = useState(false);
  const [copiedAccessFamilyId, setCopiedAccessFamilyId] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("classe");
  const [publicationType, setPublicationType] = useState("info");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [closeDate, setCloseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [eventToDelete, setEventToDelete] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [detailEventId, setDetailEventId] = useState(null);
  const [showEventFormModal, setShowEventFormModal] = useState(false);

  const selectedClass = classes.find(
    (classItem) => String(classItem.id) === selectedClassId
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  const visibleAdminEvents = showPastEvents
    ? adminEvents
    : adminEvents.filter(
        (eventItem) => !eventItem.start_date || eventItem.start_date >= todayIso
      );

  const pastEventsCount = adminEvents.filter(
    (eventItem) => eventItem.start_date && eventItem.start_date < todayIso
  ).length;

  const activeFamilies = families.filter((family) => family.is_active !== false);
  const inactiveFamiliesCount = families.length - activeFamilies.length;
  const missingPinsCount = activeFamilies.filter((family) => !family.access_pin).length;

  const detailEvent = detailEventId
    ? adminEvents.find((eventItem) => eventItem.id === detailEventId)
    : null;

  const detailOrganization = detailEvent
    ? adminOrganizations.find(
        (organization) => organization.event_id === detailEvent.id
      )
    : null;

  const detailResponses = detailOrganization
    ? organizationResponses.filter(
        (response) => response.organization_id === detailOrganization.id
      )
    : [];

  const detailRegistrations = detailOrganization
    ? organizationRegistrations.filter(
        (registration) =>
          registration.organization_id === detailOrganization.id
      )
    : [];

  const eventPendingDelete = eventToDelete
    ? adminEvents.find((eventItem) => eventItem.id === eventToDelete)
    : null;

  const registrationSummary = detailRegistrations.reduce(
    (summary, registration) => ({
      adults: summary.adults + (registration.adults_count || 0),
      children: summary.children + (registration.children_count || 0),
      under3: summary.under3 + (registration.under3_count || 0),
    }),
    { adults: 0, children: 0, under3: 0 }
  );

  const attendanceSummary = detailResponses.reduce(
    (summary, response) => {
      if (response.response === "yes") return { ...summary, yes: summary.yes + 1 };
      if (response.response === "no") return { ...summary, no: summary.no + 1 };
      if (response.response === "maybe") return { ...summary, maybe: summary.maybe + 1 };
      return { ...summary, other: summary.other + 1 };
    },
    { yes: 0, no: 0, maybe: 0, other: 0 }
  );

  const detailAnsweredCount =
    detailOrganization?.organization_type === "registration"
      ? detailRegistrations.length
      : detailResponses.length;

  const detailPendingCount = detailOrganization
    ? Math.max(activeFamilies.length - detailAnsweredCount, 0)
    : 0;

  function getFamilyName(familyId) {
    return (
      families.find((family) => family.id === familyId)?.student_name ||
      "Família no trobada"
    );
  }

  function formatResponse(response) {
    if (response === "yes") return "Sí";
    if (response === "no") return "No";
    if (response === "maybe") return "Potser";
    return response || "Sense resposta";
  }

  async function loadAdminEvents(classId) {
    if (!classId) return;
  
    const { data, error } = await supabase
      .from("ch_events")
      .select("*")
      .or(`class_id.eq.${Number(classId)},and(event_type.eq.escola,class_id.is.null)`)
      .order("start_date");
  
    if (error) {
      console.error(error);
      setMessage("No s'han pogut carregar els esdeveniments.");
      return;
    }
  
    setAdminEvents(data || []);
  }

  async function loadAdminActionData(classId) {
    if (!classId) return;

    const { data: organizationsData, error: organizationsError } = await supabase
      .from("ch_organizations")
      .select("*")
      .eq("class_id", Number(classId))
      .order("created_at", { ascending: false });

    if (organizationsError) {
      console.error(organizationsError);
      setMessage("No s'han pogut carregar les accions vinculades.");
      return;
    }

    const organizations = organizationsData || [];
    setAdminOrganizations(organizations);

    const organizationIds = organizations.map((organization) => organization.id);

    if (organizationIds.length === 0) {
      setOrganizationResponses([]);
      setOrganizationRegistrations([]);
      return;
    }

    const [responsesResult, registrationsResult] = await Promise.all([
      supabase
        .from("ch_organization_responses")
        .select("*")
        .in("organization_id", organizationIds),
      supabase
        .from("ch_organization_registrations")
        .select("*")
        .in("organization_id", organizationIds),
    ]);

    if (responsesResult.error) {
      console.error(responsesResult.error);
      setMessage("No s'han pogut carregar les respostes.");
      return;
    }

    if (registrationsResult.error) {
      console.error(registrationsResult.error);
      setMessage("No s'han pogut carregar les inscripcions.");
      return;
    }

    setOrganizationResponses(responsesResult.data || []);
    setOrganizationRegistrations(registrationsResult.data || []);
  }

  async function loadFamilies(classId) {
    if (!classId) return;

    const { data, error } = await supabase
      .from("ch_families")
      .select("*")
      .eq("class_id", Number(classId))
      .order("student_name");

    if (error) {
      console.error(error);
      setMessage("No s'han pogut carregar les famílies.");
      return;
    }

    setFamilies(data || []);
  }

  function handleStartEditFamily(family) {
    setEditingFamilyId(family.id);
    setNewFamilyName(family.student_name || "");
    setMessage("");
    setShowFamilyFormModal(true);
  }

  async function handleCreateFamily(event) {
    event.preventDefault();
    setMessage("");

    const cleanName = newFamilyName.trim();

    if (!selectedClassId) {
      setMessage("Cal seleccionar una classe abans d'afegir una família.");
      return;
    }

    if (!cleanName) {
      setMessage("Cal escriure el nom de l'infant o família.");
      return;
    }

    setFamilySaving(true);

    const { error } = editingFamilyId
      ? await supabase
          .from("ch_families")
          .update({
            student_name: cleanName,
          })
          .eq("id", editingFamilyId)
      : await supabase
          .from("ch_families")
          .insert({
            class_id: Number(selectedClassId),
            student_name: cleanName,
          });

    setFamilySaving(false);

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        setMessage("Ja existeix una família amb aquest nom en aquesta classe.");
      } else {
        setMessage(`No s'ha pogut crear la família: ${error.message}`);
      }

      return;
    }

    setNewFamilyName("");
    setEditingFamilyId(null);
    setShowFamilyFormModal(false);
    setMessage(
      editingFamilyId
        ? "Família actualitzada correctament."
        : "Família afegida correctament."
    );
    await loadFamilies(selectedClassId);
  }

  async function countFamilyRows(tableName, familyId) {
    const { count, error } = await supabase
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .eq("family_id", familyId);

    if (error) {
      throw error;
    }

    return count || 0;
  }

  function generateFamilyPin() {
    if (typeof window !== "undefined" && window.crypto) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return String(1000 + (values[0] % 9000));
    }

    return String(Math.floor(1000 + Math.random() * 9000));
  }

  async function handleCopyFamilyAccess(family) {
    if (!family.access_pin) {
      setMessage("Aquesta família encara no té PIN generat.");
      return;
    }

    const accessMessage = `Hola! Per accedir a ClasseHub:

https://classehub-psi.vercel.app/classe/orenetes

Família: ${family.student_name}
PIN: ${family.access_pin}`;

    try {
      await navigator.clipboard.writeText(accessMessage);
      setCopiedAccessFamilyId(family.id);
      setMessage(`Missatge d'accés copiat per a ${family.student_name}.`);

      window.setTimeout(() => {
        setCopiedAccessFamilyId(null);
      }, 1800);
    } catch (error) {
      console.error(error);
      setMessage("No s'ha pogut copiar el missatge d'accés.");
    }
  }

  async function handleGenerateFamilyPin(family) {
    setMessage("");
    setPinUpdatingFamilyId(family.id);

    const newPin = generateFamilyPin();

    const { error } = await supabase
      .from("ch_families")
      .update({
        access_pin: newPin,
      })
      .eq("id", family.id);

    if (error) {
      console.error(error);
      setMessage(`No s'ha pogut actualitzar el PIN: ${error.message}`);
      setPinUpdatingFamilyId(null);
      return;
    }

    setMessage(`PIN actualitzat per a ${family.student_name}.`);
    await loadFamilies(selectedClassId);
    setPinUpdatingFamilyId(null);
  }

  async function handleGenerateMissingFamilyPins() {
    const familiesWithoutPin = activeFamilies.filter((family) => !family.access_pin);

    if (familiesWithoutPin.length === 0) {
      setMessage("Totes les famílies actives ja tenen PIN.");
      return;
    }

    setMessage("");
    setBulkPinGenerating(true);

    const usedPins = new Set(
      families
        .map((family) => family.access_pin)
        .filter(Boolean)
    );

    function generateUniquePin() {
      let pin = generateFamilyPin();
      let attempts = 0;

      while (usedPins.has(pin) && attempts < 100) {
        pin = generateFamilyPin();
        attempts += 1;
      }

      usedPins.add(pin);
      return pin;
    }

    try {
      for (const family of familiesWithoutPin) {
        const { error } = await supabase
          .from("ch_families")
          .update({
            access_pin: generateUniquePin(),
          })
          .eq("id", family.id);

        if (error) throw error;
      }

      setMessage(`S'han generat ${familiesWithoutPin.length} PINs pendents.`);
      await loadFamilies(selectedClassId);
    } catch (error) {
      console.error(error);
      setMessage(`No s'han pogut generar tots els PINs: ${error.message}`);
    } finally {
      setBulkPinGenerating(false);
    }
  }

  async function handleReactivateFamily(family) {
    setMessage("");

    const { error } = await supabase
      .from("ch_families")
      .update({
        is_active: true,
        deactivated_at: null,
      })
      .eq("id", family.id);

    if (error) {
      console.error(error);
      setMessage(`No s'ha pogut reactivar la família: ${error.message}`);
      return;
    }

    setMessage("Família reactivada correctament.");
    await loadFamilies(selectedClassId);
  }

  async function handleRequestDeleteFamily(family) {
    setMessage("");

    try {
      const [
        responsesCount,
        registrationsCount,
        votesCount,
        feedbackCount,
      ] = await Promise.all([
        countFamilyRows("ch_organization_responses", family.id),
        countFamilyRows("ch_organization_registrations", family.id),
        countFamilyRows("ch_poll_votes", family.id),
        countFamilyRows("ch_feedback", family.id),
      ]);

      const totalActivity =
        responsesCount + registrationsCount + votesCount + feedbackCount;

      setFamilyDeleteInfo({
        family,
        hasActivity: totalActivity > 0,
        counts: {
          responses: responsesCount,
          registrations: registrationsCount,
          votes: votesCount,
          feedback: feedbackCount,
        },
      });
    } catch (error) {
      console.error(error);
      setMessage("No s'ha pogut comprovar si la família té activitat associada.");
    }
  }

  async function handleConfirmDeleteFamily() {
    if (!familyDeleteInfo?.family) return;

    setFamilyDeleting(true);
    setMessage("");

    const family = familyDeleteInfo.family;

    try {
      if (familyDeleteInfo.hasActivity) {
        const { error } = await supabase
          .from("ch_families")
          .update({
            is_active: false,
            deactivated_at: new Date().toISOString(),
          })
          .eq("id", family.id);

        if (error) throw error;

        setMessage("Família desactivada correctament.");
      } else {
        const { error: participantsError } = await supabase
          .from("ch_organization_participants")
          .delete()
          .eq("family_id", family.id);

        if (participantsError) throw participantsError;

        const { error: familyError } = await supabase
          .from("ch_families")
          .delete()
          .eq("id", family.id);

        if (familyError) throw familyError;

        setMessage("Família eliminada correctament.");
      }

      setFamilyDeleteInfo(null);
      await loadFamilies(selectedClassId);
    } catch (error) {
      console.error(error);
      setMessage(`No s'ha pogut completar l'acció: ${error.message}`);
    } finally {
      setFamilyDeleting(false);
    }
  }

  async function loadFeedbacks() {
    const { data, error } = await supabase
      .from("ch_feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage("No s'han pogut carregar els missatges de feedback.");
      return;
    }

    setFeedbacks(data || []);
  }

  useEffect(() => {
    async function loadClasses() {
      const { data, error } = await supabase
        .from("ch_classes")
        .select("*")
        .order("name");

      if (error) {
        console.error(error);
        setMessage("No s'han pogut carregar les classes.");
        return;
      }

      setClasses(data || []);

      if (data?.length) {
        setSelectedClassId(String(data[0].id));
        loadAdminEvents(data[0].id);
        loadAdminActionData(data[0].id);
        loadFamilies(data[0].id);
        loadFeedbacks();
      }
    }

    loadClasses();
  }, []);
  function handleStartEdit(eventItem) {
    setEditingEventId(eventItem.id);
    setTitle(eventItem.title || "");
    setEventType(eventItem.event_type || "classe");
    setStartDate(eventItem.start_date || "");
    setStartTime(eventItem.start_time ? eventItem.start_time.slice(0, 5) : "");
    setLocation(eventItem.location || "");
    setDescription(eventItem.summary || eventItem.details || "");
    setPublicationType("info");
    setCloseDate("");
    setShowEventFormModal(true);
    setMessage("Estàs editant aquest esdeveniment.");
  }

  function resetForm() {
    setTitle("");
    setEventType("classe");
    setStartDate("");
    setStartTime("");
    setLocation("");
    setDescription("");
    setPublicationType("info");
    setCloseDate("");
    setEditingEventId(null);
    setShowEventFormModal(false);
  }

  async function handleCreateEvent(event) {
    event.preventDefault();
    setMessage("");

    if (!title || !startDate || (eventType !== "escola" && !selectedClassId)) {
      setMessage("Cal indicar com a mínim títol, data i classe si no és un esdeveniment d’escola.");
      return;
    }

    if (publicationType !== "info" && !selectedClassId) {
      setMessage("Cal seleccionar una classe per crear una confirmació o inscripció.");
      return;
    }

    if (publicationType !== "info" && activeFamilies.length === 0) {
      setMessage("No hi ha famílies actives carregades per aquesta classe.");
      return;
    }

    setSaving(true);

    const payload = {
      class_id: eventType === "escola" ? null : Number(selectedClassId),
      title,
      event_type: eventType,
      start_date: startDate,
      start_time: startTime || null,
      location,
      summary: description,
      details: description,
    };
    
    const { data, error } = editingEventId
  ? await supabase
      .from("ch_events")
      .update(payload)
      .eq("id", editingEventId)
      .select()
  : await supabase
      .from("ch_events")
      .insert(payload)
      .select();

console.log("Resultat guardar esdeveniment:", { data, error });

    setSaving(false);

    if (error) {
      console.error(error);
      setSaving(false);

      setMessage(
        `Error: ${error.message} (${error.code || "No s'ha pogut crear d'esdeveniment"})`
      );

      return;
    }

    const savedEvent = data?.[0];

    if (!editingEventId && publicationType !== "info" && savedEvent) {
      const organizationType =
        publicationType === "registration" ? "registration" : "attendance";

      const organizationTitle =
        publicationType === "registration"
          ? `${title} - Inscripció`
          : `${title} - Confirmació`;

      const question =
        publicationType === "registration"
          ? "Qui s'hi apunta?"
          : "Confirmes assistència?";

      const { data: organizationData, error: organizationError } = await supabase
        .from("ch_organizations")
        .insert({
          class_id: Number(selectedClassId),
          title: organizationTitle,
          description: description || null,
          event_date: startDate,
          location: location || null,
          is_active: true,
          is_important: false,
          organization_type: organizationType,
          question,
          close_date: closeDate || null,
          event_id: savedEvent.id,
        })
        .select()
        .single();

      if (organizationError) {
        console.error(organizationError);
        setSaving(false);
        setMessage(
          `S'ha creat l'esdeveniment, però no s'ha pogut crear l'acció vinculada: ${organizationError.message}`
        );
        await loadAdminEvents(selectedClassId);
    await loadAdminActionData(selectedClassId);
        return;
      }

      const participantsPayload = activeFamilies.map((family) => ({
        organization_id: organizationData.id,
        family_id: family.id,
      }));

      const { error: participantsError } = await supabase
        .from("ch_organization_participants")
        .insert(participantsPayload);

      if (participantsError) {
        console.error(participantsError);
        setSaving(false);
        setMessage(
          `S'ha creat l'esdeveniment i l'acció, però no s'han pogut afegir les famílies: ${participantsError.message}`
        );
        await loadAdminEvents(selectedClassId);
    await loadAdminActionData(selectedClassId);
        return;
      }
    }

    setSaving(false);
    resetForm();
    setMessage(
      editingEventId
        ? "Esdeveniment actualitzat correctament."
        : publicationType === "info"
          ? "Esdeveniment creat correctament."
          : "Esdeveniment i acció vinculada creats correctament."
    );
    await loadAdminEvents(selectedClassId);
    await loadAdminActionData(selectedClassId);
  }
  async function handleDeleteEvent(eventId) {
    const { error } = await supabase
      .from("ch_events")
      .delete()
      .eq("id", eventId);
  
    if (error) {
      console.error(error);
      setMessage("No s'ha pogut eliminar l'esdeveniment.");
      return;
    }
  
    setEventToDelete(null);
    setMessage("Esdeveniment eliminat correctament.");
    await loadAdminEvents(selectedClassId);
    await loadAdminActionData(selectedClassId);
  }
   
  return (
    <main className="page">
      <header className="hero">
        <div className="hero-main">
          <div>
            <p className="eyebrow">ClasseHub Admin</p>
            <h1>Administració</h1>
          </div>

          <div className="hero-badge">
            🛠️ Admin general
            {selectedClass ? ` · ${selectedClass.emoji} ${selectedClass.name}` : ""}
          </div>
        </div>
      </header>

      <section className="layout">
        <Card className="span-2">
          <SectionTitle
            icon={<CalendarDays size={22} />}
            title="Panell d'administració"
            subtitle="Gestiona la classe, crea esdeveniments i revisa l'activitat recent."
          />

          <div className="admin-toolbar">
            <label>
              Classe administrada
              <select
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  loadAdminEvents(event.target.value);
                  loadAdminActionData(event.target.value);
                  loadFamilies(event.target.value);
                }}
              >
                {classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>
                    {classItem.emoji} {classItem.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                resetForm();
                setMessage("");
                setShowEventFormModal(true);
              }}
            >
              + Nou esdeveniment
            </button>
          </div>

          {message && <p className="admin-message">{message}</p>}
        </Card>

        <Card className="span-2">
          <SectionTitle
            icon={<CalendarDays size={22} />}
            title="Esdeveniments creats"
            subtitle="Revisa els esdeveniments de la classe seleccionada."
          />

          <div className="admin-list">
  <h3>Esdeveniments creats</h3>

  <div className="admin-row-actions">
    {pastEventsCount > 0 && (
      <button
        type="button"
        className="secondary-action"
        onClick={() => setShowPastEvents((currentValue) => !currentValue)}
      >
        {showPastEvents
          ? "Amagar esdeveniments passats"
          : `Mostrar esdeveniments passats (${pastEventsCount})`}
      </button>
    )}
  </div>

  {visibleAdminEvents.length === 0 ? (
    <p>
      {adminEvents.length === 0
        ? "No hi ha esdeveniments per aquesta classe."
        : "No hi ha esdeveniments futurs per aquesta classe."}
    </p>
  ) : (
    visibleAdminEvents.map((event) => {
      const linkedOrganization = adminOrganizations.find(
        (organization) => organization.event_id === event.id
      );

      const responseCount = linkedOrganization
        ? organizationResponses.filter(
            (response) => response.organization_id === linkedOrganization.id
          ).length
        : 0;

      const registrationCount = linkedOrganization
        ? organizationRegistrations.filter(
            (registration) => registration.organization_id === linkedOrganization.id
          ).length
        : 0;

      return (
      <div className="admin-row admin-event-row" key={event.id}>
        <div className="admin-event-main">
          <strong>{event.title}</strong>
          <p>
            {typeMeta[event.event_type]?.label || "Esdeveniment"} · {shortDate(event.start_date)}
            {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}
            {event.location ? ` · ${event.location}` : ""}
          </p>

          {linkedOrganization ? (
            <p>
              {linkedOrganization.organization_type === "registration"
                ? `🟢 Inscripció familiar · ${registrationCount} famílies inscrites`
                : `🟠 Confirmació sí/no · ${responseCount} respostes`}
              {linkedOrganization.close_date
                ? ` · límit ${shortDate(linkedOrganization.close_date)}`
                : ""}
            </p>
          ) : (
            <p>ℹ️ Només informatiu</p>
          )}
        </div>

        <div className="admin-row-actions">
        {linkedOrganization && (
          <button
            type="button"
            className="secondary-action"
            onClick={() => setDetailEventId(event.id)}
          >
            Veure detall
          </button>
        )}

        {editingEventId === event.id ? (
          <span className="admin-message">En edició</span>
        ) : (
          <button
            type="button"
            className="secondary-action"
            onClick={() => handleStartEdit(event)}
          >
            Editar
          </button>
        )}
  <button
    type="button"
    className="secondary-action danger-text"
    onClick={() => setEventToDelete(event.id)}
  >
    Eliminar
  </button>
</div>
      </div>
      );
    })
  )}
</div>
        </Card>

        <Card className="span-2">
          <SectionTitle
            icon={<Users size={22} />}
            title="Famílies de la classe"
            subtitle="Llistat de famílies carregades per a la classe seleccionada."
          />

          <div className="admin-row-actions family-toolbar-actions">
            {missingPinsCount > 0 ? (
              <button
                type="button"
                className="secondary-action subtle-action"
                disabled={bulkPinGenerating}
                onClick={handleGenerateMissingFamilyPins}
              >
                {bulkPinGenerating
                  ? "Generant PINs..."
                  : `Generar ${missingPinsCount} PINs pendents`}
              </button>
            ) : (
              <span className="status-pill success-pill">PINs generats</span>
            )}

            <button
              type="button"
              onClick={() => {
                setEditingFamilyId(null);
                setNewFamilyName("");
                setMessage("");
                setShowFamilyFormModal(true);
              }}
            >
              + Afegir família
            </button>
          </div>

          <p className="admin-message">
            {activeFamilies.length} famílies actives
            {inactiveFamiliesCount > 0
              ? ` · ${inactiveFamiliesCount} desactivades`
              : ""}
          </p>

          <div className="admin-list">
            {families.length === 0 ? (
              <p>No hi ha famílies carregades per aquesta classe.</p>
            ) : (
              families.map((family) => (
                <div className="admin-row family-admin-row" key={family.id}>
                  <div>
                    <strong>{family.student_name}</strong>
                    <div className="family-status-row">
                      <span
                        className={
                          family.is_active === false
                            ? "status-pill danger-pill"
                            : "status-pill success-pill"
                        }
                      >
                        {family.is_active === false ? "Desactivada" : "Activa"}
                      </span>

                      {family.is_active === false && (
                        <span className="family-status-note">
                          Es manté l'historial, però no s'afegirà a noves accions.
                        </span>
                      )}
                    </div>

                    <div className="family-pin-row">
                      <p className="family-pin">
                        PIN familiar: <strong>{family.access_pin || "pendent de generar"}</strong>
                      </p>

                      {family.is_active !== false && (
                        <>
                          <button
                            type="button"
                            className="secondary-action family-copy-action"
                            disabled={!family.access_pin}
                            onClick={() => handleCopyFamilyAccess(family)}
                          >
                            {copiedAccessFamilyId === family.id
                              ? "Copiat!"
                              : "Copiar accés"}
                          </button>

                          <button
                            type="button"
                            className="secondary-action family-pin-action"
                            disabled={pinUpdatingFamilyId === family.id}
                            onClick={() => handleGenerateFamilyPin(family)}
                          >
                            {pinUpdatingFamilyId === family.id
                              ? "Actualitzant..."
                              : family.access_pin
                                ? "Regenerar PIN"
                                : "Generar PIN"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="admin-row-actions family-general-actions">
                    {family.is_active === false ? (
                      <>
                        <span className="admin-message">Desactivada</span>

                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => handleReactivateFamily(family)}
                        >
                          Reactivar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => handleStartEditFamily(family)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="secondary-action danger-text"
                          onClick={() => handleRequestDeleteFamily(family)}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="span-2">
          <SectionTitle
            icon={<CalendarDays size={22} />}
            title="Feedback rebut"
            subtitle="Missatges enviats per les famílies des de la part pública."
          />

          <div className="admin-list">
            {feedbacks.length === 0 ? (
              <p>No hi ha cap missatge de feedback encara.</p>
            ) : (
              feedbacks.map((feedback) => (
                <div className="admin-row" key={feedback.id}>
                  <div>
                    <strong>{feedback.feedback_type}</strong>
                    <p>{feedback.message}</p>
                    <small>Estat: {feedback.status}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      {showEventFormModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            resetForm();
            setMessage("");
          }}
        >
          <article
            className="modal admin-event-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => {
                resetForm();
                setMessage("");
              }}
            >
              Tancar
            </button>

        <Card className="span-2">
          <SectionTitle
            icon={<CalendarDays size={22} />}
            title={editingEventId ? "Editar esdeveniment" : "Crear esdeveniment"}
            subtitle={
              editingEventId
                ? "Modifica les dades de l’esdeveniment seleccionat."
                : "Afegeix un nou esdeveniment al calendari."
            }
          />

          {editingEventId && (
            <div className="admin-message">
              ✏️ Mode edició actiu: <strong>{title || "Esdeveniment seleccionat"}</strong>
            </div>
          )}

          <div className="admin-message">
            <label>
              Classe administrada
              <select
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  loadAdminEvents(event.target.value);
                  loadAdminActionData(event.target.value);
                  loadFamilies(event.target.value);
                }}
              >
                {classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>
                    {classItem.emoji} {classItem.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <form className="registration-form" onSubmit={handleCreateEvent}>
            <label className="span-all">
              Què vols crear?
              <select
                value={publicationType}
                onChange={(event) => setPublicationType(event.target.value)}
                disabled={Boolean(editingEventId)}
              >
                <option value="info">Només informar</option>
                <option value="attendance">Demanar confirmació sí/no</option>
                <option value="registration">Obrir inscripció familiar</option>
              </select>
            </label>

            <div className="admin-message span-all">
              {publicationType === "info" && (
                <span>Es crearà només un esdeveniment informatiu a l’agenda.</span>
              )}

              {publicationType === "attendance" && (
                <span>Les famílies podran confirmar si vindran o no.</span>
              )}

              {publicationType === "registration" && (
                <span>Les famílies podran inscriure adults, infants i comentaris.</span>
              )}
            </div>

            {publicationType !== "info" && (
              <label className="span-all">
                Data límit de resposta
                <input
                  type="date"
                  value={closeDate}
                  onChange={(event) => setCloseDate(event.target.value)}
                />
              </label>
            )}

            <label>
              Tipus
              <select
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                <option value="classe">Classe</option>
                <option value="escola">Escola</option>
              </select>
            </label>

            <label>
              Data
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label className="span-all">
              Títol
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Aniversari Nil"
              />
            </label>

            <label>
              Hora
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>

            <label className="span-all">
              Lloc
              <input
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Ex: Parc, escola, platja..."
              />
            </label>

            <label className="span-all">
              Descripció
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Informació breu per a les famílies"
              />
            </label>
            {editingEventId && (
  <button
    type="button"
    className="secondary-action span-all"
    onClick={() => {
      resetForm();
      setMessage("");
    }}
  >
    Cancel·lar edició
  </button>
)}
            <button className="span-all" disabled={saving}>
  {saving
    ? "Guardant..."
    : editingEventId
      ? "Guardar canvis"
      : "Crear esdeveniment"}
</button>
          </form>

          {message && <p className="admin-message">{message}</p>}
        </Card>
          </article>
        </div>
      )}

      {familyDeleteInfo && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!familyDeleting) setFamilyDeleteInfo(null);
          }}
        >
          <article
            className="modal delete-confirmation-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              disabled={familyDeleting}
              onClick={() => setFamilyDeleteInfo(null)}
            >
              Tancar
            </button>

            <p className="eyebrow">
              {familyDeleteInfo.hasActivity ? "Desactivar família" : "Eliminar família"}
            </p>

            <h2>
              {familyDeleteInfo.hasActivity
                ? "Aquesta família ja té activitat"
                : "Vols eliminar aquesta família?"}
            </h2>

            <p className="modal-intro">
              <strong>{familyDeleteInfo.family.student_name}</strong>
              {familyDeleteInfo.hasActivity
                ? " té respostes, inscripcions, vots o feedback associats. Per conservar l'historial, no s'eliminarà: quedarà desactivada i no s'afegirà a noves accions."
                : " no té activitat real associada. S'eliminarà definitivament de la classe."}
            </p>

            {familyDeleteInfo.hasActivity && (
              <div className="detail-grid">
                <div>
                  <span>Confirmacions</span>
                  <strong>{familyDeleteInfo.counts.responses}</strong>
                </div>

                <div>
                  <span>Inscripcions</span>
                  <strong>{familyDeleteInfo.counts.registrations}</strong>
                </div>

                <div>
                  <span>Vots</span>
                  <strong>{familyDeleteInfo.counts.votes}</strong>
                </div>
              </div>
            )}

            <div className="delete-confirmation-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={familyDeleting}
                onClick={() => setFamilyDeleteInfo(null)}
              >
                Cancel·lar
              </button>

              <button
                type="button"
                className="danger-action"
                disabled={familyDeleting}
                onClick={handleConfirmDeleteFamily}
              >
                {familyDeleting
                  ? "Processant..."
                  : familyDeleteInfo.hasActivity
                    ? "Desactivar família"
                    : "Eliminar definitivament"}
              </button>
            </div>
          </article>
        </div>
      )}

      {showFamilyFormModal && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setShowFamilyFormModal(false);
            setNewFamilyName("");
            setEditingFamilyId(null);
            setMessage("");
          }}
        >
          <article
            className="modal family-form-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => {
                setShowFamilyFormModal(false);
                setNewFamilyName("");
              }}
            >
              Tancar
            </button>

            <p className="eyebrow">Famílies</p>
            <h2>{editingFamilyId ? "Editar família" : "Afegir família"}</h2>
            <p className="modal-intro">
              {editingFamilyId
                ? "Modifica el nom de la família o infant seleccionat."
                : "Afegeix una nova família a la classe seleccionada. Després apareixerà a les inscripcions, confirmacions i votacions."}
            </p>

            <form className="registration-form" onSubmit={handleCreateFamily}>
              <label className="span-all">
                Nom de l'infant o família
                <input
                  type="text"
                  value={newFamilyName}
                  onChange={(event) => setNewFamilyName(event.target.value)}
                  placeholder="Ex: Nil Segura"
                  autoFocus
                />
              </label>

              <button className="span-all" disabled={familySaving}>
                {familySaving
                  ? "Guardant..."
                  : editingFamilyId
                    ? "Guardar canvis"
                    : "Crear família"}
              </button>

              {message && <p className="admin-message span-all">{message}</p>}
            </form>
          </article>
        </div>
      )}

      {eventPendingDelete && (
        <div className="modal-backdrop" onClick={() => setEventToDelete(null)}>
          <article
            className="modal delete-confirmation-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setEventToDelete(null)}
            >
              Tancar
            </button>

            <p className="eyebrow">Eliminar esdeveniment</p>
            <h2>Vols eliminar aquest esdeveniment?</h2>

            <p className="modal-intro">
              S'eliminarà <strong>{eventPendingDelete.title}</strong>. Aquesta acció no es podrà desfer.
            </p>

            <div className="delete-confirmation-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setEventToDelete(null)}
              >
                Cancel·lar
              </button>

              <button
                type="button"
                className="danger-action"
                onClick={() => handleDeleteEvent(eventPendingDelete.id)}
              >
                Sí, eliminar
              </button>
            </div>
          </article>
        </div>
      )}

      {detailEvent && detailOrganization && (
        <div className="modal-backdrop" onClick={() => setDetailEventId(null)}>
          <article
            className="modal action-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setDetailEventId(null)}
            >
              Tancar
            </button>

            <p className="eyebrow">
              {detailOrganization.organization_type === "registration"
                ? "Inscripció familiar"
                : "Confirmació sí/no"}
            </p>

            <h2>{detailEvent.title}</h2>

            <p className="modal-intro">
              {detailOrganization.organization_type === "registration"
                ? "Consulta quines famílies s'han inscrit i el recompte d'assistents."
                : "Consulta les respostes rebudes de les famílies."}
            </p>

            <div className="detail-grid action-stats-grid">
              {detailOrganization.organization_type === "registration" ? (
                <>
                  <div>
                    <span>Famílies</span>
                    <strong>{detailRegistrations.length}</strong>
                  </div>

                  <div>
                    <span>Adults</span>
                    <strong>{registrationSummary.adults}</strong>
                  </div>

                  <div>
                    <span>Infants</span>
                    <strong>{registrationSummary.children}</strong>
                  </div>

                  <div>
                    <span>Menors de 3</span>
                    <strong>{registrationSummary.under3}</strong>
                  </div>

                  <div>
                    <span>Pendents</span>
                    <strong>{detailPendingCount}</strong>
                  </div>

                  <div>
                    <span>Data límit</span>
                    <strong>
                      {detailOrganization.close_date
                        ? shortDate(detailOrganization.close_date)
                        : "Sense límit"}
                    </strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span>Sí</span>
                    <strong>{attendanceSummary.yes}</strong>
                  </div>

                  <div>
                    <span>No</span>
                    <strong>{attendanceSummary.no}</strong>
                  </div>

                  <div>
                    <span>Potser</span>
                    <strong>{attendanceSummary.maybe}</strong>
                  </div>

                  <div>
                    <span>Altres</span>
                    <strong>{attendanceSummary.other}</strong>
                  </div>

                  <div>
                    <span>Pendents</span>
                    <strong>{detailPendingCount}</strong>
                  </div>

                  <div>
                    <span>Data límit</span>
                    <strong>
                      {detailOrganization.close_date
                        ? shortDate(detailOrganization.close_date)
                        : "Sense límit"}
                    </strong>
                  </div>
                </>
              )}
            </div>

            {detailOrganization.organization_type === "registration" && (
              <div className="action-detail-list">
                <div className="action-detail-summary">
                  {detailRegistrations.length} famílies inscrites
                </div>

                {detailRegistrations.length === 0 ? (
                  <p className="action-detail-empty">
                    Encara no hi ha cap família inscrita.
                  </p>
                ) : (
                  detailRegistrations.map((registration) => (
                    <div className="action-detail-row" key={registration.id}>
                      <div className="action-detail-main">
                        <strong>{getFamilyName(registration.family_id)}</strong>
                        <span>
                          {registration.adults_count || 0} adults ·{" "}
                          {registration.children_count || 0} infants ·{" "}
                          {registration.under3_count || 0} menors de 3
                        </span>
                      </div>

                      {registration.comment && (
                        <p className="action-detail-comment">
                          {registration.comment}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {detailOrganization.organization_type === "attendance" && (
              <div className="action-detail-list">
                <div className="action-detail-summary">
                  {detailResponses.length} respostes
                </div>

                {detailResponses.length === 0 ? (
                  <p className="action-detail-empty">
                    Encara no hi ha cap resposta.
                  </p>
                ) : (
                  detailResponses.map((response) => (
                    <div className="action-detail-row" key={response.id}>
                      <div className="action-detail-main">
                        <strong>{getFamilyName(response.family_id)}</strong>
                        <span>Resposta: {formatResponse(response.response)}</span>
                      </div>

                      {response.comment && (
                        <p className="action-detail-comment">
                          {response.comment}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </article>
        </div>
      )}
    </main>
  );
}

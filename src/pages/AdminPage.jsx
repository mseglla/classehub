import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Card, SectionTitle } from "../components/LayoutComponents";
import { shortDate } from "../utils/dateHelpers";
import { typeMeta } from "../utils/eventHelpers";

export default function AdminPage() {
  const [classes, setClasses] = useState([]);
  const [adminEvents, setAdminEvents] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("classe");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [eventToDelete, setEventToDelete] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  async function loadAdminEvents(classId) {
    if (!classId) return;
  
    const { data, error } = await supabase
      .from("ch_events")
      .select("*")
      .eq("class_id", Number(classId))
      .order("start_date");
  
    if (error) {
      console.error(error);
      setMessage("No s'han pogut carregar els esdeveniments.");
      return;
    }
  
    setAdminEvents(data || []);
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
    setMessage("Estàs editant aquest esdeveniment.");
  }

  function resetForm() {
    setTitle("");
    setEventType("classe");
    setStartDate("");
    setStartTime("");
    setLocation("");
    setDescription("");
    setEditingEventId(null);
  }

  async function handleCreateEvent(event) {
    event.preventDefault();
    setMessage("");

    if (!selectedClassId || !title || !startDate) {
      setMessage("Cal indicar com a mínim classe, títol i data.");
      return;
    }

    setSaving(true);

    const payload = {
      class_id: Number(selectedClassId),
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
    
      setMessage(
        `Error: ${error.message} (${error.code || "No s'ha pogut crear d'esdeveniment"})`
      );
    
      return;
    }

    resetForm();
    setMessage(
      editingEventId
        ? "Esdeveniment actualitzat correctament."
        : "Esdeveniment creat correctament."
    );
    await loadAdminEvents(selectedClassId);
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
  }
   
  return (
    <main className="page">
      <header className="hero">
        <div className="hero-main">
          <div>
            <p className="eyebrow">ClasseHub Admin</p>
            <h1>Administració</h1>
          </div>

          <div className="hero-badge">🛠️ Mode delegat</div>
        </div>
      </header>

      <section className="layout">
        <Card className="span-2">
          <SectionTitle
            icon={<CalendarDays size={22} />}
            title={editingEventId ? "Editar esdeveniment" : "Crear esdeveniment"}
            subtitle={
              editingEventId
                ? "Modifica les dades de l’esdeveniment seleccionat."
                : "Afegeix un nou esdeveniment al calendari de la classe."
            }
          />

          {editingEventId && (
            <div className="admin-message">
              ✏️ Mode edició actiu: <strong>{title || "Esdeveniment seleccionat"}</strong>
            </div>
          )}

          <form className="registration-form" onSubmit={handleCreateEvent}>
            <label>
              Classe
              <select
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  loadAdminEvents(event.target.value);
                }}              >
                {classes.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>
                    {classItem.emoji} {classItem.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipus
              <select
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                <option value="classe">Classe</option>
                <option value="escola">Escola</option>
                <option value="comunitat">Comunitat</option>
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
                placeholder="Ex: Aniversari Oliver"
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

        <Card className="span-2">
          <SectionTitle
            icon={<CalendarDays size={22} />}
            title="Esdeveniments creats"
            subtitle="Revisa els esdeveniments de la classe seleccionada."
          />

          <div className="admin-list">
  <h3>Esdeveniments creats</h3>

  {adminEvents.length === 0 ? (
    <p>No hi ha esdeveniments per aquesta classe.</p>
  ) : (
    adminEvents.map((event) => (
      <div className="admin-row" key={event.id}>
        <div>
          <strong>{event.title}</strong>
          <p>
            {typeMeta[event.event_type]?.label || "Esdeveniment"} · {shortDate(event.start_date)}
            {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>

        <div className="admin-row-actions">
        {editingEventId !== event.id && (
          <button
            type="button"
            className="secondary-action"
            onClick={() => handleStartEdit(event)}
          >
            Editar
          </button>
        )}
  {eventToDelete === event.id ? (
    <>
      <button
        type="button"
        className="secondary-action"
        onClick={() => setEventToDelete(null)}
      >
        No
      </button>

      <span className="danger-text">Eliminar definitivament?</span>

      <button
        type="button"
        className="secondary-action danger-text"
        onClick={() => handleDeleteEvent(event.id)}
      >
        Sí, eliminar
      </button>
    </>
  ) : (
    <button
      type="button"
      className="secondary-action danger-text"
      onClick={() => setEventToDelete(event.id)}
    >
      Eliminar
    </button>
  )}
</div>
      </div>
    ))
  )}
</div>
        </Card>
      </section>
    </main>
  );
}

export const typeMeta = {
  escola: { label: "Avís d'escola", icon: "🏫" },
  classe: { label: "Classe", icon: "👨‍👩‍👧‍👦" },
};

export function eventToDetail(event) {
  return {
    ...event,
    kind: "event",
    kindLabel: typeMeta[event.event_type]?.label || "Esdeveniment",
    icon: typeMeta[event.event_type]?.icon || "📅",
    date: event.start_date,
    time: event.start_time?.slice(0, 5),
  };
}

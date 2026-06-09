export function shortDate(value) {
  if (!value) return "Pendent";
  return new Intl.DateTimeFormat("ca-ES", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatDate(value) {
  if (!value) return "Data pendent";
  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00`));
}

export function daysUntil(value) {
  if (!value) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${value}T00:00:00`);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) return "Ja ha passat";
  if (diff === 0) return "Avui";
  if (diff === 1) return "Demà";
  return `D'aquí ${diff} dies`;
}

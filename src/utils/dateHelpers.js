export function shortDate(value) {
  if (!value) return "Pendent";
  return new Intl.DateTimeFormat("ca-ES", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

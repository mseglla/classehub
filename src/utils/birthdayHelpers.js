export const birthdayPeriods = [
  {
    id: "sep-dec",
    title: "1r trimestre",
    startMonth: 9,
    endMonth: 12,
  },
  {
    id: "jan-mar",
    title: "2n trimestre",
    startMonth: 1,
    endMonth: 3,
  },
  {
    id: "apr-aug",
    title: "3r trimestre",
    startMonth: 4,
    endMonth: 8,
  },
];

export function getBirthdayMonthDay(birthDate) {
  if (!birthDate) return null;

  const [, month, day] = birthDate.split("-").map(Number);

  if (!month || !day) return null;

  return { month, day };
}

export function formatBirthdayDate(birthDate) {
  const monthDay = getBirthdayMonthDay(birthDate);

  if (!monthDay) return "";

  const date = new Date(2026, monthDay.month - 1, monthDay.day);

  return date.toLocaleDateString("ca-ES", {
    day: "numeric",
    month: "long",
  });
}

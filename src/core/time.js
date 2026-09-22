const italianDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
export const formatDate = (dateString, options) => new Intl.DateTimeFormat('it-IT', options ?? { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${dateString}T12:00:00`));
export const fullDate = (dateString) => italianDate.format(new Date(`${dateString}T12:00:00`));
export function advanceDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

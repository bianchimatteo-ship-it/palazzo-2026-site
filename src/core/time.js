const italianDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
export const formatDate = (dateString, options) => new Intl.DateTimeFormat('it-IT', options ?? { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${dateString}T12:00:00`));
export const fullDate = (dateString) => italianDate.format(new Date(`${dateString}T12:00:00`));
export function advanceDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
const weekday = dateString => new Date(`${dateString}T12:00:00Z`).getUTCDay();
export const sundayOnOrBeforeDate = dateString => advanceDays(dateString, -weekday(dateString));
// The calendar of local votes. Comuni (law 182/1991): a spring round between 15 April and 15 June — the round of the
// fifth year after the last vote, of the sixth when the five years end in the second half of the year (the game votes
// on the last Sunday of May). Regions: five years after the last vote, in the same month. A date already past moves on
// by five years.
const lastSundayOfMay = year => sundayOnOrBeforeDate(`${year}-05-31`);
export function nextMunicipalVote(lastDate, after) {
  const [year, month] = String(lastDate).split('-').map(Number);
  let date = lastSundayOfMay(year + (month <= 6 ? 5 : 6));
  while (date <= after) date = lastSundayOfMay(Number(date.slice(0, 4)) + 5);
  return date;
}
export function nextRegionalVote(lastDate, after) {
  const shift = date => sundayOnOrBeforeDate(`${Number(date.slice(0, 4)) + 5}${date.slice(4, 7)}-28`);
  let date = shift(lastDate);
  while (date <= after) date = shift(date);
  return date;
}

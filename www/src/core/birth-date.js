// The date of birth typed as three simple fields (day, month, year), for a phone: it checks the calendar (months of 30 and 31 days, leap years), that it is not in the future and a plausible age, and gives back
// the same «YYYY-MM-DD» text the game has always saved (so old saves and the rules on the age of the career are untouched).
export const MONTHS = Object.freeze(['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']);
export const MIN_YEAR = 1900;
export const isLeapYear = year => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
export const daysInMonth = (year, month) => month === 2 ? (isLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
export const ageOn = (iso, date) => /^\d{4}-\d{2}-\d{2}$/.test(iso ?? '') && /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? Number(date.slice(0, 4)) - Number(iso.slice(0, 4)) - (date.slice(5) < iso.slice(5) ? 1 : 0) : null;
export const splitBirth = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? ''); return m ? { day: String(Number(m[3])), month: String(Number(m[2])), year: m[1] } : { day: '', month: '', year: '' }; };
// parts: { day, month, year } (text or numbers, as typed). today: «YYYY-MM-DD» (the date of the game). Returns { iso, age, error }: iso only when the date is whole and valid; error says what is wrong in words; an unfinished date has neither.
export function parseBirth(parts, today) {
  const clean = value => String(value ?? '').trim();
  const d = clean(parts?.day), m = clean(parts?.month), y = clean(parts?.year);
  if (!d && !m && !y) return { iso: '', age: null, error: null, empty: true };
  if (!d || !m || y.length < 4) return { iso: '', age: null, error: null, unfinished: true };
  if (![d, m, y].every(item => /^\d+$/.test(item))) return { iso: '', age: null, error: 'Scrivi giorno, mese e anno con le sole cifre.' };
  const day = Number(d), month = Number(m), year = Number(y);
  if (month < 1 || month > 12) return { iso: '', age: null, error: 'Scegli un mese da gennaio a dicembre.' };
  if (year < MIN_YEAR) return { iso: '', age: null, error: `L’anno deve essere ${MIN_YEAR} o successivo.` };
  if (day < 1) return { iso: '', age: null, error: 'Il giorno deve essere almeno 1.' };
  const limit = daysInMonth(year, month);
  if (day > limit) return { iso: '', age: null, error: month === 2 && day === 29 ? `Il 29 febbraio ${year} non esiste: ${year} non è un anno bisestile.` : `${MONTHS[month - 1][0].toUpperCase()}${MONTHS[month - 1].slice(1)} ha ${limit} giorni: il giorno ${day} non esiste.` };
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (today && iso > today) return { iso: '', age: null, error: 'La data di nascita non può essere nel futuro.' };
  const age = today ? ageOn(iso, today) : null;
  if (age !== null && age > 110) return { iso: '', age, error: 'Controlla l’anno: l’età risulta oltre i 110 anni.' };
  return { iso, age, error: null };
}

// A whole date typed or pasted in one go («12/04/1985», «12-4-1985», «12.04.1985», «1985-04-12», «12 aprile 1985»): split into the three fields; null when it is not a whole date with a four-digit year.
export function parseTyped(text) {
  const t = String(text ?? '').trim().toLowerCase();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return { day: String(Number(m[3])), month: String(Number(m[2])), year: m[1] };
  m = /^(\d{1,2})\s*[\/.\-\s]\s*(\d{1,2})\s*[\/.\-\s]\s*(\d{4})$/.exec(t);
  if (m) return { day: String(Number(m[1])), month: String(Number(m[2])), year: m[3] };
  m = /^(\d{1,2})\s+([a-zà-ù]+)\s+(\d{4})$/.exec(t);
  if (m) { const index = MONTHS.indexOf(m[2]); if (index >= 0) return { day: String(Number(m[1])), month: String(index + 1), year: m[3] }; }
  return null;
}

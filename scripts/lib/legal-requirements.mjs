// The information only the controller can supply (docs/legale-requisiti.json). The public legal pages are written without it and never invent it; this list says what is still missing and
// why, and the release check (scripts/check-legal.mjs --release, scripts/check-account-deletion.mjs --release) fails while a required item is missing.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const REQUIREMENTS_FILE = fileURLToPath(new URL('../../docs/legale-requisiti.json', import.meta.url));
export async function loadRequirements() {
  const data = JSON.parse(await readFile(REQUIREMENTS_FILE, 'utf8'));
  const problems = [];
  const ids = new Set();
  for (const item of data.items ?? []) {
    if (!item.id || ids.has(item.id)) problems.push(`requisito senza id o doppio: ${item.id}`);
    ids.add(item.id);
    for (const field of ['title', 'section', 'why']) if (typeof item[field] !== 'string' || item[field].length < (field === 'section' ? 8 : 20)) problems.push(`${item.id}: «${field}» mancante o troppo breve`);
    if (typeof item.required !== 'boolean') problems.push(`${item.id}: «required» deve essere true o false`);
    if (!['mancante', 'fornito'].includes(item.status)) problems.push(`${item.id}: stato non valido (${item.status})`);
    if (item.status === 'fornito' && !(typeof item.provided === 'string' && item.provided.length >= 10)) problems.push(`${item.id}: fornito senza nota su data e fonte`);
    if (item.status === 'mancante' && item.provided) problems.push(`${item.id}: indicato come mancante ma con una nota «provided»`);
  }
  return { data, problems, items: data.items ?? [], missingRequired: (data.items ?? []).filter(item => item.required && item.status !== 'fornito'), missingOptional: (data.items ?? []).filter(item => !item.required && item.status !== 'fornito') };
}
export const releaseMessage = missing => `BLOCCO DI RILASCIO: restano ${missing.length} informazioni indispensabili da fornire a cura del titolare (docs/legale-requisiti.json):\n${missing.map(item => `- ${item.id} (${item.section}): ${item.title}`).join('\n')}`;

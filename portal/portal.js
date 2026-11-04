// The portal: confirms the e-mail address and sets a new password from the links of the messages (?verifica-email=… and ?reimposta-password=…). It carries no game: it uses the account client of the game
// (copied byte for byte by scripts/build-portal.mjs), so tokens, deadlines and proofs are exactly those of the service.
import { PASSWORD_MIN, accountApiBase, checkResetToken, resetPassword, verifyEmail } from './src/data/repositories/account-sync.js';

const state = document.getElementById('portal-state');
const say = (text, kind = '') => { state.textContent = text; state.className = kind; };
const params = new URLSearchParams(location.search);
const resetToken = params.get('reimposta-password'), verifyToken = params.get('verifica-email');
// the code leaves the address at once (it works only once anyway)
if (resetToken || verifyToken) history.replaceState(null, '', location.pathname);
// The installed app: when it declares the links of this site (Android App Links), the system opens it by itself; the button below is the manual way, by the package of the app.
const openApp = document.getElementById('portal-app');
const appLink = document.getElementById('portal-app-link');
if (/Android/i.test(navigator.userAgent)) { appLink.href = 'intent://account#Intent;scheme=politicando;package=it.matteobianchi.politicando2026;end'; openApp.hidden = false; }

if (!accountApiBase()) say('Servizio non raggiungibile da questo indirizzo.', 'error');
else if (verifyToken) {
  say('Verifica in corso…');
  verifyEmail(verifyToken).then(answer => say(answer.message ?? 'Indirizzo e-mail verificato.', 'ok')).catch(error => say(error.message, 'error'));
} else if (resetToken) {
  say('Controllo del collegamento…');
  checkResetToken(resetToken).then(answer => {
    say('Collegamento valido.', 'ok');
    document.getElementById('portal-user').textContent = answer.username;
    const form = document.getElementById('portal-reset');
    form.hidden = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const first = document.getElementById('portal-password').value, second = document.getElementById('portal-password2').value;
      if (first.length < PASSWORD_MIN) return say(`La password deve avere almeno ${PASSWORD_MIN} caratteri.`, 'error');
      if (first !== second) return say('Le due password non coincidono.', 'error');
      try { const done = await resetPassword(resetToken, answer.username, first); form.hidden = true; say(done.message ?? 'Password cambiata: accedi nell’app.', 'ok'); }
      catch (error) { say(error.message, 'error'); }
    });
  }).catch(error => say(error.message, 'error'));
} else say('Questa pagina serve per confermare l’indirizzo e-mail e recuperare la password: apri il collegamento ricevuto per e-mail.');

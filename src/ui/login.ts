import { login, resume, type Player } from '../net/api';

/** Anmeldemaske (Bürgerportal-Zugangsdaten). Löst auf, sobald der Spieler angemeldet ist. */
export async function requireLogin(): Promise<Player> {
  const silent = await resume();
  if (silent) return silent;

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'login';
    wrap.innerHTML = `
      <form class="login-box" autocomplete="on">
        <h1>Mais Tower Defense</h1>
        <p class="login-sub">Anmeldung mit deinem <b>Bürgerportal-Konto</b> der Republik Maiskolbistan.</p>
        <label>E-Mail-Adresse<input name="ident" type="text" autocomplete="username" spellcheck="false" required maxlength="254"></label>
        <label>Passwort<input name="password" type="password" autocomplete="current-password" required maxlength="200"></label>
        <div class="login-msg" role="alert"></div>
        <button class="btn btn-primary" type="submit">Anmelden</button>
        <p class="login-note">Das Spiel kostet 500 Maisdollar pro Monat. Beim ersten Login eines Monats wird der Betrag von deinem Bürgerportal-Konto abgebucht. Dein Passwort wird vom Spiel nicht gespeichert.</p>
      </form>`;
    document.body.append(wrap);
    const form = wrap.querySelector('form')!;
    const msg = wrap.querySelector<HTMLElement>('.login-msg')!;
    const btn = wrap.querySelector<HTMLButtonElement>('button')!;
    (form.elements.namedItem('ident') as HTMLInputElement).focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ident = (form.elements.namedItem('ident') as HTMLInputElement).value;
      const pwEl = form.elements.namedItem('password') as HTMLInputElement;
      btn.disabled = true;
      btn.textContent = 'Prüfe Zugang und Abo …';
      msg.textContent = '';
      const r = await login(ident, pwEl.value);
      btn.disabled = false;
      btn.textContent = 'Anmelden';
      if (r.ok) {
        wrap.remove();
        resolve(r.player);
      } else {
        pwEl.value = '';
        msg.textContent = r.message;
      }
    });
  });
}

/**
 * Loyal Production - Admin password gate.
 *
 * Client-side shared-password protection. Compares SHA-256(input) to a baked-in
 * hash. Persists "unlocked" state in sessionStorage so it survives navigation
 * within the tab but clears when the tab is closed.
 *
 * SECURITY NOTE: this is a UX deterrent, not real auth. Anyone with the
 * Supabase anon key (which is intentionally public) can already read public
 * tables directly. For real protection, switch to Supabase Auth + RLS policies
 * that restrict writes/reads to authenticated admins.
 */
(function () {
  'use strict';

  const PASSWORD_HASH =
    'd2e70743862d41f1b183e4583088e50e3bd2e46b8133ec94fb29212f9c75af28';
  const STORAGE_KEY = 'lp.admin.unlocked';
  // The plaintext password is also stashed (tab-scoped) so the admin can
  // authenticate against the serverless email function. sessionStorage is
  // tab-scoped and cleared on close. We accept this trade-off because the
  // alternative is asking the admin to type the password again per email.
  const TOKEN_KEY = 'lp.admin.token';
  const UNLOCK_EVENT = 'lp:admin-unlocked';

  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function isUnlocked() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markUnlocked(token) {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
      if (token != null) sessionStorage.setItem(TOKEN_KEY, token);
    } catch (e) {
      /* ignore quota errors */
    }
  }

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function lock() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      /* ignore */
    }
    document.body.dataset.locked = 'true';
    showLoginOverlay();
  }

  function showLoginOverlay() {
    let overlay = document.getElementById('lp-login-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'lp-login-overlay';
      overlay.innerHTML = `
        <div class="lp-login-card" role="dialog" aria-modal="true" aria-labelledby="lp-login-title">
          <div class="lp-login-brand">
            <div class="lp-login-icon"><i class="bi bi-shield-lock-fill"></i></div>
            <div>
              <p class="lp-login-eyebrow">Loyal Production</p>
              <h2 id="lp-login-title">Admin Access</h2>
            </div>
          </div>
          <p class="lp-login-subtitle">Enter the admin password to unlock the dashboard.</p>
          <form id="lp-login-form" autocomplete="off" novalidate>
            <label class="lp-login-label" for="lp-login-password">Password</label>
            <div class="lp-login-input-wrap">
              <input
                type="password"
                id="lp-login-password"
                name="password"
                autocomplete="current-password"
                placeholder="••••••••"
                required
                autofocus />
              <button type="button" class="lp-login-toggle" id="lp-login-toggle" aria-label="Show password">
                <i class="bi bi-eye"></i>
              </button>
            </div>
            <p id="lp-login-error" class="lp-login-error" role="alert" aria-live="polite"></p>
            <button type="submit" class="lp-login-submit" id="lp-login-submit">
              <i class="bi bi-unlock-fill"></i>
              <span>Unlock Dashboard</span>
            </button>
          </form>
          <p class="lp-login-footnote">
            <i class="bi bi-info-circle"></i>
            Session expires when you close this tab.
          </p>
        </div>
      `;
      document.body.appendChild(overlay);

      const form = overlay.querySelector('#lp-login-form');
      const input = overlay.querySelector('#lp-login-password');
      const err = overlay.querySelector('#lp-login-error');
      const submit = overlay.querySelector('#lp-login-submit');
      const toggle = overlay.querySelector('#lp-login-toggle');

      toggle.addEventListener('click', () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        toggle.querySelector('i').className = showing ? 'bi bi-eye' : 'bi bi-eye-slash';
        toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
        input.focus();
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.textContent = '';
        const value = input.value;
        if (!value) {
          err.textContent = 'Please enter the password.';
          input.focus();
          return;
        }
        submit.disabled = true;
        submit.classList.add('is-loading');
        try {
          const hash = await sha256(value);
          if (hash === PASSWORD_HASH) {
            markUnlocked(value);
            overlay.classList.add('is-unlocking');
            setTimeout(() => {
              overlay.remove();
              document.body.dataset.locked = 'false';
              document.dispatchEvent(new CustomEvent(UNLOCK_EVENT));
            }, 250);
          } else {
            err.textContent = 'Incorrect password. Please try again.';
            input.value = '';
            input.focus();
            input.classList.add('is-shake');
            setTimeout(() => input.classList.remove('is-shake'), 400);
          }
        } catch (cryptoErr) {
          console.error('[admin-auth] crypto failed', cryptoErr);
          err.textContent = 'Could not verify password. Please reload and try again.';
        } finally {
          submit.disabled = false;
          submit.classList.remove('is-loading');
        }
      });
    }
  }

  // Expose API
  window.LP = window.LP || {};
  window.LP.adminAuth = {
    isUnlocked,
    lock,
    getToken,
    UNLOCK_EVENT,
  };

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    if (isUnlocked()) {
      document.body.dataset.locked = 'false';
    } else {
      document.body.dataset.locked = 'true';
      showLoginOverlay();
    }
  });
})();

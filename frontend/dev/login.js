(async function bootLogin() {
  const btn = document.getElementById('signin-btn');
  const foot = document.getElementById('login-foot');

  function setFoot(msg, isError) {
    foot.textContent = msg;
    foot.style.color = isError ? '#F87171' : '';
  }

  function whenMsalReady() {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      if (window.msal) return resolve();
      const i = setInterval(() => {
        if (window.msal) { clearInterval(i); resolve(); return; }
        if (Date.now() - start > 8000) { clearInterval(i); reject(new Error('MSAL failed to load')); }
      }, 50);
    });
  }

  let cfg;
  try {
    const res = await fetch('/api/token', { credentials: 'omit' });
    cfg = await res.json();
  } catch (e) {
    setFoot('Could not load DAX config: ' + e.message, true);
    return;
  }

  try { await whenMsalReady(); } catch (e) { setFoot(e.message, true); return; }

  const msalInstance = new window.msal.PublicClientApplication({
    auth: {
      clientId: cfg.clientId,
      authority: 'https://login.microsoftonline.com/' + cfg.tenantId,
      redirectUri: window.location.origin + '/'
    },
    cache: { cacheLocation: 'sessionStorage' }
  });
  await msalInstance.initialize();
  const redirectResponse = await msalInstance.handleRedirectPromise();

  if (redirectResponse && redirectResponse.account) {
    msalInstance.setActiveAccount(redirectResponse.account);
    window.location.replace('/c');
    return;
  }

  // Already cached account? Auto-skip to chat.
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (account) {
    window.location.replace('/c');
    return;
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    setFoot('Redirecting to Microsoft sign-in…');
    try {
      await msalInstance.loginRedirect({ scopes: [cfg.scope] });
    } catch (e) {
      setFoot('Sign-in failed: ' + (e.message || e), true);
      btn.disabled = false;
    }
  });
})();

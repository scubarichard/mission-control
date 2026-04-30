(async function bootDax() {
  const statusEl = document.getElementById('status');
  const webchatEl = document.getElementById('webchat');
  const userSlot = document.getElementById('user-slot');

  function showStatus(msg, isError) {
    statusEl.hidden = false;
    statusEl.textContent = msg;
    if (isError) {
      statusEl.style.background = '#FDE8E8';
      statusEl.style.color = '#9B1C1C';
      statusEl.style.borderTopColor = '#F8B4B4';
    }
    console.log('[dax]', msg);
  }

  // Surface anything that escapes try/catch
  window.addEventListener('error', (e) => {
    showStatus('JS error: ' + (e.message || e.error || 'unknown'), true);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    const msg = (r && (r.message || r.errorMessage)) || (typeof r === 'string' ? r : JSON.stringify(r));
    showStatus('Unhandled rejection: ' + msg, true);
  });

  showStatus('Booting…');

  async function loadUser() {
    try {
      const res = await fetch('/.auth/me', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.clientPrincipal;
    } catch (_) {
      return null;
    }
  }

  async function fetchAgentConfig() {
    const res = await fetch('/api/token', { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('Config endpoint failed: ' + res.status + ' ' + text);
    }
    return res.json();
  }

  function whenReady(timeoutMs) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const have = () => ({
        cs: !!window.CopilotStudio,
        wc: !!window.WebChat,
        msal: !!window.msal
      });
      const ready = (h) => h.cs && h.wc && h.msal;
      const h0 = have();
      if (ready(h0)) return resolve();
      const interval = setInterval(() => {
        const h = have();
        if (ready(h)) { clearInterval(interval); resolve(); return; }
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          reject(new Error('SDK load timeout. Loaded: CopilotStudio=' + h.cs + ' WebChat=' + h.wc + ' msal=' + h.msal));
        }
      }, 100);
    });
  }

  showStatus('Loading user identity…');
  const principal = await loadUser();
  if (principal && principal.userDetails) {
    userSlot.textContent = principal.userDetails;
  }

  showStatus('Waiting for SDKs (CopilotStudio + WebChat + MSAL)…');
  try {
    await whenReady(15000);
  } catch (e) {
    showStatus(e.message, true);
    return;
  }

  showStatus('Fetching agent config…');
  let cfg;
  try {
    cfg = await fetchAgentConfig();
  } catch (err) {
    showStatus('Could not load DAX config: ' + err.message, true);
    return;
  }

  showStatus('Initializing MSAL…');
  let msalInstance;
  try {
    msalInstance = new window.msal.PublicClientApplication({
      auth: {
        clientId: cfg.clientId,
        authority: 'https://login.microsoftonline.com/' + cfg.tenantId,
        redirectUri: window.location.origin + '/'
      },
      cache: { cacheLocation: 'sessionStorage' }
    });
    await msalInstance.initialize();
    await msalInstance.handleRedirectPromise();
  } catch (e) {
    showStatus('MSAL init failed: ' + (e.message || e), true);
    return;
  }

  showStatus('Acquiring agent access token…');
  let account = msalInstance.getAllAccounts()[0];
  let tokenResp;
  const scopeRequest = { scopes: [cfg.scope], loginHint: cfg.user.name };

  try {
    if (account) {
      showStatus('Acquiring token silently (existing account)…');
      tokenResp = await msalInstance.acquireTokenSilent({ ...scopeRequest, account });
    } else {
      showStatus('No cached account — trying SSO silent…');
      tokenResp = await msalInstance.ssoSilent(scopeRequest);
      account = tokenResp.account;
    }
  } catch (silentErr) {
    showStatus('Silent failed (' + (silentErr.errorCode || silentErr.name || 'err') + '), opening popup…');
    console.warn('Silent token acquisition failed:', silentErr);
    try {
      tokenResp = await msalInstance.acquireTokenPopup(scopeRequest);
      account = tokenResp.account;
    } catch (popupErr) {
      showStatus('Popup failed: ' + (popupErr.message || popupErr) + '. Click here to retry with redirect.', true);
      statusEl.style.cursor = 'pointer';
      statusEl.onclick = () => msalInstance.acquireTokenRedirect(scopeRequest);
      return;
    }
  }

  showStatus('Got token. Starting Copilot Studio client…');
  let directLine;
  try {
    const { CopilotStudioClient, CopilotStudioWebChat, ConnectionSettings } = window.CopilotStudio;
    const settings = new ConnectionSettings({ directConnectUrl: cfg.directConnectUrl });
    const client = new CopilotStudioClient(settings, tokenResp.accessToken);
    directLine = CopilotStudioWebChat.createConnection(client, { showTyping: true });
  } catch (e) {
    showStatus('Copilot Studio client error: ' + (e.message || e), true);
    return;
  }

  const styleOptions = {
    backgroundColor: '#FFFFFF',
    bubbleBackground: '#F1F4FB',
    bubbleFromUserBackground: '#1F3864',
    bubbleFromUserTextColor: '#FFFFFF',
    bubbleTextColor: '#1A2540',
    primaryFont: '"Segoe UI", system-ui, sans-serif',
    sendBoxBackground: '#FFFFFF',
    sendBoxButtonColor: '#1F3864',
    sendBoxBorderTop: '1px solid #D6DCE8',
    rootHeight: '100%',
    rootWidth: '100%'
  };

  showStatus('Rendering Web Chat…');
  try {
    window.WebChat.renderWebChat(
      { directLine, styleOptions, locale: 'en-US' },
      webchatEl
    );
  } catch (e) {
    showStatus('Web Chat render failed: ' + (e.message || e), true);
    return;
  }

  // Hide the status bar after success
  setTimeout(() => { statusEl.hidden = true; }, 1500);
})();

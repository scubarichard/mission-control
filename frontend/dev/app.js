(async function bootDax() {
  const REDIRECT_FLAG = 'dax_msal_redirect_pending';
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
    } else {
      statusEl.style.background = '';
      statusEl.style.color = '';
      statusEl.style.borderTopColor = '';
    }
    statusEl.style.cursor = '';
    statusEl.onclick = null;
    console.log('[dax]', msg);
  }

  function showAction(msg, label, onClick) {
    statusEl.hidden = false;
    statusEl.style.background = '#EFF6FF';
    statusEl.style.color = '#1E40AF';
    statusEl.style.borderTopColor = '#BFDBFE';
    statusEl.style.cursor = 'pointer';
    statusEl.textContent = msg + ' — ' + label;
    statusEl.onclick = onClick;
    console.log('[dax]', msg);
  }

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
      if (ready(have())) return resolve();
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

  async function renderChat(cfg, msalInstance, accessToken) {
    const { CopilotStudioClient, CopilotStudioWebChat, ConnectionSettings } = window.CopilotStudio;
    const settings = new ConnectionSettings({ directConnectUrl: cfg.directConnectUrl });
    const client = new CopilotStudioClient(settings, accessToken);
    const directLine = CopilotStudioWebChat.createConnection(client, { showTyping: true });
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
    window.WebChat.renderWebChat(
      { directLine, styleOptions, locale: 'en-US' },
      webchatEl
    );
    setTimeout(() => { statusEl.hidden = true; }, 1500);
  }

  showStatus('Loading user identity…');
  const principal = await loadUser();
  if (principal && principal.userDetails) {
    userSlot.textContent = principal.userDetails;
  }

  showStatus('Waiting for SDKs…');
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
  let redirectResponse;
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
    redirectResponse = await msalInstance.handleRedirectPromise();
  } catch (e) {
    showStatus('MSAL init failed: ' + (e.message || e), true);
    return;
  }

  if (redirectResponse && redirectResponse.account) {
    msalInstance.setActiveAccount(redirectResponse.account);
  }

  const scopeRequest = { scopes: [cfg.scope], loginHint: cfg.user.name };
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];

  let tokenResp;
  if (redirectResponse && redirectResponse.accessToken) {
    // Just came back from redirect with a fresh token — use it directly.
    sessionStorage.removeItem(REDIRECT_FLAG);
    tokenResp = redirectResponse;
  } else if (account) {
    showStatus('Acquiring agent token silently…');
    try {
      tokenResp = await msalInstance.acquireTokenSilent({ ...scopeRequest, account });
      sessionStorage.removeItem(REDIRECT_FLAG);
    } catch (silentErr) {
      console.warn('Silent acquisition failed:', silentErr);
      const isInteraction = silentErr && (silentErr.errorCode === 'interaction_required' ||
        silentErr.errorCode === 'consent_required' ||
        silentErr.errorCode === 'login_required' ||
        (silentErr.name && silentErr.name.includes('InteractionRequired')));
      if (isInteraction) {
        if (sessionStorage.getItem(REDIRECT_FLAG)) {
          // Already tried a redirect this session — don't loop. Surface a click target.
          sessionStorage.removeItem(REDIRECT_FLAG);
          showAction('Sign-in did not complete on the previous redirect.',
            'click here to try again',
            () => {
              sessionStorage.setItem(REDIRECT_FLAG, '1');
              msalInstance.acquireTokenRedirect(scopeRequest);
            });
          return;
        }
        sessionStorage.setItem(REDIRECT_FLAG, '1');
        showStatus('Need consent — redirecting to Microsoft sign-in…');
        await msalInstance.acquireTokenRedirect(scopeRequest);
        return;
      }
      showStatus('Token error: ' + (silentErr.message || silentErr), true);
      return;
    }
  } else {
    // No cached account — kick a redirect (no popup blocker, no user gesture needed).
    if (sessionStorage.getItem(REDIRECT_FLAG)) {
      sessionStorage.removeItem(REDIRECT_FLAG);
      showAction('Sign-in did not complete on the previous redirect.',
        'click here to try again',
        () => {
          sessionStorage.setItem(REDIRECT_FLAG, '1');
          msalInstance.acquireTokenRedirect(scopeRequest);
        });
      return;
    }
    sessionStorage.setItem(REDIRECT_FLAG, '1');
    showStatus('Authorizing DAX agent — redirecting to Microsoft sign-in…');
    await msalInstance.acquireTokenRedirect(scopeRequest);
    return;
  }

  showStatus('Got token. Starting chat…');
  try {
    await renderChat(cfg, msalInstance, tokenResp.accessToken);
  } catch (e) {
    showStatus('Chat render failed: ' + (e.message || e), true);
  }
})();

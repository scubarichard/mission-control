(async function bootDax() {
  const statusEl = document.getElementById('status');
  const webchatEl = document.getElementById('webchat');
  const userSlot = document.getElementById('user-slot');

  function showStatus(msg) {
    statusEl.hidden = false;
    statusEl.textContent = msg;
  }

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

  function whenReady() {
    return new Promise((resolve) => {
      const check = () => window.CopilotStudio && window.WebChat && window.msal;
      if (check()) return resolve();
      const interval = setInterval(() => {
        if (check()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  const principal = await loadUser();
  if (principal && principal.userDetails) {
    userSlot.textContent = principal.userDetails;
  }

  await whenReady();

  let cfg;
  try {
    cfg = await fetchAgentConfig();
  } catch (err) {
    showStatus('Could not load DAX config: ' + err.message);
    return;
  }

  const msalInstance = new window.msal.PublicClientApplication({
    auth: {
      clientId: cfg.clientId,
      authority: 'https://login.microsoftonline.com/' + cfg.tenantId,
      redirectUri: window.location.origin + '/'
    },
    cache: { cacheLocation: 'sessionStorage' }
  });
  await msalInstance.initialize();
  await msalInstance.handleRedirectPromise();

  let account = msalInstance.getAllAccounts()[0];
  let tokenResp;
  const scopeRequest = { scopes: [cfg.scope], loginHint: cfg.user.name };

  try {
    if (account) {
      tokenResp = await msalInstance.acquireTokenSilent({ ...scopeRequest, account });
    } else {
      tokenResp = await msalInstance.ssoSilent(scopeRequest);
      account = tokenResp.account;
    }
  } catch (silentErr) {
    console.warn('Silent token acquisition failed, falling back to popup:', silentErr);
    try {
      tokenResp = await msalInstance.acquireTokenPopup(scopeRequest);
      account = tokenResp.account;
    } catch (popupErr) {
      showStatus('Could not get agent access token: ' + (popupErr.message || popupErr));
      return;
    }
  }

  const { CopilotStudioClient, CopilotStudioWebChat, ConnectionSettings } = window.CopilotStudio;
  const settings = new ConnectionSettings({ directConnectUrl: cfg.directConnectUrl });
  const client = new CopilotStudioClient(settings, tokenResp.accessToken);
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
    {
      directLine,
      styleOptions,
      locale: 'en-US'
    },
    webchatEl
  );
})();

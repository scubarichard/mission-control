(async function bootDax() {
  const statusEl = document.getElementById('status');
  const webchatEl = document.getElementById('webchat');
  const userSlot = document.getElementById('user-slot');

  function showStatus(msg, isError) {
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.style.background = isError ? 'rgba(248, 113, 113, 0.12)' : '';
    statusEl.style.color = isError ? '#F87171' : '';
    statusEl.style.borderTopColor = isError ? 'rgba(248, 113, 113, 0.3)' : '';
    statusEl.style.cursor = '';
    statusEl.onclick = null;
    console.log('[dax]', msg);
  }

  window.addEventListener('error', (e) => {
    showStatus('JS error: ' + (e.message || 'unknown'), true);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    const msg = (r && (r.message || r.errorMessage)) || (typeof r === 'string' ? r : JSON.stringify(r));
    showStatus('Unhandled rejection: ' + msg, true);
  });

  showStatus('Booting…');

  function whenReady(timeoutMs) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const have = () => ({ cs: !!window.CopilotStudio, wc: !!window.WebChat, msal: !!window.msal });
      const ready = (h) => h.cs && h.wc && h.msal;
      if (ready(have())) return resolve();
      const i = setInterval(() => {
        const h = have();
        if (ready(h)) { clearInterval(i); resolve(); return; }
        if (Date.now() - start > timeoutMs) {
          clearInterval(i);
          reject(new Error('SDK load timeout. CopilotStudio=' + h.cs + ' WebChat=' + h.wc + ' msal=' + h.msal));
        }
      }, 100);
    });
  }

  showStatus('Waiting for SDKs…');
  try { await whenReady(15000); } catch (e) { showStatus(e.message, true); return; }

  showStatus('Fetching agent config…');
  let cfg;
  try {
    cfg = await (await fetch('/api/token', { credentials: 'omit' })).json();
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

  let account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) {
    showStatus('Not signed in — returning to login…');
    setTimeout(() => window.location.replace('/'), 800);
    return;
  }
  msalInstance.setActiveAccount(account);
  if (userSlot && account.username) userSlot.textContent = account.username;

  showStatus('Acquiring agent token silently…');
  let tokenResp;
  try {
    tokenResp = await msalInstance.acquireTokenSilent({ scopes: [cfg.scope], account });
  } catch (silentErr) {
    console.warn('Silent failed:', silentErr);
    showStatus('Silent failed — re-authenticating…');
    try {
      await msalInstance.acquireTokenRedirect({ scopes: [cfg.scope], account });
      return;
    } catch (e) {
      showStatus('Re-auth failed: ' + (e.message || e), true);
      return;
    }
  }

  showStatus('Got token. Starting chat…');
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

  let lastConnStatus = null;
  let everConnected = false;
  directLine.connectionStatus$.subscribe((s) => {
    console.log('[dax] connection status:', s, '(0=Disconnected 1=Connecting 2=Connected)');
    lastConnStatus = s;
    if (s === 2) everConnected = true;
  });
  setTimeout(() => {
    if (!everConnected && (lastConnStatus === 0 || lastConnStatus === 1)) {
      showStatus('Cannot reach the DAX agent. Most likely cause: the agent has not been Published in Copilot Studio (open the agent and click Publish).', true);
    }
  }, 10000);

  // SEC Rule 17a-4 audit trail: log every user/bot turn to cosmos via /api/log.
  // Fire-and-forget; failures don't block the chat.
  directLine.activity$.subscribe((act) => {
    try {
      if (!act || act.type !== 'message') return;
      const role = act.from && act.from.role === 'user' ? 'user' : 'assistant';
      const content = act.text || (act.attachments ? `[attachments: ${act.attachments.length}]` : '');
      if (!content) return;
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          role,
          content,
          conversationId: act.conversation && act.conversation.id || null,
          activityId: act.id || null,
          activityTimestamp: act.timestamp || null,
          userOid: account && account.idTokenClaims && account.idTokenClaims.oid || null,
          userPrincipal: account && account.username || null
        })
      }).catch(e => console.warn('[dax] log failed', e));
    } catch (e) { console.warn('[dax] log hook error', e); }
  });

  const styleOptions = {
    backgroundColor: '#0d0d0d',
    bubbleBackground: '#1f1f23',
    bubbleBorderColor: '#2a2a30',
    bubbleBorderRadius: 10,
    bubbleBorderWidth: 1,
    bubbleTextColor: '#ECECF1',
    bubbleFromUserBackground: '#3B82F6',
    bubbleFromUserBorderColor: '#3B82F6',
    bubbleFromUserBorderRadius: 10,
    bubbleFromUserBorderWidth: 1,
    bubbleFromUserTextColor: '#FFFFFF',
    primaryFont: '"Segoe UI", system-ui, sans-serif',
    sendBoxBackground: '#161616',
    sendBoxTextColor: '#ECECF1',
    sendBoxButtonColor: '#3B82F6',
    sendBoxButtonColorOnHover: '#60A5FA',
    sendBoxButtonColorOnFocus: '#60A5FA',
    sendBoxBorderTop: '1px solid #2a2a30',
    sendBoxPlaceholderColor: '#7C7C85',
    suggestedActionBackgroundColor: '#1f1f23',
    suggestedActionBorderColor: '#2a2a30',
    suggestedActionTextColor: '#ECECF1',
    timestampColor: '#7C7C85',
    rootHeight: '100%',
    rootWidth: '100%'
  };

  showStatus('Rendering chat…');
  try {
    window.WebChat.renderWebChat({ directLine, styleOptions, locale: 'en-US' }, webchatEl);
    setTimeout(() => { statusEl.hidden = true; }, 1500);
  } catch (e) {
    showStatus('Web Chat render failed: ' + (e.message || e), true);
  }
})();

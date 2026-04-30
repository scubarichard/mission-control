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
      const principal = data.clientPrincipal;
      if (principal && principal.userDetails) {
        userSlot.textContent = principal.userDetails;
      }
      return principal;
    } catch (_) {
      return null;
    }
  }

  async function fetchAgentToken() {
    const res = await fetch('/api/token', { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('Token endpoint failed: ' + res.status + ' ' + text);
    }
    return res.json();
  }

  function whenSdkReady() {
    if (window.CopilotStudio && window.WebChat) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (window.CopilotStudio && window.WebChat) resolve();
      };
      document.addEventListener('cs-sdk-ready', check, { once: false });
      const interval = setInterval(() => {
        if (window.CopilotStudio && window.WebChat) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  await loadUser();
  await whenSdkReady();

  let agentInfo;
  try {
    agentInfo = await fetchAgentToken();
  } catch (err) {
    showStatus('Could not start DAX chat: ' + err.message);
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

  const { CopilotStudioClient, CopilotStudioWebChat, ConnectionSettings } = window.CopilotStudio;

  const settings = new ConnectionSettings({
    directConnectUrl: agentInfo.directConnectUrl
  });

  const client = new CopilotStudioClient(settings, agentInfo.token);
  const directLine = CopilotStudioWebChat.createConnection(client, { showTyping: true });

  window.WebChat.renderWebChat(
    {
      directLine,
      styleOptions,
      locale: 'en-US'
    },
    webchatEl
  );
})();

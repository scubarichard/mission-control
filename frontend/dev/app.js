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

  async function fetchDirectLineToken() {
    const res = await fetch('/api/token', { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('Token endpoint failed: ' + res.status + ' ' + text);
    }
    return res.json();
  }

  await loadUser();

  let tokenInfo;
  try {
    tokenInfo = await fetchDirectLineToken();
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

  const directLine = window.WebChat.createDirectLine({ token: tokenInfo.token });

  window.WebChat.renderWebChat(
    {
      directLine,
      styleOptions,
      locale: 'en-US'
    },
    webchatEl
  );
})();

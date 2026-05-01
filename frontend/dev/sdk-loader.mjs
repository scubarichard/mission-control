// Loaded as <script type="module" src="/sdk-loader.mjs"> so the inline-script
// CSP restriction doesn't apply. Imports from unpkg (allowed by script-src).
import { CopilotStudioClient, CopilotStudioWebChat, ConnectionSettings }
  from 'https://unpkg.com/@microsoft/agents-copilotstudio-client@1.5.1/dist/src/browser.mjs';

window.CopilotStudio = { CopilotStudioClient, CopilotStudioWebChat, ConnectionSettings };
document.dispatchEvent(new Event('cs-sdk-ready'));

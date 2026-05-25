/*---------------------------------------------------------------------------------------------
 *  Rota alternativa: chat Princy sem workbench (sem cache do editor).
 *  https://princyai.com/princy-chat-live/
 *--------------------------------------------------------------------------------------------*/

import type { FastifyInstance } from 'fastify';

const PRINCY_CHAT_LIVE_HTML = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
<title>Princy Chat Live</title>
<style>
  :root { --bg:#181818; --panel:#1f1f1f; --border:rgba(255,255,255,.1); --text:#ccc; --accent:#e4e4e4; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,sans-serif; background:var(--bg); color:var(--text); min-height:100vh; display:flex; flex-direction:column; }
  header { padding:12px 16px; border-bottom:1px solid var(--border); display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  header h1 { margin:0; font-size:15px; font-weight:600; color:var(--accent); }
  #status { font-size:12px; padding:4px 8px; border-radius:4px; background:var(--panel); }
  #status.ok { color:#89d185; }
  #status.err { color:#f48771; }
  main { flex:1; display:flex; flex-direction:column; max-width:900px; width:100%; margin:0 auto; padding:16px; gap:12px; }
  #log { flex:1; overflow:auto; background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:12px; font-size:13px; line-height:1.5; white-space:pre-wrap; }
  .row { display:flex; gap:8px; }
  input, button, select { font:inherit; }
  #input { flex:1; padding:10px 12px; border-radius:8px; border:1px solid var(--border); background:#252526; color:var(--text); }
  button { padding:10px 16px; border-radius:8px; border:1px solid var(--border); background:var(--accent); color:#1e1e1e; cursor:pointer; font-weight:600; }
  button:disabled { opacity:.5; cursor:not-allowed; }
  a { color:#9cdcfe; }
  .hint { font-size:12px; opacity:.85; }
</style>
</head>
<body data-princy-ui-rev="cursor-agent-2026.05.25-r7" class="cursor-agent-ui">
<header>
  <h1>Princy Chat Live</h1>
  <span id="status">A testar API...</span>
  <span class="hint">API: <code id="apiBase"></code> · <a href="/webeditor-live/">Editor live</a> · <a href="/webeditor/">Editor normal</a></span>
</header>
<main>
  <div id="log">A ligar ao agent backend (/princy-api)...</div>
  <div class="row">
    <select id="mode"><option value="chat">Chat</option><option value="agent">Agent job</option></select>
    <input id="input" type="text" placeholder="Mensagem de teste..." />
    <button id="send" type="button">Enviar</button>
  </div>
</main>
<script>
(function () {
  const logEl = document.getElementById('log');
  const statusEl = document.getElementById('status');
  const apiEl = document.getElementById('apiBase');
  const input = document.getElementById('input');
  const sendBtn = document.getElementById('send');
  const modeSel = document.getElementById('mode');

  const apiBase = (location.origin + '/princy-api').replace(/\/$/, '');
  apiEl.textContent = apiBase;

  function append(line) {
    logEl.textContent += '\n' + line;
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function probe() {
    try {
      const r = await fetch(apiBase + '/api/agent/health', { credentials: 'include' });
      const j = await r.json();
      if (j.ok) {
        statusEl.textContent = 'Backend OK';
        statusEl.className = 'ok';
        append('Health OK: ' + JSON.stringify(j));
        return true;
      }
      throw new Error(JSON.stringify(j));
    } catch (e) {
      statusEl.textContent = 'Backend OFFLINE';
      statusEl.className = 'err';
      append('ERRO health: ' + (e.message || e));
      return false;
    }
  }

  async function sendChat(text) {
    const r = await fetch(apiBase + '/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ agent: 'deepseek', message: text, context: 'princy-chat-live' })
    });
    const j = await r.json();
    append('Chat: ' + (j.reply || j.message || JSON.stringify(j)));
  }

  async function sendJob(text) {
    const r = await fetch(apiBase + '/api/agent/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ agent: 'deepseek', message: text, context: 'princy-chat-live' })
    });
    const j = await r.json();
    const jobId = j.jobId || j.id;
    append('Job: ' + jobId + ' state=' + (j.state || '?'));
    if (!jobId) return;
    const snap = await fetch(apiBase + '/api/agent/jobs/' + encodeURIComponent(jobId), { credentials: 'include' });
    append('Snapshot: ' + await snap.text());
  }

  sendBtn.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      if (modeSel.value === 'agent') await sendJob(text);
      else await sendChat(text);
    } catch (e) {
      append('ERRO send: ' + (e.message || e));
    } finally {
      sendBtn.disabled = false;
    }
  };

  probe();
})();
</script>
</body>
</html>`;

export async function registerPrincyChatLiveRoutes(app: FastifyInstance): Promise<void> {
	const handler = async (_request: unknown, reply: { header: (k: string, v: string) => void; type: (t: string) => { send: (b: string) => unknown } }) => {
		reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
		reply.header('Pragma', 'no-cache');
		return reply.type('text/html').send(PRINCY_CHAT_LIVE_HTML);
	};

	app.get('/princy-chat-live', handler);
	app.get('/princy-chat-live/', handler);
}

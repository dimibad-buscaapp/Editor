# Fase 10 — Princy Automations

## Visao

Modulo **Princy Automations**: gerar scripts PowerShell, Node, bots de navegador, tarefas agendadas, integracoes API, webhooks e robos de atendimento — com pipeline orquestrado (plan → build → test → publicar → monitorar).

## Fluxo

1. **Criar projeto** — modo Creator (templates `automation`, `powershell-script`, `browser-bot`, `api-integration`, `chatbot-support`, `bot`)
2. **Gerar job** — Automations: nome + cron → scaffold
3. **Agendar** — Task Scheduler (VPS) ou instrucoes locais
4. **Executar / Testar** — run ou smoke test
5. **Pipeline** — receita `full-stack-web`, `api-deploy` ou `daily-script`
6. **Monitorar** — watchdog verifica `/api/health` e dispara heal job

## Templates

| ID | Nome |
|----|------|
| `automation` | Jobs node-cron |
| `powershell-script` | Script .ps1 |
| `browser-bot` | Playwright |
| `api-integration` | Cliente HTTP + cron |
| `chatbot-support` | Bot Telegram + FAQ |
| `bot` | Bot Telegram basico |

Marcador: `// PRINCY_AUTOMATION_INSERT` (Node) ou `# PRINCY_AUTOMATION_INSERT` (PS).

## API REST (:3210)

| Metodo | Rota | Funcao |
|--------|------|--------|
| GET | `/api/automations` | Capacidades + watchdog status |
| GET | `/api/automations/:slug` | Info do projeto |
| POST | `/api/automations/:slug/scaffold` | Gerar job |
| POST | `/api/automations/:slug/run` | Executar uma vez |
| POST | `/api/automations/:slug/test` | Smoke test |
| POST | `/api/automations/:slug/schedule` | Agendar |
| DELETE | `/api/automations/:slug/schedule` | Remover agendamento |
| GET | `/api/automations/:slug/logs` | Ultimas linhas de log |
| POST | `/api/automations/:slug/trigger` | Webhook ingress |
| POST | `/api/automations/:slug/pipeline` | Pipeline orquestrado |
| POST | `/api/automations/watchdog/start` | Iniciar watchdog |
| POST | `/api/automations/watchdog/stop` | Parar watchdog |

## Extensao

Modo **Automations** no painel: Criar → Gerar → Agendar → Executar → Monitorar.

Botao **Executar aqui** abre terminal local no projeto.

## Agent modo builder

Jobs com `mode: "builder"` + `buildTarget` + `projectSlug` executam apos apply:
compile → test → Build Center → API test (se api) → preview/publish (se web).

## Deploy VPS

```powershell
cd C:\Apps\Editor
powershell -ExecutionPolicy Bypass -File .\deploy\windows\deploy-fase10-automacoes.ps1
```

## Storage

```
workspace-storage/
├── projetos/{slug}/
└── princy-automations/{slug}/manifest.json
```

## Variaveis

| Variavel | Padrao |
|----------|--------|
| `PRINCY_AUTOMATIONS_ROOT` | `{WORKSPACE_STORAGE}/princy-automations` |
| `PRINCY_AUTOMATION_WATCHDOG` | `true` |
| `PRINCY_WATCHDOG_INTERVAL_MS` | `300000` |

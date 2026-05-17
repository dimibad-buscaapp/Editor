# Autenticacao Temporaria e Proxima Fase

Nesta fase, o Princy Ai Code-OSS Web deve ficar privado. O runtime `scripts/code-web.bat` nao implementa login multiusuario por conta propria.

## Agora

Use uma das opcoes temporarias:

- Acessar apenas pelo navegador dentro do RDP do VPS.
- Liberar a porta `3200` somente para IPs administrativos no firewall.
- Colocar `princyai.com` atras de Cloudflare Access antes de liberar publicamente.

## Recomendado Para Colaboradores

A proxima camada profissional deve ser autenticacao externa antes do Code-OSS Web:

- Cloudflare Access, mais rapido para email/Google/Microsoft.
- Authentik ou Keycloak, se quiser controlar usuarios internamente.
- Caddy `forward_auth`, se adotarmos Authentik/Authelia.

## Regra

Nao exponha `127.0.0.1:3200` publicamente sem autenticação. O dominio publico deve passar por HTTPS e por uma camada de acesso.

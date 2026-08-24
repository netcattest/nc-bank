# Arquitetura inicial

O projeto comeca como um monorepo pequeno para facilitar evolucao sem misturar responsabilidades.

- `frente` entrega a interface publica em `netcatbank.com`.
- `api` entrega contratos HTTP somente na rede privada; o navegador acessa o BFF `/canal-seguro-api` na frente.
- `proxy` recebe todo trafego externo e aplica HTTPS, redirecionamento e cabecalhos de seguranca.
- `banco-dados` e `cache` ficam somente na rede privada.

Decisoes de seguranca ja preparadas:

- HTTPS obrigatorio em producao com ACME DNS-01 pela Cloudflare.
- Sem portas publicas para API, Postgres ou Redis.
- Sem DNS publico para API; `api.netcatbank.com` deve ficar inexistente publicamente, e a borda publica nao possui router `api`.
- O nome `api.netcatbank.interno` e apenas identidade interna de mTLS, nao registro publico.
- Canal interno frente -> API com mTLS, HMAC versionado, identidade de servico e replay cache em Redis.
- Containers de aplicacao sem privilegios extras.
- Cabecalhos base de seguranca no proxy e no Next.js.
- Separacao entre rede publica e rede privada.
- Variaveis sensiveis fora do repositorio.

As proximas etapas naturais sao auditoria operacional, modelagem bancaria, observabilidade, pipeline CI/CD e gestao formal de segredos.

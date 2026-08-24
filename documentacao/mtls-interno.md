# mTLS interno

O NC Bank usa API privada: o navegador nunca chama `api.netcatbank.com`. As telas chamam `/canal-seguro-api` no proprio front, e o BFF conversa com a API pela rede privada Docker usando mTLS, HMAC interno e replay cache em Redis.

## Arquivos

Gere os certificados locais com:

```bash
npm run preparar:mtls
```

O comando cria `segredos/mtls/`:

- `ca.crt` e `ca.key`: autoridade interna.
- `api.crt` e `api.key`: certificado servidor da API.
- `bff.crt` e `bff.key`: certificado cliente do BFF.
- `monitor.crt` e `monitor.key`: certificado cliente usado pelo healthcheck.

`segredos/mtls` fica fora do versionamento. Em producao, prefira trocar esses arquivos por certificados emitidos por uma CA interna operacional, mantendo os mesmos nomes ou atualizando as variaveis de ambiente.

## Rotacao

- Para recriar tudo em desenvolvimento: `npm run preparar:mtls -- --forcar`.
- Para rotacionar HMAC sem queda, preencha `NCBANK_SEGREDO_CANAL_INTERNO_ANTERIOR` com o segredo atual, gere um novo `NCBANK_SEGREDO_CANAL_INTERNO` e ajuste `NCBANK_ID_SEGREDO_CANAL_INTERNO`.
- A API aceita o segredo atual e o anterior; o BFF assina somente com o atual.
- Depois da janela de deploy, remova o segredo anterior.

## Producao

O Compose de producao monta certificados como Docker secrets em `/run/secrets`. O Compose de desenvolvimento monta `segredos/mtls` em `/certificados/mtls`.

Variaveis principais:

- `NCBANK_MTLS_API_ATIVO=true`
- `NCBANK_MTLS_CLIENTE_ATIVO=true`
- `NCBANK_MTLS_SERVERNAME=api.netcatbank.interno`
- `NCBANK_MTLS_CLIENTE_CN=bff.netcatbank.interno`
- `NCBANK_IDENTIDADE_BFF=netcatbank-frente-bff`

Nao publique DNS ou router para a API. O unico caminho externo permitido para operacoes de API e o BFF do front.

## DNS publico

`api.netcatbank.com` nao deve existir publicamente. Nao crie registro `A`, `AAAA`, `CNAME`, proxied ou DNS-only para esse nome no Cloudflare. O certificado da API usa `api.netcatbank.interno`, que e apenas identidade interna do mTLS, nao subdominio publico.

No desenvolvimento, `localtest.me` resolve qualquer subdominio para a maquina local. Por isso `api.netcatbank.localtest.me` pode resolver por causa do wildcard externo do proprio `localtest.me`, mas ele nao possui router Traefik nem chega na API. Em producao, a garantia esperada e NXDOMAIN/sem dados para `api.netcatbank.com`.

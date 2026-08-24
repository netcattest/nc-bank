# Segredos locais

Guarde aqui apenas arquivos locais sensiveis quando forem necessarios. O conteudo desta pasta e ignorado pelo Git.

Nao coloque tokens, senhas ou chaves privadas em arquivos versionados.

## mTLS interno

Gere a CA local e os certificados internos com:

```bash
npm run preparar:mtls
```

Os arquivos ficam em `segredos/mtls/` e continuam ignorados pelo controle de versao.
Para rotacionar tudo em desenvolvimento, use `npm run preparar:mtls -- --forcar`.

Em producao, use uma CA interna propria ou gere uma nova neste mesmo formato e monte
os arquivos esperados nos containers:

- `ca.crt`
- `api.crt` e `api.key`
- `bff.crt` e `bff.key`
- `monitor.crt` e `monitor.key`

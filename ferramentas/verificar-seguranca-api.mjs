#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createCipheriv, createECDH, createHash, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { resolveAny } from "node:dns/promises";
import { readFileSync } from "node:fs";

const origemAbertura =
  process.env.NCBANK_TESTE_ORIGEM_ABERTURA ?? "https://abrir-conta.netcatbank.localtest.me:8443";
const origemCliente =
  process.env.NCBANK_TESTE_ORIGEM_CLIENTE ?? "https://cliente.netcatbank.localtest.me:8443";
const origemPainel =
  process.env.NCBANK_TESTE_ORIGEM_PAINEL ?? "https://painel.netcatbank.localtest.me:8443";
const frenteAbertura = process.env.NCBANK_TESTE_FRENTE_URL ?? origemAbertura;
const api = process.env.NCBANK_TESTE_API_URL ?? `${origemAbertura}/canal-seguro-api`;
const dnsApiPublica =
  process.env.NCBANK_TESTE_DNS_API_PUBLICA ?? "api.netcatbank.com";
const dominioCookieEsperado =
  process.env.NCBANK_TESTE_COOKIE_DOMAIN ?? (api.includes("localtest.me") ? "netcatbank.localtest.me" : "");

process.on("warning", (aviso) => {
  if (!aviso.message.includes("NODE_TLS_REJECT_UNAUTHORIZED")) {
    console.warn(aviso);
  }
});

if (api.includes("localtest.me") || api.includes("localhost")) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const resultados = [];
const sensiveisGerados = [];
const agenteTeste = `Mozilla/5.0 NetCatBank-Seguranca/${Date.now()}-${process.pid}`;
const sinalClienteTeste = createHash("sha256")
  .update(`netcatbank-teste-seguranca:${agenteTeste}`)
  .digest("base64url");
const segredoAplicacaoTeste =
  process.env.NCBANK_TESTE_SEGREDO_APLICACAO ??
  "netcatbank-desenvolvimento-trocar-em-producao-8d6f0f4d16b34a29";
const segredoFinanceiroTeste =
  process.env.NCBANK_TESTE_SEGREDO_FINANCEIRO_HMAC ??
  process.env.NCBANK_SEGREDO_FINANCEIRO_HMAC ??
  "netcatbank-financeiro-desenvolvimento-trocar-em-producao-712f4d0c9a6b";
const aliasKmsFinanceiroTeste =
  process.env.NCBANK_TESTE_KMS_ALIAS_FINANCEIRO ??
  process.env.NCBANK_KMS_ALIAS_FINANCEIRO ??
  "netcatbank-financeiro-local";
const chaveIndiceTeste = createHash("sha256")
  .update(`netcatbank:indice:${segredoAplicacaoTeste}`)
  .digest();
const chaveAssinaturaFinanceiraTeste = createHash("sha256")
  .update(`netcatbank:financeiro:${aliasKmsFinanceiroTeste}:${segredoFinanceiroTeste}`)
  .digest();
const sequenciasEnvelopeTeste = new Map();

const canonicalizarJsonSeguro = (valor) => {
  if (valor === null) return "null";
  if (typeof valor === "string") return JSON.stringify(valor);
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new Error("json_nao_canonico");
    return JSON.stringify(valor);
  }
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (Array.isArray(valor)) return `[${valor.map((item) => canonicalizarJsonSeguro(item)).join(",")}]`;
  if (typeof valor === "object") {
    return `{${Object.keys(valor)
      .sort()
      .map((chave) => {
        const item = valor[chave];
        if (item === undefined || typeof item === "function" || typeof item === "symbol") {
          throw new Error("json_nao_canonico");
        }
        return `${JSON.stringify(chave)}:${canonicalizarJsonSeguro(item)}`;
      })
      .join(",")}}`;
  }
  throw new Error("json_nao_canonico");
};

const hashBase64url = (valor) => createHash("sha256").update(valor).digest("base64url");

const criticidadeEnvelope = (rota) =>
  rota.startsWith("/financeiro/") ||
  rota.startsWith("/nex/") ||
  rota.startsWith("/pagamentos/") ||
  rota.startsWith("/doacoes/") ||
  rota.startsWith("/emprestimos/") ||
  rota.startsWith("/auth/") ||
  rota === "/abertura/iniciar" ||
  rota === "/abertura/cnpj/consulta" ||
  rota === "/abertura/cancelar" ||
  rota === "/abertura/complemento"
    ? "alta"
    : "padrao";

const proximaSequenciaEnvelope = (fluxo, rota) => {
  const chave = `${fluxo}:${rota}`;
  const proxima = (sequenciasEnvelopeTeste.get(chave) ?? 0) + 1;
  sequenciasEnvelopeTeste.set(chave, proxima);
  return proxima;
};

const reduzirBase64url32 = (valor) => {
  let acumulador = 0x811c9dc5;
  for (let indice = 0; indice < valor.length; indice += 1) {
    acumulador = Math.imul(acumulador ^ valor.charCodeAt(indice), 0x01000193);
  }
  return acumulador >>> 0;
};

const calcularIntegridadeRuntime = (aadHash, payloadHash) => {
  const esquerda = reduzirBase64url32(aadHash);
  const direita = reduzirBase64url32(payloadHash);
  return ((Math.imul(esquerda, 0x01000193) ^ direita) >>> 0).toString(16).padStart(8, "0");
};

const assinarRequisicao = ({ csrf, envelopeHash, fluxo, rota, tempo }) => {
  const segredo = createHash("sha256")
    .update(`netcatbank-assinatura:${csrf}:${sinalClienteTeste}`)
    .digest();
  const texto = [
    "NCBANK-REQ-HMAC-v1",
    fluxo,
    rota,
    envelopeHash,
    tempo,
    sinalClienteTeste
  ].join("|");
  return createHmac("sha256", segredo).update(texto).digest("base64url");
};

const indiceSeguroTeste = (valor) =>
  createHmac("sha256", chaveIndiceTeste).update(valor).digest("hex");

const registrar = (nome, ok, detalhe = "") => {
  resultados.push({ nome, ok, detalhe });
  const marcador = ok ? "ok" : "falhou";
  console.log(`${marcador.padEnd(6)} ${nome}${detalhe ? ` (${detalhe})` : ""}`);
};

class CookiesNetCat {
  constructor() {
    this.cookies = new Map();
  }

  adicionar(resposta) {
    const cabecalhos =
      typeof resposta.headers.getSetCookie === "function"
        ? resposta.headers.getSetCookie()
        : [resposta.headers.get("set-cookie")].filter(Boolean);

    for (const cabecalho of cabecalhos) {
      const bruto = cabecalho.split(";")[0];
      const indice = bruto.indexOf("=");
      if (indice === -1) continue;
      const nome = bruto.slice(0, indice);
      const valor = bruto.slice(indice + 1);
      if (!valor) {
        this.cookies.delete(nome);
      } else {
        this.cookies.set(nome, valor);
      }
    }
  }

  cabecalho() {
    return Array.from(this.cookies.entries())
      .map(([nome, valor]) => `${nome}=${valor}`)
      .join("; ");
  }
}

const jar = new CookiesNetCat();

const obterSetCookies = (resposta) =>
  typeof resposta.headers.getSetCookie === "function"
    ? resposta.headers.getSetCookie()
    : [resposta.headers.get("set-cookie")].filter(Boolean);

const requisitar = async (
  caminho,
  {
    origem,
    fluxo,
    metodo = "GET",
    csrf,
    corpo,
    cookieManual,
    usarCookies = true,
    enviarSinalCliente = true,
    enviarFetchMetadata = true,
    assinaturaManual,
    ipManual
  } = {}
) => {
  const cabecalhos = {};
  if (origem) cabecalhos.Origin = origem;
  if (fluxo) cabecalhos["X-NetCatBank-Fluxo"] = fluxo;
  if (fluxo && enviarSinalCliente) cabecalhos["X-NetCatBank-Cliente"] = sinalClienteTeste;
  if (csrf) cabecalhos["X-NetCatBank-CSRF"] = csrf;
  if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
  if (origem && fluxo) {
    cabecalhos["Accept-Language"] = "pt-BR,pt;q=0.9";
    cabecalhos["User-Agent"] = agenteTeste;
  }
  if (origem && fluxo && enviarFetchMetadata) {
    cabecalhos["Sec-Fetch-Site"] = "same-site";
    cabecalhos["Sec-Fetch-Mode"] = "cors";
    cabecalhos["Sec-Fetch-Dest"] = "empty";
  }
  if (ipManual) {
    cabecalhos["X-Forwarded-For"] = ipManual;
  }
  if (
    csrf &&
    fluxo &&
    metodo !== "GET" &&
    corpo &&
    typeof corpo === "object" &&
    typeof corpo.envelopeHash === "string"
  ) {
    const tempo = Date.now().toString();
    cabecalhos["X-NetCatBank-Tempo"] = tempo;
    cabecalhos["X-NetCatBank-Assinatura"] =
      assinaturaManual ??
      assinarRequisicao({
        csrf,
        envelopeHash: corpo.envelopeHash,
        fluxo,
        rota: caminho,
        tempo
      });
  }
  if (cookieManual) {
    cabecalhos.Cookie = cookieManual;
  } else if (usarCookies && jar.cabecalho()) {
    cabecalhos.Cookie = jar.cabecalho();
  }

  const resposta = await fetch(`${api}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: "no-store"
  });
  const headers = Object.fromEntries(resposta.headers.entries());
  const setCookies = obterSetCookies(resposta);
  if (!cookieManual) jar.adicionar(resposta);

  const texto = await resposta.text();
  let json = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = null;
  }

  return { status: resposta.status, headers, json, setCookies, texto };
};

const aguardar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

const buscarFrenteComTentativas = async (urls) => {
  let ultimaResposta = null;
  const candidatos = Array.isArray(urls) ? urls : [urls];

  for (let tentativa = 0; tentativa < 30; tentativa += 1) {
    for (const url of candidatos) {
      const resposta = await fetch(url, {
        headers: {
          "User-Agent": agenteTeste,
          Accept: "text/html"
        }
      });

      ultimaResposta = resposta;
      if (resposta.ok) return resposta;
    }
    await aguardar(1_000);
  }

  return ultimaResposta;
};

const preflightCors = async (caminho, { origem, metodoSolicitado, headersSolicitados = "" }) => {
  const resposta = await fetch(`${api}${caminho}`, {
    method: "OPTIONS",
    headers: {
      Origin: origem,
      "Access-Control-Request-Method": metodoSolicitado,
      ...(headersSolicitados ? { "Access-Control-Request-Headers": headersSolicitados } : {})
    },
    cache: "no-store"
  });

  return {
    status: resposta.status,
    headers: Object.fromEntries(resposta.headers.entries()),
    texto: await resposta.text()
  };
};

const criarCpfValido = () => {
  const calcular = (numeros) => {
    const soma = numeros.reduce((total, numero, indice) => total + numero * (numeros.length + 1 - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  base.push(calcular(base));
  base.push(calcular(base));
  return base.join("");
};

const digitoModulo10BoletoTeste = (valor) => {
  let soma = 0;
  let peso = 2;

  for (let indice = valor.length - 1; indice >= 0; indice -= 1) {
    const produto = Number(valor[indice]) * peso;
    soma += produto > 9 ? Math.floor(produto / 10) + (produto % 10) : produto;
    peso = peso === 2 ? 1 : 2;
  }

  return (10 - (soma % 10)) % 10;
};

const digitoModulo11BoletoTeste = (valor) => {
  let soma = 0;
  let peso = 2;

  for (let indice = valor.length - 1; indice >= 0; indice -= 1) {
    soma += Number(valor[indice]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }

  const digito = 11 - (soma % 11);
  return digito === 0 || digito === 10 || digito === 11 ? 1 : digito;
};

const criarCodigoBarrasBoletoTeste = () => {
  const banco = "260";
  const moeda = "9";
  const fatorVencimento = "2500";
  const valor = "0000000100";
  const campoLivre = randomBytes(13).toString("hex").replace(/\D/g, "").padEnd(25, "7").slice(0, 25);
  const semDigito = `${banco}${moeda}${fatorVencimento}${valor}${campoLivre}`;
  const digitoGeral = digitoModulo11BoletoTeste(semDigito);

  return `${semDigito.slice(0, 4)}${digitoGeral}${semDigito.slice(4)}`;
};

const criarLinhaDigitavelBoletoTeste = (codigoBarras) => {
  const campo1 = `${codigoBarras.slice(0, 4)}${codigoBarras.slice(19, 24)}`;
  const campo2 = codigoBarras.slice(24, 34);
  const campo3 = codigoBarras.slice(34, 44);

  return [
    `${campo1}${digitoModulo10BoletoTeste(campo1)}`,
    `${campo2}${digitoModulo10BoletoTeste(campo2)}`,
    `${campo3}${digitoModulo10BoletoTeste(campo3)}`,
    codigoBarras[4],
    codigoBarras.slice(5, 19)
  ].join("");
};

const assinarSaldoContaTeste = ({
  contaId,
  saldoDisponivelCentavos,
  saldoTotalCentavos,
  saldoContabilCentavos,
  moeda,
  versao
}) =>
  createHmac("sha256", chaveAssinaturaFinanceiraTeste)
    .update(
      [
        "saldo-conta-v1",
        contaId,
        String(saldoDisponivelCentavos),
        String(saldoTotalCentavos),
        String(saldoContabilCentavos),
        moeda,
        String(versao)
      ].join("|")
    )
    .digest("hex");

const assinarLancamentoSaldoTeste = ({
  contaId,
  idempotenciaChave,
  tipo,
  fase,
  estado,
  deltaDisponivelCentavos,
  deltaContabilCentavos,
  moeda,
  versaoSaldo,
  hashAnterior,
  merkleRaiz,
  referenciaOrigem,
  metadadosCifrados
}) =>
  createHmac("sha256", chaveAssinaturaFinanceiraTeste)
    .update(
      [
        "ledger-saldo-v1",
        contaId,
        idempotenciaChave,
        tipo,
        fase,
        estado,
        String(deltaDisponivelCentavos),
        String(deltaContabilCentavos),
        moeda,
        String(versaoSaldo),
        hashAnterior,
        merkleRaiz,
        referenciaOrigem,
        metadadosCifrados
      ].join("|")
    )
    .digest("hex");

const assinarPartidaDobradaSaldoTeste = ({
  contaId,
  idempotenciaChave,
  ordem,
  contaContabil,
  natureza,
  valorCentavos,
  moeda
}) =>
  createHmac("sha256", chaveAssinaturaFinanceiraTeste)
    .update(
      [
        "partida-dobrada-saldo-v1",
        contaId,
        idempotenciaChave,
        String(ordem),
        contaContabil,
        natureza,
        String(valorCentavos),
        moeda
      ].join("|")
    )
    .digest("hex");

const calcularMerkleRaizSaldoTeste = (folhas) => {
  let camada = folhas.length > 0 ? folhas : [createHash("sha256").update("netcatbank:ledger-sem-partidas").digest("hex")];

  while (camada.length > 1) {
    const proxima = [];
    for (let indice = 0; indice < camada.length; indice += 2) {
      const esquerda = camada[indice] ?? "";
      const direita = camada[indice + 1] ?? esquerda;
      proxima.push(createHash("sha256").update(`${esquerda}:${direita}`).digest("hex"));
    }
    camada = proxima;
  }

  return camada[0] ?? createHash("sha256").update("netcatbank:merkle-vazio").digest("hex");
};

const prepararPartidasCreditoSaldoTeste = (valorCentavos) => [
  { ordem: 1, contaContabil: "liquidacao_banco", natureza: "debito", valorCentavos },
  { ordem: 2, contaContabil: "passivo_clientes", natureza: "credito", valorCentavos },
  { ordem: 3, contaContabil: "disponivel_clientes", natureza: "debito", valorCentavos },
  { ordem: 4, contaContabil: "reservas_operacionais", natureza: "credito", valorCentavos }
];

const alfabetoBase32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const decodificarBase32 = (valor) => {
  const limpo = valor.replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  let bits = "";
  for (const caractere of limpo) {
    const indice = alfabetoBase32.indexOf(caractere);
    if (indice === -1) return Buffer.alloc(0);
    bits += indice.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let indice = 0; indice + 8 <= bits.length; indice += 8) {
    bytes.push(Number.parseInt(bits.slice(indice, indice + 8), 2));
  }
  return Buffer.from(bytes);
};

const gerarTotpTeste = (segredo, deslocamento = 0) => {
  const chave = decodificarBase32(segredo);
  const contador = Math.floor(Date.now() / 30_000) + deslocamento;
  const contadorBuffer = Buffer.alloc(8);
  contadorBuffer.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac("sha1", chave).update(contadorBuffer).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const codigo =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);
  return String(codigo % 1_000_000).padStart(6, "0");
};

const obterCsrf = async (origem) => {
  const resposta = await requisitar("/seguranca/csrf", { origem, fluxo: "csrf-publico" });
  if (resposta.status !== 200 || !resposta.json?.controle?.csrf) {
    throw new Error(`csrf_${resposta.status}`);
  }
  return resposta.json.controle.csrf;
};

const obterTransporte = async (origem) => {
  const resposta = await requisitar("/seguranca/transporte", {
    origem,
    fluxo: "transporte-publico"
  });
  if (
    resposta.status !== 200 ||
    resposta.json?.transporte?.algoritmo !== "NCBANK-ECDH-P256-A256GCM-v3" ||
    !resposta.json?.transporte?.chaveId ||
    !resposta.json?.transporte?.chavePublica ||
    !Number.isSafeInteger(resposta.json?.transporte?.expiraEm)
  ) {
    throw new Error(`transporte_${resposta.status}`);
  }
  return resposta.json.transporte;
};

const envelope = (transporte, payload, { fluxo, rota, csrf }) => {
  const emitidoEm = Date.now();
  const nonce = randomBytes(24).toString("base64url");
  const idempotencia = `idem_${randomBytes(18).toString("base64url")}`;
  const sequencia = proximaSequenciaEnvelope(fluxo, rota);
  const criticidade = criticidadeEnvelope(rota);
  const aadObjeto = {
    _ncAlgoritmo: transporte.algoritmo,
    _ncChaveId: transporte.chaveId,
    _ncClienteHash: hashBase64url(sinalClienteTeste),
    _ncCriticidade: criticidade,
    _ncCsrfHash: hashBase64url(csrf),
    _ncEmitidoEm: emitidoEm,
    _ncFluxo: fluxo,
    _ncIdempotencia: idempotencia,
    _ncNonce: nonce,
    _ncRota: rota,
    _ncSeq: sequencia,
    _ncVersao: 3
  };
  const aad = canonicalizarJsonSeguro(aadObjeto);
  const aadHash = hashBase64url(aad);
  const payloadCanonico = canonicalizarJsonSeguro(payload);
  const payloadHash = hashBase64url(payloadCanonico);
  const integridadeRuntime = calcularIntegridadeRuntime(aadHash, payloadHash);
  const assinaturaPayload = createHmac(
    "sha256",
    createHash("sha256")
      .update(`netcatbank-envelope-payload-v3:${csrf}:${sinalClienteTeste}:${aad}`)
      .digest()
  )
    .update(payloadCanonico)
    .digest("base64url");
  const payloadSeguro = {
    ...payload,
    _ncAadHash: aadHash,
    _ncAssinaturaPayload: assinaturaPayload,
    _ncCliente: sinalClienteTeste,
    _ncCriticidade: criticidade,
    _ncFluxo: fluxo,
    _ncRota: rota,
    _ncCsrf: csrf,
    _ncEmitidoEm: emitidoEm,
    _ncIdempotencia: idempotencia,
    _ncIntegridadeRuntime: integridadeRuntime,
    _ncNonce: nonce,
    _ncPayloadHash: payloadHash,
    _ncSeq: sequencia,
    _ncVersao: 3
  };
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const segredoCompartilhado = ecdh.computeSecret(Buffer.from(transporte.chavePublica, "base64url"));
  const chave = Buffer.from(
    hkdfSync(
      "sha256",
      segredoCompartilhado,
      createHash("sha256").update(aad).digest(),
      Buffer.from("NCBANK-ENVELOPE-AES-GCM-v3"),
      32
    )
  );
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", chave, iv);
  cifrador.setAAD(Buffer.from(aad, "utf8"));
  const cifrado = Buffer.concat([
    cifrador.update(Buffer.from(canonicalizarJsonSeguro(payloadSeguro), "utf8")),
    cifrador.final(),
    cifrador.getAuthTag()
  ]);
  const chavePublica = ecdh.getPublicKey().toString("base64url");
  const ivPublico = iv.toString("base64url");
  const conteudoPublico = cifrado.toString("base64url");
  const assinaturaEnvelope = createHmac(
    "sha256",
    createHash("sha256")
      .update(`netcatbank-envelope-publico-v3:${csrf}:${sinalClienteTeste}:${aad}`)
      .digest()
  )
    .update(`${transporte.algoritmo}.${transporte.chaveId}.${chavePublica}.${ivPublico}.${conteudoPublico}.${hashBase64url(aad)}`)
    .digest("base64url");

  const envelopePublico = {
    algoritmo: transporte.algoritmo,
    chaveId: transporte.chaveId,
    chave: chavePublica,
    iv: ivPublico,
    conteudo: conteudoPublico,
    aad,
    assinatura: assinaturaEnvelope
  };

  return {
    envelope: envelopePublico,
    envelopeHash: hashBase64url(canonicalizarJsonSeguro(envelopePublico))
  };
};

const postSeguro = (rota, origem, fluxo, csrf, transporte, payload) =>
  requisitar(rota, {
    origem,
    fluxo,
    csrf,
    metodo: "POST",
    corpo: envelope(transporte, payload, { fluxo, rota, csrf })
  });

const contemTextoSensivel = (valor) =>
  sensiveisGerados.some((sensivel) => JSON.stringify(valor).includes(sensivel));

const verificarBancoSemTextoClaro = () => {
  const sql = [
    "SELECT count(*) FROM contas_netcatbank",
    "WHERE nome_cifrado ILIKE '%Daniel%'",
    "OR primeiro_nome_cifrado ILIKE '%Daniel%'",
    "OR email_cifrado ILIKE '%netcatbank.test%'",
    "OR documento_cifrado ~ '^[0-9]{11,14}$'",
    "OR data_nascimento_cifrada ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';"
  ].join(" ");

  const saida = execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "compose.desenvolvimento.yml",
      "exec",
      "-T",
      "banco-dados",
      "psql",
      "-U",
      "netcatbank_app",
      "-d",
      "netcatbank",
      "-tAc",
      sql
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  ).trim();

  return saida === "0";
};

const adulterarRedeSessaoMaisRecente = () => {
  const sql = [
    "UPDATE sessoes_cliente_netcatbank",
    "SET contexto_rede_hash = 'netcatbank_rede_adulterada_teste'",
    "WHERE token_hash = (",
    "  SELECT token_hash FROM sessoes_cliente_netcatbank",
    "  ORDER BY criado_em DESC",
    "  LIMIT 1",
    ");"
  ].join(" ");

  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "compose.desenvolvimento.yml",
      "exec",
      "-T",
      "banco-dados",
      "psql",
      "-U",
      "netcatbank_app",
      "-d",
      "netcatbank",
      "-tAc",
      sql
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
};

const expirarSessaoClienteMaisRecente = () => {
  const sql = [
    "UPDATE sessoes_cliente_netcatbank",
    "SET ultimo_uso_em = now() - interval '25 minutes'",
    "WHERE token_hash = (",
    "  SELECT token_hash FROM sessoes_cliente_netcatbank",
    "  ORDER BY criado_em DESC",
    "  LIMIT 1",
    ");"
  ].join(" ");

  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "compose.desenvolvimento.yml",
      "exec",
      "-T",
      "banco-dados",
      "psql",
      "-U",
      "netcatbank_app",
      "-d",
      "netcatbank",
      "-tAc",
      sql
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
};

const apiSemRouterPublicoNoCompose = () => {
  const saida = execFileSync(
    "docker",
    ["compose", "-f", "compose.desenvolvimento.yml", "config"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  return (
    !saida.includes("traefik.http.routers.api-dev") &&
    !saida.includes("traefik.http.routers.api") &&
    !saida.includes("NEXT_PUBLIC_API_URL") &&
    !saida.includes("SUBDOMINIO_API") &&
    !saida.includes("Host(`api.")
  );
};

const dnsPublicoApiInexistente = async () => {
  try {
    const registros = await resolveAny(dnsApiPublica);
    return {
      ok: registros.length === 0,
      detalhe: registros.length === 0 ? "sem registros" : `${dnsApiPublica} resolveu publicamente`
    };
  } catch (erro) {
    if (erro?.code === "ENOTFOUND" || erro?.code === "ENODATA" || erro?.code === "ESERVFAIL") {
      return { ok: true, detalhe: `${dnsApiPublica} sem DNS publico` };
    }

    return { ok: false, detalhe: erro?.message ?? "falha ao consultar DNS" };
  }
};

const canalInternoBloqueadoEmHostApi = () => {
  const saida = execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "compose.desenvolvimento.yml",
      "exec",
      "-T",
      "frente",
      "node",
      "-e",
      [
        "fetch('http://127.0.0.1:3000/canal-seguro-api/seguranca/csrf',",
        "{headers:{host:'api.netcatbank.com','x-netcatbank-fluxo':'csrf-publico','x-netcatbank-cliente':'",
        sinalClienteTeste,
        "','accept-language':'pt-BR','user-agent':'",
        agenteTeste,
        "'}})",
        ".then((r)=>process.stdout.write(String(r.status)))",
        ".catch(()=>process.exit(2));"
      ].join("")
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  ).trim();

  return saida === "404";
};

const semearVerificacoesAbertura = (tipo, valor, total = 8) => {
  const referencia = indiceSeguroTeste(`abertura-verificacao:${tipo}:${valor}`);
  const valores = Array.from({ length: total }, (_, indice) =>
    `('abertura_verificacao', '${referencia}', 'netcatbank_teste_enumeracao_${indice}')`
  ).join(",");
  const sql = `INSERT INTO eventos_seguranca_netcatbank (evento, referencia, contexto_hash) VALUES ${valores};`;

  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "compose.desenvolvimento.yml",
      "exec",
      "-T",
      "banco-dados",
      "psql",
      "-U",
      "netcatbank_app",
      "-d",
      "netcatbank",
      "-tAc",
      sql
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  );
};

const executarSqlBanco = (sql) =>
  execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "compose.desenvolvimento.yml",
      "exec",
      "-T",
      "banco-dados",
      "psql",
      "-U",
      "netcatbank_app",
      "-d",
      "netcatbank",
      "-tAc",
      sql
    ],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }
  ).trim();

const sqlLiteralSeguro = (valor, padrao) => {
  if (!padrao.test(valor)) throw new Error("sql_literal_teste_invalido");
  return `'${valor}'`;
};

const provisionarCreditoTesteConta = (documento, valorCentavos) => {
  if (!/^\d{11}$/.test(documento) || !Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
    throw new Error("credito_teste_invalido");
  }

  const documentoIndice = indiceSeguroTeste(documento);
  const bruto = executarSqlBanco(`
    SELECT
      c.id,
      coalesce(s.saldo_disponivel_centavos, 0),
      coalesce(s.saldo_contabil_centavos, 0),
      coalesce(s.versao, 0),
      coalesce((
        SELECT l.hash_encadeado
        FROM ledger_saldos_netcatbank l
        WHERE l.conta_id = c.id
        ORDER BY l.versao_saldo DESC
        LIMIT 1
      ), 'GENESIS')
    FROM contas_netcatbank c
    LEFT JOIN saldos_conta_netcatbank s ON s.conta_id = c.id
    WHERE c.documento_indice = ${sqlLiteralSeguro(documentoIndice, /^[a-f0-9]{64}$/)}
      AND c.apagado_em IS NULL
    ORDER BY c.criado_em DESC
    LIMIT 1;
  `);
  const [contaId, saldoDisponivelTexto, saldoContabilTexto, versaoTexto, hashAnterior] = bruto.split("|");

  if (!/^[0-9a-f-]{36}$/i.test(contaId ?? "") || !(hashAnterior === "GENESIS" || /^[a-f0-9]{64}$/.test(hashAnterior ?? ""))) {
    throw new Error("conta_teste_indisponivel");
  }

  const saldoDisponivelAtual = Number(saldoDisponivelTexto);
  const saldoContabilAtual = Number(saldoContabilTexto);
  const versaoAtual = Number(versaoTexto);
  if (
    !Number.isSafeInteger(saldoDisponivelAtual) ||
    !Number.isSafeInteger(saldoContabilAtual) ||
    !Number.isSafeInteger(versaoAtual)
  ) {
    throw new Error("saldo_teste_invalido");
  }

  const idempotenciaChave = `teste:credito-boleto:${randomBytes(8).toString("hex")}`;
  const referenciaOrigem = `teste:boleto:${randomBytes(8).toString("hex")}`;
  const metadadosCifrados = createHash("sha256").update(`credito-boleto:${contaId}:${idempotenciaChave}`).digest("base64url");
  const novaVersao = Math.max(versaoAtual, 0) + 1;
  const novoSaldoDisponivel = saldoDisponivelAtual + valorCentavos;
  const novoSaldoContabil = saldoContabilAtual + valorCentavos;
  const partidas = prepararPartidasCreditoSaldoTeste(valorCentavos).map((partida) => ({
    ...partida,
    hashPartida: assinarPartidaDobradaSaldoTeste({
      contaId,
      idempotenciaChave,
      ordem: partida.ordem,
      contaContabil: partida.contaContabil,
      natureza: partida.natureza,
      valorCentavos: partida.valorCentavos,
      moeda: "BRL"
    })
  }));
  const merkleRaiz = calcularMerkleRaizSaldoTeste(partidas.map((partida) => partida.hashPartida));
  const hashEncadeado = assinarLancamentoSaldoTeste({
    contaId,
    idempotenciaChave,
    tipo: "credito_liquidado",
    fase: "liquidacao",
    estado: "liquidado",
    deltaDisponivelCentavos: valorCentavos,
    deltaContabilCentavos: valorCentavos,
    moeda: "BRL",
    versaoSaldo: novaVersao,
    hashAnterior,
    merkleRaiz,
    referenciaOrigem,
    metadadosCifrados
  });
  const integridadeHash = assinarSaldoContaTeste({
    contaId,
    saldoDisponivelCentavos: novoSaldoDisponivel,
    saldoTotalCentavos: novoSaldoContabil,
    saldoContabilCentavos: novoSaldoContabil,
    moeda: "BRL",
    versao: novaVersao
  });
  const valoresPartidas = partidas
    .map((partida) =>
      [
        sqlLiteralSeguro(contaId, /^[0-9a-f-]{36}$/i),
        partida.ordem,
        sqlLiteralSeguro(partida.contaContabil, /^[a-z_]{8,40}$/),
        sqlLiteralSeguro(partida.natureza, /^(debito|credito)$/),
        partida.valorCentavos,
        "'BRL'",
        sqlLiteralSeguro(partida.hashPartida, /^[a-f0-9]{64}$/)
      ].join(", ")
    )
    .map((linha) => `(${linha})`)
    .join(",");

  executarSqlBanco(`
    BEGIN;
    SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true);
    WITH novo AS (
      INSERT INTO ledger_saldos_netcatbank (
        conta_id,
        idempotencia_chave,
        tipo,
        fase,
        estado,
        delta_disponivel_centavos,
        delta_contabil_centavos,
        moeda,
        versao_saldo,
        referencia_origem,
        metadados_cifrados,
        hash_anterior,
        merkle_raiz,
        hash_encadeado
      )
      VALUES (
        ${sqlLiteralSeguro(contaId, /^[0-9a-f-]{36}$/i)},
        ${sqlLiteralSeguro(idempotenciaChave, /^[a-z0-9:_-]{8,120}$/)},
        'credito_liquidado',
        'liquidacao',
        'liquidado',
        ${valorCentavos},
        ${valorCentavos},
        'BRL',
        ${novaVersao},
        ${sqlLiteralSeguro(referenciaOrigem, /^[a-zA-Z0-9:._-]{8,140}$/)},
        ${sqlLiteralSeguro(metadadosCifrados, /^[A-Za-z0-9_-]{24,96}$/)},
        ${sqlLiteralSeguro(hashAnterior, /^(GENESIS|[a-f0-9]{64})$/)},
        ${sqlLiteralSeguro(merkleRaiz, /^[a-f0-9]{64}$/)},
        ${sqlLiteralSeguro(hashEncadeado, /^[a-f0-9]{64}$/)}
      )
      RETURNING id
    )
    INSERT INTO partidas_dobradas_saldo_netcatbank (
      lancamento_id,
      conta_id,
      ordem,
      conta_contabil,
      natureza,
      valor_centavos,
      moeda,
      hash_partida
    )
    SELECT
      novo.id,
      partidas.conta_id::uuid,
      partidas.ordem::smallint,
      partidas.conta_contabil,
      partidas.natureza,
      partidas.valor_centavos::bigint,
      partidas.moeda,
      partidas.hash_partida
    FROM novo
    CROSS JOIN (VALUES ${valoresPartidas}) AS partidas(
      conta_id,
      ordem,
      conta_contabil,
      natureza,
      valor_centavos,
      moeda,
      hash_partida
    );
    INSERT INTO saldos_conta_netcatbank (
      conta_id,
      saldo_disponivel_centavos,
      saldo_total_centavos,
      saldo_contabil_centavos,
      moeda,
      versao,
      integridade_hash
    )
    VALUES (
      ${sqlLiteralSeguro(contaId, /^[0-9a-f-]{36}$/i)},
      ${novoSaldoDisponivel},
      ${novoSaldoContabil},
      ${novoSaldoContabil},
      'BRL',
      ${novaVersao},
      ${sqlLiteralSeguro(integridadeHash, /^[a-f0-9]{64}$/)}
    )
    ON CONFLICT (conta_id) DO UPDATE
    SET saldo_disponivel_centavos = EXCLUDED.saldo_disponivel_centavos,
        saldo_total_centavos = EXCLUDED.saldo_total_centavos,
        saldo_contabil_centavos = EXCLUDED.saldo_contabil_centavos,
        moeda = EXCLUDED.moeda,
        versao = EXCLUDED.versao,
        integridade_hash = EXCLUDED.integridade_hash,
        atualizado_em = now()
    WHERE saldos_conta_netcatbank.versao = ${versaoAtual};
    COMMIT;
  `);
};

const respostaRemoveCookieSessao = (resposta) =>
  resposta.setCookies.some(
    (cookie) =>
      cookie.includes("ncbank_netcatbank_sessao_z5m9=") &&
      /max-age=0/i.test(cookie)
  );

const executar = async () => {
  const semOrigem = await requisitar("/seguranca/csrf", { usarCookies: false });
  registrar("csrf sem origem permitida bloqueado", semOrigem.status === 400, `http ${semOrigem.status}`);

  const semSinal = await requisitar("/seguranca/csrf", {
    origem: origemAbertura,
    fluxo: "csrf-publico",
    usarCookies: false,
    enviarSinalCliente: false
  });
  registrar("csrf sem sinal de cliente bloqueado", semSinal.status === 400, `http ${semSinal.status}`);

  const semFetchMetadata = await requisitar("/seguranca/transporte", {
    origem: origemAbertura,
    fluxo: "transporte-publico",
    usarCookies: false,
    enviarFetchMetadata: false
  });
  registrar(
    "transporte sem Fetch Metadata aceito com sinais fortes",
    semFetchMetadata.status === 200,
    `http ${semFetchMetadata.status}`
  );
  registrar(
    "canal seguro responde sem cache e sem headers internos",
    semFetchMetadata.headers["cache-control"] === "no-store" &&
      semFetchMetadata.headers["x-netcatbank-canal"] === "interno-criptografado" &&
      !Object.keys(semFetchMetadata.headers).some((nome) => nome.startsWith("x-netcatbank-canal-")),
    "bff no-store"
  );

  const respostaFrente = await buscarFrenteComTentativas([
    frenteAbertura,
    origemAbertura,
    "https://abrir-conta.netcatbank.localtest.me:8443/",
    "https://abrir-conta.localtest.me:8443/"
  ]);
  const cspFrente = respostaFrente?.headers.get("content-security-policy") ?? "";
  registrar(
    "frente envia CSP e isolamento de navegação",
    Boolean(respostaFrente?.ok) &&
      cspFrente.includes("default-src 'self'") &&
      cspFrente.includes("object-src 'none'") &&
      cspFrente.includes("frame-ancestors 'none'") &&
      respostaFrente?.headers.get("strict-transport-security")?.includes("includeSubDomains") &&
      respostaFrente?.headers.get("origin-agent-cluster") === "?1" &&
      respostaFrente?.headers.get("x-content-type-options") === "nosniff",
    `http ${respostaFrente?.status ?? "sem resposta"}`
  );

  const workerEnvelope = readFileSync(
    new URL("../aplicacoes/frente/src/seguranca/motor-criptografico.worker.ts", import.meta.url),
    "utf8"
  );
  registrar(
    "worker classifica rotas financeiras como envelope sensível",
    workerEnvelope.includes('rota.startsWith("/nex/")') &&
      workerEnvelope.includes('rota.startsWith("/pagamentos/")') &&
      workerEnvelope.includes('rota.startsWith("/doacoes/")') &&
      workerEnvelope.includes('rota.startsWith("/emprestimos/")')
  );

  const bancoTransferencias = readFileSync(
    new URL("../aplicacoes/api/src/banco.ts", import.meta.url),
    "utf8"
  );
  registrar(
    "Nex confirma transferência somente com chave ativa revalidada",
    bancoTransferencias.includes("destino_chave_inativa") &&
      bancoTransferencias.includes("origem_sem_chave_ativa") &&
      bancoTransferencias.includes("valor_indice_hmac = $3") &&
      bancoTransferencias.includes("ORDER BY conta_id ASC, id ASC") &&
      bancoTransferencias.includes("FOR UPDATE")
  );

  const preflightPut = await preflightCors("/auth/login", {
    origem: origemCliente,
    metodoSolicitado: "PUT",
    headersSolicitados: "content-type,x-netcatbank-fluxo,x-netcatbank-cliente"
  });
  const metodosCors = preflightPut.headers["access-control-allow-methods"] ?? "";
  registrar(
    "bff rejeita método fora do contrato",
    preflightPut.status === 404 || preflightPut.status === 405,
    metodosCors || `http ${preflightPut.status}`
  );

  try {
    registrar(
      "compose não publica router público da API",
      apiSemRouterPublicoNoCompose()
    );
  } catch (erro) {
    registrar("compose não publica router público da API", false, erro.message);
  }

  try {
    const dnsApi = await dnsPublicoApiInexistente();
    registrar("DNS público da API não existe", dnsApi.ok, dnsApi.detalhe);
  } catch (erro) {
    registrar("DNS público da API não existe", false, erro.message);
  }

  try {
    registrar(
      "canal seguro bloqueia host api reservado",
      canalInternoBloqueadoEmHostApi()
    );
  } catch (erro) {
    registrar("canal seguro bloqueia host api reservado", false, erro.message);
  }

  const csrfAbertura = await obterCsrf(origemAbertura);
  const transporte = await obterTransporte(origemAbertura);
  registrar("csrf e chave de transporte emitidos com origem permitida", true);

  const cpfEnumeracao = criarCpfValido();
  semearVerificacoesAbertura("documento", cpfEnumeracao);
  const verificacaoRepetida = await postSeguro(
    "/abertura/verificacao",
    origemAbertura,
    "abertura-conta",
    csrfAbertura,
    transporte,
    { tipo: "documento", tipoDocumento: "cpf", valor: cpfEnumeracao }
  );
  registrar(
    "verificação repetida do mesmo documento bloqueada",
    verificacaoRepetida.status === 429,
    `http ${verificacaoRepetida.status}`
  );

  const cpf = criarCpfValido();
  const email = `seguro+${Date.now()}${Math.floor(Math.random() * 1_000_000)}@netcatbank.test`;
  const nome = "Daniel Auditor";
  const senha = "829173";
  sensiveisGerados.push(cpf, email, nome, senha, "1994-09-12");

  const claro = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: {
      tipo: "documento",
      tipoDocumento: "cpf",
      valor: cpf
    }
  });
  registrar("json em claro recusado", claro.status === 400, `http ${claro.status}`);

  const corpoVerificacao = envelope(
    transporte,
    { tipo: "documento", tipoDocumento: "cpf", valor: cpf },
    { fluxo: "abertura-conta", rota: "/abertura/verificacao", csrf: csrfAbertura }
  );
  registrar("envelope não contém texto sensível", !contemTextoSensivel(corpoVerificacao));

  const hashAdulterado = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: {
      ...corpoVerificacao,
      envelopeHash: "adulterado"
    }
  });
  registrar("hash do envelope adulterado bloqueado", hashAdulterado.status === 400, `http ${hashAdulterado.status}`);

  const assinaturaAdulterada = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: corpoVerificacao,
    assinaturaManual: "a".repeat(43)
  });
  registrar(
    "assinatura de requisição adulterada bloqueada",
    assinaturaAdulterada.status === 400,
    `http ${assinaturaAdulterada.status}`
  );

  const assinaturaPublicaAdulterada = {
    envelope: {
      ...corpoVerificacao.envelope,
      assinatura: "b".repeat(43)
    }
  };
  const assinaturaPublicaAdulteradaCorpo = {
    ...assinaturaPublicaAdulterada,
    envelopeHash: hashBase64url(canonicalizarJsonSeguro(assinaturaPublicaAdulterada.envelope))
  };
  const assinaturaPublicaRecusada = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: assinaturaPublicaAdulteradaCorpo
  });
  registrar(
    "assinatura pública do envelope adulterada bloqueada",
    assinaturaPublicaRecusada.status === 400,
    `http ${assinaturaPublicaRecusada.status}`
  );

  const downgradeEnvelope = {
    ...corpoVerificacao.envelope,
    algoritmo: "NCBANK-RSA-OAEP-A256GCM-v2"
  };
  const downgradeRecusado = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: {
      envelope: downgradeEnvelope,
      envelopeHash: hashBase64url(canonicalizarJsonSeguro(downgradeEnvelope))
    }
  });
  registrar("downgrade de envelope bloqueado", downgradeRecusado.status === 400, `http ${downgradeRecusado.status}`);

  const aadAdulteradoObjeto = JSON.parse(corpoVerificacao.envelope.aad);
  aadAdulteradoObjeto._ncRota = "/auth/login";
  const aadAdulteradoEnvelope = {
    ...corpoVerificacao.envelope,
    aad: canonicalizarJsonSeguro(aadAdulteradoObjeto)
  };
  const aadAdulterado = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: {
      envelope: aadAdulteradoEnvelope,
      envelopeHash: hashBase64url(canonicalizarJsonSeguro(aadAdulteradoEnvelope))
    }
  });
  registrar("AAD do envelope adulterado bloqueado", aadAdulterado.status === 400, `http ${aadAdulterado.status}`);

  const verificacao = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: corpoVerificacao
  });
  registrar(
    "verificação criptografada aceita",
    verificacao.status === 200 && verificacao.json?.disponivel === true,
    `http ${verificacao.status}`
  );

  const cpfSemCookie = criarCpfValido();
  const verificacaoSemCookie = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: envelope(
      transporte,
      { tipo: "documento", tipoDocumento: "cpf", valor: cpfSemCookie },
      { fluxo: "abertura-conta", rota: "/abertura/verificacao", csrf: csrfAbertura }
    ),
    usarCookies: false
  });
  registrar(
    "verificação criptografada sem cookie csrf bloqueada",
    verificacaoSemCookie.status === 403,
    `http ${verificacaoSemCookie.status}`
  );

  const cpfCookieForjado = criarCpfValido();
  const cookieForjado = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: envelope(
      transporte,
      { tipo: "documento", tipoDocumento: "cpf", valor: cpfCookieForjado },
      { fluxo: "abertura-conta", rota: "/abertura/verificacao", csrf: csrfAbertura }
    ),
    cookieManual: "ncbank_netcatbank_csrf_h7v4=csrf_forjado"
  });
  registrar("cookie csrf forjado bloqueado", cookieForjado.status === 403, `http ${cookieForjado.status}`);

  const replay = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: corpoVerificacao
  });
  registrar("replay do envelope bloqueado", replay.status === 409, `http ${replay.status}`);

  const rotaErrada = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: envelope(
      transporte,
      { tipo: "documento", tipoDocumento: "cpf", valor: cpf },
      { fluxo: "abertura-conta", rota: "/auth/login", csrf: csrfAbertura }
    )
  });
  registrar("rota interna adulterada bloqueada", rotaErrada.status === 400, `http ${rotaErrada.status}`);

  const csrfInternoErrado = await requisitar("/abertura/verificacao", {
    origem: origemAbertura,
    fluxo: "abertura-conta",
    csrf: csrfAbertura,
    metodo: "POST",
    corpo: envelope(
      transporte,
      { tipo: "documento", tipoDocumento: "cpf", valor: cpf },
      { fluxo: "abertura-conta", rota: "/abertura/verificacao", csrf: "csrf_forjado" }
    )
  });
  registrar("csrf interno adulterado bloqueado", csrfInternoErrado.status === 400, `http ${csrfInternoErrado.status}`);

  const cnpjsTeste = [
    "37814106000139",
    "27865757000102",
    "19131243000197",
    "00000000000191",
    "33000167000101",
    "06990590000123",
    "60746948000112",
    "34028316000103"
  ];
  let cnpjTeste = cnpjsTeste[0];
  let iniciarCnpj = null;

  for (const candidato of cnpjsTeste) {
    const emailCnpj = `pj+${Date.now()}${Math.floor(Math.random() * 1_000_000)}@netcatbank.test`;
    const tentativa = await postSeguro(
      "/abertura/iniciar",
      origemAbertura,
      "abertura-conta",
      csrfAbertura,
      transporte,
      {
        nomeCompleto: "Daniel Auditor PJ",
        tipoDocumento: "cnpj",
        documento: candidato,
        email: emailCnpj,
        emailConfirmacao: emailCnpj,
        aceitouSistema: true,
        aceitouDados: true,
        aceitouPrivacidade: true,
        produto: "somente-conta"
      }
    );

    if (tentativa.status === 200) {
      cnpjTeste = candidato;
      iniciarCnpj = tentativa;
      break;
    }
  }

  registrar(
    "abertura PJ criptografada reservada",
    iniciarCnpj?.status === 200,
    `http ${iniciarCnpj?.status ?? "sem_resposta"}`
  );

  let consultaCnpj = await postSeguro(
    "/abertura/cnpj/consulta",
    origemAbertura,
    "abertura-conta",
    csrfAbertura,
    transporte,
    { documento: cnpjTeste }
  );

  for (let tentativa = 0; tentativa < 10 && consultaCnpj.json?.estado === "pendente"; tentativa += 1) {
    await aguardar(5_000);
    consultaCnpj = await postSeguro(
      "/abertura/cnpj/consulta",
      origemAbertura,
      "abertura-conta",
      csrfAbertura,
      transporte,
      { documento: cnpjTeste }
    );
  }

  registrar(
    "consulta CNPJ retorna pelo canal seguro interno",
    [200, 202].includes(consultaCnpj.status) &&
      ["ok", "adiado"].includes(consultaCnpj.json?.estado) &&
      !JSON.stringify(consultaCnpj.json ?? {}).toLowerCase().includes("brasilapi"),
    `http ${consultaCnpj.status}, ${consultaCnpj.json?.estado ?? "sem_estado"}`
  );

  const cancelarCnpj = await postSeguro(
    "/abertura/cancelar",
    origemAbertura,
    "abertura-conta",
    csrfAbertura,
    transporte,
    {}
  );
  registrar("abertura PJ cancelada libera reinício", cancelarCnpj.status === 200, `http ${cancelarCnpj.status}`);

  const iniciar = await postSeguro(
    "/abertura/iniciar",
    origemAbertura,
    "abertura-conta",
    csrfAbertura,
    transporte,
    {
      nomeCompleto: nome,
      tipoDocumento: "cpf",
      documento: cpf,
      email,
      emailConfirmacao: email,
      aceitouSistema: true,
      aceitouDados: true,
      aceitouPrivacidade: true,
      produto: "credito-conta"
    }
  );
  registrar("abertura inicial criptografada criada", iniciar.status === 200, `http ${iniciar.status}`);

  const nascimentoInvalido = await postSeguro(
    "/abertura/complemento",
    origemAbertura,
    "abertura-conta",
    csrfAbertura,
    transporte,
    {
      dataNascimento: "2020-01-01",
      senha,
      senhaConfirmacao: senha
    }
  );
  registrar("data de nascimento inválida recusada", nascimentoInvalido.status === 422, `http ${nascimentoInvalido.status}`);

  const senhaSequencial = await postSeguro(
    "/abertura/complemento",
    origemAbertura,
    "abertura-conta",
    csrfAbertura,
    transporte,
    {
      dataNascimento: "1994-09-12",
      senha: "123456",
      senhaConfirmacao: "123456"
    }
  );
  registrar("senha sequencial recusada", senhaSequencial.status === 422, `http ${senhaSequencial.status}`);

  const senhaParesPrevisiveis = await postSeguro(
    "/abertura/complemento",
    origemAbertura,
    "abertura-conta",
    csrfAbertura,
    transporte,
    {
      dataNascimento: "1994-09-12",
      senha: "102030",
      senhaConfirmacao: "102030"
    }
  );
  registrar(
    "senha com pares previsíveis recusada",
    senhaParesPrevisiveis.status === 422,
    `http ${senhaParesPrevisiveis.status}`
  );

  const complemento = await postSeguro(
    "/abertura/complemento",
    origemAbertura,
    "abertura-conta",
    csrfAbertura,
    transporte,
    {
      dataNascimento: "1994-09-12",
      senha,
      senhaConfirmacao: senha
    }
  );
  registrar("complemento criptografado conclui conta", complemento.status === 200, `http ${complemento.status}`);

  const csrfCliente = await obterCsrf(origemCliente);
  const loginClaro = await requisitar("/auth/login", {
    origem: origemCliente,
    fluxo: "area-cliente",
    csrf: csrfCliente,
    metodo: "POST",
    corpo: {
      documento: cpf,
      senha
    }
  });
  registrar("login em claro recusado", loginClaro.status === 400, `http ${loginClaro.status}`);

  const cpfBruteForce = criarCpfValido();
  let tentativasBruteForceOk = true;
  for (let indice = 0; indice < 5; indice += 1) {
    const tentativa = await postSeguro("/auth/login", origemCliente, "area-cliente", csrfCliente, transporte, {
      documento: cpfBruteForce,
      senha: "000000"
    });
    tentativasBruteForceOk = tentativasBruteForceOk && tentativa.status === 401;
  }
  const bruteForceBloqueado = await postSeguro("/auth/login", origemCliente, "area-cliente", csrfCliente, transporte, {
    documento: cpfBruteForce,
    senha: "000000"
  });
  registrar(
    "brute force por documento bloqueado",
    tentativasBruteForceOk && bruteForceBloqueado.status === 429,
    `http ${bruteForceBloqueado.status}`
  );

  const login = await postSeguro("/auth/login", origemCliente, "area-cliente", csrfCliente, transporte, {
    documento: cpf,
    senha
  });
  registrar("login criptografado aceito", login.status === 200, `http ${login.status}`);
  const cookieSessaoAntigo =
    login.setCookies.find((cookie) => cookie.includes("ncbank_netcatbank_sessao_z5m9="))?.split(";")[0] ?? "";
  if (dominioCookieEsperado) {
    registrar(
      "cookie de sessão usa domínio compartilhado",
      login.setCookies.some(
        (cookie) =>
          cookie.includes("ncbank_netcatbank_sessao_z5m9=") &&
          cookie.toLowerCase().includes(`domain=${dominioCookieEsperado.toLowerCase()}`)
      ),
      dominioCookieEsperado
    );
  }

  const loginRotacionado = await postSeguro("/auth/login", origemCliente, "area-cliente", csrfCliente, transporte, {
    documento: cpf,
    senha
  });
  const sessaoAntiga = await requisitar("/auth/sessao", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    cookieManual: cookieSessaoAntigo
  });
  registrar(
    "novo login invalida sessão anterior",
    loginRotacionado.status === 200 &&
      Boolean(cookieSessaoAntigo) &&
      sessaoAntiga.status === 401 &&
      respostaRemoveCookieSessao(sessaoAntiga),
    `login ${loginRotacionado.status}, sessao antiga ${sessaoAntiga.status}`
  );

  const sessaoSemOrigem = await requisitar("/auth/sessao", {
    fluxo: "painel-cliente",
    usarCookies: true
  });
  registrar("sessão sem origem bloqueada", sessaoSemOrigem.status === 400, `http ${sessaoSemOrigem.status}`);

  const sessao = await requisitar("/auth/sessao", {
    origem: origemPainel,
    fluxo: "painel-cliente"
  });
  const apresentacao = sessao.json?.cliente?.apresentacao ?? "";
  registrar(
    "sessão retorna apresentação completa no painel",
    sessao.status === 200 && apresentacao === nome,
    `http ${sessao.status}, ${apresentacao}`
  );

  const csrfFinanceiro = await obterCsrf(origemPainel);
  const saldoClaro = await requisitar("/financeiro/saldo", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    metodo: "POST",
    corpo: {
      saldo: 999999
    }
  });
  registrar("saldo em claro ou sem csrf bloqueado", saldoClaro.status === 403, `http ${saldoClaro.status}`);

  const saldoFinanceiro = await postSeguro("/financeiro/saldo", origemPainel, "painel-cliente", csrfFinanceiro, transporte, {});
  registrar(
    "saldo financeiro autenticado aceito",
    saldoFinanceiro.status === 200 &&
      saldoFinanceiro.json?.estado === "ok" &&
      typeof saldoFinanceiro.json?.saldo?.disponivel === "string",
    `http ${saldoFinanceiro.status}`
  );

  const saldoMassAssignment = await postSeguro("/financeiro/saldo", origemPainel, "painel-cliente", csrfFinanceiro, transporte, {
    conta_id: "00000000-0000-0000-0000-000000000000",
    saldo: 123456
  });
  registrar(
    "saldo recusa mass assignment financeiro",
    saldoMassAssignment.status === 400,
    `http ${saldoMassAssignment.status}`
  );

  const emprestimoClaro = await requisitar("/emprestimos/elegibilidade", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    metodo: "POST",
    corpo: {
      limiteCentavos: 100000
    }
  });
  registrar("empréstimos recusa payload claro ou sem csrf", emprestimoClaro.status === 403, `http ${emprestimoClaro.status}`);

  const emprestimoMassAssignment = await postSeguro(
    "/emprestimos/elegibilidade",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      conta_id: "00000000-0000-0000-0000-000000000000",
      limiteCentavos: 100000000,
      score: 999
    }
  );
  registrar(
    "empréstimos recusa mass assignment na elegibilidade",
    emprestimoMassAssignment.status === 400,
    `http ${emprestimoMassAssignment.status}`
  );

  const emprestimoElegibilidadeInicial = await postSeguro(
    "/emprestimos/elegibilidade",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {}
  );
  const elegibilidadeInicial = emprestimoElegibilidadeInicial.json?.emprestimos?.elegibilidade;
  registrar(
    "empréstimos consulta elegibilidade com limite pilotado",
    emprestimoElegibilidadeInicial.status === 200 &&
      emprestimoElegibilidadeInicial.json?.estado === "ok" &&
      ["disponivel", "analise"].includes(elegibilidadeInicial?.estado) &&
      Number.isInteger(elegibilidadeInicial?.limiteCentavos) &&
      elegibilidadeInicial.limiteCentavos >= 0 &&
      elegibilidadeInicial.limiteCentavos <= 100000 &&
      typeof elegibilidadeInicial?.proximaAtualizacaoEm === "string",
    `http ${emprestimoElegibilidadeInicial.status}`
  );

  provisionarCreditoTesteConta(cpf, 5000);

  const codigoBoletoTeste = criarCodigoBarrasBoletoTeste();
  const linhaDigitavelBoletoTeste = criarLinhaDigitavelBoletoTeste(codigoBoletoTeste);
  const boletoMassAssignment = await postSeguro(
    "/pagamentos/boleto/validar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      codigo: linhaDigitavelBoletoTeste,
      conta_id: "00000000-0000-0000-0000-000000000000",
      liquidado: false,
      valorCentavos: 1
    }
  );
  registrar(
    "boleto recusa mass assignment na validação",
    boletoMassAssignment.status === 400,
    `http ${boletoMassAssignment.status}`
  );

  const boletoValidado = await postSeguro(
    "/pagamentos/boleto/validar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      codigo: linhaDigitavelBoletoTeste
    }
  );
  registrar(
    "boleto válido retorna banco normalizado",
    boletoValidado.status === 200 &&
      boletoValidado.json?.boleto?.bancoNome === "NU Bank" &&
      boletoValidado.json?.boleto?.valorCentavos === 100,
    `http ${boletoValidado.status}`
  );

  const boletoPago = await postSeguro(
    "/pagamentos/boleto/confirmar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      codigo: codigoBoletoTeste
    }
  );
  registrar(
    "boleto liquida somente pelo backend",
    boletoPago.status === 200 &&
      boletoPago.json?.estado === "ok" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        boletoPago.json?.pagamento?.transacaoId ?? ""
      ),
    `http ${boletoPago.status}`
  );

  const boletoValidacaoDuplicada = await postSeguro(
    "/pagamentos/boleto/validar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      codigo: linhaDigitavelBoletoTeste
    }
  );
  registrar(
    "boleto já pago bloqueia nova validação",
    boletoValidacaoDuplicada.status === 409 &&
      boletoValidacaoDuplicada.json?.mensagem === "Este boleto já foi pago.",
    `http ${boletoValidacaoDuplicada.status}`
  );

  const boletoConfirmacaoDuplicada = await postSeguro(
    "/pagamentos/boleto/confirmar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      codigo: codigoBoletoTeste
    }
  );
  registrar(
    "boleto já pago bloqueia nova confirmação",
    boletoConfirmacaoDuplicada.status === 409 &&
      boletoConfirmacaoDuplicada.json?.mensagem === "Este boleto já foi pago.",
    `http ${boletoConfirmacaoDuplicada.status}`
  );

  const telefoneRecargaTeste = "11983274658";
  const recargaClara = await requisitar("/pagamentos/celular/validar", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    metodo: "POST",
    corpo: {
      telefone: telefoneRecargaTeste
    }
  });
  registrar("recarga recusa payload claro ou sem csrf", recargaClara.status === 403, `http ${recargaClara.status}`);

  const recargaMassAssignment = await postSeguro(
    "/pagamentos/celular/validar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      conta_id: "00000000-0000-0000-0000-000000000000",
      telefone: telefoneRecargaTeste,
      valorCentavos: 999999
    }
  );
  registrar(
    "recarga recusa mass assignment na validação",
    recargaMassAssignment.status === 400,
    `http ${recargaMassAssignment.status}`
  );

  const recargaNumeroInvalido = await postSeguro(
    "/pagamentos/celular/validar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      telefone: "00911111111"
    }
  );
  registrar(
    "recarga rejeita celular brasileiro inválido",
    recargaNumeroInvalido.status === 400,
    `http ${recargaNumeroInvalido.status}`
  );

  const recargaValidada = await postSeguro(
    "/pagamentos/celular/validar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      telefone: telefoneRecargaTeste
    }
  );
  registrar(
    "recarga válida retorna operadora estimada e faixas",
    recargaValidada.status === 200 &&
      recargaValidada.json?.estado === "ok" &&
      ["Algar", "Claro", "Sercomtel", "TIM", "Vivo"].includes(recargaValidada.json?.recarga?.operadora) &&
      recargaValidada.json?.recarga?.operadoraConfianca === "estimada" &&
      recargaValidada.json?.recarga?.valorMinimoCentavos === 1500 &&
      Array.isArray(recargaValidada.json?.recarga?.valoresSugeridosCentavos),
    `http ${recargaValidada.status}`
  );

  const recargaConfirmacaoMassAssignment = await postSeguro(
    "/pagamentos/celular/confirmar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      conta_id: "00000000-0000-0000-0000-000000000000",
      telefone: telefoneRecargaTeste,
      valorCentavos: 1500
    }
  );
  registrar(
    "recarga recusa mass assignment na confirmação",
    recargaConfirmacaoMassAssignment.status === 400,
    `http ${recargaConfirmacaoMassAssignment.status}`
  );

  const recargaValorBaixo = await postSeguro(
    "/pagamentos/celular/confirmar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      telefone: telefoneRecargaTeste,
      valorCentavos: 100
    }
  );
  registrar(
    "recarga rejeita valor fora da faixa",
    recargaValorBaixo.status === 400,
    `http ${recargaValorBaixo.status}`
  );

  const recargaConfirmada = await postSeguro(
    "/pagamentos/celular/confirmar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      telefone: telefoneRecargaTeste,
      valorCentavos: 1500
    }
  );
  const transacaoRecargaId = recargaConfirmada.json?.recarga?.transacaoId ?? "";
  registrar(
    "recarga liquida somente pelo backend",
    recargaConfirmada.status === 200 &&
      recargaConfirmada.json?.estado === "ok" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transacaoRecargaId),
    `http ${recargaConfirmada.status}`
  );

  const emprestimoElegibilidadeCacheada = await postSeguro(
    "/emprestimos/elegibilidade",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {}
  );
  registrar(
    "empréstimos mantém elegibilidade cacheada por duas horas",
    emprestimoElegibilidadeInicial.status === 200 &&
      emprestimoElegibilidadeCacheada.status === 200 &&
      emprestimoElegibilidadeCacheada.json?.emprestimos?.elegibilidade?.atualizadoEm ===
        elegibilidadeInicial?.atualizadoEm,
    `http ${emprestimoElegibilidadeCacheada.status}`
  );

  if (transacaoRecargaId) {
    const detalheRecarga = await postSeguro(
      "/financeiro/transacao",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        id: transacaoRecargaId
      }
    );
    registrar(
      "recarga aparece no detalhe e comprovante dedicado",
      detalheRecarga.status === 200 &&
        detalheRecarga.json?.transacao?.tipoOperacao === "recarga" &&
        detalheRecarga.json?.transacao?.categoria === "pagamentos" &&
        detalheRecarga.json?.transacao?.comprovanteTitulo === "Recarga realizada" &&
        detalheRecarga.json?.transacao?.recebedor?.documento === "Linha pré-paga" &&
        /^\(\d{2}\) 9\*{4}-\d{4}$/.test(detalheRecarga.json?.transacao?.recebedor?.chave ?? ""),
      `http ${detalheRecarga.status}`
    );

    const extratoRecarga = await postSeguro(
      "/financeiro/transacoes",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        categoria: "pagamentos",
        limite: 10,
        ordenar: "recentes",
        pagina: 1,
        periodo: "90d",
        pesquisa: "Recarga",
        tipo: "saida"
      }
    );
    registrar(
      "extrato classifica recarga separada de boleto",
      extratoRecarga.status === 200 &&
        extratoRecarga.json?.transacoes?.itens?.some(
          (item) =>
            item?.id === transacaoRecargaId &&
            item?.tipoOperacao === "recarga" &&
            item?.categoria === "pagamentos" &&
            item?.comprovanteTitulo === "Recarga realizada"
        ),
      `http ${extratoRecarga.status}`
    );
  }

  const nexClaro = await requisitar("/nex/chaves/listar", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    metodo: "POST",
    corpo: {
      conta_id: "00000000-0000-0000-0000-000000000000"
    }
  });
  registrar("Nex recusa payload claro ou sem csrf", nexClaro.status === 403, `http ${nexClaro.status}`);

  const chavesNexIniciais = await postSeguro("/nex/chaves/listar", origemPainel, "painel-cliente", csrfFinanceiro, transporte, {});
  registrar(
    "Nex lista chaves autenticadas sem localStorage",
    chavesNexIniciais.status === 200 && Array.isArray(chavesNexIniciais.json?.chaves?.itens),
    `http ${chavesNexIniciais.status}`
  );

  const chaveNexMassAssignment = await postSeguro(
    "/nex/chaves/criar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      conta_id: "00000000-0000-0000-0000-000000000000",
      estado: "ativa",
      saldo: 999999,
      tipo: "aleatoria",
      valor_indice_hmac: "0".repeat(64)
    }
  );
  registrar(
    "Nex recusa mass assignment na criação de chave",
    chaveNexMassAssignment.status === 400,
    `http ${chaveNexMassAssignment.status}`
  );

  const excluirOutraChaveNex = await postSeguro(
    "/nex/chaves/excluir",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      id: "00000000-0000-4000-8000-000000000001"
    }
  );
  registrar(
    "Nex bloqueia enumeração ao excluir chave inexistente",
    excluirOutraChaveNex.status === 200,
    `http ${excluirOutraChaveNex.status}`
  );

  const chaveNexAleatoria = await postSeguro(
    "/nex/chaves/criar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      tipo: "aleatoria"
    }
  );
  const chaveNexCriada = chaveNexAleatoria.json?.chave;
  registrar(
    "Nex cria chave aleatória somente no backend",
    chaveNexAleatoria.status === 200 &&
      chaveNexCriada?.tipo === "aleatoria" &&
      /^ncb-nex-[a-z0-9]{20,40}$/.test(chaveNexCriada?.valor ?? ""),
    `http ${chaveNexAleatoria.status}`
  );

  if (chaveNexCriada?.id) {
    const qrRecebimentoNex = await postSeguro(
      "/nex/recebimentos/qr/criar",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        chaveId: chaveNexCriada.id,
        valorCentavos: 0
      }
    );
    registrar(
      "Nex cria QR de recebimento assinado pelo backend",
      qrRecebimentoNex.status === 200 &&
        qrRecebimentoNex.json?.qr?.conteudo?.includes("NCBANK_NEX_QR") &&
        qrRecebimentoNex.json?.qr?.qrSvg?.includes("<svg"),
      `http ${qrRecebimentoNex.status}`
    );

    const qrRecebimentoMassAssignment = await postSeguro(
      "/nex/recebimentos/qr/criar",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        chaveId: chaveNexCriada.id,
        conta_id: "00000000-0000-0000-0000-000000000000",
        estado: "ativa",
        valorCentavos: 1
      }
    );
    registrar(
      "Nex recusa mass assignment na criação de QR",
      qrRecebimentoMassAssignment.status === 400,
      `http ${qrRecebimentoMassAssignment.status}`
    );

    const qrRecebimentoValorNegativo = await postSeguro(
      "/nex/recebimentos/qr/criar",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        chaveId: chaveNexCriada.id,
        valorCentavos: -1
      }
    );
    registrar(
      "Nex recusa valor negativo na criação de QR",
      qrRecebimentoValorNegativo.status === 400,
      `http ${qrRecebimentoValorNegativo.status}`
    );

    const qrRecebimentoValorExcessivo = await postSeguro(
      "/nex/recebimentos/qr/criar",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        chaveId: chaveNexCriada.id,
        valorCentavos: 100_000_001
      }
    );
    registrar(
      "Nex recusa valor acima do limite na criação de QR",
      qrRecebimentoValorExcessivo.status === 400,
      `http ${qrRecebimentoValorExcessivo.status}`
    );

    const qrRecebimentoValidacaoMassAssignment = await postSeguro(
      "/nex/recebimentos/qr/validar",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        conta_id: "00000000-0000-0000-0000-000000000000",
        conteudo: qrRecebimentoNex.json?.qr?.conteudo ?? ""
      }
    );
    registrar(
      "Nex recusa mass assignment na validação de QR",
      qrRecebimentoValidacaoMassAssignment.status === 400,
      `http ${qrRecebimentoValidacaoMassAssignment.status}`
    );

    const qrRecebimentoInvalido = await postSeguro(
      "/nex/recebimentos/qr/validar",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        conteudo: JSON.stringify({ tipo: "NCBANK_NEX_QR", assinatura: "forjada" })
      }
    );
    registrar(
      "Nex recusa QR de recebimento adulterado",
      qrRecebimentoInvalido.status === 400,
      `http ${qrRecebimentoInvalido.status}`
    );
  }

  const chaveNexCooldown = await postSeguro(
    "/nex/chaves/criar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      tipo: "aleatoria"
    }
  );
  registrar(
    "Nex aplica cooldown de criação de chave",
    chaveNexCooldown.status === 429 || chaveNexCooldown.status === 409,
    `http ${chaveNexCooldown.status}`
  );

  const transferenciaNexMassAssignment = await postSeguro(
    "/nex/transferencias/preparar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      chaveDestino: "ncb-nex-destinoinexistente000000000000",
      conta_destino_id: "00000000-0000-0000-0000-000000000000",
      conta_origem_id: "00000000-0000-0000-0000-000000000000",
      saldo: 999999,
      valorCentavos: 100
    }
  );
  registrar(
    "Nex recusa mass assignment na preparação de transferência",
    transferenciaNexMassAssignment.status === 400,
    `http ${transferenciaNexMassAssignment.status}`
  );

  const transferenciaNexInexistente = await postSeguro(
    "/nex/transferencias/preparar",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      chaveDestino: "ncb-nex-destinoinexistente000000000000",
      descricao: "<script>alert(1)</script>",
      valorCentavos: 100
    }
  );
	  registrar(
	    "Nex preparação não enumera chave de destino inexistente",
	    transferenciaNexInexistente.status === 409 &&
	      !JSON.stringify(transferenciaNexInexistente.json ?? {}).includes("inexistente"),
	    `http ${transferenciaNexInexistente.status}`
	  );

	  const resolucaoNexMassAssignment = await postSeguro(
	    "/nex/transferencias/resolver",
	    origemPainel,
	    "painel-cliente",
	    csrfFinanceiro,
	    transporte,
	    {
	      chaveDestino: "ncb-nex-destinoinexistente000000000000",
	      conta_destino_id: "00000000-0000-0000-0000-000000000000"
	    }
	  );
	  registrar(
	    "Nex recusa mass assignment na resolução de chave",
	    resolucaoNexMassAssignment.status === 400,
	    `http ${resolucaoNexMassAssignment.status}`
	  );

	  const resolucaoTelefoneInvalido = await postSeguro(
	    "/nex/transferencias/resolver",
	    origemPainel,
	    "painel-cliente",
	    csrfFinanceiro,
	    transporte,
	    {
	      chaveDestino: "(00) 99999-9999"
	    }
	  );
	  registrar(
	    "Nex recusa telefone com DDD inválido",
	    resolucaoTelefoneInvalido.status === 400,
	    `http ${resolucaoTelefoneInvalido.status}`
	  );

	  const confirmacaoNexMassAssignment = await postSeguro(
	    "/nex/transferencias/confirmar",
	    origemPainel,
	    "painel-cliente",
	    csrfFinanceiro,
	    transporte,
	    {
	      conta_destino_id: "00000000-0000-0000-0000-000000000000",
	      conta_origem_id: "00000000-0000-0000-0000-000000000000",
	      saldo: 999999,
	      transferenciaId: "00000000-0000-4000-8000-000000000001",
	      valorCentavos: 1
	    }
	  );
	  registrar(
	    "Nex recusa mass assignment na confirmação de transferência",
	    confirmacaoNexMassAssignment.status === 400,
	    `http ${confirmacaoNexMassAssignment.status}`
	  );

	  const dataAgendamentoSeguro = new Date(Date.now() + 120_000).toISOString();
	  const agendamentoNexMassAssignment = await postSeguro(
	    "/nex/agendamentos/criar",
	    origemPainel,
	    "painel-cliente",
	    csrfFinanceiro,
	    transporte,
	    {
	      agendadoPara: dataAgendamentoSeguro,
	      chaveDestino: "ncb-nex-destinoinexistente000000000000",
	      conta_destino_id: "00000000-0000-0000-0000-000000000000",
	      conta_origem_id: "00000000-0000-0000-0000-000000000000",
	      destino_conta_id: "00000000-0000-0000-0000-000000000000",
	      saldo: 999999,
	      status: "processado",
	      valorCentavos: 100
	    }
	  );
	  registrar(
	    "Nex recusa mass assignment na criação de agendamento",
	    agendamentoNexMassAssignment.status === 400,
	    `http ${agendamentoNexMassAssignment.status}`
	  );

	  const agendamentoNexDataInvalida = await postSeguro(
	    "/nex/agendamentos/criar",
	    origemPainel,
	    "painel-cliente",
	    csrfFinanceiro,
	    transporte,
	    {
	      agendadoPara: new Date(Date.now() - 60_000).toISOString(),
	      chaveDestino: "ncb-nex-destinoinexistente000000000000",
	      valorCentavos: 100
	    }
	  );
	  registrar(
	    "Nex recusa agendamento com data inválida",
	    agendamentoNexDataInvalida.status === 400,
	    `http ${agendamentoNexDataInvalida.status}`
	  );

	  const agendamentoNexInexistente = await postSeguro(
	    "/nex/agendamentos/criar",
	    origemPainel,
	    "painel-cliente",
	    csrfFinanceiro,
	    transporte,
	    {
	      agendadoPara: dataAgendamentoSeguro,
	      chaveDestino: "ncb-nex-destinoinexistente000000000000",
	      descricao: "<script>alert(1)</script>",
	      valorCentavos: 100
	    }
	  );
	  registrar(
	    "Nex agendamento não enumera chave de destino inexistente",
	    agendamentoNexInexistente.status === 409 &&
	      !JSON.stringify(agendamentoNexInexistente.json ?? {}).includes("inexistente"),
	    `http ${agendamentoNexInexistente.status}`
	  );

	  const atividadesNex = await postSeguro(
	    "/nex/atividades",
	    origemPainel,
	    "painel-cliente",
	    csrfFinanceiro,
	    transporte,
	    {
	      limite: 8,
	      pagina: 1
	    }
	  );
	  registrar(
	    "Nex lista atividades autenticadas",
	    atividadesNex.status === 200 &&
	      Array.isArray(atividadesNex.json?.nex?.atividades?.itens) &&
	      Array.isArray(atividadesNex.json?.nex?.recorrentes),
	    `http ${atividadesNex.status}`
	  );

	  if (chaveNexCriada?.id) {
    const removerChaveNex = await postSeguro(
      "/nex/chaves/excluir",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        id: chaveNexCriada.id
      }
    );
    registrar(
      "Nex aplica cooldown também na exclusão de chave",
      removerChaveNex.status === 429 || removerChaveNex.status === 409,
      `http ${removerChaveNex.status}`
    );
  }

  const extratoFiltroInvalido = await postSeguro(
    "/financeiro/transacoes",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      fim: "2099-01-02",
      inicio: "2099-01-01",
      limite: 20,
      ordenar: "recentes",
      pagina: 1,
      tipo: "todos"
    }
  );
  registrar(
    "extrato recusa período futuro",
    extratoFiltroInvalido.status === 400,
    `http ${extratoFiltroInvalido.status}`
  );

  const extratoFinanceiro = await postSeguro(
    "/financeiro/transacoes",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      limite: 20,
      ordenar: "recentes",
      pagina: 1,
      periodo: "90d",
      pesquisa: "<script>alert(1)</script>".repeat(8),
      tipo: "todos"
    }
  );
  registrar(
    "extrato financeiro autenticado aplica filtros seguros",
    extratoFinanceiro.status === 200 && Array.isArray(extratoFinanceiro.json?.transacoes?.itens),
    `http ${extratoFinanceiro.status}`
  );

  const detalheTransacaoManipulado = await postSeguro(
    "/financeiro/transacao",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      id: "00000000-0000-0000-0000-000000000000",
      conta_id: "00000000-0000-0000-0000-000000000000",
      saldo: 999999
    }
  );
  registrar(
    "detalhe de transação recusa mass assignment financeiro",
    detalheTransacaoManipulado.status === 400,
    `http ${detalheTransacaoManipulado.status}`
  );

  const comprovanteManipulado = await postSeguro(
    "/financeiro/transacao/comprovante",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      formato: "pdf",
      id: "00000000-0000-0000-0000-000000000000",
      conta_id: "00000000-0000-0000-0000-000000000000",
      saldo: 999999
    }
  );
  registrar(
    "comprovante recusa mass assignment financeiro",
    comprovanteManipulado.status === 400,
    `http ${comprovanteManipulado.status}`
  );

  const transacaoParaComprovante = extratoFinanceiro.json?.transacoes?.itens?.[0];
  if (transacaoParaComprovante?.id) {
    const comprovantePdf = await postSeguro(
      "/financeiro/transacao/comprovante",
      origemPainel,
      "painel-cliente",
      csrfFinanceiro,
      transporte,
      {
        formato: "pdf",
        id: transacaoParaComprovante.id
      }
    );
    registrar(
      "comprovante autenticado usa download protegido e sem metadados PDF",
      comprovantePdf.status === 200 &&
        comprovantePdf.headers["content-type"]?.includes("application/pdf") &&
        /^attachment; filename="comprovante-netcatbank-nc-[a-z0-9]{12}\.pdf"$/i.test(
          comprovantePdf.headers["content-disposition"] ?? ""
        ) &&
        comprovantePdf.headers["content-security-policy"] === "sandbox" &&
        comprovantePdf.headers["x-content-type-options"] === "nosniff" &&
        comprovantePdf.texto.startsWith("%PDF-1.4") &&
        !comprovantePdf.texto.includes("/Info") &&
        !comprovantePdf.texto.includes("/Producer"),
      `http ${comprovantePdf.status}`
    );
  }

  const agoraFinanceiro = new Date();
  const mesFuturo = new Date(Date.UTC(agoraFinanceiro.getUTCFullYear(), agoraFinanceiro.getUTCMonth() + 1, 1));
  const graficoFuturo = await postSeguro(
    "/financeiro/graficos",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      mes: `${mesFuturo.getUTCFullYear()}-${String(mesFuturo.getUTCMonth() + 1).padStart(2, "0")}`
    }
  );
  registrar("gráficos recusam mês futuro", graficoFuturo.status === 400, `http ${graficoFuturo.status}`);

  const downloadSemSessao = await requisitar("/financeiro/extrato/download", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    csrf: csrfFinanceiro,
    metodo: "POST",
    corpo: envelope(
      transporte,
      { limite: 20, ordenar: "recentes", pagina: 1, periodo: "90d", tipo: "todos" },
      { fluxo: "painel-cliente", rota: "/financeiro/extrato/download", csrf: csrfFinanceiro }
    ),
    usarCookies: false
  });
  registrar(
    "download de extrato sem sessão/csrf coerente bloqueado",
    downloadSemSessao.status === 401 || downloadSemSessao.status === 403,
    `http ${downloadSemSessao.status}`
  );

  const payloadDownloadBase = { limite: 20, ordenar: "recentes", pagina: 1, periodo: "90d", tipo: "todos" };
  const corpoDownloadReplay = envelope(
    transporte,
    { ...payloadDownloadBase, formato: "csv" },
    { fluxo: "painel-cliente", rota: "/financeiro/extrato/download", csrf: csrfFinanceiro }
  );
  const downloadReplayOriginal = await requisitar("/financeiro/extrato/download", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    csrf: csrfFinanceiro,
    metodo: "POST",
    corpo: corpoDownloadReplay
  });
  const downloadReplayRepetido = await requisitar("/financeiro/extrato/download", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    csrf: csrfFinanceiro,
    metodo: "POST",
    corpo: corpoDownloadReplay
  });
  registrar(
    "download de extrato bloqueia replay do envelope",
    downloadReplayOriginal.status === 200 && downloadReplayRepetido.status === 409,
    `http ${downloadReplayOriginal.status}/${downloadReplayRepetido.status}`
  );

  const downloadFormatoInvalido = await postSeguro(
    "/financeiro/extrato/download",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    { ...payloadDownloadBase, formato: "zip" }
  );
  registrar(
    "download de extrato recusa formato não permitido",
    downloadFormatoInvalido.status === 400,
    `http ${downloadFormatoInvalido.status}`
  );

  const downloadMassAssignment = await postSeguro(
    "/financeiro/extrato/download",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    {
      ...payloadDownloadBase,
      formato: "csv",
      email: "atacante@exemplo.test",
      nome: "Nome Injetado",
      referencia_publica: "conta-forjada"
    }
  );
  registrar(
    "download de extrato recusa dados cadastrais no payload",
    downloadMassAssignment.status === 400,
    `http ${downloadMassAssignment.status}`
  );

  const downloadExtratoCsv = await postSeguro(
    "/financeiro/extrato/download",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    { ...payloadDownloadBase, formato: "csv" }
  );
  const csvOk =
    downloadExtratoCsv.status === 200 &&
    downloadExtratoCsv.headers["content-type"]?.includes("text/csv") &&
    downloadExtratoCsv.headers["x-content-type-options"] === "nosniff" &&
    downloadExtratoCsv.headers["content-security-policy"]?.includes("object-src 'none'") &&
    downloadExtratoCsv.headers["content-security-policy"]?.includes("frame-ancestors 'none'") &&
    downloadExtratoCsv.texto.includes('"Titular","Daniel Auditor"') &&
    downloadExtratoCsv.texto.includes('"CPF/CNPJ"') &&
    downloadExtratoCsv.texto.includes('"E-mail"') &&
    /^attachment; filename="extrato-netcatbank-\d{4}-\d{2}-\d{2}\.csv"$/i.test(
      downloadExtratoCsv.headers["content-disposition"] ?? ""
    );
  registrar(
    "download de extrato CSV inclui identificação bancária do titular",
    csvOk,
    csvOk
      ? `http ${downloadExtratoCsv.status}`
      : `http ${downloadExtratoCsv.status}, ct=${downloadExtratoCsv.headers["content-type"]}, csp=${downloadExtratoCsv.headers["content-security-policy"]}, cd=${downloadExtratoCsv.headers["content-disposition"]}, corpo=${downloadExtratoCsv.texto.slice(0, 160)}`
  );

  const downloadExtratoPdf = await postSeguro(
    "/financeiro/extrato/download",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    { ...payloadDownloadBase, formato: "pdf" }
  );
  const pdfOk =
    downloadExtratoPdf.status === 200 &&
    downloadExtratoPdf.headers["content-type"]?.includes("application/pdf") &&
    /^attachment; filename="extrato-netcatbank-\d{4}-\d{2}-\d{2}\.pdf"$/i.test(
      downloadExtratoPdf.headers["content-disposition"] ?? ""
    ) &&
    downloadExtratoPdf.texto.startsWith("%PDF-1.4") &&
    downloadExtratoPdf.texto.includes("Daniel Auditor") &&
    !downloadExtratoPdf.texto.includes("/Info") &&
    !downloadExtratoPdf.texto.includes("/Producer");
  registrar(
    "download de extrato PDF é gerado sem metadados de documento",
    pdfOk,
    pdfOk
      ? `http ${downloadExtratoPdf.status}`
      : `http ${downloadExtratoPdf.status}, ct=${downloadExtratoPdf.headers["content-type"]}, cd=${downloadExtratoPdf.headers["content-disposition"]}, inicio=${downloadExtratoPdf.texto.slice(0, 40)}`
  );

  const downloadExtratoOfx = await postSeguro(
    "/financeiro/extrato/download",
    origemPainel,
    "painel-cliente",
    csrfFinanceiro,
    transporte,
    { ...payloadDownloadBase, formato: "ofx" }
  );
  const ofxOk =
    downloadExtratoOfx.status === 200 &&
    downloadExtratoOfx.headers["content-type"]?.includes("application/x-ofx") &&
    /^attachment; filename="extrato-netcatbank-\d{4}-\d{2}-\d{2}\.ofx"$/i.test(
      downloadExtratoOfx.headers["content-disposition"] ?? ""
    ) &&
    downloadExtratoOfx.texto.startsWith("OFXHEADER:100") &&
    downloadExtratoOfx.texto.includes("<OFX>") &&
    downloadExtratoOfx.texto.includes("Daniel Auditor");
  registrar(
    "download de extrato OFX é gerado com dados oficiais da conta",
    ofxOk,
    ofxOk
      ? `http ${downloadExtratoOfx.status}`
      : `http ${downloadExtratoOfx.status}, ct=${downloadExtratoOfx.headers["content-type"]}, cd=${downloadExtratoOfx.headers["content-disposition"]}, corpo=${downloadExtratoOfx.texto.slice(0, 160)}`
  );

  const csrfPainel2fa = await obterCsrf(origemPainel);
  const preparar2fa = await postSeguro("/auth/2fa/preparar", origemPainel, "painel-cliente", csrfPainel2fa, transporte, {});
  const segredo2fa = preparar2fa.json?.doisFatores?.chaveManual ?? "";
  registrar(
    "2FA prepara QR protegido no painel",
    preparar2fa.status === 200 &&
      preparar2fa.json?.doisFatores?.qrSvg?.includes("<svg") &&
      /^[A-Z2-7]{32}$/.test(segredo2fa),
    `http ${preparar2fa.status}`
  );

  const ativar2fa = await postSeguro("/auth/2fa/ativar", origemPainel, "painel-cliente", csrfPainel2fa, transporte, {
    codigo: gerarTotpTeste(segredo2fa)
  });
  registrar(
    "2FA ativa somente com TOTP válido",
    ativar2fa.status === 200 && ativar2fa.json?.doisFatores?.ativo === true,
    `http ${ativar2fa.status}`
  );

  const csrfCliente2fa = await obterCsrf(origemCliente);
  const loginCom2fa = await postSeguro("/auth/login", origemCliente, "area-cliente", csrfCliente2fa, transporte, {
    documento: cpf,
    senha
  });
  const desafio2fa = loginCom2fa.setCookies.some((cookie) => cookie.includes("ncbank_netcatbank_2fa_login_d4p7="));
  const sessaoCriadaAntesDo2fa = loginCom2fa.setCookies.some(
    (cookie) => cookie.includes("ncbank_netcatbank_sessao_z5m9=") && !/max-age=0/i.test(cookie)
  );
  registrar(
    "login com 2FA exige desafio antes da sessão",
    loginCom2fa.status === 200 &&
      loginCom2fa.json?.estado === "verificacao_2fa" &&
      desafio2fa &&
      !sessaoCriadaAntesDo2fa,
    `http ${loginCom2fa.status}`
  );

  const login2faInvalido = await postSeguro("/auth/login/2fa", origemCliente, "area-cliente", csrfCliente2fa, transporte, {
    codigo: "000000"
  });
  registrar("2FA recusa código inválido", login2faInvalido.status === 401, `http ${login2faInvalido.status}`);

  const login2faValido = await postSeguro("/auth/login/2fa", origemCliente, "area-cliente", csrfCliente2fa, transporte, {
    codigo: gerarTotpTeste(segredo2fa)
  });
  const sessao2fa = login2faValido.setCookies.find((cookie) => cookie.includes("ncbank_netcatbank_sessao_z5m9="));
  registrar(
    "2FA válido cria sessão final",
    login2faValido.status === 200 && Boolean(sessao2fa),
    `http ${login2faValido.status}`
  );

  expirarSessaoClienteMaisRecente();
  const sessaoOciosa = await requisitar("/auth/sessao", {
    origem: origemPainel,
    fluxo: "painel-cliente"
  });
  registrar(
    "sessão ociosa expira no servidor",
    sessaoOciosa.status === 401 && respostaRemoveCookieSessao(sessaoOciosa),
    `http ${sessaoOciosa.status}`
  );

  const csrfClienteAposOciosidade = await obterCsrf(origemCliente);
  const loginAposOciosidade = await postSeguro("/auth/login", origemCliente, "area-cliente", csrfClienteAposOciosidade, transporte, {
    documento: cpf,
    senha
  });
  const loginAposOciosidade2fa = await postSeguro(
    "/auth/login/2fa",
    origemCliente,
    "area-cliente",
    csrfClienteAposOciosidade,
    transporte,
    {
      codigo: gerarTotpTeste(segredo2fa, 1)
    }
  );
  const sessaoAposOciosidade2fa = loginAposOciosidade2fa.setCookies.find((cookie) =>
    cookie.includes("ncbank_netcatbank_sessao_z5m9=")
  );
  registrar(
    "login após expiração ociosa exige 2FA e recria sessão",
    loginAposOciosidade.status === 200 &&
      loginAposOciosidade.json?.estado === "verificacao_2fa" &&
      loginAposOciosidade2fa.status === 200 &&
      Boolean(sessaoAposOciosidade2fa),
    `login ${loginAposOciosidade.status}, 2fa ${loginAposOciosidade2fa.status}`
  );

  adulterarRedeSessaoMaisRecente();
  const sessaoRedeAlterada = await requisitar("/auth/sessao", {
    origem: origemPainel,
    fluxo: "painel-cliente"
  });
  registrar(
    "sessão com contexto de rede divergente bloqueada",
    sessaoRedeAlterada.status === 401 && respostaRemoveCookieSessao(sessaoRedeAlterada),
    `http ${sessaoRedeAlterada.status}`
  );

  const sairSemCsrf = await requisitar("/auth/sair", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    metodo: "POST",
    corpo: {}
  });
  registrar("logout sem csrf bloqueado", sairSemCsrf.status === 403, `http ${sairSemCsrf.status}`);

  const csrfPainel = await obterCsrf(origemPainel);
  const sairClaro = await requisitar("/auth/sair", {
    origem: origemPainel,
    fluxo: "painel-cliente",
    csrf: csrfPainel,
    metodo: "POST",
    corpo: {}
  });
  registrar("logout em claro recusado", sairClaro.status === 400, `http ${sairClaro.status}`);

  const sairCriptografado = await postSeguro("/auth/sair", origemPainel, "painel-cliente", csrfPainel, transporte, {});
  registrar("logout criptografado aceito", sairCriptografado.status === 200, `http ${sairCriptografado.status}`);
  registrar(
    "logout solicita limpeza de cache e storage",
    sairCriptografado.headers["clear-site-data"]?.includes('"cache"') &&
      sairCriptografado.headers["clear-site-data"]?.includes('"storage"'),
    sairCriptografado.headers["clear-site-data"] ?? "sem header"
  );

  try {
    registrar("banco sem dados sensíveis em texto claro", verificarBancoSemTextoClaro());
  } catch (erro) {
    registrar("banco sem dados sensíveis em texto claro", false, erro.message);
  }

  const falhas = resultados.filter((resultado) => !resultado.ok);
  if (falhas.length > 0) {
    console.error(`\n${falhas.length} verificação(ões) falharam.`);
    process.exit(1);
  }

  console.log("\nVerificação de segurança da API concluída.");
};

executar().catch((erro) => {
  console.error("falhou  verificação interrompida", erro);
  process.exit(1);
});

import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHmac,
  createHash,
  hkdfSync,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const segredoConfigurado = process.env.NCBANK_SEGREDO_APLICACAO;
const segredoFinanceiroConfigurado = process.env.NCBANK_SEGREDO_FINANCEIRO_HMAC;
const aliasKmsFinanceiro = process.env.NCBANK_KMS_ALIAS_FINANCEIRO ?? "netcatbank-financeiro-local";

if (process.env.NODE_ENV === "production" && (!segredoConfigurado || segredoConfigurado.length < 48)) {
  throw new Error("NCBANK_SEGREDO_APLICACAO forte e obrigatorio em producao.");
}

if (
  process.env.NODE_ENV === "production" &&
  (!segredoFinanceiroConfigurado || segredoFinanceiroConfigurado.length < 48)
) {
  throw new Error("NCBANK_SEGREDO_FINANCEIRO_HMAC forte e obrigatorio em producao.");
}

const segredoAplicacao =
  process.env.NCBANK_SEGREDO_APLICACAO ??
  "netcatbank-desenvolvimento-trocar-em-producao-8d6f0f4d16b34a29";
const segredoFinanceiro =
  segredoFinanceiroConfigurado ??
  "netcatbank-financeiro-desenvolvimento-trocar-em-producao-712f4d0c9a6b";

const chaveCriptografia = createHash("sha256")
  .update(`netcatbank:cripto:${segredoAplicacao}`)
  .digest();
const chaveIndice = createHash("sha256")
  .update(`netcatbank:indice:${segredoAplicacao}`)
  .digest();
const chaveAssinatura = createHash("sha256")
  .update(`netcatbank:assinatura:${segredoAplicacao}`)
  .digest();
const chaveAssinaturaFinanceira = createHash("sha256")
  .update(`netcatbank:financeiro:${aliasKmsFinanceiro}:${segredoFinanceiro}`)
  .digest();

export const cookiesNetCat = {
  csrf: "ncbank_netcatbank_csrf_h7v4",
  abertura: "ncbank_netcatbank_abertura_s8k2",
  sessao: "ncbank_netcatbank_sessao_z5m9",
  login2fa: "ncbank_netcatbank_2fa_login_d4p7",
  indicacao: "ncbank_netcatbank_indicacao_p6r3"
} as const;

export const cabecalhoCsrf = "x-netcatbank-csrf";
export const algoritmoEnvelope = "NCBANK-ECDH-P256-A256GCM-v3";

const base64url = (valor: Buffer) => valor.toString("base64url");

const transportesEcdh = new Map<string, { expiraEm: number; privada: Buffer }>();
const ttlTransporteMs = 90_000;

const limparTransportesEcdhExpirados = () => {
  const agora = Date.now();
  for (const [chaveIdAtual, material] of transportesEcdh.entries()) {
    if (material.expiraEm <= agora || transportesEcdh.size > 2_000) {
      transportesEcdh.delete(chaveIdAtual);
    }
  }
};

const temporizadorLimpezaTransporte = setInterval(limparTransportesEcdhExpirados, 30_000);
temporizadorLimpezaTransporte.unref?.();

export const gerarTokenSeguro = (bytes = 32) => base64url(randomBytes(bytes));

export const criarTransporteSeguro = () => {
  const agora = Date.now();
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const chaveId = gerarTokenSeguro(18);
  const expiraEm = agora + ttlTransporteMs;
  transportesEcdh.set(chaveId, {
    expiraEm,
    privada: ecdh.getPrivateKey()
  });

  return {
    algoritmo: algoritmoEnvelope,
    chaveId,
    chavePublica: base64url(ecdh.getPublicKey()),
    expiraEm
  };
};

export const canonicalizarJsonSeguro = (valor: unknown): string => {
  if (valor === null) return "null";
  if (typeof valor === "string") return JSON.stringify(valor);
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new Error("json_nao_canonico");
    return JSON.stringify(valor);
  }
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (Array.isArray(valor)) return `[${valor.map((item) => canonicalizarJsonSeguro(item)).join(",")}]`;
  if (typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    const chaves = Object.keys(objeto).sort();
    return `{${chaves
      .map((chave) => {
        const item = objeto[chave];
        if (item === undefined || typeof item === "function" || typeof item === "symbol") {
          throw new Error("json_nao_canonico");
        }
        return `${JSON.stringify(chave)}:${canonicalizarJsonSeguro(item)}`;
      })
      .join(",")}}`;
  }

  throw new Error("json_nao_canonico");
};

export const hashTextoBase64url = (valor: string) =>
  createHash("sha256").update(valor).digest("base64url");

export const hashEnvelopePublico = (valor: unknown) => {
  const envelope = objetoSimples(valor);
  if (!envelope) return "";
  const algoritmo = envelope.algoritmo;
  const chave = envelope.chave;
  const chaveId = envelope.chaveId;
  const iv = envelope.iv;
  const conteudo = envelope.conteudo;
  const aad = envelope.aad;
  const assinatura = envelope.assinatura;

  if (
    typeof algoritmo !== "string" ||
    typeof chaveId !== "string" ||
    typeof chave !== "string" ||
    typeof iv !== "string" ||
    typeof conteudo !== "string" ||
    typeof aad !== "string" ||
    typeof assinatura !== "string"
  ) {
    return "";
  }

  try {
    return hashTextoBase64url(canonicalizarJsonSeguro({ aad, algoritmo, assinatura, chave, chaveId, conteudo, iv }));
  } catch {
    return "";
  }
};

export const indiceSeguro = (valor: string) =>
  createHmac("sha256", chaveIndice).update(valor).digest("hex");

export const hashToken = (valor: string) =>
  createHmac("sha256", chaveAssinatura).update(`token:${valor}`).digest("hex");

export const assinarSaldoConta = (entrada: {
  contaId: string;
  saldoDisponivelCentavos: string | number;
  saldoTotalCentavos: string | number;
  saldoContabilCentavos: string | number;
  moeda: string;
  versao: string | number;
}) =>
  createHmac("sha256", chaveAssinaturaFinanceira)
    .update(
      [
        "saldo-conta-v1",
        entrada.contaId,
        String(entrada.saldoDisponivelCentavos),
        String(entrada.saldoTotalCentavos),
        String(entrada.saldoContabilCentavos),
        entrada.moeda,
        String(entrada.versao)
      ].join("|")
    )
    .digest("hex");

export const validarAssinaturaSaldoConta = (
  entrada: {
    contaId: string;
    saldoDisponivelCentavos: string | number;
    saldoTotalCentavos: string | number;
    saldoContabilCentavos: string | number;
    moeda: string;
    versao: string | number;
  },
  assinatura: string
) => {
  if (!/^[a-f0-9]{64}$/i.test(assinatura)) return false;
  const esperada = assinarSaldoConta(entrada);
  const esperadaBuffer = Buffer.from(esperada, "hex");
  const assinaturaBuffer = Buffer.from(assinatura, "hex");
  return esperadaBuffer.length === assinaturaBuffer.length && timingSafeEqual(esperadaBuffer, assinaturaBuffer);
};

export const assinarLancamentoSaldo = (entrada: {
  contaId: string;
  idempotenciaChave: string;
  tipo: string;
  fase: string;
  estado: string;
  deltaDisponivelCentavos: string | number;
  deltaContabilCentavos: string | number;
  moeda: string;
  versaoSaldo: string | number;
  hashAnterior: string;
  merkleRaiz: string;
  referenciaOrigem: string;
  metadadosCifrados: string;
}) =>
  createHmac("sha256", chaveAssinaturaFinanceira)
    .update(
      [
        "ledger-saldo-v1",
        entrada.contaId,
        entrada.idempotenciaChave,
        entrada.tipo,
        entrada.fase,
        entrada.estado,
        String(entrada.deltaDisponivelCentavos),
        String(entrada.deltaContabilCentavos),
        entrada.moeda,
        String(entrada.versaoSaldo),
        entrada.hashAnterior,
        entrada.merkleRaiz,
        entrada.referenciaOrigem,
        entrada.metadadosCifrados
      ].join("|")
    )
    .digest("hex");

export const assinarPartidaDobradaSaldo = (entrada: {
  contaId: string;
  idempotenciaChave: string;
  ordem: number;
  contaContabil: string;
  natureza: "debito" | "credito";
  valorCentavos: number;
  moeda: string;
}) =>
  createHmac("sha256", chaveAssinaturaFinanceira)
    .update(
      [
        "partida-dobrada-saldo-v1",
        entrada.contaId,
        entrada.idempotenciaChave,
        String(entrada.ordem),
        entrada.contaContabil,
        entrada.natureza,
        String(entrada.valorCentavos),
        entrada.moeda
      ].join("|")
    )
    .digest("hex");

export const calcularMerkleRaizSaldo = (folhas: string[]) => {
  const hashes = folhas.length > 0 ? folhas : [createHash("sha256").update("netcatbank:ledger-sem-partidas").digest("hex")];
  let camada = hashes;

  while (camada.length > 1) {
    const proxima: string[] = [];
    for (let indice = 0; indice < camada.length; indice += 2) {
      const esquerda = camada[indice] ?? "";
      const direita = camada[indice + 1] ?? esquerda;
      proxima.push(createHash("sha256").update(`${esquerda}:${direita}`).digest("hex"));
    }
    camada = proxima;
  }

  return camada[0] ?? createHash("sha256").update("netcatbank:merkle-vazio").digest("hex");
};

export const compararHashSeguro = (esperado: string, recebido: string) => {
  if (!/^[a-f0-9]{64}$/i.test(esperado) || !/^[a-f0-9]{64}$/i.test(recebido)) return false;
  const esperadoBuffer = Buffer.from(esperado, "hex");
  const recebidoBuffer = Buffer.from(recebido, "hex");
  return esperadoBuffer.length === recebidoBuffer.length && timingSafeEqual(esperadoBuffer, recebidoBuffer);
};

export const criptografar = (valor: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chaveCriptografia, iv);
  const conteudo = Buffer.concat([cipher.update(valor, "utf8"), cipher.final()]);
  const etiqueta = cipher.getAuthTag();
  return `${base64url(iv)}.${base64url(etiqueta)}.${base64url(conteudo)}`;
};

export const descriptografar = (valor: string) => {
  const [iv, etiqueta, conteudo] = valor.split(".");
  if (!iv || !etiqueta || !conteudo) return "";
  const decipher = createDecipheriv(
    "aes-256-gcm",
    chaveCriptografia,
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(etiqueta, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(conteudo, "base64url")),
    decipher.final()
  ]).toString("utf8");
};

const decodificarBase64url = (valor: string) => Buffer.from(valor, "base64url");

const objetoSimples = (valor: unknown): Record<string, unknown> | null =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;

const aadCanonicoValido = (valor: string) => {
  try {
    const parseado = JSON.parse(valor);
    const objeto = objetoSimples(parseado);
    if (!objeto) return null;
    if (canonicalizarJsonSeguro(objeto) !== valor) return null;
    return objeto;
  } catch {
    return null;
  }
};

const assinaturaBase64urlValida = (esperada: string, recebida: string) => {
  if (!/^[A-Za-z0-9_-]{43,96}$/.test(recebida)) return false;
  const esperadoBuffer = Buffer.from(esperada);
  const recebidoBuffer = Buffer.from(recebida);
  return esperadoBuffer.length === recebidoBuffer.length && timingSafeEqual(esperadoBuffer, recebidoBuffer);
};

const chaveEnvelopeCliente = (rotulo: string, csrf: string, sinalCliente: string, aad: string) =>
  createHash("sha256")
    .update(`${rotulo}:${csrf}:${sinalCliente}:${aad}`)
    .digest();

export const assinarEnvelopePublicoCliente = (entrada: {
  aad: string;
  chave: string;
  chaveId: string;
  conteudo: string;
  csrf: string;
  iv: string;
  sinalCliente: string;
}) =>
  createHmac("sha256", chaveEnvelopeCliente("netcatbank-envelope-publico-v3", entrada.csrf, entrada.sinalCliente, entrada.aad))
    .update(`${algoritmoEnvelope}.${entrada.chaveId}.${entrada.chave}.${entrada.iv}.${entrada.conteudo}.${hashTextoBase64url(entrada.aad)}`)
    .digest("base64url");

export const assinarPayloadEnvelopeCliente = (entrada: {
  aad: string;
  csrf: string;
  payloadCanonico: string;
  sinalCliente: string;
}) =>
  createHmac("sha256", chaveEnvelopeCliente("netcatbank-envelope-payload-v3", entrada.csrf, entrada.sinalCliente, entrada.aad))
    .update(entrada.payloadCanonico)
    .digest("base64url");

const derivarChaveEnvelope = (semente: Buffer, aad: string) =>
  Buffer.from(
    hkdfSync(
      "sha256",
      semente,
      createHash("sha256").update(aad).digest(),
      Buffer.from("NCBANK-ENVELOPE-AES-GCM-v3"),
      32
    )
  );

const segredoCompartilhadoTransporte = (chaveId: string, clientePublica: string) => {
  const material = transportesEcdh.get(chaveId);
  if (!material || material.expiraEm <= Date.now()) {
    transportesEcdh.delete(chaveId);
    return null;
  }

  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(material.privada);
    return ecdh.computeSecret(decodificarBase64url(clientePublica));
  } catch {
    return null;
  }
};

export const abrirEnvelopeSeguro = (
  valor: unknown,
  opcoes: { csrf: string; sinalCliente: string }
): Record<string, unknown> | null => {
  const envelope = objetoSimples(valor);
  if (!envelope) return null;

  const algoritmo = envelope.algoritmo;
  const chave = envelope.chave;
  const chaveId = envelope.chaveId;
  const iv = envelope.iv;
  const conteudo = envelope.conteudo;
  const aad = envelope.aad;
  const assinatura = envelope.assinatura;
  const aadObjeto = typeof aad === "string" ? aadCanonicoValido(aad) : null;

  if (
    algoritmo !== algoritmoEnvelope ||
    typeof chaveId !== "string" ||
    typeof chave !== "string" ||
    typeof iv !== "string" ||
    typeof conteudo !== "string" ||
    typeof aad !== "string" ||
    typeof assinatura !== "string" ||
    chaveId.length > 80 ||
    chave.length > 120 ||
    iv.length > 32 ||
    conteudo.length > 6_000 ||
    aad.length > 1_500 ||
    !aadObjeto
  ) {
    return null;
  }

  try {
    const assinaturaEsperada = assinarEnvelopePublicoCliente({
      aad,
      chave,
      chaveId,
      conteudo,
      csrf: opcoes.csrf,
      iv,
      sinalCliente: opcoes.sinalCliente
    });
    if (!assinaturaBase64urlValida(assinaturaEsperada, assinatura)) {
      return null;
    }

    const sementeChave = segredoCompartilhadoTransporte(chaveId, chave);
    const ivBuffer = decodificarBase64url(iv);
    const conteudoBuffer = decodificarBase64url(conteudo);

    if (!sementeChave || sementeChave.length < 32 || ivBuffer.length !== 12 || conteudoBuffer.length <= 16) {
      return null;
    }

    const chaveAes = derivarChaveEnvelope(sementeChave, aad);
    const etiqueta = conteudoBuffer.subarray(conteudoBuffer.length - 16);
    const cifrado = conteudoBuffer.subarray(0, conteudoBuffer.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", chaveAes, ivBuffer);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(etiqueta);
    const texto = Buffer.concat([decipher.update(cifrado), decipher.final()]).toString("utf8");
    const aberto = objetoSimples(JSON.parse(texto));
    if (!aberto || canonicalizarJsonSeguro(aberto) !== texto) return null;
    return aberto;
  } catch {
    return null;
  }
};

export const criarHashSenha = async (senha: string) => {
  const sal = gerarTokenSeguro(18);
  const hash = (await scrypt(senha, sal, 64)) as Buffer;
  return `scrypt-v1$${sal}$${base64url(hash)}`;
};

export const verificarSenha = async (senha: string, armazenado: string | null) => {
  if (!armazenado) return false;
  const [versao, sal, hashSalvo] = armazenado.split("$");
  if (versao !== "scrypt-v1" || !sal || !hashSalvo) return false;
  const hashCalculado = (await scrypt(senha, sal, 64)) as Buffer;
  const hashBuffer = Buffer.from(hashSalvo, "base64url");
  return hashBuffer.length === hashCalculado.length && timingSafeEqual(hashBuffer, hashCalculado);
};

export const criarCsrf = (contextoHash: string) => {
  const nonce = gerarTokenSeguro(24);
  const emitidoEm = Date.now().toString(36);
  const assinatura = createHmac("sha256", chaveAssinatura)
    .update(`csrf:${nonce}:${emitidoEm}:${contextoHash}`)
    .digest("base64url");
  return `${nonce}.${emitidoEm}.${assinatura}`;
};

export const validarCsrf = (valor: string | undefined, contextoHash: string) => {
  if (!valor) return false;
  const [nonce, emitidoEm, assinatura] = valor.split(".");
  if (!nonce || !emitidoEm || !assinatura) return false;

  const emitidoMs = Number.parseInt(emitidoEm, 36);
  if (!Number.isFinite(emitidoMs)) return false;
  if (Date.now() - emitidoMs > 30 * 60 * 1000) return false;

  const esperado = createHmac("sha256", chaveAssinatura)
    .update(`csrf:${nonce}:${emitidoEm}:${contextoHash}`)
    .digest("base64url");

  const esperadoBuffer = Buffer.from(esperado);
  const assinaturaBuffer = Buffer.from(assinatura);
  return (
    esperadoBuffer.length === assinaturaBuffer.length &&
    timingSafeEqual(esperadoBuffer, assinaturaBuffer)
  );
};

export const lerCookie = (cabecalhoCookie: string | undefined, nome: string) => {
  return lerCookies(cabecalhoCookie, nome)[0] ?? "";
};

export const lerCookies = (cabecalhoCookie: string | undefined, nome: string) => {
  if (!cabecalhoCookie) return [];
  const partes = cabecalhoCookie.split(";").map((parte) => parte.trim());
  const valores: string[] = [];
  for (const parte of partes) {
    const indice = parte.indexOf("=");
    if (indice === -1) continue;
    const chave = parte.slice(0, indice);
    if (chave === nome) valores.push(decodeURIComponent(parte.slice(indice + 1)));
  }
  return Array.from(new Set(valores.filter(Boolean)));
};

export const serializarCookie = (
  nome: string,
  valor: string,
  segundos: number,
  opcoes: { domain?: string; httpOnly?: boolean } = { httpOnly: true }
) => {
  const partes = [
    `${nome}=${encodeURIComponent(valor)}`,
    "Path=/",
    "SameSite=Strict",
    "Secure",
    `Max-Age=${segundos}`
  ];

  if (opcoes.domain) partes.push(`Domain=${opcoes.domain}`);
  if (opcoes.httpOnly !== false) partes.push("HttpOnly");
  return partes.join("; ");
};

export const apagarCookie = (nome: string, opcoes: { domain?: string } = {}) => {
  const partes = [
    `${nome}=`,
    "Path=/",
    "SameSite=Strict",
    "Secure",
    "HttpOnly",
    "Max-Age=0"
  ];

  if (opcoes.domain) partes.push(`Domain=${opcoes.domain}`);
  return partes.join("; ");
};

export const hashContextoRequisicao = (ip: string, agente: string) =>
  indiceSeguro(`${ip.slice(0, 96)}|${agente.slice(0, 220)}`);

type TransporteSeguro = {
  algoritmo: "NCBANK-ECDH-P256-A256GCM-v3";
  chaveId: string;
  chavePublica: string;
  expiraEm: number;
};

type MensagemEnvelope = {
  id: string;
  opcoes: {
    csrf: string;
    fluxo: string;
    rota: string;
  };
  payload: Record<string, unknown>;
  sequencia: number;
  sinalCliente: string;
  transporte: TransporteSeguro;
  tipo: "envelope";
};

const algoritmoEnvelope = "NCBANK-ECDH-P256-A256GCM-v3" as const;

const bytesParaBase64url = (bytes: Uint8Array) => {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64urlParaBytes = (valor: string) => {
  const base64 = valor.replace(/-/g, "+").replace(/_/g, "/");
  const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binario = atob(preenchido);
  return Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0));
};

const hashTextoBase64url = async (texto: string) =>
  bytesParaBase64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto))));

const canonicalizarJsonSeguro = (valor: unknown): string => {
  if (valor === null) return "null";
  if (typeof valor === "string") return JSON.stringify(valor);
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) throw new Error("payload");
    return JSON.stringify(valor);
  }
  if (typeof valor === "boolean") return valor ? "true" : "false";
  if (Array.isArray(valor)) return `[${valor.map((item) => canonicalizarJsonSeguro(item)).join(",")}]`;
  if (typeof valor === "object") {
    const objeto = valor as Record<string, unknown>;
    return `{${Object.keys(objeto)
      .sort()
      .map((chave) => {
        const item = objeto[chave];
        if (item === undefined || typeof item === "function" || typeof item === "symbol") {
          throw new Error("payload");
        }
        return `${JSON.stringify(chave)}:${canonicalizarJsonSeguro(item)}`;
      })
      .join(",")}}`;
  }

  throw new Error("payload");
};

const moduloIntegridadeWasm = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60,
  0x02, 0x7f, 0x7f, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01,
  0x03, 0x6d, 0x69, 0x78, 0x00, 0x00, 0x0a, 0x0f, 0x01, 0x0d, 0x00, 0x20,
  0x00, 0x41, 0x93, 0x83, 0x80, 0x08, 0x6c, 0x20, 0x01, 0x73, 0x0b
]);

let integridadeWasmPromessa: Promise<(esquerda: number, direita: number) => number> | null = null;

const reduzirBase64url32 = (valor: string) => {
  let acumulador = 0x811c9dc5;
  for (let indice = 0; indice < valor.length; indice += 1) {
    acumulador = Math.imul(acumulador ^ valor.charCodeAt(indice), 0x01000193);
  }
  return acumulador >>> 0;
};

const obterMisturaIntegridadeWasm = async () => {
  if (!integridadeWasmPromessa) {
    integridadeWasmPromessa = WebAssembly.instantiate(moduloIntegridadeWasm).then(({ instance }) => {
      const mix = instance.exports.mix;
      if (typeof mix !== "function") throw new Error("wasm");
      return mix as (esquerda: number, direita: number) => number;
    });
  }
  return integridadeWasmPromessa;
};

const calcularIntegridadeRuntime = async (aadHash: string, payloadHash: string) => {
  const esquerda = reduzirBase64url32(aadHash);
  const direita = reduzirBase64url32(payloadHash);
  const mix = await obterMisturaIntegridadeWasm();
  const wasm = (mix(esquerda, direita) >>> 0).toString(16).padStart(8, "0");
  const esperado = (Math.imul(esquerda, 0x01000193) ^ direita) >>> 0;
  const esperadoHex = esperado.toString(16).padStart(8, "0");
  if (wasm !== esperadoHex) throw new Error("integridade");
  return wasm;
};

const assinarTextoBase64url = async (segredo: string, texto: string) => {
  const materialChave = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(segredo));
  const chave = await crypto.subtle.importKey(
    "raw",
    materialChave,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto));
  return bytesParaBase64url(new Uint8Array(assinatura));
};

const criticidadeEnvelope = (rota: string) =>
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

const derivarChaveAesEnvelope = async (segredoCompartilhado: ArrayBuffer, aad: string) => {
  const material = await crypto.subtle.importKey("raw", segredoCompartilhado, "HKDF", false, ["deriveKey"]);
  const sal = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(aad));

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: sal,
      info: new TextEncoder().encode("NCBANK-ENVELOPE-AES-GCM-v3")
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
};

const criarEnvelope = async (mensagem: MensagemEnvelope) => {
  const { opcoes, payload, sequencia, sinalCliente, transporte } = mensagem;
  if (transporte.algoritmo !== algoritmoEnvelope) {
    throw new Error("downgrade");
  }

  const servidorPublica = await crypto.subtle.importKey(
    "raw",
    base64urlParaBytes(transporte.chavePublica),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const clientePar = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const clientePublica = new Uint8Array(await crypto.subtle.exportKey("raw", clientePar.publicKey));
  const segredoCompartilhado = await crypto.subtle.deriveBits(
    { name: "ECDH", public: servidorPublica },
    clientePar.privateKey,
    256
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const nonce = crypto.getRandomValues(new Uint8Array(24));
  const emitidoEm = Date.now();
  const idempotencia = `idem_${bytesParaBase64url(crypto.getRandomValues(new Uint8Array(18)))}`;
  const criticidade = criticidadeEnvelope(opcoes.rota);
  const aadObjeto = {
    _ncAlgoritmo: algoritmoEnvelope,
    _ncChaveId: transporte.chaveId,
    _ncClienteHash: await hashTextoBase64url(sinalCliente),
    _ncCriticidade: criticidade,
    _ncCsrfHash: await hashTextoBase64url(opcoes.csrf),
    _ncEmitidoEm: emitidoEm,
    _ncFluxo: opcoes.fluxo,
    _ncIdempotencia: idempotencia,
    _ncNonce: bytesParaBase64url(nonce),
    _ncRota: opcoes.rota,
    _ncSeq: sequencia,
    _ncVersao: 3
  };
  const aad = canonicalizarJsonSeguro(aadObjeto);
  const aadHash = await hashTextoBase64url(aad);
  const payloadCanonico = canonicalizarJsonSeguro(payload);
  const payloadHash = await hashTextoBase64url(payloadCanonico);
  const integridadeRuntime = await calcularIntegridadeRuntime(aadHash, payloadHash);
  const assinaturaPayload = await assinarTextoBase64url(
    `netcatbank-envelope-payload-v3:${opcoes.csrf}:${sinalCliente}:${aad}`,
    payloadCanonico
  );
  const chaveAes = await derivarChaveAesEnvelope(segredoCompartilhado, aad);
  const texto = new TextEncoder().encode(
    canonicalizarJsonSeguro({
      ...payload,
      _ncAadHash: aadHash,
      _ncAssinaturaPayload: assinaturaPayload,
      _ncCliente: sinalCliente,
      _ncCriticidade: criticidade,
      _ncCsrf: opcoes.csrf,
      _ncEmitidoEm: emitidoEm,
      _ncFluxo: opcoes.fluxo,
      _ncIdempotencia: idempotencia,
      _ncIntegridadeRuntime: integridadeRuntime,
      _ncNonce: aadObjeto._ncNonce,
      _ncPayloadHash: payloadHash,
      _ncRota: opcoes.rota,
      _ncSeq: sequencia,
      _ncVersao: 3
    })
  );
  const conteudo = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(aad), tagLength: 128 },
      chaveAes,
      texto
    )
  );
  const chavePublicaEnvelope = bytesParaBase64url(clientePublica);
  const ivPublico = bytesParaBase64url(iv);
  const conteudoPublico = bytesParaBase64url(conteudo);
  const assinaturaEnvelope = await assinarTextoBase64url(
    `netcatbank-envelope-publico-v3:${opcoes.csrf}:${sinalCliente}:${aad}`,
    `${algoritmoEnvelope}.${transporte.chaveId}.${chavePublicaEnvelope}.${ivPublico}.${conteudoPublico}.${await hashTextoBase64url(aad)}`
  );
  const envelope = {
    algoritmo: algoritmoEnvelope,
    chaveId: transporte.chaveId,
    chave: chavePublicaEnvelope,
    iv: ivPublico,
    conteudo: conteudoPublico,
    aad,
    assinatura: assinaturaEnvelope
  };

  return {
    envelope,
    envelopeHash: await hashTextoBase64url(canonicalizarJsonSeguro(envelope))
  };
};

self.onmessage = async (evento: MessageEvent<MensagemEnvelope>) => {
  try {
    const mensagem = evento.data;
    if (mensagem.tipo !== "envelope") throw new Error("tipo");
    const resultado = await criarEnvelope(mensagem);
    self.postMessage({ id: mensagem.id, resultado });
  } catch {
    self.postMessage({ erro: "envelope", id: evento.data?.id ?? "" });
  }
};

export {};

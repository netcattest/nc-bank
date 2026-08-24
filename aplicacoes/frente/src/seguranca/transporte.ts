import { urlApiPublica } from "../configuracao/publica";

type RespostaTransporte = {
  estado?: string;
  transporte?: {
    algoritmo?: string;
    chaveId?: string;
    chavePublica?: string;
    expiraEm?: number;
  };
};

type Envelope = {
  envelope: {
    algoritmo: "NCBANK-ECDH-P256-A256GCM-v3";
    chaveId: string;
    chave: string;
    iv: string;
    conteudo: string;
    aad: string;
    assinatura: string;
  };
  envelopeHash: string;
};

type OpcoesPayloadSeguro = {
  csrf: string;
  fluxo: string;
  rota: string;
};

type OpcoesCabecalhoSeguro = {
  csrf: string;
  envelopeHash: string;
  fluxo: string;
  rota: string;
};

type TransporteSeguro = {
  algoritmo: "NCBANK-ECDH-P256-A256GCM-v3";
  chaveId: string;
  chavePublica: string;
  expiraEm: number;
};

const algoritmoEnvelope = "NCBANK-ECDH-P256-A256GCM-v3" as const;
let transportePromessa: Promise<TransporteSeguro> | null = null;
let sinalClientePromessa: Promise<string> | null = null;
let integridadeWasmPromessa: Promise<(esquerda: number, direita: number) => number> | null = null;
let motorCriptografico: Worker | null = null;

const chaveSinalCliente = "netcatbank_nc_sinal_local_r9v3";
const cookieSinalCliente = "ncbank_netcatbank_cliente_sinal_r9v3";
const sequenciasRatchetEnvelope = new Map<string, number>();
const baseRatchetEnvelope =
  typeof crypto === "undefined" ? Date.now() % 100_000 : crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
const chavesLocaisSensiveis = [
  "netcatbank_nc_abertura_conta_v9t3",
  "netcatbank_nc_area_cliente_l8q2",
  "netcatbank_nc_primeiro_acesso_w4p9",
  "netcatbank_nc_apresentacao_local_m7q2"
];
const cookiesSensiveisCliente = [
  "ncbank_netcatbank_abertura_segura_v9t3",
  "ncbank_netcatbank_cliente_acesso_l8q2"
];

export const buscarApiNetCat = async (caminho: string, opcoes: RequestInit = {}) => {
  const caminhoNormalizado = caminho.startsWith("/") ? caminho : `/${caminho}`;

  return fetch(`${urlApiPublica}${caminhoNormalizado}`, {
    credentials: "same-origin",
    ...opcoes
  });
};

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

const moduloIntegridadeWasm = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x60,
  0x02, 0x7f, 0x7f, 0x01, 0x7f, 0x03, 0x02, 0x01, 0x00, 0x07, 0x07, 0x01,
  0x03, 0x6d, 0x69, 0x78, 0x00, 0x00, 0x0a, 0x0f, 0x01, 0x0d, 0x00, 0x20,
  0x00, 0x41, 0x93, 0x83, 0x80, 0x08, 0x6c, 0x20, 0x01, 0x73, 0x0b
]);

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
    const chaves = Object.keys(objeto).sort();
    return `{${chaves
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

const proximaSequenciaEnvelope = (fluxo: string, rota: string) => {
  const chave = `${fluxo}:${rota}`;
  const atual = sequenciasRatchetEnvelope.get(chave) ?? baseRatchetEnvelope;
  const proximo = Math.min(Number.MAX_SAFE_INTEGER, atual + 1);
  sequenciasRatchetEnvelope.set(chave, proximo);
  return proximo;
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

const derivarChaveAesEnvelope = async (semente: Uint8Array, aad: string) => {
  const sementeBuffer = semente.buffer.slice(semente.byteOffset, semente.byteOffset + semente.byteLength) as ArrayBuffer;
  const material = await crypto.subtle.importKey("raw", sementeBuffer, "HKDF", false, ["deriveKey"]);
  const sal = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(aad));

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: sal,
      info: new TextEncoder().encode("NCBANK-ENVELOPE-AES-GCM-v3")
    },
    material,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt"]
  );
};

const dominiosCompartilhadosCliente = () => {
  if (typeof window === "undefined") return [];
  const host = window.location.hostname.toLowerCase();
  const dominios = ["netcatbank.localtest.me", "netcatbank.localhost", "netcatbank.com"];
  const dominioNetCat = dominios.find((dominio) => host === dominio || host.endsWith(`.${dominio}`));

  if (dominioNetCat) {
    return Array.from(
      new Set([
        dominioNetCat,
        dominioNetCat === "netcatbank.localtest.me" ? "localtest.me" : "",
        dominioNetCat === "netcatbank.localhost" ? "localhost" : ""
      ].filter(Boolean))
    );
  }

  if (host === "localtest.me" || host.endsWith(".localtest.me")) return ["localtest.me"];
  return [];
};

const lerCookieCliente = (nome: string) => {
  if (typeof document === "undefined") return "";
  return lerCookiesCliente(nome)[0] ?? "";
};

const lerCookiesCliente = (nome: string) => {
  if (typeof document === "undefined") return [];
  const partes = document.cookie.split(";").map((parte) => parte.trim());
  const valores: string[] = [];

  for (const parte of partes) {
    const indice = parte.indexOf("=");
    if (indice === -1) continue;
    if (parte.slice(0, indice) === nome) valores.push(decodeURIComponent(parte.slice(indice + 1)));
  }

  return Array.from(new Set(valores.filter(Boolean)));
};

const gravarCookieCliente = (nome: string, valor: string) => {
  if (typeof document === "undefined") return;
  const dominios = ["", ...dominiosCompartilhadosCliente()];

  for (const dominio of dominios) {
    const partes = [
      `${nome}=${encodeURIComponent(valor)}`,
      "Path=/",
      "SameSite=Strict",
      "Max-Age=31536000"
    ];

    if (window.location.protocol === "https:") partes.push("Secure");
    if (dominio) partes.push(`Domain=${dominio}`);
    document.cookie = partes.join("; ");
  }
};

const apagarCookieCliente = (nome: string) => {
  if (typeof document === "undefined") return;
  const dominios = ["", ...dominiosCompartilhadosCliente()];
  const expiracao = "Max-Age=0";

  for (const dominio of dominios) {
    document.cookie = [
      `${nome}=`,
      "Path=/",
      "SameSite=Strict",
      expiracao,
      ...(dominio ? [`Domain=${dominio}`] : []),
      ...(window.location.protocol === "https:" ? ["Secure"] : [])
    ].join("; ");
  }
};

export const limparEstadoSensivelNetCat = () => {
  try {
    for (const chave of chavesLocaisSensiveis) {
      localStorage.removeItem(chave);
      sessionStorage.removeItem(chave);
    }
  } catch {}

  for (const cookie of cookiesSensiveisCliente) {
    apagarCookieCliente(cookie);
  }
};

const lerOuCriarSegredoLocal = () => {
  try {
    const existenteCookie = lerCookiesCliente(cookieSinalCliente).find((valor) =>
      /^[A-Za-z0-9_-]{43,96}$/.test(valor)
    );
    if (existenteCookie) {
      localStorage.setItem(chaveSinalCliente, existenteCookie);
      apagarCookieCliente(cookieSinalCliente);
      gravarCookieCliente(cookieSinalCliente, existenteCookie);
      return existenteCookie;
    }

    const existente = localStorage.getItem(chaveSinalCliente);
    if (existente && /^[A-Za-z0-9_-]{43,96}$/.test(existente)) {
      apagarCookieCliente(cookieSinalCliente);
      gravarCookieCliente(cookieSinalCliente, existente);
      return existente;
    }

    const novo = bytesParaBase64url(crypto.getRandomValues(new Uint8Array(32)));
    localStorage.setItem(chaveSinalCliente, novo);
    apagarCookieCliente(cookieSinalCliente);
    gravarCookieCliente(cookieSinalCliente, novo);
    return novo;
  } catch {
    const existenteCookie = lerCookieCliente(cookieSinalCliente);
    if (existenteCookie && /^[A-Za-z0-9_-]{43,96}$/.test(existenteCookie)) return existenteCookie;

    const novo = bytesParaBase64url(crypto.getRandomValues(new Uint8Array(32)));
    apagarCookieCliente(cookieSinalCliente);
    gravarCookieCliente(cookieSinalCliente, novo);
    return novo;
  }
};

export const obterSinalClienteNetCat = async () => {
  if (!sinalClientePromessa) {
    sinalClientePromessa = (async () => {
      try {
        const tela =
          typeof screen === "undefined" ? "sem-tela" : `${screen.width}x${screen.height}x${screen.colorDepth}`;
        const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || "sem-fuso";
        const componentes = [
          "netcatbank-cliente-v2",
          lerOuCriarSegredoLocal(),
          navigator.userAgent,
          navigator.language,
          navigator.languages?.join(",") ?? "",
          navigator.platform,
          String(navigator.hardwareConcurrency ?? ""),
          String((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? ""),
          tela,
          fuso,
          String(globalThis.devicePixelRatio ?? 1)
        ].join("|");

        return hashTextoBase64url(componentes);
      } catch {
        return hashTextoBase64url(`netcatbank-cliente-fallback|${lerOuCriarSegredoLocal()}`);
      }
    })();
  }

  return sinalClientePromessa;
};

export const cabecalhosNetCat = async (fluxo: string, extras: HeadersInit = {}) => ({
  ...Object.fromEntries(new Headers(extras).entries()),
  "X-NetCatBank-Fluxo": fluxo,
  "X-NetCatBank-Cliente": await obterSinalClienteNetCat()
});

const assinarTextoBase64url = async (segredo: string, texto: string) => {
  const materialChave = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(segredo));
  const chave = await crypto.subtle.importKey(
    "raw",
    materialChave,
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(texto));
  return bytesParaBase64url(new Uint8Array(assinatura));
};

export const cabecalhosEnvelopeNetCat = async (
  opcoes: OpcoesCabecalhoSeguro,
  extras: HeadersInit = {}
) => {
  const sinalCliente = await obterSinalClienteNetCat();
  const tempo = Date.now().toString();
  const textoAssinatura = [
    "NCBANK-REQ-HMAC-v1",
    opcoes.fluxo,
    opcoes.rota,
    opcoes.envelopeHash,
    tempo,
    sinalCliente
  ].join("|");
  const assinatura = await assinarTextoBase64url(
    `netcatbank-assinatura:${opcoes.csrf}:${sinalCliente}`,
    textoAssinatura
  );

  return {
    ...Object.fromEntries(new Headers(extras).entries()),
    "X-NetCatBank-Fluxo": opcoes.fluxo,
    "X-NetCatBank-Cliente": sinalCliente,
    "X-NetCatBank-CSRF": opcoes.csrf,
    "X-NetCatBank-Tempo": tempo,
    "X-NetCatBank-Assinatura": assinatura
  };
};

const transporteValido = (valor: unknown): valor is TransporteSeguro => {
  const transporte = valor as TransporteSeguro;
  return (
    transporte?.algoritmo === algoritmoEnvelope &&
    typeof transporte.chaveId === "string" &&
    /^[A-Za-z0-9_-]{24,96}$/.test(transporte.chaveId) &&
    typeof transporte.chavePublica === "string" &&
    /^[A-Za-z0-9_-]{80,120}$/.test(transporte.chavePublica) &&
    Number.isSafeInteger(transporte.expiraEm)
  );
};

const carregarTransporte = async () => {
  if (!transportePromessa) {
    transportePromessa = (async () => {
      try {
        const resposta = await buscarApiNetCat("/seguranca/transporte", {
          cache: "no-store",
          credentials: "include",
          headers: await cabecalhosNetCat("transporte-publico")
        });
        const conteudo = (await resposta.json().catch(() => null)) as RespostaTransporte | null;

        if (
          !resposta.ok ||
          conteudo?.estado !== "ok" ||
          !transporteValido(conteudo.transporte)
        ) {
          throw new Error("transporte");
        }

        return conteudo.transporte;
      } catch (erro) {
        throw erro;
      } finally {
        transportePromessa = null;
      }
    })();
  }

  return transportePromessa;
};

const obterMotorCriptografico = () => {
  if (typeof Worker === "undefined") throw new Error("worker");
  if (!motorCriptografico) {
    motorCriptografico = new Worker(new URL("./motor-criptografico.worker.ts", import.meta.url), {
      type: "module"
    });
  }
  return motorCriptografico;
};

const criptografarPayloadNoWorker = (
  payload: Record<string, unknown>,
  opcoes: OpcoesPayloadSeguro,
  transporte: TransporteSeguro,
  sinalCliente: string,
  sequencia: number
) =>
  new Promise<Envelope>((resolver, rejeitar) => {
    const worker = obterMotorCriptografico();
    const id = bytesParaBase64url(crypto.getRandomValues(new Uint8Array(16)));
    const temporizador = window.setTimeout(() => {
      worker.removeEventListener("message", receber);
      rejeitar(new Error("worker"));
    }, 8_000);
    const receber = (evento: MessageEvent<{ erro?: string; id: string; resultado?: Envelope }>) => {
      if (evento.data.id !== id) return;
      window.clearTimeout(temporizador);
      worker.removeEventListener("message", receber);
      if (evento.data.resultado) {
        resolver(evento.data.resultado);
      } else {
        rejeitar(new Error(evento.data.erro ?? "worker"));
      }
    };

    worker.addEventListener("message", receber);
    worker.postMessage({
      id,
      opcoes,
      payload,
      sequencia,
      sinalCliente,
      transporte,
      tipo: "envelope"
    });
  });

export const criptografarPayloadNetCat = async (
  payload: Record<string, unknown>,
  opcoes: OpcoesPayloadSeguro
): Promise<Envelope> => {
  const transporte = await carregarTransporte();
  const sinalCliente = await obterSinalClienteNetCat();
  const sequencia = proximaSequenciaEnvelope(opcoes.fluxo, opcoes.rota);
  return criptografarPayloadNoWorker(payload, opcoes, transporte, sinalCliente, sequencia);
};

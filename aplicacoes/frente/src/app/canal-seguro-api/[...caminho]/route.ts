import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { request as requisicaoHttps } from "node:https";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiInterna = process.env.API_INTERNA_URL ?? "http://api:3001";
const tamanhoMaximoCorpo = 32 * 1024;
const canalInternoAtivo = process.env.NCBANK_CANAL_INTERNO_ATIVO !== "false";
const segredoCanalInterno =
  process.env.NCBANK_SEGREDO_CANAL_INTERNO ??
  (process.env.NODE_ENV === "production"
    ? ""
    : "netcatbank-canal-interno-desenvolvimento-9e7b5d1a4c2f8a6d");
const identidadeServico = process.env.NCBANK_IDENTIDADE_BFF ?? "netcatbank-frente-bff";
const identificadorSegredo = process.env.NCBANK_ID_SEGREDO_CANAL_INTERNO ?? "atual";
const versaoAssinaturaInterna = "NCBANK-CANAL-INTERNO-HMAC-v1";
const mtlsClienteAtivo = process.env.NCBANK_MTLS_CLIENTE_ATIVO === "true";
const caminhoMtlsCa = process.env.NCBANK_MTLS_CA;
const caminhoMtlsClienteCert = process.env.NCBANK_MTLS_CLIENTE_CERT;
const caminhoMtlsClienteKey = process.env.NCBANK_MTLS_CLIENTE_KEY;
const mtlsServidorNome = process.env.NCBANK_MTLS_SERVERNAME ?? "api.netcatbank.interno";
const janelaRateLimitBffMs = 60_000;
const limiteRateLimitBff = 900;

type PoliticaRota = {
  corpo: "nenhum" | "envelope";
  fluxo: string;
  metodo: "GET" | "POST";
};

const politicasRotas = new Map<string, PoliticaRota>(
  [
    ["GET /seguranca/csrf", { corpo: "nenhum", fluxo: "csrf-publico", metodo: "GET" }],
    ["GET /seguranca/transporte", { corpo: "nenhum", fluxo: "transporte-publico", metodo: "GET" }],
    ["POST /indicacoes/convite", { corpo: "envelope", fluxo: "indicacao", metodo: "POST" }],
    ["POST /abertura/verificacao", { corpo: "envelope", fluxo: "abertura-conta", metodo: "POST" }],
    ["POST /abertura/iniciar", { corpo: "envelope", fluxo: "abertura-conta", metodo: "POST" }],
    ["POST /abertura/cnpj/consulta", { corpo: "envelope", fluxo: "abertura-conta", metodo: "POST" }],
    ["POST /abertura/cancelar", { corpo: "envelope", fluxo: "abertura-conta", metodo: "POST" }],
    ["POST /abertura/complemento", { corpo: "envelope", fluxo: "abertura-conta", metodo: "POST" }],
    ["POST /auth/login", { corpo: "envelope", fluxo: "area-cliente", metodo: "POST" }],
    ["POST /auth/login/2fa", { corpo: "envelope", fluxo: "area-cliente", metodo: "POST" }],
    ["POST /auth/2fa/preparar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /auth/2fa/ativar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["GET /auth/sessao", { corpo: "nenhum", fluxo: "painel-cliente", metodo: "GET" }],
    ["POST /indicacoes/link", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /indicacoes/boas-vindas/dispensar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/chaves/listar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/chaves/criar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/chaves/excluir", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/recebimentos/qr/criar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/recebimentos/qr/validar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/transferencias/resolver", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/transferencias/preparar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/transferencias/confirmar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/agendamentos/criar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /nex/atividades", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /doacoes/instituto-murzo/doar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /pagamentos/boleto/validar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /pagamentos/boleto/confirmar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /pagamentos/celular/validar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /pagamentos/celular/confirmar", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /emprestimos/elegibilidade", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /financeiro/saldo", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /financeiro/transacoes", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /financeiro/transacao", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /financeiro/transacao/comprovante", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /financeiro/agendamentos", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /financeiro/graficos", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /financeiro/extrato/download", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }],
    ["POST /auth/sair", { corpo: "envelope", fluxo: "painel-cliente", metodo: "POST" }]
  ]
);

const cabecalhosInternos = [
  "x-netcatbank-canal-interno",
  "x-netcatbank-canal-tempo",
  "x-netcatbank-canal-nonce",
  "x-netcatbank-canal-corpo",
  "x-netcatbank-canal-assinatura",
  "x-netcatbank-servico",
  "x-netcatbank-servico-versao",
  "x-netcatbank-segredo-id"
];
const contadoresRateLimitBff = new Map<string, { inicio: number; total: number }>();

const limparRateLimitBffExpirado = () => {
  const agora = Date.now();
  for (const [chave, valor] of contadoresRateLimitBff.entries()) {
    if (agora - valor.inicio > janelaRateLimitBffMs) {
      contadoresRateLimitBff.delete(chave);
    }
  }
};

const temporizadorLimpezaRateLimitBff = setInterval(limparRateLimitBffExpirado, 60_000);
temporizadorLimpezaRateLimitBff.unref?.();

const hostsPermitidos = new Set(
  [
    "localhost",
    "netcatbank.localhost",
    "abrir-conta.localhost",
    "abrir-conta.netcatbank.localhost",
    "cliente.localhost",
    "cliente.netcatbank.localhost",
    "area-cliente.localhost",
    "area-cliente.netcatbank.localhost",
    "painel.localhost",
    "painel.netcatbank.localhost",
    "dashboard.localhost",
    "dashboard.netcatbank.localhost",
    "indique.localhost",
    "indique.netcatbank.localhost",
    "netcatbank.localme",
    "abrir-conta.localme",
    "abrir-conta.netcatbank.localme",
    "cliente.localme",
    "cliente.netcatbank.localme",
    "area-cliente.localme",
    "area-cliente.netcatbank.localme",
    "painel.localme",
    "painel.netcatbank.localme",
    "dashboard.localme",
    "dashboard.netcatbank.localme",
    "indique.localme",
    "indique.netcatbank.localme",
    "localtest.me",
    "netcatbank.localtest.me",
    "abrir-conta.localtest.me",
    "abrir-conta.netcatbank.localtest.me",
    "cliente.localtest.me",
    "cliente.netcatbank.localtest.me",
    "area-cliente.localtest.me",
    "area-cliente.netcatbank.localtest.me",
    "painel.localtest.me",
    "painel.netcatbank.localtest.me",
    "dashboard.localtest.me",
    "dashboard.netcatbank.localtest.me",
    "indique.localtest.me",
    "indique.netcatbank.localtest.me",
    "netcatbank.com",
    "www.netcatbank.com",
    "abrir-conta.netcatbank.com",
    "cliente.netcatbank.com",
    "area-cliente.netcatbank.com",
    "painel.netcatbank.com",
    "dashboard.netcatbank.com",
    "indique.netcatbank.com",
    process.env.NEXT_PUBLIC_ABRIR_CONTA_URL,
    process.env.NEXT_PUBLIC_AREA_CLIENTE_URL,
    process.env.NEXT_PUBLIC_PAINEL_URL,
    process.env.NEXT_PUBLIC_INDICACOES_URL
  ]
    .flatMap((valor) => {
      if (!valor) return [];
      try {
        return [new URL(valor).hostname.toLowerCase()];
      } catch {
        return [valor.toLowerCase()];
      }
    })
    .filter(Boolean)
);

type ContextoRota = {
  params: Promise<{
    caminho?: string[];
  }>;
};

const respostaBloqueada = (codigo: number, mensagem: string) =>
  Response.json(
    {
      estado: "erro",
      mensagem
    },
    {
      status: codigo,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );

const respostaRateLimit = (segundos: number) =>
  Response.json(
    {
      estado: "erro",
      mensagem: `Muitas verificações em sequência. Aguarde ${segundos}s para tentar novamente.`
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(segundos)
      }
    }
  );

const respostaIndisponibilidadeInterna = () =>
  Response.json(
    {
      estado: "erro",
      mensagem: "Serviço temporariamente indisponível. Tente novamente em instantes."
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "3",
        "X-NetCatBank-Canal": "interno-criptografado"
      }
    }
  );

const lerArquivoObrigatorio = (caminho: string | undefined, nome: string) => {
  if (!caminho) throw new Error(`${nome} obrigatorio para mTLS interno.`);
  return readFileSync(caminho);
};

const materialMtls = (() => {
  if (!mtlsClienteAtivo) return null;

  return {
    ca: lerArquivoObrigatorio(caminhoMtlsCa, "NCBANK_MTLS_CA"),
    cert: lerArquivoObrigatorio(caminhoMtlsClienteCert, "NCBANK_MTLS_CLIENTE_CERT"),
    key: lerArquivoObrigatorio(caminhoMtlsClienteKey, "NCBANK_MTLS_CLIENTE_KEY")
  };
})();

const caminhoSeguro = async (contexto: ContextoRota) => {
  const parametros = await contexto.params;
  const partes = parametros.caminho ?? [];

  if (
    partes.length === 0 ||
    partes.some((parte) => !/^[a-z0-9_-]+$/i.test(parte))
  ) {
    return "";
  }

  return `/${partes.join("/")}`;
};

const origemDaRequisicao = (requisicao: NextRequest) => {
  const host =
    requisicao.headers.get("x-forwarded-host") ??
    requisicao.headers.get("host") ??
    "";
  const protocolo = requisicao.headers.get("x-forwarded-proto") ?? "https";

  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host) || !/^https?$/.test(protocolo)) {
    return "";
  }

  return `${protocolo}://${host}`;
};

const hostControlado = (requisicao: NextRequest) => {
  const host =
    requisicao.headers.get("x-forwarded-host") ??
    requisicao.headers.get("host") ??
  "";
  const dominio = host.split(":")[0]?.toLowerCase() ?? "";

  return hostsPermitidos.has(dominio);
};

const possuiSinalDeNavegadorReal = (requisicao: NextRequest) => {
  if (requisicao.headers.has("origin")) return true;

  const secFetchSite = requisicao.headers.get("sec-fetch-site")?.toLowerCase() ?? "";
  const secFetchMode = requisicao.headers.get("sec-fetch-mode")?.toLowerCase() ?? "";
  const secFetchDest = requisicao.headers.get("sec-fetch-dest")?.toLowerCase() ?? "";

  return (
    (secFetchSite === "same-origin" || secFetchSite === "same-site") &&
    (!secFetchMode || secFetchMode === "cors" || secFetchMode === "same-origin") &&
    (!secFetchDest || secFetchDest === "empty")
  );
};

const chaveRateLimitBff = (requisicao: NextRequest) => {
  const host = requisicao.headers.get("x-forwarded-host") ?? requisicao.headers.get("host") ?? "";
  const cliente = requisicao.headers.get("x-netcatbank-cliente") ?? "";
  const agente = requisicao.headers.get("user-agent") ?? "";
  return createHash("sha256")
    .update(`bff:${host.slice(0, 120)}:${cliente.slice(0, 120)}:${agente.slice(0, 180)}`)
    .digest("base64url");
};

const verificarRateLimitBff = (requisicao: NextRequest) => {
  const agora = Date.now();
  const chave = chaveRateLimitBff(requisicao);
  const atual = contadoresRateLimitBff.get(chave);

  if (!atual || agora - atual.inicio > janelaRateLimitBffMs) {
    contadoresRateLimitBff.set(chave, { inicio: agora, total: 1 });
    return { permitido: true, segundos: 0 };
  }

  atual.total += 1;
  if (atual.total <= limiteRateLimitBff) return { permitido: true, segundos: 0 };

  return {
    permitido: false,
    segundos: Math.max(1, Math.ceil((janelaRateLimitBffMs - (agora - atual.inicio)) / 1000))
  };
};

const base64url = (valor: Buffer) => valor.toString("base64url");

const hashConteudo = (valor: string) =>
  createHash("sha256").update(valor).digest("base64url");

const hashBytes = (valor: Buffer) =>
  createHash("sha256").update(valor).digest("base64url");

const objetoSimples = (valor: unknown): Record<string, unknown> | null =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;

const possuiSomenteCampos = (valor: Record<string, unknown>, campos: string[]) =>
  Object.keys(valor).every((campo) => campos.includes(campo));

const canonicalizarJsonSeguro = (valor: unknown): string => {
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

const normalizarCorpo = (corpo: string, politica: PoliticaRota) => {
  if (politica.corpo === "nenhum") {
    return corpo ? null : "";
  }

  let json: unknown;
  try {
    json = JSON.parse(corpo);
  } catch {
    return null;
  }

  const externo = objetoSimples(json);
  const envelope = objetoSimples(externo?.envelope);

  if (
    !externo ||
    !possuiSomenteCampos(externo, ["envelope", "envelopeHash"]) ||
    !envelope ||
    !possuiSomenteCampos(envelope, ["algoritmo", "chaveId", "chave", "iv", "conteudo", "aad", "assinatura"]) ||
    envelope.algoritmo !== "NCBANK-ECDH-P256-A256GCM-v3" ||
    typeof envelope.chaveId !== "string" ||
    typeof envelope.chave !== "string" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.conteudo !== "string" ||
    typeof envelope.aad !== "string" ||
    typeof envelope.assinatura !== "string" ||
    typeof externo.envelopeHash !== "string" ||
    !/^[A-Za-z0-9_-]{43,96}$/.test(externo.envelopeHash) ||
    hashConteudo(canonicalizarJsonSeguro(envelope)) !== externo.envelopeHash
  ) {
    return null;
  }

  return JSON.stringify(externo);
};

const assinarCanalInterno = ({
  caminho,
  corpo,
  metodo
}: {
  caminho: string;
  corpo: string;
  metodo: string;
}) => {
  if (segredoCanalInterno.length < 48) {
    throw new Error("segredo_canal_interno_indisponivel");
  }

  const tempo = Date.now().toString();
  const nonce = base64url(randomBytes(24));
  const corpoHash = hashConteudo(corpo);
  const texto = [
    versaoAssinaturaInterna,
    identidadeServico,
    identificadorSegredo,
    metodo,
    caminho,
    corpoHash,
    tempo,
    nonce
  ].join("|");
  const chave = createHash("sha256")
    .update(`netcatbank:canal-interno:${segredoCanalInterno}`)
    .digest();

  return {
    "x-netcatbank-canal-interno": versaoAssinaturaInterna,
    "x-netcatbank-servico": identidadeServico,
    "x-netcatbank-servico-versao": "bff-v1",
    "x-netcatbank-segredo-id": identificadorSegredo,
    "x-netcatbank-canal-tempo": tempo,
    "x-netcatbank-canal-nonce": nonce,
    "x-netcatbank-canal-corpo": corpoHash,
    "x-netcatbank-canal-assinatura": createHmac("sha256", chave)
      .update(texto)
      .digest("base64url")
  };
};

const assinaturaRespostaInternaValida = (entrada: {
  caminho: string;
  corpoRequisicao: string;
  corpoResposta: Buffer;
  metodo: string;
  respostaApi: Response;
}) => {
  const assinatura = entrada.respostaApi.headers.get("x-netcatbank-resposta-binding") ?? "";
  if (!/^[A-Za-z0-9_-]{43,96}$/.test(assinatura) || segredoCanalInterno.length < 48) return false;

  const chave = createHash("sha256")
    .update(`netcatbank:canal-interno:${segredoCanalInterno}`)
    .digest();
  const texto = [
    "NCBANK-RESP-HMAC-v1",
    entrada.metodo,
    entrada.caminho,
    hashConteudo(entrada.corpoRequisicao),
    String(entrada.respostaApi.status),
    hashBytes(entrada.corpoResposta)
  ].join("|");
  const esperada = createHmac("sha256", chave).update(texto).digest("base64url");
  const esperadaBuffer = Buffer.from(esperada);
  const recebidaBuffer = Buffer.from(assinatura);

  return esperadaBuffer.length === recebidaBuffer.length && timingSafeEqual(esperadaBuffer, recebidaBuffer);
};

const montarCabecalhos = (
  requisicao: NextRequest,
  opcoes: {
    caminho: string;
    corpo: string;
    metodo: string;
  }
) => {
  const cabecalhos = new Headers();
  const repassar = [
    "accept",
    "accept-language",
    "content-type",
    "cookie",
    "user-agent",
    "x-netcatbank-assinatura",
    "x-netcatbank-cliente",
    "x-netcatbank-csrf",
    "x-netcatbank-fluxo",
    "x-netcatbank-tempo"
  ];

  for (const nome of cabecalhosInternos) {
    if (requisicao.headers.has(nome)) {
      throw new Error("cabecalho_interno_recusado");
    }
  }

  for (const nome of repassar) {
    const valor = requisicao.headers.get(nome);
    if (valor) cabecalhos.set(nome, valor);
  }

  const origem = origemDaRequisicao(requisicao);
  if (origem) cabecalhos.set("origin", origem);
  cabecalhos.set("sec-fetch-site", "same-site");
  cabecalhos.set("sec-fetch-mode", "cors");
  cabecalhos.set("sec-fetch-dest", "empty");
  cabecalhos.set("x-netcatbank-canal", "interno-criptografado");

  const assinaturaInterna = assinarCanalInterno(opcoes);
  for (const [nome, valor] of Object.entries(assinaturaInterna)) {
    cabecalhos.set(nome, valor);
  }

  return cabecalhos;
};

const copiarCabecalhosResposta = (respostaApi: Response) => {
  const cabecalhos = new Headers();
  const permitidos = [
    "cache-control",
    "clear-site-data",
    "content-type",
    "cross-origin-resource-policy",
    "x-content-type-options",
    "x-download-options",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset"
  ];

  for (const nome of permitidos) {
    const valor = respostaApi.headers.get(nome);
    if (valor) cabecalhos.set(nome, valor);
  }

  const disposicao = respostaApi.headers.get("content-disposition");
  if (
    disposicao &&
    (/^attachment; filename="extrato-netcatbank-\d{4}-\d{2}-\d{2}\.(csv|pdf|ofx)"$/i.test(disposicao) ||
      /^attachment; filename="comprovante-netcatbank-[a-z0-9-]{8,48}\.(pdf|png)"$/i.test(disposicao))
  ) {
    cabecalhos.set("content-disposition", disposicao);
  }

  const cookies: string[] =
    typeof respostaApi.headers.getSetCookie === "function"
      ? respostaApi.headers.getSetCookie()
      : [respostaApi.headers.get("set-cookie")].filter((cookie): cookie is string => Boolean(cookie));

  for (const cookie of cookies) {
    cabecalhos.append("set-cookie", cookie);
  }

  cabecalhos.set("Cache-Control", "no-store");
  cabecalhos.set("X-NetCatBank-Canal", "interno-criptografado");
  return cabecalhos;
};

const chamarApiInternaMtls = (
  destino: URL,
  metodo: string,
  cabecalhos: Headers,
  corpo: string | undefined
) =>
  new Promise<Response>((resolver, rejeitar) => {
    if (!materialMtls) {
      rejeitar(new Error("mtls_indisponivel"));
      return;
    }

    const requisicao = requisicaoHttps(
      {
        ca: materialMtls.ca,
        cert: materialMtls.cert,
        headers: Object.fromEntries(cabecalhos.entries()),
        hostname: destino.hostname,
        key: materialMtls.key,
        method: metodo,
        minVersion: "TLSv1.3",
        path: `${destino.pathname}${destino.search}`,
        port: destino.port || 443,
        rejectUnauthorized: true,
        servername: mtlsServidorNome
      },
      (resposta) => {
        const pedacos: Buffer[] = [];
        resposta.on("data", (pedaco) => pedacos.push(Buffer.from(pedaco)));
        resposta.on("end", () => {
          const cabecalhosResposta = new Headers();

          for (const [nome, valor] of Object.entries(resposta.headers)) {
            if (Array.isArray(valor)) {
              for (const item of valor) cabecalhosResposta.append(nome, item);
            } else if (valor) {
              cabecalhosResposta.set(nome, valor);
            }
          }

          resolver(
            new Response(Buffer.concat(pedacos), {
              status: resposta.statusCode ?? 502,
              headers: cabecalhosResposta
            })
          );
        });
      }
    );

    requisicao.setTimeout(8_000, () => {
      requisicao.destroy(new Error("tempo_esgotado_api_interna"));
    });
    requisicao.on("error", rejeitar);
    if (corpo) requisicao.write(corpo);
    requisicao.end();
  });
const chamarApiInterna = (destino: URL, metodo: string, cabecalhos: Headers, corpo: string | undefined) => {
  if (destino.protocol === "https:" || mtlsClienteAtivo) {
    return chamarApiInternaMtls(destino, metodo, cabecalhos, corpo);
  }

  return fetch(destino, {
    method: metodo,
    headers: cabecalhos,
    body: corpo,
    cache: "no-store",
    redirect: "manual"
  });
};

const encaminhar = async (requisicao: NextRequest, contexto: ContextoRota) => {
  const caminho = await caminhoSeguro(contexto);
  const metodo = requisicao.method.toUpperCase();
  const chaveRota = `${metodo} ${caminho}`;
  const politica = politicasRotas.get(chaveRota);

  if (!canalInternoAtivo || !hostControlado(requisicao)) {
    return respostaBloqueada(404, "Canal seguro interno indisponível neste domínio.");
  }

  if (requisicao.nextUrl.search || !caminho || !politica || politica.metodo !== metodo) {
    return respostaBloqueada(404, "Canal seguro indisponível para esta rota.");
  }

  if (!possuiSinalDeNavegadorReal(requisicao)) {
    return respostaBloqueada(400, "Formato de segurança inválido.");
  }

  const rateLimitBff = verificarRateLimitBff(requisicao);
  if (!rateLimitBff.permitido) {
    return respostaRateLimit(rateLimitBff.segundos);
  }

  const corpoRecebido = metodo === "GET" ? "" : await requisicao.text();

  if (corpoRecebido.length > tamanhoMaximoCorpo) {
    return respostaBloqueada(413, "Envelope de segurança muito grande.");
  }

  if (politica.corpo === "envelope") {
    const tipoConteudo = requisicao.headers.get("content-type")?.toLowerCase() ?? "";
    if (!tipoConteudo.includes("application/json")) {
      return respostaBloqueada(415, "Envelope de segurança inválido.");
    }
    if (!requisicao.headers.get("x-netcatbank-csrf")) {
      return respostaBloqueada(403, "Validação de segurança expirada.");
    }
  }

  const corpoNormalizado = normalizarCorpo(corpoRecebido, politica);
  if (corpoNormalizado === null) {
    return respostaBloqueada(400, "Envelope de segurança inválido.");
  }

  const fluxoRecebido = requisicao.headers.get("x-netcatbank-fluxo") ?? "";
  if (fluxoRecebido !== politica.fluxo) {
    return respostaBloqueada(400, "Formato de segurança inválido.");
  }

  let cabecalhosApi: Headers;
  try {
    cabecalhosApi = montarCabecalhos(requisicao, {
      caminho,
      corpo: corpoNormalizado,
      metodo
    });
  } catch {
    return respostaBloqueada(503, "Canal seguro interno temporariamente indisponível.");
  }

  const destino = new URL(caminho, apiInterna);
  let respostaApi: Response;
  let corpoResposta: Buffer;

  try {
    respostaApi = await chamarApiInterna(
      destino,
      metodo,
      cabecalhosApi,
      politica.corpo === "nenhum" ? undefined : corpoNormalizado
    );
    corpoResposta = Buffer.from(await respostaApi.arrayBuffer());
  } catch {
    return respostaIndisponibilidadeInterna();
  }

  if (
    !assinaturaRespostaInternaValida({
      caminho,
      corpoRequisicao: corpoNormalizado,
      corpoResposta,
      metodo,
      respostaApi
    })
  ) {
    return respostaBloqueada(502, "Canal seguro interno temporariamente indisponível.");
  }

  return new Response(new Uint8Array(corpoResposta), {
    status: respostaApi.status,
    headers: copiarCabecalhosResposta(respostaApi)
  });
};

export const GET = encaminhar;
export const POST = encaminhar;
export const OPTIONS = () => respostaBloqueada(405, "Método não permitido neste canal.");

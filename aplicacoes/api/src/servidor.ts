import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import QRCode from "qrcode";
import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  sign as assinarEd25519,
  timingSafeEqual
} from "node:crypto";
import { readFileSync } from "node:fs";
import type { TLSSocket } from "node:tls";
import { createClient } from "redis";
import sharp from "sharp";
import {
  ativarDoisFatoresConta,
  aplicarLancamentoLedgerSaldo,
  atualizarSinalSessaoCliente,
  atualizarContadorDoisFatoresConta,
  buscarAgendamentosFinanceirosConta,
  buscarAgendamentosNexVencidosConta,
  buscarAtividadesNexConta,
  buscarBoasVindasIndicacaoPendente,
  buscarCampanhaIndicacao,
  buscarChavesNexConta,
  buscarContaPorDocumento,
  buscarContaPorId,
  buscarConsultaCnpj,
  buscarConviteIndicacao,
  buscarDesafioLogin2fa,
  buscarGraficoFinanceiroConta,
  buscarIndicacaoPendenteBonus,
  buscarIndicacaoRecebida,
  buscarLancamentosSaldoConta,
  buscarLancamentoSaldoPorIdempotencia,
  buscarLinkIndicacaoPorCodigo,
  boletoBancarioJaLiquidado,
  buscarComprovanteTransacao,
  buscarMovimentoFinanceiroContaPorId,
  buscarMovimentosFinanceirosConta,
  buscarPartidasDobradasSaldoLancamento,
  buscarOuCriarCampanhaIndicacao,
  buscarSaldoConta,
  buscarSessaoAbertura,
  buscarSessaoCliente,
  buscarParticipantesTransferenciaNexMovimento,
  buscarTransferenciaNexConta,
  bloquearIndicacao,
  cancelarSessaoAbertura,
  concluirConta,
  consumirDesafioLogin2fa,
  consumirSessaoAbertura,
  contarIndicacoesLiquidadas,
  contarIndicacoesLiquidadasCampanha,
  contarEventosSegurancaPorReferencia,
  contarEventosSegurancaRecentes,
  criarContaPendente,
  criarAgendamentoNexConta,
  criarChaveNexConta,
  criarConviteIndicacao,
  criarDesafioLogin2fa,
  criarLinkIndicacao,
  criarSessaoAbertura,
  criarSessaoCliente,
  documentoExiste,
  emailExiste,
  encerrarSessaoCliente,
  falharAgendamentoNexConta,
  liquidarDoacaoInstitutoMurzoConta,
  liquidarPagamentoBoletoConta,
  liquidarRecargaCelularConta,
  marcarBoasVindasIndicacaoVista,
  marcarAgendamentoNexProcessado,
  marcarAgendamentoNexProcessando,
  marcarIndicacaoBonusLiquidado,
  marcarIndicacaoContaAtivada,
  obterElegibilidadeCreditoConta,
  prepararDoisFatoresConta,
  prepararBanco,
  confirmarTransferenciaNex,
  prepararTransferenciaNex,
  registrarEnvelopeUnico,
  registrarComprovanteTransacao,
  registrarEventoSeguranca,
  registrarMovimentoFinanceiroLedger,
  removerChaveNexConta,
  resolverDestinoChaveNex,
  salvarConsultaCnpj,
  tocarSessaoCliente,
  vincularConviteIndicacaoAConta
} from "./banco.js";
import type {
  CategoriaMovimentoFinanceiro,
  AgendamentoFinanceiroBanco,
  ChaveNexBanco,
  ContaBanco,
  DirecaoMovimentoFinanceiro,
  EstadoChaveNexBanco,
  FiltrosMovimentosFinanceiros,
  MovimentoFinanceiroBanco,
  OrdenacaoMovimentoFinanceiro,
  ParticipantesTransferenciaNexBanco,
  TipoChaveNexBanco,
  TransferenciaNexBanco,
  TransferenciaNexComMovimentoBanco,
  DestinatarioNexBanco,
  ContatoNexBanco
} from "./banco.js";
import {
  abrirEnvelopeSeguro,
  apagarCookie,
  algoritmoEnvelope,
  assinarLancamentoSaldo,
  assinarPartidaDobradaSaldo,
  assinarPayloadEnvelopeCliente,
  assinarSaldoConta,
  calcularMerkleRaizSaldo,
  cabecalhoCsrf,
  compararHashSeguro,
  canonicalizarJsonSeguro,
  cookiesNetCat,
  criarTransporteSeguro,
  criarCsrf,
  criarHashSenha,
  criptografar,
  descriptografar,
  gerarTokenSeguro,
  hashContextoRequisicao,
  hashEnvelopePublico,
  hashTextoBase64url,
  hashToken,
  indiceSeguro,
  lerCookie,
  lerCookies,
  serializarCookie,
  validarAssinaturaSaldoConta,
  validarCsrf,
  verificarSenha
} from "./seguranca.js";
import { criarQrTotpSvg, criarUriTotp, gerarSegredoTotp, validarCodigoTotp } from "./totp.js";
import {
  normalizarEmail,
  normalizarNomeCompleto,
  obterPrimeiroNome,
  somenteDigitos,
  validarDataNascimento,
  validarDocumento,
  validarEmail,
  validarNomeCompleto,
  validarProduto,
  validarSenhaNumerica
} from "./validacao.js";
import type { ProdutoConta, TipoDocumento } from "./validacao.js";

const host = process.env.HOST ?? "0.0.0.0";
const porta = Number(process.env.PORTA ?? process.env.PORT ?? 3001);
const urlEstaticosPublicos =
  process.env.URL_ESTATICOS_PUBLICA ??
  process.env.NEXT_PUBLIC_ESTATICOS_URL ??
  "https://estaticos.netcatbank.com";
const urlIndicacoesPublica =
  process.env.URL_INDICACOES_PUBLICA ??
  process.env.NEXT_PUBLIC_INDICACOES_URL ??
  "https://indique.netcatbank.com";
const janelaSilenciosaIndicacaoRecebidaMs = 24 * 60 * 60 * 1000;
const limiteIndicacoesCampanha = 20;
const origensPermitidas = new Set(
  (process.env.ORIGENS_PERMITIDAS ?? "https://netcatbank.com,https://www.netcatbank.com")
    .split(",")
    .map((origem) => origem.trim())
    .filter(Boolean)
);
const desenvolvimento = process.env.NODE_ENV !== "production";
const chavePrivadaComprovanteConfigurada = process.env.NCBANK_COMPROVANTE_ED25519_PRIVADA_PKCS8 ?? "";
const segredoComprovanteEd25519 =
  process.env.NCBANK_SEGREDO_COMPROVANTE_ED25519 ??
  process.env.NCBANK_SEGREDO_FINANCEIRO_HMAC ??
  process.env.NCBANK_SEGREDO_APLICACAO ??
  (desenvolvimento
    ? "netcatbank-comprovante-ed25519-desenvolvimento-4f0c9b7a2e1d8c6a"
    : "");
const segredoNexIndice =
  process.env.NCBANK_SEGREDO_NEX_INDICE ??
  process.env.NCBANK_SEGREDO_FINANCEIRO_HMAC ??
  process.env.NCBANK_SEGREDO_APLICACAO ??
  (desenvolvimento
    ? "netcatbank-nex-indice-desenvolvimento-8f35c44a9a0d6f73b1e2"
    : "");
const segredoCanalInterno =
  process.env.NCBANK_SEGREDO_CANAL_INTERNO ??
  (desenvolvimento
    ? "netcatbank-canal-interno-desenvolvimento-9e7b5d1a4c2f8a6d"
    : "");
const segredoCanalInternoAnterior = process.env.NCBANK_SEGREDO_CANAL_INTERNO_ANTERIOR ?? "";
const identificadorSegredoCanalInterno = process.env.NCBANK_ID_SEGREDO_CANAL_INTERNO ?? "atual";
const identificadorSegredoCanalInternoAnterior =
  process.env.NCBANK_ID_SEGREDO_CANAL_INTERNO_ANTERIOR ?? "anterior";
const identidadeServicoEsperada = process.env.NCBANK_IDENTIDADE_BFF ?? "netcatbank-frente-bff";
const versaoAssinaturaInterna = "NCBANK-CANAL-INTERNO-HMAC-v1";
const redisUrl = process.env.REDIS_URL;
const mtlsApiAtivo = process.env.NCBANK_MTLS_API_ATIVO === "true";
const mtlsClienteCnEsperado = process.env.NCBANK_MTLS_CLIENTE_CN ?? "bff.netcatbank.interno";
const caminhoMtlsCa = process.env.NCBANK_MTLS_CA;
const caminhoMtlsApiCert = process.env.NCBANK_MTLS_API_CERT;
const caminhoMtlsApiKey = process.env.NCBANK_MTLS_API_KEY;

if (!desenvolvimento && segredoCanalInterno.length < 48) {
  throw new Error("NCBANK_SEGREDO_CANAL_INTERNO forte e obrigatorio em producao.");
}

if (!desenvolvimento && !chavePrivadaComprovanteConfigurada && segredoComprovanteEd25519.length < 48) {
  throw new Error("NCBANK_SEGREDO_COMPROVANTE_ED25519 ou NCBANK_COMPROVANTE_ED25519_PRIVADA_PKCS8 forte e obrigatorio em producao.");
}

if (!desenvolvimento && segredoNexIndice.length < 48) {
  throw new Error("NCBANK_SEGREDO_NEX_INDICE forte e obrigatorio em producao.");
}

if (!desenvolvimento && !redisUrl) {
  throw new Error("REDIS_URL obrigatoria para replay cache do canal interno em producao.");
}

const carregarChavePrivadaComprovante = () => {
  const configurada = chavePrivadaComprovanteConfigurada.trim();

  if (configurada) {
    if (configurada.includes("BEGIN PRIVATE KEY")) {
      return createPrivateKey(configurada);
    }

    return createPrivateKey({
      key: Buffer.from(configurada, "base64"),
      format: "der",
      type: "pkcs8"
    });
  }

  const semente = createHmac("sha256", segredoComprovanteEd25519)
    .update("netcatbank:comprovante:ed25519:v1")
    .digest()
    .subarray(0, 32);

  return createPrivateKey({
    key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), semente]),
    format: "der",
    type: "pkcs8"
  });
};

const chavePrivadaComprovante = carregarChavePrivadaComprovante();
const chavePrivadaComprovantePem = chavePrivadaComprovante.export({
  format: "pem",
  type: "pkcs8"
});
const chavePublicaComprovanteDer = createPublicKey(chavePrivadaComprovantePem).export({
  format: "der",
  type: "spki"
});
const chaveIdComprovante =
  process.env.NCBANK_COMPROVANTE_CHAVE_ID ??
  `ed25519-${createHash("sha256").update(chavePublicaComprovanteDer).digest("base64url").slice(0, 18)}`;

const segredosCanalInterno = new Map(
  [
    [identificadorSegredoCanalInterno, segredoCanalInterno],
    [identificadorSegredoCanalInternoAnterior, segredoCanalInternoAnterior]
  ].filter((entrada): entrada is [string, string] => {
    const segredo = entrada[1];
    return typeof segredo === "string" && segredo.length >= 48;
  })
);

const dominioCookieSessao = (process.env.NCBANK_COOKIE_DOMAIN ?? "")
  .trim()
  .replace(/^\./, "")
  .toLowerCase();
const dominiosCookieSessao = Array.from(
  new Set(
    [
      dominioCookieSessao,
      desenvolvimento && dominioCookieSessao === "netcatbank.localtest.me" ? "localtest.me" : "",
      desenvolvimento && dominioCookieSessao === "netcatbank.localtest.me" ? "netcatbank.localme" : ""
    ].filter((dominio) => /^[a-z0-9.-]+$/.test(dominio) && dominio.includes("."))
  )
);
const opcoesCookiesSessao = dominiosCookieSessao.map((domain) => ({ domain }));

const carregarLogoComprovante = () => {
  const caminhos = [
    `${process.cwd()}/aplicacoes/api/assets/logo-netcatbank-comprovante.png`,
    `${process.cwd()}/assets/logo-netcatbank-comprovante.png`
  ];

  for (const caminho of caminhos) {
    try {
      return `data:image/png;base64,${readFileSync(caminho).toString("base64")}`;
    } catch {
      // Usa o fallback vetorial abaixo quando o asset não está disponível.
    }
  }

  return "";
};

const logoComprovanteDataUri = carregarLogoComprovante();

const lerArquivoObrigatorio = (caminho: string | undefined, nome: string) => {
  if (!caminho) throw new Error(`${nome} obrigatorio para mTLS interno.`);
  return readFileSync(caminho);
};

const servidor = Fastify({
  bodyLimit: 32 * 1024,
  ...(mtlsApiAtivo
    ? {
        https: {
          ca: lerArquivoObrigatorio(caminhoMtlsCa, "NCBANK_MTLS_CA"),
          cert: lerArquivoObrigatorio(caminhoMtlsApiCert, "NCBANK_MTLS_API_CERT"),
          key: lerArquivoObrigatorio(caminhoMtlsApiKey, "NCBANK_MTLS_API_KEY"),
          minVersion: "TLSv1.3",
          rejectUnauthorized: true,
          requestCert: true
        }
      }
    : {}),
  logger: true,
  requestIdHeader: "x-request-id",
  trustProxy: true
});

const clienteRedis = redisUrl
  ? createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 4_000
      }
    })
  : null;
let conexaoRedis: Promise<NonNullable<typeof clienteRedis>> | null = null;

const obterRedis = async () => {
  if (!clienteRedis) throw new Error("redis_indisponivel");
  if (!conexaoRedis) {
    const cliente = clienteRedis;
    conexaoRedis = cliente.connect().then(() => cliente);
  }
  return conexaoRedis;
};

type CorpoVerificacaoAbertura = {
  tipo?: unknown;
  tipoDocumento?: unknown;
  valor?: unknown;
};

type CorpoIniciarAbertura = {
  nomeCompleto?: unknown;
  tipoDocumento?: unknown;
  documento?: unknown;
  email?: unknown;
  emailConfirmacao?: unknown;
  aceitouSistema?: unknown;
  aceitouDados?: unknown;
  aceitouPrivacidade?: unknown;
  produto?: unknown;
};

type CorpoComplementoAbertura = {
  dataNascimento?: unknown;
  senha?: unknown;
  senhaConfirmacao?: unknown;
};

type CorpoConsultaCnpjAbertura = {
  documento?: unknown;
};

type DadosCnpjPublicos = {
  atividadePrincipal: string;
  bairro: string;
  capitalSocial: string;
  cep: string;
  cidade: string;
  cnpj: string;
  dataAbertura: string;
  endereco: string;
  matrizFilial: string;
  naturezaJuridica: string;
  nomeFantasia: string;
  porte: string;
  razaoSocial: string;
  simples: string;
  situacao: string;
  uf: string;
};

type RespostaBrasilApiCnpj = {
  bairro?: unknown;
  capital_social?: unknown;
  cep?: unknown;
  cnae_fiscal_descricao?: unknown;
  cnpj?: unknown;
  complemento?: unknown;
  data_inicio_atividade?: unknown;
  descricao_identificador_matriz_filial?: unknown;
  descricao_situacao_cadastral?: unknown;
  logradouro?: unknown;
  municipio?: unknown;
  natureza_juridica?: unknown;
  nome_fantasia?: unknown;
  numero?: unknown;
  opcao_pelo_simples?: unknown;
  porte?: unknown;
  razao_social?: unknown;
  uf?: unknown;
};

type CorpoLogin = {
  documento?: unknown;
  senha?: unknown;
};

type CorpoLogin2fa = {
  codigo?: unknown;
};

type CorpoAtivar2fa = {
  codigo?: unknown;
};

type CorpoTransacoesFinanceiras = {
  categoria?: unknown;
  fim?: unknown;
  formato?: unknown;
  inicio?: unknown;
  limite?: unknown;
  ordenar?: unknown;
  pagina?: unknown;
  periodo?: unknown;
  pesquisa?: unknown;
  tipo?: unknown;
};

type CorpoGraficosFinanceiros = {
  mes?: unknown;
};

type CorpoTransacaoFinanceira = {
  id?: unknown;
};

type CorpoComprovanteFinanceiro = {
  formato?: unknown;
  id?: unknown;
};

type CorpoDoacaoInstitutoMurzo = {
  valorCentavos?: unknown;
};

type CorpoPagamentoBoleto = {
  codigo?: unknown;
};

type CorpoRecargaCelularValidar = {
  telefone?: unknown;
};

type CorpoRecargaCelularConfirmar = {
  telefone?: unknown;
  valorCentavos?: unknown;
};

type CorpoCriarChaveNex = {
  tipo?: unknown;
  valor?: unknown;
};

type CorpoExcluirChaveNex = {
  id?: unknown;
};

type CorpoResolverTransferenciaNex = {
  chaveDestino?: unknown;
};

type CorpoPrepararTransferenciaNex = {
  chaveDestino?: unknown;
  descricao?: unknown;
  valorCentavos?: unknown;
};

type CorpoConfirmarTransferenciaNex = {
  transferenciaId?: unknown;
};

type CorpoCriarAgendamentoNex = {
  agendadoPara?: unknown;
  chaveDestino?: unknown;
  descricao?: unknown;
  valorCentavos?: unknown;
};

type CorpoCriarQrRecebimentoNex = {
  chaveId?: unknown;
  descricao?: unknown;
  valorCentavos?: unknown;
};

type CorpoValidarQrRecebimentoNex = {
  conteudo?: unknown;
};

type CorpoAtividadesNex = {
  limite?: unknown;
  pagina?: unknown;
  pesquisa?: unknown;
};

type CorpoEnvelopeComMetadados = Record<string, unknown> & {
  __metadadosEnvelope?: {
    idempotencia: string;
  };
};

type ParticipanteComprovante = {
  chave: string;
  documento: string;
  instituicao: string;
  nome: string;
};

type VerificacaoComprovante = {
  algoritmo: "Ed25519";
  assinatura: string;
  chaveId: string;
  digest: string;
  snapshotVersao: 1;
};

type TransacaoDetalhadaPublica = ReturnType<typeof serializarMovimento> & {
  comprovanteTitulo: string;
  liquidadoEm: string;
  pagador: ParticipanteComprovante;
  recebedor: ParticipanteComprovante;
  referencia: string;
  resumo: string;
  verificacao: VerificacaoComprovante;
};

type CorpoConviteIndicacao = {
  codigo?: unknown;
};

const documentosReservados = new Set([
  "52998224725",
  "11144477735",
  "11222333000181"
]);
const emailsReservados = new Set([
  "cliente@netcatbank.com",
  "murphy@netcatbank.com",
  "conta@netcatbank.com"
]);
const intervaloConsultaCnpjMs = 30_000;
const tempoMaximoEsperaCnpjMs = 120_000;
let proximaConsultaCnpjEm = 0;
const consultasCnpjEmAndamento = new Map<
  string,
  {
    agendadaPara: number;
    estado: "pendente" | "ok" | "adiado";
    iniciouEm: number;
  }
>();
const categoriasFinanceirasPermitidas = new Set<CategoriaMovimentoFinanceiro>([
  "geral",
  "moradia",
  "alimentacao",
  "transporte",
  "lazer",
  "servicos",
  "pagamentos",
  "doacoes",
  "investimentos",
  "bonus",
  "cartoes"
]);
const tiposFinanceirosPermitidos = new Set<DirecaoMovimentoFinanceiro | "todos">([
  "entrada",
  "saida",
  "todos"
]);
const ordenacoesFinanceirasPermitidas = new Set<OrdenacaoMovimentoFinanceiro>([
  "recentes",
  "antigas",
  "valor_maior",
  "valor_menor"
]);
const eventosEnvelopeInvalidos = [
  "envelope_invalido",
  "envelope_repetido",
  "cabecalho_sensivel_invalido",
  "fluxo_recusado"
];
const limiteEventosEnvelopeInvalidos = Number(
  process.env.NCBANK_LIMITE_EVENTOS_ENVELOPE_INVALIDOS ?? (desenvolvimento ? 160 : 12)
);
const cabecalhosInternosResposta = [
  "x-netcatbank-canal-interno",
  "x-netcatbank-canal-tempo",
  "x-netcatbank-canal-nonce",
  "x-netcatbank-canal-corpo",
  "x-netcatbank-canal-assinatura",
  "x-netcatbank-servico",
  "x-netcatbank-servico-versao",
  "x-netcatbank-segredo-id"
];

await servidor.register(helmet, {
  contentSecurityPolicy: false,
  global: true
});

await servidor.register(cors, {
  allowedHeaders: [
    "Accept",
    "Accept-Language",
    "Content-Type",
    "X-NetCatBank-Assinatura",
    "X-NetCatBank-Cliente",
    "X-NetCatBank-CSRF",
    "X-NetCatBank-Fluxo",
    "X-NetCatBank-Tempo"
  ],
  credentials: true,
  exposedHeaders: [
    "Cache-Control",
    "Content-Disposition",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset"
  ],
  maxAge: 300,
  methods: ["GET", "POST", "OPTIONS"],
  origin(origem, retorno) {
    if (!origem || origensPermitidas.has(origem)) {
      retorno(null, true);
      return;
    }

    retorno(null, false);
  }
});

const chaveRateLimitGlobalApi = (requisicao: FastifyRequest) => {
  const sinal = requisicao.headers["x-netcatbank-cliente"];
  const sinalTexto = Array.isArray(sinal) ? sinal.join(",") : sinal ?? "";
  const agente = requisicao.headers["user-agent"];
  const agenteTexto = Array.isArray(agente) ? agente.join(" ") : agente ?? "";
  const sinalValido =
    sinalTexto.length >= 43 &&
    sinalTexto.length <= 96 &&
    /^[A-Za-z0-9_-]+$/.test(sinalTexto);

  return createHash("sha256")
    .update(`global:${sinalValido ? sinalTexto : requisicao.ip}:${agenteTexto.slice(0, 220)}`)
    .digest("base64url");
};

await servidor.register(rateLimit, {
  keyGenerator: chaveRateLimitGlobalApi,
  max: 900,
  timeWindow: "1 minute"
});

servidor.addHook("onSend", async (_requisicao, resposta, carga) => {
  for (const cabecalho of cabecalhosInternosResposta) {
    resposta.removeHeader(cabecalho);
  }

  const cabecalhosSeguros: Record<string, string> = {
    "Cache-Control": "no-store",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Download-Options": "noopen",
    "X-Frame-Options": "DENY",
    "X-Permitted-Cross-Domain-Policies": "none"
  };

  for (const [nome, valor] of Object.entries(cabecalhosSeguros)) {
    resposta.header(nome, valor);
  }

  return carga;
});

const aceitaHtml = (cabecalhoAceite: string | undefined) =>
  cabecalhoAceite?.toLowerCase().includes("text/html") ?? false;

const paginaErro = ({
  codigo,
  titulo,
  texto,
  detalhe
}: {
  codigo: number;
  titulo: string;
  texto: string;
  detalhe: string;
}) => `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${codigo} | NetCat Bank</title>
    <link rel="stylesheet" href="${urlEstaticosPublicos}/erros/erro.css" />
    <link rel="icon" href="${urlEstaticosPublicos}/marca/favicon-32x32.png" sizes="32x32" />
  </head>
  <body>
    <main class="pagina-erro">
      <picture class="erro-fundo" aria-hidden="true">
        <source srcset="${urlEstaticosPublicos}/marca/erro-404-netcatbank.avif" type="image/avif" />
        <source srcset="${urlEstaticosPublicos}/marca/erro-404-netcatbank.webp" type="image/webp" />
        <img src="${urlEstaticosPublicos}/marca/erro-404-netcatbank.png" alt="" />
      </picture>
      <section class="erro-conteudo" aria-label="Erro ${codigo}">
        <a class="erro-marca" href="https://netcatbank.com">
          <img src="${urlEstaticosPublicos}/marca/logo-netcatbank-branca.webp" alt="NetCat Bank" />
          <span>Acesso protegido</span>
        </a>
        <span class="erro-status">Erro ${codigo}</span>
        <h1>${titulo}</h1>
        <p>${texto}</p>
        <div class="erro-acoes">
          <a class="erro-botao erro-botao--primario" href="https://netcatbank.com">Voltar ao início</a>
          <a class="erro-botao erro-botao--secundario" href="mailto:contato@netcatbank.com">Falar com suporte</a>
        </div>
        <p class="erro-detalhe">${detalhe}</p>
      </section>
    </main>
  </body>
</html>`;

const responderErro = (
  codigo: number,
  titulo: string,
  texto: string,
  detalhe: string,
  requisicao: FastifyRequest,
  resposta: FastifyReply
) => {
  if (aceitaHtml(requisicao.headers.accept)) {
    return resposta
      .code(codigo)
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "no-store")
      .header("X-Robots-Tag", "noindex, nofollow")
      .send(paginaErro({ codigo, titulo, texto, detalhe }));
  }

  return resposta.code(codigo).send({
    estado: "erro",
    codigo,
    mensagem: titulo,
    detalhe
  });
};

const corpoComoObjeto = (valor: unknown): Record<string, unknown> | null =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;

const parseObjetoJsonSeguro = (valor: string) => {
  try {
    return corpoComoObjeto(JSON.parse(valor));
  } catch {
    return null;
  }
};

const possuiSomenteCampos = (corpo: Record<string, unknown>, campos: string[]) =>
  Object.keys(corpo).every((campo) => campos.includes(campo));

const origemPermitida = (requisicao: FastifyRequest) => {
  const origem = requisicao.headers.origin;
  return typeof origem === "string" && origensPermitidas.has(origem);
};

const cabecalhoTexto = (requisicao: FastifyRequest, nome: string) => {
  const valor = requisicao.headers[nome.toLowerCase()];
  return Array.isArray(valor) ? valor.join(",") : valor ?? "";
};

const cabecalhoUnicoTexto = (requisicao: FastifyRequest, nome: string) => {
  const valor = requisicao.headers[nome.toLowerCase()];
  return typeof valor === "string" ? valor : "";
};

const hashConteudo = (valor: string) =>
  createHash("sha256").update(valor).digest("base64url");

const hashBytes = (valor: Buffer | string) =>
  createHash("sha256").update(valor).digest("base64url");

const corpoCanalInterno = (valor: unknown) => {
  if (valor === undefined || valor === null) return "";
  if (typeof valor === "string") return valor;
  return JSON.stringify(valor);
};

const ipPrivado = (ip: string) =>
  ip === "::1" ||
  ip === "127.0.0.1" ||
  ip.startsWith("10.") ||
  ip.startsWith("172.16.") ||
  ip.startsWith("172.17.") ||
  ip.startsWith("172.18.") ||
  ip.startsWith("172.19.") ||
  ip.startsWith("172.20.") ||
  ip.startsWith("172.21.") ||
  ip.startsWith("172.22.") ||
  ip.startsWith("172.23.") ||
  ip.startsWith("172.24.") ||
  ip.startsWith("172.25.") ||
  ip.startsWith("172.26.") ||
  ip.startsWith("172.27.") ||
  ip.startsWith("172.28.") ||
  ip.startsWith("172.29.") ||
  ip.startsWith("172.30.") ||
  ip.startsWith("172.31.") ||
  ip.startsWith("192.168.") ||
  ip.startsWith("::ffff:10.") ||
  ip.startsWith("::ffff:172.") ||
  ip.startsWith("::ffff:192.168.") ||
  ip.startsWith("::ffff:127.");

const conexaoInternaEsperada = (requisicao: FastifyRequest) => {
  const enderecoRemoto = requisicao.socket.remoteAddress ?? "";
  return ipPrivado(enderecoRemoto);
};

const certificadoClienteInternoValido = (requisicao: FastifyRequest) => {
  if (!mtlsApiAtivo) return true;

  const socket = requisicao.raw.socket as TLSSocket;
  const certificado = socket.getPeerCertificate();

  return (
    socket.authorized === true &&
    certificado &&
    typeof certificado === "object" &&
    certificado.subject?.CN === mtlsClienteCnEsperado
  );
};

const registrarNonceInterno = async (nonceHash: string) => {
  const redis = await obterRedis();
  const resultado = await redis.set(`ncbank:canal-interno:nonce:${nonceHash}`, "1", {
    NX: true,
    EX: 90
  });
  return resultado === "OK";
};

const assinaturaInternaValida = async (requisicao: FastifyRequest) => {
  if (segredosCanalInterno.size === 0) return false;
  if (!conexaoInternaEsperada(requisicao)) return false;
  if (!certificadoClienteInternoValido(requisicao)) return false;

  const caminho = requisicao.url.split("?")[0] || "/";
  const metodo = requisicao.method.toUpperCase();
  const canal = cabecalhoUnicoTexto(requisicao, "x-netcatbank-canal-interno");
  const servico = cabecalhoUnicoTexto(requisicao, "x-netcatbank-servico");
  const servicoVersao = cabecalhoUnicoTexto(requisicao, "x-netcatbank-servico-versao");
  const segredoId = cabecalhoUnicoTexto(requisicao, "x-netcatbank-segredo-id");
  const tempo = cabecalhoUnicoTexto(requisicao, "x-netcatbank-canal-tempo");
  const nonce = cabecalhoUnicoTexto(requisicao, "x-netcatbank-canal-nonce");
  const corpoHash = cabecalhoUnicoTexto(requisicao, "x-netcatbank-canal-corpo");
  const assinatura = cabecalhoUnicoTexto(requisicao, "x-netcatbank-canal-assinatura");
  const segredo = segredosCanalInterno.get(segredoId);
  const corpoHashEsperado = hashConteudo(corpoCanalInterno(requisicao.body));
  const tempoMs = Number(tempo);

  if (
    canal !== versaoAssinaturaInterna ||
    servico !== identidadeServicoEsperada ||
    servicoVersao !== "bff-v1" ||
    !segredo ||
    !Number.isSafeInteger(tempoMs) ||
    Math.abs(Date.now() - tempoMs) > 45_000 ||
    !/^[A-Za-z0-9_-]{32,96}$/.test(nonce) ||
    !/^[A-Za-z0-9_-]{43,96}$/.test(corpoHash) ||
    !/^[A-Za-z0-9_-]{43,96}$/.test(assinatura) ||
    corpoHash !== corpoHashEsperado
  ) {
    return false;
  }

  const chave = createHash("sha256")
    .update(`netcatbank:canal-interno:${segredo}`)
    .digest();
  const texto = [
    versaoAssinaturaInterna,
    servico,
    segredoId,
    metodo,
    caminho,
    corpoHash,
    tempo,
    nonce
  ].join("|");
  const esperado = createHmac("sha256", chave).update(texto).digest("base64url");
  const esperadoBuffer = Buffer.from(esperado);
  const recebidoBuffer = Buffer.from(assinatura);

  if (esperadoBuffer.length !== recebidoBuffer.length || !timingSafeEqual(esperadoBuffer, recebidoBuffer)) {
    return false;
  }

  const nonceHash = createHmac("sha256", chave)
    .update(`${servico}:${segredoId}:${nonce}:${tempo}`)
    .digest("base64url");

  return registrarNonceInterno(nonceHash);
};

servidor.addHook("preHandler", async (requisicao, resposta) => {
  const caminho = requisicao.url.split("?")[0] || "/";
  const chaveRota = `${requisicao.method.toUpperCase()} ${caminho}`;

  if (chaveRota === "GET /saude") return;

  if (!(await assinaturaInternaValida(requisicao).catch(() => false))) {
    await registrarEventoSeguranca("canal_interno_recusado", null, contextoRequisicao(requisicao));
    return resposta.code(404).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Canal seguro indisponível."
    });
  }
});

const assinarRespostaInterna = (requisicao: FastifyRequest, statusCode: number, payload: unknown) => {
  const segredoId = cabecalhoUnicoTexto(requisicao, "x-netcatbank-segredo-id");
  const segredo = segredosCanalInterno.get(segredoId);
  if (!segredo) return "";

  const caminho = requisicao.url.split("?")[0] || "/";
  const metodo = requisicao.method.toUpperCase();
  const corpoHash = cabecalhoUnicoTexto(requisicao, "x-netcatbank-canal-corpo");
  const payloadBytes =
    Buffer.isBuffer(payload) ? payload : Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload ?? ""), "utf8");
  const respostaHash = hashBytes(payloadBytes);
  const chave = createHash("sha256")
    .update(`netcatbank:canal-interno:${segredo}`)
    .digest();
  const texto = [
    "NCBANK-RESP-HMAC-v1",
    metodo,
    caminho,
    corpoHash,
    String(statusCode),
    respostaHash
  ].join("|");

  return createHmac("sha256", chave).update(texto).digest("base64url");
};

servidor.addHook("onSend", async (requisicao, resposta, payload) => {
  if (requisicao.url.split("?")[0] === "/saude") return payload;
  if (cabecalhoUnicoTexto(requisicao, "x-netcatbank-canal-interno") !== versaoAssinaturaInterna) return payload;

  const assinatura = assinarRespostaInterna(requisicao, resposta.statusCode, payload);
  if (assinatura) resposta.header("X-NetCatBank-Resposta-Binding", assinatura);
  return payload;
});

const validarSinalCliente = (valor: unknown) =>
  typeof valor === "string" &&
  valor.length >= 43 &&
  valor.length <= 96 &&
  /^[A-Za-z0-9_-]+$/.test(valor);

const origemLocalDesenvolvimento = (origem: string) =>
  desenvolvimento &&
  /^https:\/\/(?:localhost|(?:[\w-]+\.)*localhost|localtest\.me|(?:[\w-]+\.)*localtest\.me)(?::\d+)?$/.test(
    origem
  );

const validarCabecalhosSensivel = async (
  requisicao: FastifyRequest,
  resposta: FastifyReply,
  fluxoEsperado: string
) => {
  const contextoAtual = contextoRequisicao(requisicao);
  const origem = cabecalhoTexto(requisicao, "origin");
  const agente = cabecalhoTexto(requisicao, "user-agent");
  const acceptLanguage = cabecalhoTexto(requisicao, "accept-language");
  const secFetchSite = cabecalhoTexto(requisicao, "sec-fetch-site").toLowerCase();
  const secFetchMode = cabecalhoTexto(requisicao, "sec-fetch-mode").toLowerCase();
  const secFetchDest = cabecalhoTexto(requisicao, "sec-fetch-dest").toLowerCase();
  const sinalCliente = cabecalhoTexto(requisicao, "x-netcatbank-cliente");
  const fluxo = cabecalhoTexto(requisicao, "x-netcatbank-fluxo");
  const recentes = await contarEventosSegurancaRecentes(eventosEnvelopeInvalidos, contextoAtual);

  if (recentes >= limiteEventosEnvelopeInvalidos) {
    resposta.code(429).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Muitas verificações em sequência."
    });
    return false;
  }

  const fetchMetadataPresente = Boolean(secFetchSite || secFetchMode || secFetchDest);
  const secFetchSiteValido =
    !secFetchSite ||
    secFetchSite === "same-site" ||
    secFetchSite === "same-origin" ||
    (secFetchSite === "cross-site" && origemLocalDesenvolvimento(origem));
  const secFetchModeValido = !secFetchMode || secFetchMode === "cors";
  const secFetchDestValido = !secFetchDest || secFetchDest === "empty";
  const fetchMetadataValido =
    !fetchMetadataPresente || (secFetchSiteValido && secFetchModeValido && secFetchDestValido);

  if (
    !origensPermitidas.has(origem) ||
    fluxo !== fluxoEsperado ||
    !validarSinalCliente(sinalCliente) ||
    !fetchMetadataValido
  ) {
    await registrarEventoSeguranca("cabecalho_sensivel_invalido", null, contextoAtual);
    resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Formato de segurança inválido."
    });
    return false;
  }

  if (!fetchMetadataPresente) {
    await registrarEventoSeguranca("cabecalho_fetch_metadata_ausente", null, contextoAtual);
  }

  if (!acceptLanguage) {
    await registrarEventoSeguranca("cabecalho_idioma_ausente", null, contextoAtual);
  }

  if (agente.length < 12) {
    await registrarEventoSeguranca("cabecalho_agente_incomum", null, contextoAtual);
  }

  return true;
};

const contextoRequisicao = (requisicao: FastifyRequest) => {
  const agente = requisicao.headers["user-agent"];
  const agenteTexto = Array.isArray(agente) ? agente.join(" ") : agente ?? "";
  const sinalCliente = cabecalhoTexto(requisicao, "x-netcatbank-cliente");

  if (validarSinalCliente(sinalCliente)) {
    return indiceSeguro(`cliente:${sinalCliente.slice(0, 160)}|agente:${agenteTexto.slice(0, 220)}`);
  }

  return hashContextoRequisicao(requisicao.ip, agenteTexto);
};

const agenteRequisicao = (requisicao: FastifyRequest) => {
  const agente = requisicao.headers["user-agent"];
  return Array.isArray(agente) ? agente.join(" ") : agente ?? "";
};

const contextoRedeRequisicao = (requisicao: FastifyRequest) =>
  indiceSeguro(`rede:${requisicao.ip.slice(0, 96)}`);

const agenteHashRequisicao = (requisicao: FastifyRequest) =>
  indiceSeguro(`agente:${agenteRequisicao(requisicao).slice(0, 220)}`);

const sinalClienteHashRequisicao = (requisicao: FastifyRequest) =>
  indiceSeguro(`sinal:${cabecalhoTexto(requisicao, "x-netcatbank-cliente").slice(0, 160)}`);

const assinaturaValida = ({
  assinatura,
  csrf,
  envelopeHash,
  fluxo,
  rota,
  sinalCliente,
  tempo
}: {
  assinatura: string;
  csrf: string;
  envelopeHash: string;
  fluxo: string;
  rota: string;
  sinalCliente: string;
  tempo: string;
}) => {
  if (
    !csrf ||
    !validarSinalCliente(sinalCliente) ||
    !/^\d{12,17}$/.test(tempo) ||
    !/^[A-Za-z0-9_-]{43,96}$/.test(envelopeHash) ||
    !/^[A-Za-z0-9_-]{43,96}$/.test(assinatura)
  ) {
    return false;
  }

  const segredo = createHash("sha256")
    .update(`netcatbank-assinatura:${csrf}:${sinalCliente}`)
    .digest();
  const texto = [
    "NCBANK-REQ-HMAC-v1",
    fluxo,
    rota,
    envelopeHash,
    tempo,
    sinalCliente
  ].join("|");
  const esperado = createHmac("sha256", segredo).update(texto).digest("base64url");
  const esperadoBuffer = Buffer.from(esperado);
  const recebidoBuffer = Buffer.from(assinatura);

  return esperadoBuffer.length === recebidoBuffer.length && timingSafeEqual(esperadoBuffer, recebidoBuffer);
};

const assinaturaBase64urlValida = (esperada: string, recebida: string) => {
  if (!/^[A-Za-z0-9_-]{43,96}$/.test(esperada) || !/^[A-Za-z0-9_-]{43,96}$/.test(recebida)) {
    return false;
  }
  const esperadaBuffer = Buffer.from(esperada);
  const recebidaBuffer = Buffer.from(recebida);
  return esperadaBuffer.length === recebidaBuffer.length && timingSafeEqual(esperadaBuffer, recebidaBuffer);
};

const validarJsonSeguro = (
  requisicao: FastifyRequest,
  resposta: FastifyReply,
  fluxoEsperado: string,
  camposPermitidos: string[]
) => {
  const corpo = corpoComoObjeto(requisicao.body);
  const contentType = requisicao.headers["content-type"] ?? "";
  const fluxo = requisicao.headers["x-netcatbank-fluxo"];

  if (
    !origemPermitida(requisicao) ||
    !contentType.toLowerCase().includes("application/json") ||
    fluxo !== fluxoEsperado ||
    !corpo ||
    !possuiSomenteCampos(corpo, camposPermitidos)
  ) {
    resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Formato de segurança inválido."
    });
    return null;
  }

  return corpo;
};

const criticidadeEsperadaEnvelope = (rota: string) =>
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

const camposInternosEnvelope = [
  "_ncAadHash",
  "_ncAssinaturaPayload",
  "_ncCliente",
  "_ncCriticidade",
  "_ncCsrf",
  "_ncEmitidoEm",
  "_ncFluxo",
  "_ncIdempotencia",
  "_ncIntegridadeRuntime",
  "_ncNonce",
  "_ncPayloadHash",
  "_ncRota",
  "_ncSeq",
  "_ncVersao"
];

const reduzirBase64url32 = (valor: string) => {
  let acumulador = 0x811c9dc5;
  for (let indice = 0; indice < valor.length; indice += 1) {
    acumulador = Math.imul(acumulador ^ valor.charCodeAt(indice), 0x01000193);
  }
  return acumulador >>> 0;
};

const integridadeRuntimeEnvelopeValida = (aadHash: unknown, payloadHash: unknown, integridade: unknown) => {
  if (
    typeof aadHash !== "string" ||
    typeof payloadHash !== "string" ||
    typeof integridade !== "string" ||
    !/^[a-f0-9]{8}$/.test(integridade)
  ) {
    return false;
  }

  const esquerda = reduzirBase64url32(aadHash);
  const direita = reduzirBase64url32(payloadHash);
  const esperado = ((Math.imul(esquerda, 0x01000193) ^ direita) >>> 0).toString(16).padStart(8, "0");
  return esperado === integridade;
};

const validarJsonEnvelopeSeguro = async (
  requisicao: FastifyRequest,
  resposta: FastifyReply,
  fluxoEsperado: string,
  rotaEsperada: string,
  camposPermitidos: string[]
) => {
  const corpoEnvelope = validarJsonSeguro(requisicao, resposta, fluxoEsperado, ["envelope", "envelopeHash"]);
  if (!corpoEnvelope) return null;

  const tokenCabecalho = requisicao.headers[cabecalhoCsrf];
  const token = typeof tokenCabecalho === "string" ? tokenCabecalho : "";
  const contextoAtual = contextoRequisicao(requisicao);
  const sinalClienteCabecalho = cabecalhoTexto(requisicao, "x-netcatbank-cliente");
  const corpoAberto = abrirEnvelopeSeguro(corpoEnvelope.envelope, {
    csrf: token,
    sinalCliente: sinalClienteCabecalho
  });
  const envelopePublico = corpoComoObjeto(corpoEnvelope.envelope);
  const aadTexto = typeof envelopePublico?.aad === "string" ? envelopePublico.aad : "";
  const aadObjeto = aadTexto ? parseObjetoJsonSeguro(aadTexto) : null;

  if (!corpoAberto) {
    resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Envelope de segurança inválido."
    });
    return null;
  }

  const fluxo = corpoAberto._ncFluxo;
  const rota = corpoAberto._ncRota;
  const csrf = corpoAberto._ncCsrf;
  const emitidoEm = corpoAberto._ncEmitidoEm;
  const nonce = corpoAberto._ncNonce;
  const versao = corpoAberto._ncVersao;
  const aadHash = corpoAberto._ncAadHash;
  const payloadHash = corpoAberto._ncPayloadHash;
  const assinaturaPayload = corpoAberto._ncAssinaturaPayload;
  const idempotencia = corpoAberto._ncIdempotencia;
  const integridadeRuntime = corpoAberto._ncIntegridadeRuntime;
  const sequencia = corpoAberto._ncSeq;
  const criticidade = corpoAberto._ncCriticidade;
  const sinalClienteEnvelope = corpoAberto._ncCliente;
  const tempoAssinatura = cabecalhoTexto(requisicao, "x-netcatbank-tempo");
  const assinatura = cabecalhoTexto(requisicao, "x-netcatbank-assinatura");
  const hashCorpo = corpoEnvelope.envelopeHash;
  const emitidoMs = typeof emitidoEm === "number" ? emitidoEm : 0;
  const tempoAssinaturaMs = Number(tempoAssinatura);
  const sequenciaNumero = typeof sequencia === "number" ? sequencia : 0;
  const nonceValido =
    typeof nonce === "string" &&
    nonce.length >= 24 &&
    nonce.length <= 80 &&
    /^[A-Za-z0-9_-]+$/.test(nonce);
  const idempotenciaValida =
    typeof idempotencia === "string" &&
    idempotencia.length >= 12 &&
    idempotencia.length <= 96 &&
    /^[a-zA-Z0-9:_-]+$/.test(idempotencia);
  const criticidadeEsperada = criticidadeEsperadaEnvelope(rotaEsperada);

  const corpo = { ...corpoAberto };
  for (const campoInterno of camposInternosEnvelope) delete corpo[campoInterno];
  let payloadCanonico = "";
  try {
    payloadCanonico = canonicalizarJsonSeguro(corpo);
  } catch {
    payloadCanonico = "";
  }

  if (
    versao !== 3 ||
    !aadObjeto ||
    envelopePublico?.algoritmo !== algoritmoEnvelope ||
    aadObjeto._ncVersao !== 3 ||
    aadObjeto._ncAlgoritmo !== algoritmoEnvelope ||
    aadObjeto._ncChaveId !== envelopePublico?.chaveId ||
    aadObjeto._ncFluxo !== fluxoEsperado ||
    aadObjeto._ncRota !== rotaEsperada ||
    aadObjeto._ncCsrfHash !== hashTextoBase64url(token) ||
    aadObjeto._ncClienteHash !== hashTextoBase64url(sinalClienteCabecalho) ||
    aadObjeto._ncEmitidoEm !== emitidoEm ||
    aadObjeto._ncNonce !== nonce ||
    aadObjeto._ncSeq !== sequencia ||
    aadObjeto._ncCriticidade !== criticidade ||
    aadObjeto._ncIdempotencia !== idempotencia ||
    fluxo !== fluxoEsperado ||
    rota !== rotaEsperada ||
    csrf !== token ||
    sinalClienteEnvelope !== sinalClienteCabecalho ||
    !validarSinalCliente(sinalClienteEnvelope) ||
    criticidade !== criticidadeEsperada ||
    !idempotenciaValida ||
    !Number.isSafeInteger(sequenciaNumero) ||
    sequenciaNumero < 1 ||
    !Number.isSafeInteger(emitidoMs) ||
    !Number.isSafeInteger(tempoAssinaturaMs) ||
    Math.abs(tempoAssinaturaMs - emitidoMs) > 15_000 ||
    !nonceValido ||
    typeof hashCorpo !== "string" ||
    hashCorpo.length < 43 ||
    hashCorpo.length > 96 ||
    hashCorpo !== hashEnvelopePublico(corpoEnvelope.envelope) ||
    aadHash !== hashTextoBase64url(aadTexto) ||
    payloadHash !== hashTextoBase64url(payloadCanonico) ||
    !integridadeRuntimeEnvelopeValida(aadHash, payloadHash, integridadeRuntime) ||
    !assinaturaBase64urlValida(
      assinarPayloadEnvelopeCliente({
        aad: aadTexto,
        csrf: token,
        payloadCanonico,
        sinalCliente: sinalClienteCabecalho
      }),
      typeof assinaturaPayload === "string" ? assinaturaPayload : ""
    ) ||
    !assinaturaValida({
      assinatura,
      csrf: token,
      envelopeHash: hashCorpo,
      fluxo: fluxoEsperado,
      rota: rotaEsperada,
      sinalCliente: sinalClienteCabecalho,
      tempo: tempoAssinatura
    })
  ) {
    await registrarEventoSeguranca("envelope_invalido", null, contextoAtual);
    resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Envelope de segurança inválido."
    });
    return null;
  }

  const nonceHash = indiceSeguro(`envelope-v3:${contextoAtual}:${fluxoEsperado}:${rotaEsperada}:${nonce}:${idempotencia}:${sequencia}`);
  const envelopeNovo = await registrarEnvelopeUnico({
    nonceHash,
    contextoHash: contextoAtual,
    fluxo: fluxoEsperado,
    rota: rotaEsperada
  });

  if (!envelopeNovo) {
    await registrarEventoSeguranca("envelope_repetido", null, contextoAtual);
    resposta.code(409).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Requisição já processada."
    });
    return null;
  }

  if (!possuiSomenteCampos(corpo, camposPermitidos)) {
    await registrarEventoSeguranca("envelope_invalido", null, contextoAtual);
    resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Envelope de segurança inválido."
    });
    return null;
  }

  Object.defineProperty(corpo, "__metadadosEnvelope", {
    configurable: false,
    enumerable: false,
    value: {
      idempotencia
    },
    writable: false
  });

  return corpo;
};

const metadadosEnvelopeSeguro = (corpo: unknown) =>
  (corpo as CorpoEnvelopeComMetadados | null | undefined)?.__metadadosEnvelope ?? null;

const validarCsrfRequisicao = async (
  requisicao: FastifyRequest,
  resposta: FastifyReply,
  opcoes: { exigirCookie?: boolean } = {}
) => {
  const tokenCabecalho = requisicao.headers[cabecalhoCsrf];
  const tokenCookie = lerCookie(requisicao.headers.cookie, cookiesNetCat.csrf);
  const token = typeof tokenCabecalho === "string" ? tokenCabecalho : "";
  const contextoAtual = contextoRequisicao(requisicao);
  const cookieObrigatorio = opcoes.exigirCookie === true;
  const cookiePresente = Boolean(tokenCookie);
  const cookieCoerente = !cookiePresente || token === tokenCookie;

  if (!token || (cookieObrigatorio && !cookiePresente) || !cookieCoerente || !validarCsrf(token, contextoAtual)) {
    await registrarEventoSeguranca("csrf_recusado", null, contextoAtual);
    resposta.code(403).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Validação de segurança expirada."
    });
    return false;
  }

  if (!cookiePresente) {
    await registrarEventoSeguranca("csrf_cookie_ausente_envelope", null, contextoAtual);
  }

  return true;
};

const criarReferenciaPublica = () => `NCB-${new Date().getFullYear()}-${gerarTokenSeguro(6).toUpperCase()}`;

const aguardar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

const atrasarFalhaAutenticacao = () => aguardar(320 + Math.floor(Math.random() * 220));

const serializarCookiesCompartilhados = (nome: string, valor: string, segundos: number) =>
  opcoesCookiesSessao.length > 0
    ? opcoesCookiesSessao.map((opcoes) => serializarCookie(nome, valor, segundos, opcoes))
    : [serializarCookie(nome, valor, segundos)];

const apagarCookiesCompartilhados = (nome: string) => [
  apagarCookie(nome),
  ...opcoesCookiesSessao.map((opcoes) => apagarCookie(nome, opcoes))
];

const criarCookieSessaoCliente = async (
  contaId: string,
  requisicao: FastifyRequest
) => {
  const tokenSessao = gerarTokenSeguro();
  await criarSessaoCliente({
    tokenHash: hashToken(tokenSessao),
    contaId,
    contextoHash: contextoRequisicao(requisicao),
    contextoRedeHash: contextoRedeRequisicao(requisicao),
    agenteHash: agenteHashRequisicao(requisicao),
    sinalClienteHash: sinalClienteHashRequisicao(requisicao)
  });
  return serializarCookiesCompartilhados(cookiesNetCat.sessao, tokenSessao, 60 * 60 * 2);
};

const cookiesLimpezaSessaoCliente = () =>
  [
    ...apagarCookiesCompartilhados(cookiesNetCat.sessao),
    ...apagarCookiesCompartilhados(cookiesNetCat.login2fa)
  ];

const criarCookieDesafio2fa = async (contaId: string, requisicao: FastifyRequest) => {
  const tokenDesafio = gerarTokenSeguro();
  await criarDesafioLogin2fa({
    tokenHash: hashToken(tokenDesafio),
    contaId,
    contextoHash: contextoRequisicao(requisicao),
    contextoRedeHash: contextoRedeRequisicao(requisicao),
    agenteHash: agenteHashRequisicao(requisicao),
    sinalClienteHash: sinalClienteHashRequisicao(requisicao)
  });

  return serializarCookiesCompartilhados(cookiesNetCat.login2fa, tokenDesafio, 4 * 60);
};

const responderSessaoNaoAutenticada = (resposta: FastifyReply) =>
  resposta
    .code(401)
    .header("Cache-Control", "no-store")
    .header("Set-Cookie", cookiesLimpezaSessaoCliente())
    .send({
      estado: "erro",
      mensagem: "Sessão não autenticada."
    });

const obterSessaoPainelAutorizada = async (requisicao: FastifyRequest, resposta: FastifyReply) => {
  const tokensSessao = lerCookies(requisicao.headers.cookie, cookiesNetCat.sessao);
  const contextoAtual = contextoRequisicao(requisicao);
  const contextoRedeAtual = contextoRedeRequisicao(requisicao);
  const agenteHashAtual = agenteHashRequisicao(requisicao);
  const sinalClienteHashAtual = sinalClienteHashRequisicao(requisicao);
  let encontrouSessao = false;

  for (const tokenSessao of tokensSessao) {
    const sessao = await buscarSessaoCliente(hashToken(tokenSessao));
    if (!sessao) continue;
    encontrouSessao = true;

    if (sessao.contexto_rede_hash === contextoRedeAtual && sessao.agente_hash === agenteHashAtual) {
      if (sessao.contexto_hash !== contextoAtual || sessao.sinal_cliente_hash !== sinalClienteHashAtual) {
        await atualizarSinalSessaoCliente(hashToken(tokenSessao), contextoAtual, sinalClienteHashAtual);
        await registrarEventoSeguranca("sessao_sinal_cliente_atualizado", sessao.referencia_publica, contextoAtual);
      } else {
        await tocarSessaoCliente(hashToken(tokenSessao));
      }
      return sessao;
    }
  }

  if (!encontrouSessao) {
    await registrarEventoSeguranca(
      "sessao_inexistente",
      null,
      contextoAtual
    );
    responderSessaoNaoAutenticada(resposta);
    return null;
  }

  await registrarEventoSeguranca("sessao_contexto_invalido", null, contextoAtual);
  responderSessaoNaoAutenticada(resposta);
  return null;
};

const normalizarCentavosSaldo = (valor: string | number) => {
  const numero = typeof valor === "number" ? valor : Number.parseInt(valor, 10);
  if (!Number.isSafeInteger(numero) || numero < 0) return null;
  return numero;
};

const normalizarInteiroSaldo = (valor: string | number) => {
  const numero = typeof valor === "number" ? valor : Number.parseInt(valor, 10);
  if (!Number.isSafeInteger(numero)) return null;
  return numero;
};

const formatarMoeda = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(centavos / 100);

const formatarTaxaMensalCredito = (basisPoints: number) =>
  basisPoints > 0 ? `${(basisPoints / 100).toFixed(2).replace(".", ",")}% a.m.` : "";

const dataIsoCurta = (data: Date) => data.toISOString().slice(0, 10);

const dataValidaIso = (valor: unknown): valor is string =>
  typeof valor === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
  !Number.isNaN(new Date(`${valor}T00:00:00.000Z`).getTime());

const normalizarPesquisaExtrato = (valor: unknown) => {
  if (typeof valor !== "string") return null;
  const normalizado = valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s._@-]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 80);

  return normalizado || null;
};

const adicionarDias = (data: Date, dias: number) => {
  const nova = new Date(data);
  nova.setUTCDate(nova.getUTCDate() + dias);
  return nova;
};

const primeiroDiaMesUtc = (data = new Date()) =>
  new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));

type BoletoBancarioValidado = {
  bancoCodigo: string;
  bancoNome: string;
  codigoBarras: string;
  linhaDigitavel: string;
  moeda: "BRL";
  referencia: string;
  valor: string;
  valorCentavos: number;
  vencimento: string | null;
  vencimentoTexto: string;
};

const valorMaximoPagamentoBoletoCentavos = 100_000_000;
const dataBaseFatorBoleto = new Date(Date.UTC(1997, 9, 7));
const dataBaseFatorBoletoNovoCiclo = new Date(Date.UTC(2025, 1, 22));

const bancosBoletoBrasil: Record<string, string> = {
  "001": "Banco do Brasil",
  "003": "Banco da Amazônia",
  "004": "Banco do Nordeste",
  "021": "Banestes",
  "033": "Santander",
  "041": "Banrisul",
  "070": "BRB",
  "077": "Banco Inter",
  "085": "Cooperativa Ailos",
  "104": "Caixa Econômica Federal",
  "136": "Unicred",
  "197": "Stone",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "218": "BS2",
  "237": "Bradesco",
  "260": "NU Bank",
  "290": "PagBank",
  "318": "Banco BMG",
  "323": "Mercado Pago",
  "336": "Banco C6",
  "341": "Itaú Unibanco",
  "380": "PicPay",
  "389": "Banco Mercantil",
  "422": "Banco Safra",
  "633": "Banco Rendimento",
  "655": "Banco Votorantim",
  "707": "Daycoval",
  "745": "Citibank",
  "748": "Sicredi",
  "756": "Sicoob"
};

const nomeBancoBoletoExibicao = (nome: string | null | undefined) => {
  const texto = (nome ?? "").normalize("NFKC").trim().replace(/\s{2,}/g, " ");
  const textoIndice = texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

  if (!texto) return "Banco emissor";
  if (textoIndice.includes("nu pagamentos") || textoIndice.includes("nubank") || textoIndice === "nu") {
    return "NU Bank";
  }

  return texto.slice(0, 80);
};

const hashCodigoBarrasBoleto = (codigoBarras: string) =>
  createHash("sha256").update(codigoBarras).digest("hex");

const digitoModulo10Febraban = (valor: string) => {
  let soma = 0;
  let peso = 2;

  for (let indice = valor.length - 1; indice >= 0; indice -= 1) {
    const produto = Number(valor[indice]) * peso;
    soma += produto > 9 ? Math.floor(produto / 10) + (produto % 10) : produto;
    peso = peso === 2 ? 1 : 2;
  }

  return (10 - (soma % 10)) % 10;
};

const digitoModulo11BoletoBancario = (valor: string) => {
  let soma = 0;
  let peso = 2;

  for (let indice = valor.length - 1; indice >= 0; indice -= 1) {
    soma += Number(valor[indice]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }

  const digito = 11 - (soma % 11);
  return digito === 0 || digito === 10 || digito === 11 ? 1 : digito;
};

const formatarLinhaDigitavelBoleto = (digitos: string) => {
  if (digitos.length !== 47) return digitos;
  return `${digitos.slice(0, 5)}.${digitos.slice(5, 10)} ${digitos.slice(10, 15)}.${digitos.slice(15, 21)} ${digitos.slice(21, 26)}.${digitos.slice(26, 32)} ${digitos.slice(32, 33)} ${digitos.slice(33)}`;
};

const linhaDigitavelDeCodigoBarrasBoleto = (codigoBarras: string) => {
  const campo1 = `${codigoBarras.slice(0, 4)}${codigoBarras.slice(19, 24)}`;
  const campo2 = codigoBarras.slice(24, 34);
  const campo3 = codigoBarras.slice(34, 44);

  return `${campo1}${digitoModulo10Febraban(campo1)}${campo2}${digitoModulo10Febraban(campo2)}${campo3}${digitoModulo10Febraban(campo3)}${codigoBarras[4]}${codigoBarras.slice(5, 19)}`;
};

const codigoBarrasDeLinhaDigitavelBoleto = (linha: string) =>
  `${linha.slice(0, 4)}${linha.slice(32, 33)}${linha.slice(33, 47)}${linha.slice(4, 9)}${linha.slice(10, 20)}${linha.slice(21, 31)}`;

const validarCodigoBarrasBoletoBancario = (codigoBarras: string) => {
  if (codigoBarras.length !== 44) return false;
  if (codigoBarras.startsWith("8")) return false;
  if (codigoBarras[3] !== "9") return false;
  const codigoSemDigito = `${codigoBarras.slice(0, 4)}${codigoBarras.slice(5)}`;
  return digitoModulo11BoletoBancario(codigoSemDigito) === Number(codigoBarras[4]);
};

const dataVencimentoBoleto = (codigoBarras: string) => {
  const fator = Number(codigoBarras.slice(5, 9));
  if (!Number.isSafeInteger(fator) || fator <= 0) return null;

  const vencimentoAntigo = adicionarDias(dataBaseFatorBoleto, fator);
  if (fator >= 1000 && Date.now() >= dataBaseFatorBoletoNovoCiclo.getTime() && vencimentoAntigo < dataBaseFatorBoletoNovoCiclo) {
    return adicionarDias(dataBaseFatorBoletoNovoCiclo, fator - 1000);
  }

  return vencimentoAntigo;
};

const validarBoletoBancario = (codigo: unknown): { boleto: BoletoBancarioValidado; ok: true } | { mensagem: string; ok: false } => {
  if (typeof codigo !== "string") {
    return { ok: false, mensagem: "Informe a linha digitável ou o código de barras do boleto." };
  }

  const texto = codigo.normalize("NFKC").trim();
  if (!texto || texto.length > 100 || /[^\d\s.-]/.test(texto)) {
    return { ok: false, mensagem: "Use apenas os números do boleto, com ou sem espaços." };
  }

  const digitos = somenteDigitos(texto);
  if (/^(\d)\1+$/.test(digitos)) {
    return { ok: false, mensagem: "Código de boleto inválido." };
  }
  if (digitos.startsWith("8")) {
    return { ok: false, mensagem: "Use um boleto bancário de 44 ou 47 dígitos. Convênios e arrecadações ainda não estão habilitados." };
  }
  if (digitos.length !== 44 && digitos.length !== 47) {
    return { ok: false, mensagem: "Informe uma linha digitável de 47 dígitos ou um código de barras de 44 dígitos." };
  }

  let codigoBarras = digitos;
  let linhaDigitavel = "";

  if (digitos.length === 47) {
    const campo1 = digitos.slice(0, 10);
    const campo2 = digitos.slice(10, 21);
    const campo3 = digitos.slice(21, 32);
    if (
      digitoModulo10Febraban(campo1.slice(0, 9)) !== Number(campo1[9]) ||
      digitoModulo10Febraban(campo2.slice(0, 10)) !== Number(campo2[10]) ||
      digitoModulo10Febraban(campo3.slice(0, 10)) !== Number(campo3[10])
    ) {
      return { ok: false, mensagem: "Os dígitos verificadores da linha digitável não conferem." };
    }

    codigoBarras = codigoBarrasDeLinhaDigitavelBoleto(digitos);
    linhaDigitavel = digitos;
  }

  if (!validarCodigoBarrasBoletoBancario(codigoBarras)) {
    return { ok: false, mensagem: "O dígito verificador geral do boleto não confere." };
  }

  if (!linhaDigitavel) {
    linhaDigitavel = linhaDigitavelDeCodigoBarrasBoleto(codigoBarras);
  }

  const valorCentavos = Number(codigoBarras.slice(9, 19));
  if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0 || valorCentavos > valorMaximoPagamentoBoletoCentavos) {
    return { ok: false, mensagem: "O valor do boleto está fora do limite permitido." };
  }

  const bancoCodigo = codigoBarras.slice(0, 3);
  const bancoNome = nomeBancoBoletoExibicao(bancosBoletoBrasil[bancoCodigo] ?? `Banco ${bancoCodigo}`);
  const vencimento = dataVencimentoBoleto(codigoBarras);
  const vencimentoIso = vencimento ? dataIsoCurta(vencimento) : null;
  const referencia = `PB-${createHash("sha256").update(codigoBarras).digest("hex").slice(0, 16).toUpperCase()}`;

  return {
    ok: true,
    boleto: {
      bancoCodigo,
      bancoNome,
      codigoBarras,
      linhaDigitavel: formatarLinhaDigitavelBoleto(linhaDigitavel),
      moeda: "BRL",
      referencia,
      valor: formatarMoeda(valorCentavos),
      valorCentavos,
      vencimento: vencimentoIso,
      vencimentoTexto: vencimento
        ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(vencimento)
        : "Sem vencimento informado"
    }
  };
};

const criarReferenciaPublicaPagamentoBoleto = () => `PB-${randomBytes(16).toString("hex").toUpperCase()}`;
const criarReferenciaPublicaRecargaCelular = () => `RC-${randomBytes(16).toString("hex").toUpperCase()}`;

const mascararCodigoBoleto = (valor: string) => {
  const digitos = somenteDigitos(valor);
  if (digitos.length <= 12) return digitos;
  return `${digitos.slice(0, 5)}...${digitos.slice(-6)}`;
};

type OperadoraRecargaCelular = "Algar" | "Claro" | "Sercomtel" | "TIM" | "Vivo";

type NumeroCelularBrasil = {
  ddd: string;
  e164: string;
  nacional: string;
  numero: string;
  telefone: string;
};

type RecargaCelularValidada = NumeroCelularBrasil & {
  moeda: "BRL";
  observacaoOperadora: string;
  operadora: OperadoraRecargaCelular;
  operadoraConfianca: "estimada";
  valorMaximo: string;
  valorMaximoCentavos: number;
  valorMinimo: string;
  valorMinimoCentavos: number;
  valoresSugeridosCentavos: number[];
};

const valorMinimoRecargaCelularCentavos = 1_500;
const valorMaximoRecargaCelularCentavos = 100_000;
const observacaoOperadoraRecarga =
  "Operadora estimada pelo DDD e prefixo. Números portados podem pertencer a outra prestadora.";
const valoresRecargaCelularPorOperadora: Record<OperadoraRecargaCelular, number[]> = {
  Algar: [1_500, 2_000, 3_000, 5_000],
  Claro: [1_500, 2_000, 3_000, 5_000, 10_000],
  Sercomtel: [1_500, 2_000, 3_000, 5_000],
  TIM: [1_500, 2_000, 3_000, 5_000, 10_000],
  Vivo: [1_500, 2_500, 3_500, 5_000, 10_000]
};
const dddsAlgarRecarga = new Set(["34", "35", "37"]);
const dddsSercomtelRecarga = new Set(["43"]);

const normalizarTelefoneCelularBrasil = (valor: unknown): NumeroCelularBrasil | null => {
  if (typeof valor !== "string") return null;
  const texto = valor.normalize("NFKC").trim();
  if (!texto || texto.length > 32 || /[a-z]/i.test(texto)) return null;

  let digitos = somenteDigitos(texto);
  if (digitos.length === 13 && digitos.startsWith("55")) digitos = digitos.slice(2);
  if (digitos.length !== 11 || /^(\d)\1+$/.test(digitos)) return null;

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  if (!dddsBrasileirosNex.has(ddd)) return null;
  if (!/^9\d{8}$/.test(numero)) return null;
  if (/^9(\d)\1{7}$/.test(numero)) return null;
  if (["912345678", "987654321", "901234567", "998765432"].includes(numero)) return null;

  return {
    ddd,
    e164: `+55${digitos}`,
    nacional: digitos,
    numero,
    telefone: formatarTelefoneNexSeguro(digitos)
  };
};

const resolverOperadoraRecargaCelular = (numero: NumeroCelularBrasil): OperadoraRecargaCelular => {
  const assinatura = Number(`${numero.ddd}${numero.numero.slice(1, 5)}`) % 10;
  if (dddsSercomtelRecarga.has(numero.ddd) && assinatura <= 2) return "Sercomtel";
  if (dddsAlgarRecarga.has(numero.ddd) && assinatura <= 2) return "Algar";
  if (assinatura <= 2) return "Vivo";
  if (assinatura <= 4) return "Claro";
  if (assinatura <= 7) return "TIM";
  return "Claro";
};

const validarRecargaCelular = (valor: unknown): { ok: true; recarga: RecargaCelularValidada } | { ok: false; mensagem: string } => {
  const numero = normalizarTelefoneCelularBrasil(valor);
  if (!numero) {
    return {
      ok: false,
      mensagem: "Informe um celular brasileiro válido com DDD."
    };
  }

  const operadora = resolverOperadoraRecargaCelular(numero);
  return {
    ok: true,
    recarga: {
      ...numero,
      moeda: "BRL",
      observacaoOperadora: observacaoOperadoraRecarga,
      operadora,
      operadoraConfianca: "estimada",
      valorMaximo: formatarMoeda(valorMaximoRecargaCelularCentavos),
      valorMaximoCentavos: valorMaximoRecargaCelularCentavos,
      valorMinimo: formatarMoeda(valorMinimoRecargaCelularCentavos),
      valorMinimoCentavos: valorMinimoRecargaCelularCentavos,
      valoresSugeridosCentavos: valoresRecargaCelularPorOperadora[operadora]
    }
  };
};

const mascararTelefoneRecarga = (numero: NumeroCelularBrasil) =>
  `(${numero.ddd}) ${numero.numero.slice(0, 1)}****-${numero.numero.slice(-4)}`;

const limitarPeriodoExtrato = (inicio: string, fim: string) => {
  const inicioData = new Date(`${inicio}T00:00:00.000Z`);
  const fimData = new Date(`${fim}T00:00:00.000Z`);
  const hoje = new Date();
  const hojeUtc = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  const maximoInicio = adicionarDias(fimData, -366);

  if (
    Number.isNaN(inicioData.getTime()) ||
    Number.isNaN(fimData.getTime()) ||
    inicioData > fimData ||
    fimData > hojeUtc ||
    inicioData < maximoInicio
  ) {
    return null;
  }

  return {
    inicio: dataIsoCurta(inicioData),
    fim: dataIsoCurta(fimData)
  };
};

const normalizarPeriodoExtrato = (corpo: CorpoTransacoesFinanceiras) => {
  const hoje = new Date();
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));

  if (dataValidaIso(corpo.inicio) && dataValidaIso(corpo.fim)) {
    return limitarPeriodoExtrato(corpo.inicio, corpo.fim);
  }

  if (corpo.periodo === "mes_atual") {
    return limitarPeriodoExtrato(dataIsoCurta(primeiroDiaMesUtc(hoje)), dataIsoCurta(fim));
  }

  if (corpo.periodo === "30d") {
    return limitarPeriodoExtrato(dataIsoCurta(adicionarDias(fim, -30)), dataIsoCurta(fim));
  }

  if (corpo.periodo === "90d" || corpo.periodo === undefined || corpo.periodo === null) {
    return limitarPeriodoExtrato(dataIsoCurta(adicionarDias(fim, -90)), dataIsoCurta(fim));
  }

  return null;
};

const normalizarFiltrosExtrato = (
  corpo: CorpoTransacoesFinanceiras,
  opcoes: { limiteMaximo: number }
): FiltrosMovimentosFinanceiros | null => {
  const periodo = normalizarPeriodoExtrato(corpo);
  if (!periodo) return null;

  const paginaRecebida = typeof corpo.pagina === "number" ? corpo.pagina : Number(corpo.pagina ?? 1);
  const limiteRecebido = typeof corpo.limite === "number" ? corpo.limite : Number(corpo.limite ?? 20);
  const pagina = Number.isSafeInteger(paginaRecebida) ? Math.max(1, Math.min(paginaRecebida, 1_000)) : 1;
  const limite = Number.isSafeInteger(limiteRecebido)
    ? Math.max(1, Math.min(limiteRecebido, opcoes.limiteMaximo))
    : 20;
  const ordenar =
    typeof corpo.ordenar === "string" && ordenacoesFinanceirasPermitidas.has(corpo.ordenar as OrdenacaoMovimentoFinanceiro)
      ? (corpo.ordenar as OrdenacaoMovimentoFinanceiro)
      : "recentes";
  const categoria =
    typeof corpo.categoria === "string" && categoriasFinanceirasPermitidas.has(corpo.categoria as CategoriaMovimentoFinanceiro)
      ? (corpo.categoria as CategoriaMovimentoFinanceiro)
      : null;
  const tipo =
    typeof corpo.tipo === "string" && tiposFinanceirosPermitidos.has(corpo.tipo as DirecaoMovimentoFinanceiro | "todos")
      ? (corpo.tipo as DirecaoMovimentoFinanceiro | "todos")
      : "todos";

  return {
    categoria,
    fim: periodo.fim,
    inicio: periodo.inicio,
    limite,
    ordenar,
    pagina,
    pesquisa: normalizarPesquisaExtrato(corpo.pesquisa),
    tipo
  };
};

const mesGraficoValido = (valor: unknown) => {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}$/.test(valor)) return null;
  const [anoTexto = "", mesTexto = ""] = valor.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const agora = new Date();
  const anoAtual = agora.getUTCFullYear();
  const mesAtual = agora.getUTCMonth() + 1;

  if (!Number.isSafeInteger(ano) || !Number.isSafeInteger(mes)) return null;
  if (ano !== anoAtual || mes < 1 || mes > mesAtual) return null;
  return valor;
};

const serializarMovimento = (movimento: MovimentoFinanceiroBanco) => {
  const valorCentavos = Number(movimento.valor_centavos);
  const contraparte =
    movimento.tipo === "pagamento"
      ? nomeBancoBoletoExibicao(movimento.contraparte)
      : movimento.contraparte;
  const instituicao =
    movimento.tipo === "pagamento"
      ? nomeBancoBoletoExibicao(movimento.contraparte)
      : movimento.tipo === "recarga"
        ? movimento.contraparte ?? "Operadora móvel"
        : "NC Bank";
  return {
    id: movimento.id,
    categoria: movimento.categoria,
    comprovanteTitulo: tituloComprovante(movimento),
    contraparte,
    data: movimento.efetivado_em.toISOString(),
    descricao: movimento.descricao,
    instituicao,
    status: movimento.status,
    tipo: movimento.direcao,
    tipoOperacao: movimento.tipo,
    valor: `${movimento.direcao === "entrada" ? "+" : "-"} ${formatarMoeda(valorCentavos)}`,
    valorCentavos
  };
};

const serializarContatoNex = (contato: ContatoNexBanco) => {
  const valorCentavos = Number(contato.valor_centavos);
  return {
    chaveSugestao: contato.chave_sugestao,
    direcaoUltima: contato.direcao_ultima,
    nome: formatarNomeNexSeguro(
      descriptografar(contato.nome_cifrado) ||
        descriptografar(contato.primeiro_nome_cifrado) ||
        "Cliente NC Bank"
    ),
    totalTransferencias: Number(contato.total_transferencias),
    ultimaEm: contato.ultima_em.toISOString(),
    valor: `${contato.direcao_ultima === "entrada" ? "+" : "-"} ${formatarMoeda(valorCentavos)}`,
    valorCentavos
  };
};

const mascararDocumentoComprovante = (documento: string, tipoDocumento: TipoDocumento) => {
  const digitos = somenteDigitos(documento);

  if (tipoDocumento === "cnpj" && digitos.length === 14) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/****-${digitos.slice(12)}`;
  }

  if (digitos.length === 11) {
    return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
  }

  return "CPF/CNPJ não disponível";
};

const formatarDocumentoNexExibicao = (documento: string, tipoDocumento: TipoDocumento) => {
  const digitos = somenteDigitos(documento);

  if (tipoDocumento === "cnpj" && digitos.length === 14) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
  }

  if (digitos.length === 11) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
  }

  return "CPF/CNPJ cadastrado da conta";
};

const mascararChaveNexComprovante = (valor: string | null | undefined) => {
  const texto = normalizarTextoComprovante(valor);
  if (!texto) return "Chave NC Bank";

  const minusculo = texto.toLocaleLowerCase("pt-BR");
  if (/^ncb-nex-[a-z0-9]{20,40}$/.test(minusculo)) {
    return `${minusculo.slice(0, 14)}...${minusculo.slice(-6)}`;
  }

  const digitos = somenteDigitos(texto);
  if (digitos.length === 11 && texto.includes("(")) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 3)}****-${digitos.slice(-4)}`;
  }

  return texto;
};

const tiposChaveNexPermitidos = new Set<TipoChaveNexBanco>(["aleatoria", "email", "telefone", "documento"]);

const tipoChaveNexSeguro = (valor: unknown): TipoChaveNexBanco | null =>
  typeof valor === "string" && tiposChaveNexPermitidos.has(valor as TipoChaveNexBanco)
    ? (valor as TipoChaveNexBanco)
    : null;

const indiceChaveNex = (valorNormalizado: string) =>
  createHmac("sha256", segredoNexIndice)
    .update(`netcatbank:nex:indice:v1:${valorNormalizado}`)
    .digest("hex");

const gerarChaveAleatoriaNexServidor = () => {
  const bruto = randomBytes(24)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 32);
  return `ncb-nex-${bruto}`;
};

const criarReferenciaPublicaNex = () => `NX-${randomBytes(16).toString("hex").toUpperCase()}`;
const criarReferenciaPublicaRecebimentoNex = () => `RQ-${randomBytes(16).toString("hex").toUpperCase()}`;
const criarReferenciaPublicaDoacaoMurzo = () => `DM-${randomBytes(16).toString("hex").toUpperCase()}`;
const gerarChaveRecebimentoNex = () =>
  `ncb-rcv-${randomBytes(22).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 30)}`;

type PayloadQrRecebimentoNex = {
  assinatura?: string;
  chaveDestino: string;
  chaveRecebimento: string;
  chaveTipo: TipoChaveNexBanco;
  descricao?: string;
  emissor: "NC Bank";
  expiraEm: string;
  referencia: string;
  tipo: "NCBANK_NEX_QR";
  valorCentavos?: number;
  versao: 1;
};

const assinaturaPayloadQrRecebimentoNex = (payload: Omit<PayloadQrRecebimentoNex, "assinatura">) =>
  createHmac("sha256", segredoNexIndice)
    .update(`netcatbank:nex:qr-recebimento:v1:${canonicalizarJsonSeguro(payload)}`)
    .digest("base64url");

const assinarPayloadQrRecebimentoNex = (payload: Omit<PayloadQrRecebimentoNex, "assinatura">) => ({
  ...payload,
  assinatura: assinaturaPayloadQrRecebimentoNex(payload)
});

const validarPayloadQrRecebimentoNex = (conteudo: unknown): PayloadQrRecebimentoNex | null => {
  if (typeof conteudo !== "string" || conteudo.length < 80 || conteudo.length > 2_500) return null;

  try {
    const bruto = JSON.parse(conteudo) as Partial<PayloadQrRecebimentoNex>;
    const assinaturaRecebida = typeof bruto.assinatura === "string" ? bruto.assinatura : "";
    const payloadSemAssinatura = {
      chaveDestino: typeof bruto.chaveDestino === "string" ? bruto.chaveDestino : "",
      chaveRecebimento: typeof bruto.chaveRecebimento === "string" ? bruto.chaveRecebimento : "",
      chaveTipo: bruto.chaveTipo as TipoChaveNexBanco,
      ...(typeof bruto.descricao === "string" && bruto.descricao ? { descricao: bruto.descricao.slice(0, 120) } : {}),
      emissor: bruto.emissor,
      expiraEm: typeof bruto.expiraEm === "string" ? bruto.expiraEm : "",
      referencia: typeof bruto.referencia === "string" ? bruto.referencia : "",
      tipo: bruto.tipo,
      ...(typeof bruto.valorCentavos === "number" ? { valorCentavos: bruto.valorCentavos } : {}),
      versao: bruto.versao
    } as Omit<PayloadQrRecebimentoNex, "assinatura">;

    if (
      payloadSemAssinatura.tipo !== "NCBANK_NEX_QR" ||
      payloadSemAssinatura.versao !== 1 ||
      payloadSemAssinatura.emissor !== "NC Bank" ||
      !/^RQ-[A-Z0-9]{16,40}$/.test(payloadSemAssinatura.referencia) ||
      !/^ncb-rcv-[a-z0-9]{20,40}$/.test(payloadSemAssinatura.chaveRecebimento) ||
      !tipoChaveNexSeguro(payloadSemAssinatura.chaveTipo) ||
      !normalizarChaveDestinoNex(payloadSemAssinatura.chaveDestino)
    ) {
      return null;
    }

    const expiraEm = new Date(payloadSemAssinatura.expiraEm);
    if (!Number.isFinite(expiraEm.getTime()) || expiraEm.getTime() < Date.now()) return null;

    if (
      payloadSemAssinatura.valorCentavos !== undefined &&
      (!Number.isSafeInteger(payloadSemAssinatura.valorCentavos) ||
        payloadSemAssinatura.valorCentavos < 0 ||
        payloadSemAssinatura.valorCentavos > 100_000_000)
    ) {
      return null;
    }

    const assinaturaEsperada = assinaturaPayloadQrRecebimentoNex(payloadSemAssinatura);
    const a = Buffer.from(assinaturaRecebida);
    const b = Buffer.from(assinaturaEsperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return {
      ...payloadSemAssinatura,
      assinatura: assinaturaRecebida
    };
  } catch {
    return null;
  }
};

const criarQrRecebimentoNexSvg = async (conteudo: string) =>
  QRCode.toString(conteudo, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: {
      dark: "#101218",
      light: "#ffffff"
    }
  });

const dddsBrasileirosNex = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99"
]);

const telefoneBrasileiroNexValido = (valor: string) => {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 10 && digitos.length !== 11) return false;
  if (/^(\d)\1+$/.test(digitos)) return false;

  const ddd = digitos.slice(0, 2);
  const local = digitos.slice(2);
  if (!dddsBrasileirosNex.has(ddd)) return false;

  if (digitos.length === 10) return /^[2-5]\d{7}$/.test(local);
  return /^9[6-9]\d{7}$/.test(local);
};

const formatarTelefoneNexSeguro = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 11);
  if (digitos.length === 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  if (digitos.length === 11) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  return digitos;
};

const mascararEmailNex = (email: string) => {
  const [usuario = "", dominio = ""] = email.split("@");
  if (!usuario || !dominio) return "E-mail cadastrado";
  const inicio = usuario.slice(0, 2);
  const fim = usuario.length > 4 ? usuario.slice(-1) : "";
  return `${inicio}${"*".repeat(Math.max(3, usuario.length - inicio.length - fim.length))}${fim}@${dominio}`;
};

const normalizarDescricaoNex = (valor: unknown) =>
  typeof valor === "string"
    ? valor
        .normalize("NFKC")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 120)
    : "";

const normalizarDataAgendamentoNex = (valor: unknown) => {
  if (typeof valor !== "string" || valor.length > 40) return null;
  const data = new Date(valor);
  const agora = Date.now();
  if (!Number.isFinite(data.getTime())) return null;
  if (data.getTime() < agora + 60_000) return null;
  if (data.getTime() > agora + 370 * 24 * 60 * 60 * 1000) return null;
  return data;
};

const serializarChaveNex = (
  chave: ChaveNexBanco,
  sessao?: Pick<ContaBanco, "documento_cifrado" | "tipo_documento">
) => ({
  criadaEm: chave.criada_em.toISOString(),
  estado: chave.estado,
  id: chave.id,
  tipo: chave.tipo,
  valor:
    chave.tipo === "documento" && sessao
      ? formatarDocumentoNexExibicao(descriptografar(sessao.documento_cifrado), sessao.tipo_documento)
      : chave.valor_exibicao,
  verificacaoPendente: chave.estado === "pendente_verificacao"
});

const formatarNomeNexSeguro = (nome: string) => {
  const partes = nome.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (partes.length === 0) return "Cliente NC Bank";
  if (partes.length === 1) return partes[0] ?? "Cliente NC Bank";
  const inicial = partes[1]?.charAt(0).toLocaleUpperCase("pt-BR") ?? "";
  return `${partes[0]} ${inicial}.`;
};

const serializarDestinatarioNex = (destinatario: DestinatarioNexBanco) => ({
  chave: destinatario.chave.valor_exibicao,
  chaveTipo: destinatario.chave.tipo,
  documento: mascararDocumentoComprovante(
    descriptografar(destinatario.conta.documento_cifrado),
    destinatario.conta.tipo_documento
  ),
  instituicao: "NC Bank",
  nome: formatarNomeNexSeguro(
    descriptografar(destinatario.conta.nome_cifrado) ||
      descriptografar(destinatario.conta.primeiro_nome_cifrado) ||
      "Cliente NC Bank"
  )
});

const serializarTransferenciaNex = (
  transferencia: TransferenciaNexBanco | TransferenciaNexComMovimentoBanco,
  destinatario?: DestinatarioNexBanco | null
) => ({
  destinatario: destinatario ? serializarDestinatarioNex(destinatario) : undefined,
  estado: transferencia.estado,
  expiraEm: transferencia.expira_em.toISOString(),
  id: transferencia.id,
  referencia: transferencia.referencia_publica,
  transacaoId: "movimento_origem_id" in transferencia ? transferencia.movimento_origem_id ?? undefined : undefined,
  valor: formatarMoeda(Number(transferencia.valor_centavos)),
  valorCentavos: Number(transferencia.valor_centavos)
});

const serializarAgendamentoNex = (
  agendamento: AgendamentoFinanceiroBanco,
  destinatario?: DestinatarioNexBanco | null
) => ({
  agendadoPara: agendamento.agendado_para.toISOString(),
  destinatario: destinatario ? serializarDestinatarioNex(destinatario) : undefined,
  estado: agendamento.status,
  id: agendamento.id,
  referencia: agendamento.referencia_publica ?? undefined,
  valor: formatarMoeda(Number(agendamento.valor_centavos)),
  valorCentavos: Number(agendamento.valor_centavos)
});

const prepararValorChaveNex = (
  tipo: TipoChaveNexBanco,
  valorInformado: unknown,
  sessao: NonNullable<Awaited<ReturnType<typeof obterSessaoPainelAutorizada>>>
): {
  estado: EstadoChaveNexBanco;
  valorCifrado: string;
  valorExibicao: string;
  valorIndiceHmac: string;
  valorNormalizado: string;
} | null => {
  let valorNormalizado = "";
  let valorExibicao = "";
  let estado: EstadoChaveNexBanco = "ativa";

  if (tipo === "aleatoria") {
    valorNormalizado = gerarChaveAleatoriaNexServidor();
    valorExibicao = valorNormalizado;
  }

  if (tipo === "documento") {
    const documento = somenteDigitos(descriptografar(sessao.documento_cifrado));
    if (!validarDocumento(sessao.tipo_documento, documento)) return null;
    valorNormalizado = `${sessao.tipo_documento}:${documento}`;
    valorExibicao = formatarDocumentoNexExibicao(documento, sessao.tipo_documento);
  }

  if (tipo === "email") {
    const emailConta = normalizarEmail(descriptografar(sessao.email_cifrado));
    const emailInformado = normalizarEmail(typeof valorInformado === "string" ? valorInformado : "");
    if (!validarEmail(emailInformado) || emailInformado !== emailConta) return null;
    valorNormalizado = `email:${emailConta}`;
    valorExibicao = mascararEmailNex(emailConta);
  }

  if (tipo === "telefone") {
    const telefone = somenteDigitos(typeof valorInformado === "string" ? valorInformado : "");
    if (!telefoneBrasileiroNexValido(telefone)) return null;
    valorNormalizado = `telefone:55${telefone}`;
    valorExibicao = formatarTelefoneNexSeguro(telefone);
    estado = "pendente_verificacao";
  }

  if (!valorNormalizado || !valorExibicao) return null;

  return {
    estado,
    valorCifrado: criptografar(valorNormalizado),
    valorExibicao,
    valorIndiceHmac: indiceChaveNex(valorNormalizado),
    valorNormalizado
  };
};

const normalizarChaveDestinoNex = (valor: unknown) => {
  const texto = typeof valor === "string" ? valor.normalize("NFKC").trim().slice(0, 160) : "";
  if (!texto) return null;

  const minusculo = texto.toLowerCase().replace(/\s/g, "");
  if (/^ncb-nex-[a-z0-9]{20,40}$/.test(minusculo)) return minusculo;

  const email = normalizarEmail(texto);
  if (validarEmail(email)) return `email:${email}`;

  const digitos = somenteDigitos(texto);
  if (digitos.length === 11 && validarDocumento("cpf", digitos)) return `cpf:${digitos}`;
  if (digitos.length === 14 && validarDocumento("cnpj", digitos)) return `cnpj:${digitos}`;
  if (telefoneBrasileiroNexValido(digitos)) return `telefone:55${digitos}`;

  return null;
};

const tituloComprovante = (movimento: MovimentoFinanceiroBanco) => {
  if (movimento.tipo === "bonus") return "Bônus recebido";
  if (movimento.tipo === "doacao") return "Doação enviada";
  if (movimento.tipo === "recarga") return "Recarga realizada";
  if (movimento.tipo === "pagamento") return "Pagamento realizado";
  if (movimento.direcao === "entrada") return "Transferência recebida";
  return "Transferência enviada";
};

const participanteBanco: ParticipanteComprovante = {
  chave: "Crédito interno NC Bank",
  documento: "Instituição financeira",
  instituicao: "NC Bank",
  nome: "NC Bank"
};

const documentoInstitutoMurzo = "47.683.291/0001-08";
const documentoInstitutoMurzoMascarado = mascararDocumentoComprovante(documentoInstitutoMurzo, "cnpj");

const participanteInstitutoMurzo: ParticipanteComprovante = {
  chave: "Doações sociais NC Bank",
  documento: documentoInstitutoMurzoMascarado,
  instituicao: "NC Bank",
  nome: "Instituto Murzo"
};

const linhaMascaradaRecargaMovimento = (movimento: MovimentoFinanceiroBanco) =>
  movimento.descricao.match(/\(\d{2}\)\s9\*{4}-\d{4}/)?.[0] ?? "Número de celular validado";

const participanteExterno = (movimento: MovimentoFinanceiroBanco): ParticipanteComprovante => ({
  chave:
    movimento.tipo === "doacao"
      ? participanteInstitutoMurzo.chave
      : movimento.tipo === "nex"
        ? "Conta NC Bank"
        : movimento.tipo === "recarga"
          ? linhaMascaradaRecargaMovimento(movimento)
        : movimento.tipo === "pagamento"
          ? "Boleto bancário liquidado"
          : "Dados da contraparte",
  documento:
    movimento.tipo === "doacao"
      ? participanteInstitutoMurzo.documento
      : movimento.tipo === "nex"
        ? "CPF/CNPJ não disponível"
        : movimento.tipo === "recarga"
          ? "Linha pré-paga"
        : movimento.tipo === "pagamento"
          ? "Dados protegidos do beneficiário"
          : "CPF/CNPJ da contraparte",
  instituicao:
    movimento.tipo === "pagamento"
      ? nomeBancoBoletoExibicao(movimento.contraparte)
      : movimento.tipo === "recarga"
        ? movimento.contraparte ?? "Operadora móvel"
      : movimento.tipo === "bonus" ||
          movimento.tipo === "sistema" ||
          movimento.tipo === "nex" ||
          movimento.tipo === "doacao"
        ? "NC Bank"
        : "Instituição externa",
  nome:
    movimento.tipo === "doacao"
      ? participanteInstitutoMurzo.nome
      : movimento.tipo === "pagamento"
        ? "Beneficiário do boleto"
        : movimento.tipo === "recarga"
          ? movimento.contraparte ?? "Operadora móvel"
        : movimento.contraparte ??
        (movimento.tipo === "bonus" || movimento.tipo === "sistema" || movimento.tipo === "nex"
          ? "NC Bank"
          : "Contraparte")
});

const participanteCliente = (
  sessao: NonNullable<Awaited<ReturnType<typeof obterSessaoPainelAutorizada>>>
): ParticipanteComprovante => ({
  chave: "Conta NC Bank",
  documento: mascararDocumentoComprovante(descriptografar(sessao.documento_cifrado), sessao.tipo_documento),
  instituicao: "NC Bank",
  nome: descriptografar(sessao.nome_cifrado) || "Cliente NC Bank"
});

const participanteComprovanteContaNex = (
  entrada: {
    chave: string | null;
    documentoCifrado: string;
    nomeCifrado: string;
    primeiroNomeCifrado: string;
    tipoDocumento: TipoDocumento;
  }
): ParticipanteComprovante => ({
  chave: mascararChaveNexComprovante(entrada.chave),
  documento: mascararDocumentoComprovante(descriptografar(entrada.documentoCifrado), entrada.tipoDocumento),
  instituicao: "NC Bank",
  nome:
    descriptografar(entrada.nomeCifrado) ||
    descriptografar(entrada.primeiroNomeCifrado) ||
    "Cliente NC Bank"
});

const participantesComprovanteNex = (
  participantes: ParticipantesTransferenciaNexBanco | null
) => {
  if (!participantes) return null;

  return {
    pagador: participanteComprovanteContaNex({
      chave: participantes.chave_origem_valor_exibicao,
      documentoCifrado: participantes.origem_documento_cifrado,
      nomeCifrado: participantes.origem_nome_cifrado,
      primeiroNomeCifrado: participantes.origem_primeiro_nome_cifrado,
      tipoDocumento: participantes.origem_tipo_documento
    }),
    recebedor: participanteComprovanteContaNex({
      chave: participantes.chave_destino_valor_exibicao,
      documentoCifrado: participantes.destino_documento_cifrado,
      nomeCifrado: participantes.destino_nome_cifrado,
      primeiroNomeCifrado: participantes.destino_primeiro_nome_cifrado,
      tipoDocumento: participantes.destino_tipo_documento
    }),
    referencia: participantes.referencia_publica
  };
};

type TransacaoDetalhadaSemVerificacao = Omit<TransacaoDetalhadaPublica, "verificacao">;

const criarSnapshotComprovante = (transacao: TransacaoDetalhadaSemVerificacao) => ({
  categoria: transacao.categoria,
  comprovanteTitulo: transacao.comprovanteTitulo,
  descricao: transacao.descricao,
  id: transacao.id,
  liquidadoEm: transacao.liquidadoEm,
  moeda: "BRL",
  pagador: transacao.pagador,
  recebedor: transacao.recebedor,
  referencia: transacao.referencia,
  status: transacao.status ?? "liquidado",
  tipo: transacao.tipo,
  tipoOperacao: transacao.tipoOperacao,
  valorCentavos: transacao.valorCentavos,
  versao: 1
});

const assinarComprovante = (transacao: TransacaoDetalhadaSemVerificacao): VerificacaoComprovante => {
  const snapshotCanonico = canonicalizarJsonSeguro(criarSnapshotComprovante(transacao));
  const assinatura = assinarEd25519(null, Buffer.from(snapshotCanonico, "utf8"), chavePrivadaComprovante);

  return {
    algoritmo: "Ed25519",
    assinatura: assinatura.toString("base64url"),
    chaveId: chaveIdComprovante,
    digest: hashTextoBase64url(snapshotCanonico),
    snapshotVersao: 1
  };
};

const serializarMovimentoDetalhado = async (
  movimento: MovimentoFinanceiroBanco,
  sessao: NonNullable<Awaited<ReturnType<typeof obterSessaoPainelAutorizada>>>
): Promise<TransacaoDetalhadaPublica> => {
  const movimentoSerializado = serializarMovimento(movimento);
  const cliente = participanteCliente(sessao);
  const externo = movimento.tipo === "bonus" || movimento.tipo === "sistema" ? participanteBanco : participanteExterno(movimento);
  const participantesNex =
    movimento.tipo === "nex"
      ? participantesComprovanteNex(await buscarParticipantesTransferenciaNexMovimento(sessao.id, movimento))
      : null;
  const recebedor = participantesNex?.recebedor ?? (movimento.direcao === "entrada" ? cliente : externo);
  const pagador = participantesNex?.pagador ?? (movimento.direcao === "entrada" ? externo : cliente);

  const transacao: TransacaoDetalhadaSemVerificacao = {
    ...movimentoSerializado,
    comprovanteTitulo: tituloComprovante(movimento),
    liquidadoEm: movimento.efetivado_em.toISOString(),
    pagador,
    recebedor,
    referencia: participantesNex?.referencia ?? `NC-${movimento.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    resumo:
      movimento.tipo === "bonus"
        ? movimento.descricao === "Bônus de boas-vindas"
          ? "Crédito promocional liberado após o primeiro cadastro."
          : "Crédito promocional liberado por indicação."
        : movimento.tipo === "doacao"
          ? "Doação liquidada para o Instituto Murzo por meio do ambiente financeiro NC Bank."
        : movimento.tipo === "pagamento"
          ? "Pagamento de boleto liquidado pelo ambiente financeiro NC Bank."
        : movimento.tipo === "recarga"
          ? "Recarga de celular liquidada pelo ambiente financeiro NC Bank."
        : "Movimento financeiro liquidado pelo NC Bank."
  };

  return {
    ...transacao,
    verificacao: assinarComprovante(transacao)
  };
};

const removerVerificacaoComprovante = (
  transacao: TransacaoDetalhadaPublica
): TransacaoDetalhadaSemVerificacao => {
  const { verificacao: _verificacao, ...semVerificacao } = transacao;
  return semVerificacao;
};

const mascararDocumentoInstitutoMurzoComprovante = (participante: ParticipanteComprovante): ParticipanteComprovante => {
  if (
    participante.nome === participanteInstitutoMurzo.nome &&
    somenteDigitos(participante.documento) === somenteDigitos(documentoInstitutoMurzo)
  ) {
    return {
      ...participante,
      documento: documentoInstitutoMurzoMascarado
    };
  }

  return participante;
};

const sanitizarTransacaoComprovantePublica = (
  transacao: TransacaoDetalhadaSemVerificacao
): TransacaoDetalhadaSemVerificacao => ({
  ...transacao,
  pagador: mascararDocumentoInstitutoMurzoComprovante(transacao.pagador),
  recebedor: mascararDocumentoInstitutoMurzoComprovante(transacao.recebedor)
});

const snapshotCanonicoComprovante = (transacao: TransacaoDetalhadaPublica) =>
  canonicalizarJsonSeguro(criarSnapshotComprovante(removerVerificacaoComprovante(transacao)));

const consolidarComprovantePersistido = async (
  contaId: string,
  transacao: TransacaoDetalhadaPublica
) => {
  const snapshotCanonico = snapshotCanonicoComprovante(transacao);
  const digest = hashTextoBase64url(snapshotCanonico);
  const existente = await buscarComprovanteTransacao(contaId, transacao.id);

  if (existente) {
    if (existente.snapshot_hash !== digest) {
      const snapshotPersistido = JSON.parse(descriptografar(existente.snapshot_cifrado)) as Partial<TransacaoDetalhadaSemVerificacao>;
      const transacaoPersistida = {
        ...removerVerificacaoComprovante(transacao),
        ...snapshotPersistido
      } as TransacaoDetalhadaSemVerificacao;
      const transacaoPublica = sanitizarTransacaoComprovantePublica(transacaoPersistida);
      const snapshotPersistidoCanonico = canonicalizarJsonSeguro(criarSnapshotComprovante(transacaoPersistida));
      const snapshotPublicoCanonico = canonicalizarJsonSeguro(criarSnapshotComprovante(transacaoPublica));
      const verificacao =
        snapshotPersistidoCanonico === snapshotPublicoCanonico
          ? {
              algoritmo: "Ed25519" as const,
              assinatura: existente.assinatura,
              chaveId: existente.chave_id,
              digest: existente.snapshot_hash,
              snapshotVersao: 1 as const
            }
          : assinarComprovante(transacaoPublica);

      return {
        ...transacao,
        ...transacaoPublica,
        verificacao
      };
    }

    return {
      ...transacao,
      verificacao: {
        algoritmo: "Ed25519" as const,
        assinatura: existente.assinatura,
        chaveId: existente.chave_id,
        digest: existente.snapshot_hash,
        snapshotVersao: 1 as const
      }
    };
  }

  const registrado = await registrarComprovanteTransacao({
    assinatura: transacao.verificacao.assinatura,
    chaveId: transacao.verificacao.chaveId,
    contaId,
    movimentoId: transacao.id,
    snapshotCifrado: criptografar(snapshotCanonico),
    snapshotHash: digest
  });

  if (registrado.snapshot_hash !== digest) {
    throw new Error("comprovante_snapshot_divergente");
  }

  return {
    ...transacao,
    verificacao: {
      algoritmo: "Ed25519" as const,
      assinatura: registrado.assinatura,
      chaveId: registrado.chave_id,
      digest: registrado.snapshot_hash,
      snapshotVersao: 1 as const
    }
  };
};

const protegerCampoCsv = (valor: string | number) => {
  const texto = String(valor).replace(/\r?\n/g, " ").trim();
  const protegido = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return `"${protegido.replace(/"/g, '""')}"`;
};

type TitularExtratoFinanceiro = {
  documento: string;
  email: string;
  instituicao: "NC Bank";
  nome: string;
  produto: string;
  referencia: string;
};

const titularExtratoFinanceiro = (sessao: ContaBanco): TitularExtratoFinanceiro => {
  const nome = normalizarTextoDownload(descriptografar(sessao.nome_cifrado)).slice(0, 120) || "Cliente NC Bank";
  const email = normalizarEmail(descriptografar(sessao.email_cifrado)) || "E-mail cadastrado";
  const documentoBruto = descriptografar(sessao.documento_cifrado);
  const documento = formatarDocumentoNexExibicao(documentoBruto, sessao.tipo_documento);

  return {
    documento: documento || "Documento cadastrado",
    email,
    instituicao: "NC Bank",
    nome,
    produto: sessao.produto === "credito-conta" ? "Conta digital com analise de credito" : "Conta digital",
    referencia: sessao.referencia_publica
  };
};

const gerarCsvExtrato = (
  movimentos: MovimentoFinanceiroBanco[],
  titular: TitularExtratoFinanceiro,
  titulo: string
) => {
  const linhas = [
    ["Instituicao", titular.instituicao].map(protegerCampoCsv).join(","),
    ["Titular", titular.nome].map(protegerCampoCsv).join(","),
    ["CPF/CNPJ", titular.documento].map(protegerCampoCsv).join(","),
    ["E-mail", titular.email].map(protegerCampoCsv).join(","),
    ["Conta", titular.referencia].map(protegerCampoCsv).join(","),
    ["Produto", titular.produto].map(protegerCampoCsv).join(","),
    ["Periodo", titulo].map(protegerCampoCsv).join(","),
    ["Gerado em", new Date().toISOString()].map(protegerCampoCsv).join(","),
    "",
    ["ID", "Data", "Descricao", "Contraparte", "Instituicao", "Categoria", "Tipo", "Operacao", "Status", "Valor"]
      .map(protegerCampoCsv)
      .join(",")
  ];

  for (const movimento of movimentos) {
    const valorCentavos = Number(movimento.valor_centavos);
    linhas.push(
      [
        movimento.id,
        movimento.efetivado_em.toISOString(),
        movimento.descricao,
        movimento.contraparte ?? "NC Bank",
        serializarMovimento(movimento).instituicao,
        movimento.categoria,
        movimento.direcao,
        movimento.tipo,
        movimento.status,
        `${movimento.direcao === "entrada" ? "+" : "-"} ${formatarMoeda(valorCentavos)}`
      ].map(protegerCampoCsv).join(",")
    );
  }

  return `${linhas.join("\n")}\n`;
};

type FormatoDownloadExtrato = "csv" | "pdf" | "ofx";

const formatoDownloadExtratoValido = (valor: unknown): FormatoDownloadExtrato | null =>
  valor === undefined || valor === "csv" ? "csv" : valor === "pdf" || valor === "ofx" ? valor : null;

const normalizarTextoDownload = (valor: string | number | null | undefined) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escaparPdfTexto = (valor: string | number | null | undefined) =>
  normalizarTextoDownload(valor).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").slice(0, 110);

const escaparOfx = (valor: string | number | null | undefined) =>
  normalizarTextoDownload(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 120);

const dataOfx = (data: Date) =>
  data.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "000[-3:BRT]");

const valorDecimalOfx = (movimento: MovimentoFinanceiroBanco) => {
  const valor = Number(movimento.valor_centavos) / 100;
  const sinal = movimento.direcao === "entrada" ? 1 : -1;
  return (valor * sinal).toFixed(2);
};

const gerarOfxExtrato = (movimentos: MovimentoFinanceiroBanco[], titular: TitularExtratoFinanceiro, titulo: string) => {
  const datas = movimentos.map((movimento) => movimento.efetivado_em.getTime()).filter(Number.isFinite);
  const inicio = datas.length > 0 ? new Date(Math.min(...datas)) : new Date();
  const fim = datas.length > 0 ? new Date(Math.max(...datas)) : new Date();
  const transacoes = movimentos.map((movimento) => {
    const serializado = serializarMovimento(movimento);
    return `<STMTTRN>
<TRNTYPE>${movimento.direcao === "entrada" ? "CREDIT" : "DEBIT"}</TRNTYPE>
<DTPOSTED>${dataOfx(movimento.efetivado_em)}</DTPOSTED>
<TRNAMT>${valorDecimalOfx(movimento)}</TRNAMT>
<FITID>${escaparOfx(movimento.id)}</FITID>
<NAME>${escaparOfx(movimento.descricao)}</NAME>
<MEMO>${escaparOfx(`${serializado.instituicao} - ${movimento.contraparte ?? movimento.categoria}`)}</MEMO>
</STMTTRN>`;
  }).join("\n");

  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:UTF-8
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<DTSERVER>${dataOfx(new Date())}</DTSERVER>
<LANGUAGE>POR</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>${escaparOfx(randomBytes(12).toString("hex"))}</TRNUID>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>NETCATBANK</BANKID>
<ACCTID>${escaparOfx(titular.referencia)}</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<MKTGINFO>${escaparOfx(`Extrato NC Bank - ${titulo} - Titular: ${titular.nome} - CPF/CNPJ: ${titular.documento} - Email: ${titular.email}`)}</MKTGINFO>
<BANKTRANLIST>
<DTSTART>${dataOfx(inicio)}</DTSTART>
<DTEND>${dataOfx(fim)}</DTEND>
${transacoes}
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;
};

const montarPdfExtrato = (
  movimentos: MovimentoFinanceiroBanco[],
  titulo: string,
  titular: TitularExtratoFinanceiro
) => {
  const linhas = movimentos.map((movimento) => {
    const valorCentavos = Number(movimento.valor_centavos);
    const data = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo"
    }).format(movimento.efetivado_em);
    return {
      data,
      descricao: normalizarTextoDownload(movimento.descricao).slice(0, 36),
      tipo: movimento.direcao === "entrada" ? "Entrada" : "Saida",
      valor: `${movimento.direcao === "entrada" ? "+" : "-"} ${formatarMoeda(valorCentavos)}`
    };
  });
  const linhasPorPagina = 24;
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / linhasPorPagina));
  const objetos: Buffer[] = [];
  const adicionarObjeto = (conteudo: Buffer | string) => {
    objetos.push(typeof conteudo === "string" ? Buffer.from(conteudo, "ascii") : conteudo);
    return objetos.length;
  };
  const escapar = escaparPdfTexto;
  const conteudosPaginas: number[] = [];
  const objetosPaginas: number[] = [];

  adicionarObjeto("<< /Type /Catalog /Pages 2 0 R >>");
  adicionarObjeto("");

  for (let pagina = 0; pagina < totalPaginas; pagina += 1) {
    const inicio = pagina * linhasPorPagina;
    const itens = linhas.slice(inicio, inicio + linhasPorPagina);
    const comandos = [
      "BT",
      "/F1 18 Tf 48 792 Td (NC Bank) Tj",
      "/F1 11 Tf 0 -20 Td (Extrato financeiro) Tj",
      `/F1 9 Tf 0 -16 Td (${escapar(titulo)}) Tj`,
      `/F1 9 Tf 0 -16 Td (Titular: ${escapar(titular.nome)}) Tj`,
      `/F1 8 Tf 0 -14 Td (CPF/CNPJ: ${escapar(titular.documento)}  |  E-mail: ${escapar(titular.email)}) Tj`,
      `/F1 8 Tf 0 -14 Td (Conta: ${escapar(titular.referencia)}  |  Produto: ${escapar(titular.produto)}) Tj`,
      `/F1 8 Tf 432 36 Td (Pagina ${pagina + 1} de ${totalPaginas}) Tj`,
      "ET",
      "0.94 0.95 0.97 rg 44 666 508 24 re f",
      "BT /F1 8 Tf 52 674 Td (Data) Tj 92 0 Td (Descricao) Tj 258 0 Td (Tipo) Tj 70 0 Td (Valor) Tj ET"
    ];
    itens.forEach((item, indice) => {
      const y = 648 - indice * 21;
      comandos.push(
        "BT",
        `/F1 8 Tf 52 ${y} Td (${escapar(item.data)}) Tj`,
        `/F1 8 Tf 144 ${y} Td (${escapar(item.descricao)}) Tj`,
        `/F1 8 Tf 402 ${y} Td (${escapar(item.tipo)}) Tj`,
        `/F1 8 Tf 472 ${y} Td (${escapar(item.valor)}) Tj`,
        "ET",
        `0.88 0.89 0.92 RG 44 ${y - 8} 508 0 l S`
      );
    });
    if (itens.length === 0) {
      comandos.push("BT /F1 10 Tf 52 624 Td (Nenhuma transacao encontrada para os filtros selecionados.) Tj ET");
    }

    const conteudo = Buffer.from(`${comandos.join("\n")}\n`, "ascii");
    const conteudoObjeto = adicionarObjeto(
      Buffer.concat([
        Buffer.from(`<< /Length ${conteudo.length} >>\nstream\n`, "ascii"),
        conteudo,
        Buffer.from("endstream", "ascii")
      ])
    );
    const paginaObjeto = adicionarObjeto("");
    conteudosPaginas.push(conteudoObjeto);
    objetosPaginas.push(paginaObjeto);
  }

  const fonteObjeto = adicionarObjeto("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (let indice = 0; indice < objetosPaginas.length; indice += 1) {
    const numeroPagina = objetosPaginas[indice] ?? 0;
    const numeroConteudo = conteudosPaginas[indice] ?? 0;
    objetos[numeroPagina - 1] = Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fonteObjeto} 0 R >> >> /Contents ${numeroConteudo} 0 R >>`,
      "ascii"
    );
  }

  objetos[1] = Buffer.from(
    `<< /Type /Pages /Kids [${objetosPaginas.map((objeto) => `${objeto} 0 R`).join(" ")}] /Count ${objetosPaginas.length} >>`,
    "ascii"
  );

  const partes: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets: number[] = [0];
  for (let indice = 0; indice < objetos.length; indice += 1) {
    offsets.push(partes.reduce((total, parte) => total + parte.length, 0));
    partes.push(Buffer.from(`${indice + 1} 0 obj\n`, "ascii"));
    partes.push(objetos[indice] ?? Buffer.from("", "ascii"));
    partes.push(Buffer.from("\nendobj\n", "ascii"));
  }

  const inicioXref = partes.reduce((total, parte) => total + parte.length, 0);
  partes.push(Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`, "ascii"));
  for (const offset of offsets.slice(1)) {
    partes.push(Buffer.from(`${offset.toString().padStart(10, "0")} 00000 n \n`, "ascii"));
  }
  partes.push(
    Buffer.from(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`, "ascii")
  );

  return Buffer.concat(partes);
};

const normalizarTextoComprovante = (valor: string | number | null | undefined) =>
  String(valor ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escaparXml = (valor: string | number | null | undefined) =>
  normalizarTextoComprovante(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const dataHoraComprovante = (iso: string) => {
  const data = new Date(iso);
  return {
    data: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "full",
      timeZone: "America/Sao_Paulo"
    }).format(data),
    hora: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    }).format(data)
  };
};

const quebrarTextoComprovante = (texto: string, limite = 34, maxLinhas = 2) => {
  const palavras = normalizarTextoComprovante(texto).split(" ").filter(Boolean);
  const linhas: string[] = [];

  for (const palavra of palavras) {
    if (linhas.length === 0) {
      linhas.push(palavra.length > limite ? `${palavra.slice(0, limite - 1)}…` : palavra);
      continue;
    }

    const atual = linhas[linhas.length - 1] ?? "";
    const proxima = atual ? `${atual} ${palavra}` : palavra;

    if (proxima.length <= limite) {
      linhas[linhas.length - 1] = proxima;
      continue;
    }

    if (linhas.length >= maxLinhas) {
      const ultima = linhas[maxLinhas - 1] ?? "";
      linhas[maxLinhas - 1] = `${ultima.slice(0, Math.max(0, limite - 1)).trim()}…`;
      return linhas.slice(0, maxLinhas);
    }

    linhas.push(palavra.length > limite ? `${palavra.slice(0, limite - 1)}…` : palavra);
  }

  if (linhas.length > maxLinhas) {
    const cortadas = linhas.slice(0, maxLinhas);
    const ultima = cortadas[maxLinhas - 1] ?? "";
    cortadas[maxLinhas - 1] = `${ultima.slice(0, Math.max(0, limite - 1)).trim()}…`;
    return cortadas;
  }

  return linhas.length > 0 ? linhas : ["-"];
};

const textoSvg = ({
  ancora = "start",
  cor = "#101114",
  limite = 120,
  maxLinhas = 1,
  peso = 700,
  tamanho,
  texto,
  x,
  y
}: {
  ancora?: "start" | "middle" | "end";
  cor?: string;
  limite?: number;
  maxLinhas?: number;
  peso?: number;
  tamanho: number;
  texto: string;
  x: number;
  y: number;
}) => {
  const linhas = quebrarTextoComprovante(texto, limite, maxLinhas);
  const alturaLinha = Math.round(tamanho * 1.18);
  const tspans = linhas
    .map((linha, indice) => `<tspan x="${x}" dy="${indice === 0 ? 0 : alturaLinha}">${escaparXml(linha)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" fill="${cor}" font-family="sans-serif" font-size="${tamanho}" font-weight="${peso}" text-anchor="${ancora}">${tspans}</text>`;
};

const campoComprovanteSvg = ({
  limite = 36,
  rotulo,
  valor,
  x,
  y
}: {
  limite?: number;
  rotulo: string;
  valor: string;
  x: number;
  y: number;
}) => `
  ${textoSvg({ texto: rotulo, x, y, tamanho: 21, peso: 800, cor: "#858b98", limite: 28 })}
  ${textoSvg({ texto: valor, x, y: y + 36, tamanho: 27, peso: 850, cor: "#16191f", limite, maxLinhas: 2 })}
`;

const logoComprovanteSvg = () =>
  logoComprovanteDataUri
    ? `<image href="${logoComprovanteDataUri}" x="68" y="42" width="82" height="66" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="70" y="96" fill="#ff243c" font-family="sans-serif" font-size="58" font-weight="900">NB</text>`;

const secaoParticipanteSvg = (
  titulo: string,
  participante: ParticipanteComprovante,
  y: number,
  rotuloIdentificacao = "Chave"
) => `
  <rect x="70" y="${y}" width="940" height="286" rx="28" fill="#ffffff" stroke="#e5e8ee" stroke-width="2"/>
  ${textoSvg({ texto: titulo, x: 105, y: y + 52, tamanho: 35, peso: 900, cor: "#111318", limite: 30 })}
  ${campoComprovanteSvg({ rotulo: "Nome", valor: participante.nome, x: 105, y: y + 96, limite: 46 })}
  ${campoComprovanteSvg({ rotulo: "CPF/CNPJ", valor: participante.documento, x: 105, y: y + 188, limite: 24 })}
  ${campoComprovanteSvg({ rotulo: "Instituição", valor: participante.instituicao, x: 555, y: y + 188, limite: 30 })}
  ${campoComprovanteSvg({ rotulo: rotuloIdentificacao, valor: participante.chave, x: 555, y: y + 96, limite: 31 })}
`;

const gerarSvgComprovante = (transacao: TransacaoDetalhadaPublica) => {
  const { data, hora } = dataHoraComprovante(transacao.liquidadoEm);
  const valorLimpo = transacao.valor.replace(/^[+-]\s*/, "");
  const seloDigest = `${transacao.verificacao.digest.slice(0, 18)}...${transacao.verificacao.digest.slice(-10)}`;
  const seloAssinatura = `${transacao.verificacao.assinatura.slice(0, 18)}...${transacao.verificacao.assinatura.slice(-10)}`;
  const marcaDagua = `${transacao.referencia} · ${transacao.verificacao.digest.slice(0, 18)}`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1600" viewBox="0 0 1080 1600">
  <rect width="1080" height="1600" fill="#ffffff"/>
  <rect x="0" y="0" width="1080" height="270" fill="#fbfbfc"/>
  <path d="M0 0h1080v270H0z" fill="#fff"/>
  <text x="540" y="842" fill="#ff243c" font-family="sans-serif" font-size="82" font-weight="900" text-anchor="middle" opacity="0.045" transform="rotate(-30 540 842)">${escaparXml(`NC BANK · ${marcaDagua}`)}</text>
  ${logoComprovanteSvg()}
  ${textoSvg({ texto: "NC Bank", x: 160, y: 84, tamanho: 33, peso: 900, cor: "#14161a", limite: 20 })}
  ${textoSvg({ texto: "Comprovante de transação", x: 160, y: 122, tamanho: 19, peso: 800, cor: "#7b818d", limite: 40 })}
  <circle cx="540" cy="224" r="72" fill="#18b967"/>
  <path d="M502 224l28 29 58-66" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  ${textoSvg({ texto: transacao.comprovanteTitulo, x: 540, y: 346, tamanho: 58, peso: 900, cor: "#101114", ancora: "middle", limite: 28 })}
  ${textoSvg({ texto: valorLimpo, x: 540, y: 430, tamanho: 72, peso: 900, cor: "#101114", ancora: "middle", limite: 22 })}

  <rect x="70" y="506" width="940" height="224" rx="28" fill="#ffffff" stroke="#e5e8ee" stroke-width="2"/>
  ${textoSvg({ texto: "Sobre a transação", x: 105, y: 560, tamanho: 35, peso: 900, cor: "#111318", limite: 32 })}
  ${campoComprovanteSvg({ rotulo: "Data", valor: data, x: 105, y: 610, limite: 45 })}
  ${campoComprovanteSvg({ rotulo: "Horário", valor: hora, x: 690, y: 610, limite: 12 })}
  ${campoComprovanteSvg({ rotulo: "ID da transação", valor: transacao.referencia, x: 105, y: 674, limite: 32 })}

  ${secaoParticipanteSvg(
    transacao.tipoOperacao === "pagamento"
      ? "Beneficiário do boleto"
      : transacao.tipoOperacao === "recarga"
        ? "Operadora"
        : "Quem recebeu",
    transacao.recebedor,
    758,
    transacao.tipoOperacao === "pagamento"
      ? "Identificação"
      : transacao.tipoOperacao === "recarga"
        ? "Linha"
        : "Chave"
  )}
  ${secaoParticipanteSvg(
    transacao.tipoOperacao === "pagamento" || transacao.tipoOperacao === "recarga" ? "Pagador" : "Quem pagou",
    transacao.pagador,
    1074,
    transacao.tipoOperacao === "pagamento" || transacao.tipoOperacao === "recarga" ? "Origem" : "Chave"
  )}

  <rect x="70" y="1378" width="940" height="148" rx="26" fill="#f4f6f8" stroke="#dde2e8"/>
  ${textoSvg({ texto: "Verificação criptográfica", x: 105, y: 1420, tamanho: 22, peso: 900, cor: "#14161a", limite: 42 })}
  ${textoSvg({ texto: `Chave ${transacao.verificacao.chaveId}`, x: 105, y: 1451, tamanho: 17, peso: 750, cor: "#565b66", limite: 72 })}
  ${textoSvg({ texto: `SHA-256 ${seloDigest}`, x: 105, y: 1479, tamanho: 16, peso: 700, cor: "#69707d", limite: 76 })}
  ${textoSvg({ texto: `Assinatura ${seloAssinatura}`, x: 105, y: 1507, tamanho: 15, peso: 700, cor: "#69707d", limite: 78 })}
  ${textoSvg({ texto: "Documento emitido pelo NC Bank.", x: 540, y: 1568, tamanho: 16, peso: 700, cor: "#8b919d", ancora: "middle", limite: 48 })}
</svg>`;
};

const gerarPngComprovante = async (transacao: TransacaoDetalhadaPublica) =>
  sharp(Buffer.from(gerarSvgComprovante(transacao)))
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();

const gerarJpegComprovante = async (transacao: TransacaoDetalhadaPublica) =>
  sharp(Buffer.from(gerarSvgComprovante(transacao)))
    .jpeg({ chromaSubsampling: "4:4:4", mozjpeg: true, quality: 94 })
    .toBuffer();

const montarPdfComImagem = (imagemJpeg: Buffer) => {
  const partes: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets: number[] = [0];
  const tamanhoAtual = () => partes.reduce((total, parte) => total + parte.length, 0);
  const adicionarObjeto = (conteudo: Buffer | string) => {
    const numero = offsets.length;
    offsets.push(tamanhoAtual());
    partes.push(Buffer.from(`${numero} 0 obj\n`, "ascii"));
    partes.push(typeof conteudo === "string" ? Buffer.from(conteudo, "ascii") : conteudo);
    partes.push(Buffer.from("\nendobj\n", "ascii"));
  };

  const conteudoPagina = Buffer.from("q\n540 0 0 800 0 0 cm\n/Im1 Do\nQ\n", "ascii");
  adicionarObjeto("<< /Type /Catalog /Pages 2 0 R >>");
  adicionarObjeto("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  adicionarObjeto(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 540 800] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>"
  );
  adicionarObjeto(
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width 1080 /Height 1600 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imagemJpeg.length} >>\nstream\n`,
        "ascii"
      ),
      imagemJpeg,
      Buffer.from("\nendstream", "ascii")
    ])
  );
  adicionarObjeto(
    Buffer.concat([
      Buffer.from(`<< /Length ${conteudoPagina.length} >>\nstream\n`, "ascii"),
      conteudoPagina,
      Buffer.from("endstream", "ascii")
    ])
  );

  const inicioXref = tamanhoAtual();
  partes.push(Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`, "ascii"));
  for (const offset of offsets.slice(1)) {
    partes.push(Buffer.from(`${offset.toString().padStart(10, "0")} 00000 n \n`, "ascii"));
  }
  partes.push(
    Buffer.from(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`, "ascii")
  );

  return Buffer.concat(partes);
};

const gerarPdfComprovante = async (transacao: TransacaoDetalhadaPublica) =>
  montarPdfComImagem(await gerarJpegComprovante(transacao));

const gerarComprovanteTransacao = async (
  transacao: TransacaoDetalhadaPublica,
  formato: "pdf" | "png"
) => (formato === "png" ? gerarPngComprovante(transacao) : gerarPdfComprovante(transacao));

const detalhesSegurancaRequisicao = (
  requisicao: FastifyRequest,
  contaId?: string | null
) => ({
  contaId: contaId ?? null,
  ipHash: indiceSeguro(`ip:${requisicao.ip.slice(0, 96)}`),
  requestId: String(requisicao.id ?? "").slice(0, 90),
  userAgentHash: agenteHashRequisicao(requisicao)
});

const registrarSaldoInicialConta = async (contaId: string, referenciaPublica: string) =>
  aplicarLancamentoLedgerSaldo({
    contaId,
    idempotenciaChave: `abertura:${referenciaPublica.toLowerCase()}`,
    tipo: "abertura",
    fase: "liquidacao",
    estado: "liquidado",
    deltaDisponivelCentavos: 0,
    deltaContabilCentavos: 0,
    moeda: "BRL",
    referenciaOrigem: `abertura:${referenciaPublica}`,
    metadadosCifrados: "",
    assinarLancamento: assinarLancamentoSaldo,
    assinarPartida: assinarPartidaDobradaSaldo,
    calcularMerkleRaiz: calcularMerkleRaizSaldo,
    assinarSaldo: assinarSaldoConta
  });

const normalizarSlugIndicacao = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "cliente";

const codigoIndicacaoValido = (valor: string) => /^[a-z0-9-]{8,96}$/i.test(valor);

const montarUrlIndicacao = (slug: string, codigo: string) => {
  const base = new URL(urlIndicacoesPublica);
  base.pathname = `/${slug}-${codigo}`;
  base.search = "";
  base.hash = "";
  return base.toString();
};

const detalhesIndicacao = (requisicao: FastifyRequest, contaId?: string | null) =>
  detalhesSegurancaRequisicao(requisicao, contaId);

const validarRateLimitIndicacao = (
  requisicao: FastifyRequest,
  resposta: FastifyReply,
  evento: string,
  referencia: string | null,
  maximo: number,
  janela = "1 minute"
) => {
  const executar = async () => {
    const total = await contarEventosSegurancaPorReferencia([evento], referencia, janela);
    if (total >= maximo) {
      await registrarEventoSeguranca(`${evento}_bloqueado`, referencia, contextoRequisicao(requisicao), detalhesIndicacao(requisicao));
      resposta.code(429).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Muitas tentativas em sequência."
      });
      return false;
    }

    await registrarEventoSeguranca(evento, referencia, contextoRequisicao(requisicao), detalhesIndicacao(requisicao));
    return true;
  };

  return executar();
};

const indicacaoRecebidaPodeIndicar = (
  indicacao: Awaited<ReturnType<typeof buscarIndicacaoRecebida>> | null,
  agora = Date.now()
) => {
  if (!indicacao) return true;
  if (indicacao.status !== "bonus_liquidado") return false;
  return agora - indicacao.atualizado_em.getTime() >= janelaSilenciosaIndicacaoRecebidaMs;
};

const obterStatusIndicacaoPainel = async (
  contaId: string,
  campanha: Awaited<ReturnType<typeof buscarCampanhaIndicacao>> | null,
  indicacaoLiberada: boolean
) => {
  if (!indicacaoLiberada) {
    return {
      disponivel: false,
      liquidadas: 0,
      status: "indisponivel" as const
    };
  }

  if (!campanha) {
    return {
      disponivel: true,
      liquidadas: 0,
      status: "ativa" as const
    };
  }

  if (campanha.status === "bloqueada") {
    return {
      disponivel: false,
      liquidadas: 0,
      status: "indisponivel" as const
    };
  }

  const liquidadas = await contarIndicacoesLiquidadasCampanha(contaId, campanha.inicio_em, campanha.expira_em);
  if (liquidadas >= limiteIndicacoesCampanha) {
    return {
      disponivel: true,
      liquidadas,
      status: "limite_atingido" as const
    };
  }

  if (campanha.status !== "ativa" || campanha.expira_em <= new Date()) {
    return {
      disponivel: false,
      liquidadas,
      status: "expirada" as const
    };
  }

  return {
    disponivel: true,
    liquidadas,
    status: "ativa" as const
  };
};

const liquidarBonusIndicacaoPendente = async (
  sessao: NonNullable<Awaited<ReturnType<typeof obterSessaoPainelAutorizada>>>,
  requisicao: FastifyRequest
) => {
  const indicacao = await buscarIndicacaoPendenteBonus(sessao.id);
  if (!indicacao) return null;

  if (indicacao.indicador_conta_id === sessao.id || indicacao.indicador_documento_indice === sessao.documento_indice) {
    await bloquearIndicacao(indicacao.id);
    await registrarEventoSeguranca("indicacao_autoindicacao_bloqueada", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesIndicacao(requisicao, sessao.id));
    return null;
  }

  const liquidadasSemana = await contarIndicacoesLiquidadas(indicacao.indicador_conta_id, "7 days");
  const liquidadasCampanha = await contarIndicacoesLiquidadas(indicacao.indicador_conta_id, "30 days");
  if (liquidadasSemana >= 5 || liquidadasCampanha >= 20) {
    await bloquearIndicacao(indicacao.id);
    await registrarEventoSeguranca("indicacao_limite_bloqueado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesIndicacao(requisicao, sessao.id));
    return null;
  }

  const idBase = indicacao.id.replace(/-/g, "").slice(0, 24).toLowerCase();
  const idempotenciaIndicado = `indicacao:boas-vindas:${idBase}`;
  const idempotenciaIndicador = `indicacao:amigo:${idBase}`;
  const referenciaOrigem = `indicacao:${idBase}`;

  await aplicarLancamentoLedgerSaldo({
    contaId: sessao.id,
    idempotenciaChave: idempotenciaIndicado,
    tipo: "credito_liquidado",
    fase: "liquidacao",
    estado: "liquidado",
    deltaDisponivelCentavos: 1_000,
    deltaContabilCentavos: 1_000,
    moeda: "BRL",
    referenciaOrigem,
    metadadosCifrados: criptografar(JSON.stringify({ origem: "bonus_boas_vindas_indicacao" })),
    assinarLancamento: assinarLancamentoSaldo,
    assinarPartida: assinarPartidaDobradaSaldo,
    calcularMerkleRaiz: calcularMerkleRaizSaldo,
    assinarSaldo: assinarSaldoConta
  });

  await aplicarLancamentoLedgerSaldo({
    contaId: indicacao.indicador_conta_id,
    idempotenciaChave: idempotenciaIndicador,
    tipo: "credito_liquidado",
    fase: "liquidacao",
    estado: "liquidado",
    deltaDisponivelCentavos: 2_500,
    deltaContabilCentavos: 2_500,
    moeda: "BRL",
    referenciaOrigem,
    metadadosCifrados: criptografar(JSON.stringify({ origem: "bonus_indicacao_amigo" })),
    assinarLancamento: assinarLancamentoSaldo,
    assinarPartida: assinarPartidaDobradaSaldo,
    calcularMerkleRaiz: calcularMerkleRaizSaldo,
    assinarSaldo: assinarSaldoConta
  });

  const lancamentoIndicado = await buscarLancamentoSaldoPorIdempotencia(sessao.id, idempotenciaIndicado);
  const lancamentoIndicador = await buscarLancamentoSaldoPorIdempotencia(indicacao.indicador_conta_id, idempotenciaIndicador);
  if (lancamentoIndicado) {
    await registrarMovimentoFinanceiroLedger({
      categoria: "bonus",
      contaId: sessao.id,
      contraparte: "NC Bank",
      descricao: "Bônus de boas-vindas",
      direcao: "entrada",
      ledgerId: lancamentoIndicado.id,
      tipo: "bonus",
      valorCentavos: 1_000
    });
  }
  if (lancamentoIndicador) {
    await registrarMovimentoFinanceiroLedger({
      categoria: "bonus",
      contaId: indicacao.indicador_conta_id,
      contraparte: "NC Bank",
      descricao: "Bônus por indicação",
      direcao: "entrada",
      ledgerId: lancamentoIndicador.id,
      tipo: "bonus",
      valorCentavos: 2_500
    });
  }

  await marcarIndicacaoBonusLiquidado({
    bonusIndicadorIdempotencia: idempotenciaIndicador,
    bonusIndicadoIdempotencia: idempotenciaIndicado,
    indicacaoId: indicacao.id
  });
  await registrarEventoSeguranca("indicacao_bonus_liquidado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesIndicacao(requisicao, sessao.id));
  return indicacao;
};

const processarAgendamentosNexVencidos = async (
  sessao: NonNullable<Awaited<ReturnType<typeof obterSessaoPainelAutorizada>>>,
  requisicao: FastifyRequest
) => {
  const vencidos = await buscarAgendamentosNexVencidosConta(sessao.id, 8);
  if (vencidos.length === 0) return;

  for (const agendamentoPendente of vencidos) {
    const agendamento = await marcarAgendamentoNexProcessando(sessao.id, agendamentoPendente.id);
    if (!agendamento) continue;

    const idBase = agendamento.id.replace(/-/g, "").slice(0, 24).toLowerCase();
    const idempotenciaPreparo = `nex_agenda:${idBase}:preparo`;
    const idempotenciaConfirmacao = `nex_agenda:${idBase}:confirmar`;
    const contextoHash = contextoRequisicao(requisicao);

    try {
      if (!agendamento.chave_destino_indice_hmac || !agendamento.destino_conta_id) {
        throw new Error("destino_indisponivel");
      }

      const contaDestino = await buscarContaPorId(agendamento.destino_conta_id);
      if (!contaDestino) throw new Error("destino_indisponivel");

      const transferencia = await prepararTransferenciaNex({
        chaveDestinoIndiceHmac: agendamento.chave_destino_indice_hmac,
        contaOrigemId: sessao.id,
        contextoHash,
        descricao: agendamento.descricao || "Transferência Nex agendada",
        idempotenciaChave: idempotenciaPreparo,
        referenciaPublica: agendamento.referencia_publica ?? criarReferenciaPublicaNex(),
        valorCentavos: Number(agendamento.valor_centavos)
      });

      await confirmarTransferenciaNex({
        assinarLancamento: assinarLancamentoSaldo,
        assinarPartida: assinarPartidaDobradaSaldo,
        assinarSaldo: assinarSaldoConta,
        calcularMerkleRaiz: calcularMerkleRaizSaldo,
        contaOrigemId: sessao.id,
        contextoHash,
        idempotenciaChave: idempotenciaConfirmacao,
        nomeDestino: descriptografar(contaDestino.nome_cifrado) || "Cliente NC Bank",
        nomeOrigem: descriptografar(sessao.nome_cifrado) || "Cliente NC Bank",
        transferenciaId: transferencia.id
      });

      await marcarAgendamentoNexProcessado({
        agendamentoId: agendamento.id,
        contaId: sessao.id,
        contextoHash,
        idempotenciaChave: `${idempotenciaConfirmacao}:ok`
      });
    } catch (erro) {
      const mensagemErro = erro instanceof Error ? erro.message : "";
      const motivo =
        mensagemErro === "saldo_insuficiente"
          ? "saldo_insuficiente"
          : mensagemErro.includes("destino") || mensagemErro.includes("indisponivel")
            ? "destino_indisponivel"
            : "falha_liquidacao";

      await falharAgendamentoNexConta({
        agendamentoId: agendamento.id,
        contaId: sessao.id,
        contextoHash,
        idempotenciaChave: `${idempotenciaConfirmacao}:falha`,
        motivo
      });
      await registrarEventoSeguranca("nex_agendamento_execucao_falhou", sessao.referencia_publica, contextoHash, {
        ...detalhesSegurancaRequisicao(requisicao, sessao.id),
        detalhesCifrados: criptografar(JSON.stringify({ agendamentoId: agendamento.id, motivo }))
      });
    }
  }
};

const validarLedgerSaldoConta = async (
  contaId: string,
  saldoDisponivelEsperado: number,
  saldoContabilEsperado: number,
  versaoEsperada: number
) => {
  const lancamentos = await buscarLancamentosSaldoConta(contaId);
  if (lancamentos.length === 0) return false;

  let saldoDisponivelCalculado = 0;
  let saldoContabilCalculado = 0;
  let hashAnterior = "GENESIS";
  let versaoCalculada = 0;

  for (const lancamento of lancamentos) {
    const deltaDisponivel = normalizarInteiroSaldo(lancamento.delta_disponivel_centavos);
    const deltaContabil = normalizarInteiroSaldo(lancamento.delta_contabil_centavos);
    const versaoLancamento = normalizarCentavosSaldo(lancamento.versao_saldo);

    if (
      deltaDisponivel === null ||
      deltaContabil === null ||
      versaoLancamento === null ||
      lancamento.moeda !== "BRL" ||
      lancamento.hash_anterior !== hashAnterior
    ) {
      return false;
    }

    const partidas = await buscarPartidasDobradasSaldoLancamento(lancamento.id);
    const hashesPartidas: string[] = [];
    let totalDebito = 0;
    let totalCredito = 0;

    for (const partida of partidas) {
      const ordem = normalizarCentavosSaldo(partida.ordem);
      const valorCentavos = normalizarCentavosSaldo(partida.valor_centavos);
      if (ordem === null || valorCentavos === null || partida.moeda !== "BRL") return false;

      const hashPartidaEsperado = assinarPartidaDobradaSaldo({
        contaId,
        idempotenciaChave: lancamento.idempotencia_chave,
        ordem,
        contaContabil: partida.conta_contabil,
        natureza: partida.natureza,
        valorCentavos,
        moeda: partida.moeda
      });

      if (!compararHashSeguro(hashPartidaEsperado, partida.hash_partida)) return false;
      hashesPartidas.push(partida.hash_partida);

      if (partida.natureza === "debito") totalDebito += valorCentavos;
      if (partida.natureza === "credito") totalCredito += valorCentavos;
    }

    if (totalDebito !== totalCredito) return false;
    const merkleRaizEsperada = calcularMerkleRaizSaldo(hashesPartidas);
    if (!compararHashSeguro(merkleRaizEsperada, lancamento.merkle_raiz)) return false;

    const hashEsperado = assinarLancamentoSaldo({
      contaId,
      idempotenciaChave: lancamento.idempotencia_chave,
      tipo: lancamento.tipo,
      fase: lancamento.fase,
      estado: lancamento.estado,
      deltaDisponivelCentavos: deltaDisponivel,
      deltaContabilCentavos: deltaContabil,
      moeda: lancamento.moeda,
      versaoSaldo: versaoLancamento,
      hashAnterior: lancamento.hash_anterior,
      merkleRaiz: lancamento.merkle_raiz,
      referenciaOrigem: lancamento.referencia_origem,
      metadadosCifrados: lancamento.metadados_cifrados
    });

    if (!compararHashSeguro(hashEsperado, lancamento.hash_encadeado)) return false;

    saldoDisponivelCalculado += deltaDisponivel;
    saldoContabilCalculado += deltaContabil;
    if (saldoDisponivelCalculado < 0 || saldoContabilCalculado < 0) return false;

    hashAnterior = lancamento.hash_encadeado;
    versaoCalculada = versaoLancamento;
  }

  return (
    saldoDisponivelCalculado === saldoDisponivelEsperado &&
    saldoContabilCalculado === saldoContabilEsperado &&
    versaoCalculada === versaoEsperada
  );
};

const obterSaldoPainelAutorizado = async (
  sessao: NonNullable<Awaited<ReturnType<typeof obterSessaoPainelAutorizada>>>,
  requisicao: FastifyRequest,
  resposta: FastifyReply
) => {
  let saldo = await buscarSaldoConta(sessao.id);
  const lancamentos = await buscarLancamentosSaldoConta(sessao.id);

  if (!saldo || lancamentos.length === 0) {
    try {
      saldo = await registrarSaldoInicialConta(sessao.id, sessao.referencia_publica);
    } catch {
      await registrarEventoSeguranca("saldo_inicializacao_recusada", sessao.referencia_publica, contextoRequisicao(requisicao));
      resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível validar o saldo da conta agora."
      });
      return null;
    }
  }

  const saldoDisponivelCentavos = saldo ? normalizarCentavosSaldo(saldo.saldo_disponivel_centavos) : null;
  const saldoTotalCentavos = saldo ? normalizarCentavosSaldo(saldo.saldo_total_centavos) : null;
  const saldoContabilCentavos = saldo ? normalizarCentavosSaldo(saldo.saldo_contabil_centavos) : null;
  const versao = saldo ? normalizarCentavosSaldo(saldo.versao) : null;
  const moeda = saldo?.moeda === "BRL" ? saldo.moeda : "";

  const assinaturaIntegra =
    saldo &&
    saldoDisponivelCentavos !== null &&
    saldoTotalCentavos !== null &&
    saldoContabilCentavos !== null &&
    versao !== null &&
    moeda === "BRL" &&
    saldoTotalCentavos === saldoContabilCentavos &&
    validarAssinaturaSaldoConta(
      {
        contaId: sessao.id,
        saldoDisponivelCentavos,
        saldoTotalCentavos,
        saldoContabilCentavos,
        moeda,
        versao
      },
      saldo.integridade_hash
    );

  const ledgerIntegro =
    assinaturaIntegra &&
    (await validarLedgerSaldoConta(
      sessao.id,
      saldoDisponivelCentavos,
      saldoContabilCentavos,
      versao
    ));

  if (!ledgerIntegro) {
    await registrarEventoSeguranca("saldo_integridade_invalida", sessao.referencia_publica, contextoRequisicao(requisicao));
    resposta.code(409).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível validar o saldo da conta agora."
    });
    return null;
  }

  return {
    moeda,
    saldoDisponivel: formatarMoeda(saldoDisponivelCentavos),
    saldoDisponivelCentavos,
    saldoTotal: formatarMoeda(saldoContabilCentavos),
    saldoTotalCentavos: saldoContabilCentavos,
    versao
  };
};

const saldoDisponivelCobreValor = async (
  sessao: NonNullable<Awaited<ReturnType<typeof obterSessaoPainelAutorizada>>>,
  requisicao: FastifyRequest,
  resposta: FastifyReply,
  valorCentavos: number
) => {
  const saldoPainel = await obterSaldoPainelAutorizado(sessao, requisicao, resposta);
  if (!saldoPainel) return null;
  return saldoPainel.saldoDisponivelCentavos >= valorCentavos;
};

const validarRateLimitFinanceiro = async (
  requisicao: FastifyRequest,
  resposta: FastifyReply,
  evento: string,
  sessao: NonNullable<Awaited<ReturnType<typeof obterSessaoPainelAutorizada>>>,
  limite: number,
  janela = "1 minute"
) => {
  const contextoAtual = contextoRequisicao(requisicao);
  const total = await contarEventosSegurancaRecentes([evento], contextoAtual, janela);

  if (total >= limite) {
    await registrarEventoSeguranca(`${evento}_bloqueado`, sessao.referencia_publica, contextoAtual, detalhesSegurancaRequisicao(requisicao, sessao.id));
    resposta.code(429).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Muitas verificações em sequência."
    });
    return false;
  }

  await registrarEventoSeguranca(evento, sessao.referencia_publica, contextoAtual, detalhesSegurancaRequisicao(requisicao, sessao.id));
  return true;
};

const textoCnpjSeguro = (valor: unknown, limite = 120) =>
  typeof valor === "string"
    ? valor
        .normalize("NFKC")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, limite)
    : "";

const formatarCnpjPublico = (valor: string) =>
  somenteDigitos(valor)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");

const formatarCepPublico = (valor: unknown) => {
  const cep = somenteDigitos(typeof valor === "string" || typeof valor === "number" ? String(valor) : "").slice(0, 8);
  return cep.length === 8 ? cep.replace(/^(\d{5})(\d{3})$/, "$1-$2") : "";
};

const formatarDataPublica = (valor: unknown) => {
  const texto = textoCnpjSeguro(valor, 10);
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : texto;
};

const formatarCapitalPublico = (valor: unknown) => {
  const numero = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(numero) || numero < 0) return "";
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(numero);
};

const normalizarDadosCnpj = (entrada: RespostaBrasilApiCnpj): DadosCnpjPublicos | null => {
  const cnpj = somenteDigitos(typeof entrada.cnpj === "string" ? entrada.cnpj : "").slice(0, 14);
  const razaoSocial = textoCnpjSeguro(entrada.razao_social, 160);
  if (!validarDocumento("cnpj", cnpj) || !razaoSocial) return null;

  const logradouro = textoCnpjSeguro(entrada.logradouro, 120);
  const numero = textoCnpjSeguro(entrada.numero, 20);
  const complemento = textoCnpjSeguro(entrada.complemento, 80);
  const endereco = [logradouro, numero, complemento].filter(Boolean).join(", ");
  const simples =
    entrada.opcao_pelo_simples === true
      ? "Optante pelo Simples"
      : entrada.opcao_pelo_simples === false
        ? "Não optante pelo Simples"
        : "";

  return {
    atividadePrincipal: textoCnpjSeguro(entrada.cnae_fiscal_descricao, 160),
    bairro: textoCnpjSeguro(entrada.bairro, 80),
    capitalSocial: formatarCapitalPublico(entrada.capital_social),
    cep: formatarCepPublico(entrada.cep),
    cidade: textoCnpjSeguro(entrada.municipio, 80),
    cnpj: formatarCnpjPublico(cnpj),
    dataAbertura: formatarDataPublica(entrada.data_inicio_atividade),
    endereco,
    matrizFilial: textoCnpjSeguro(entrada.descricao_identificador_matriz_filial, 40),
    naturezaJuridica: textoCnpjSeguro(entrada.natureza_juridica, 120),
    nomeFantasia: textoCnpjSeguro(entrada.nome_fantasia, 160),
    porte: textoCnpjSeguro(entrada.porte, 80),
    razaoSocial,
    simples,
    situacao: textoCnpjSeguro(entrada.descricao_situacao_cadastral, 80),
    uf: textoCnpjSeguro(entrada.uf, 2).toUpperCase()
  };
};

const buscarCnpjEmCache = async (cnpjIndice: string) => {
  const cache = await buscarConsultaCnpj(cnpjIndice);
  if (!cache) return null;

  try {
    return JSON.parse(descriptografar(cache.dados_cifrados)) as DadosCnpjPublicos;
  } catch {
    return null;
  }
};

const consultarCnpjFonteCadastral = async (cnpj: string) => {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 12_000);

  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "NCBank-Cadastro-Empresarial/1.0"
      },
      signal: controlador.signal
    });

    if (!resposta.ok) return null;
    const conteudo = (await resposta.json().catch(() => null)) as RespostaBrasilApiCnpj | null;
    return conteudo ? normalizarDadosCnpj(conteudo) : null;
  } finally {
    clearTimeout(timeout);
  }
};

const limparConsultaCnpjAgendada = (cnpjIndice: string) => {
  const temporizador = setTimeout(() => {
    consultasCnpjEmAndamento.delete(cnpjIndice);
  }, 5 * 60_000);
  temporizador.unref?.();
};

const agendarConsultaCnpj = (cnpj: string, cnpjIndice: string) => {
  const existente = consultasCnpjEmAndamento.get(cnpjIndice);
  const agora = Date.now();

  if (!existente && consultasCnpjEmAndamento.size >= 500) {
    return { estado: "adiado" as const, estimativaSegundos: 0 };
  }

  if (existente) {
    if (existente.estado === "adiado") return { estado: "adiado" as const, estimativaSegundos: 0 };
    if (agora - existente.iniciouEm > tempoMaximoEsperaCnpjMs) {
      existente.estado = "adiado";
      return { estado: "adiado" as const, estimativaSegundos: 0 };
    }
    return {
      estado: "pendente" as const,
      estimativaSegundos: Math.max(3, Math.ceil((existente.agendadaPara - agora) / 1000) + 8)
    };
  }

  const agendadaPara = Math.max(agora, proximaConsultaCnpjEm);
  if (agendadaPara - agora > tempoMaximoEsperaCnpjMs) {
    return { estado: "adiado" as const, estimativaSegundos: 0 };
  }
  proximaConsultaCnpjEm = agendadaPara + intervaloConsultaCnpjMs;
  consultasCnpjEmAndamento.set(cnpjIndice, {
    agendadaPara,
    estado: "pendente",
    iniciouEm: agora
  });

  const temporizador = setTimeout(async () => {
    const job = consultasCnpjEmAndamento.get(cnpjIndice);
    if (!job) return;

    try {
      const dados = await consultarCnpjFonteCadastral(cnpj);
      if (!dados) {
        job.estado = "adiado";
        return;
      }

      await salvarConsultaCnpj({
        cnpjCifrado: criptografar(cnpj),
        cnpjIndice,
        dadosCifrados: criptografar(JSON.stringify(dados))
      });
      job.estado = "ok";
    } catch {
      job.estado = "adiado";
    } finally {
      limparConsultaCnpjAgendada(cnpjIndice);
    }
  }, Math.max(0, agendadaPara - agora));
  temporizador.unref?.();

  return {
    estado: "pendente" as const,
    estimativaSegundos: Math.max(3, Math.ceil((agendadaPara - agora) / 1000) + 8)
  };
};

servidor.get("/", async () => ({
  banco: "NC Bank",
  mensagem: "Hello world"
}));

servidor.get("/saude", async () => ({
  estado: "ok",
  servico: "api-netcatbank"
}));

servidor.get("/seguranca/transporte", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "transporte-publico"))) {
    return resposta;
  }

  return resposta.header("Cache-Control", "no-store").send({
    estado: "ok",
    transporte: criarTransporteSeguro()
  });
});

servidor.get("/seguranca/csrf", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "csrf-publico"))) {
    return resposta;
  }

  const token = criarCsrf(contextoRequisicao(requisicao));
  return resposta
    .header("Cache-Control", "no-store")
    .header("Set-Cookie", serializarCookie(cookiesNetCat.csrf, token, 30 * 60))
    .send({
      estado: "ok",
      controle: {
        csrf: token,
        cabecalho: "X-NetCatBank-CSRF"
      }
    });
});

servidor.post(
  "/indicacoes/link",
  {
    config: {
      rateLimit: {
        max: 8,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "painel-cliente", "/indicacoes/link", []);
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitIndicacao(requisicao, resposta, "indicacao_link", sessao.referencia_publica, 6))) {
      return resposta;
    }

    const indicacaoRecebida = await buscarIndicacaoRecebida(sessao.id);
    if (!indicacaoRecebidaPodeIndicar(indicacaoRecebida)) {
      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        indicacao: {
          ativa: false,
          motivo: "indisponivel",
          status: "indisponivel"
        }
      });
    }

    const campanha = await buscarOuCriarCampanhaIndicacao(sessao.id);
    const statusIndicacao = await obterStatusIndicacaoPainel(sessao.id, campanha, true);
    if (!campanha || statusIndicacao.status !== "ativa") {
      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        indicacao: {
          ativa: false,
          motivo: statusIndicacao.status,
          status: statusIndicacao.status
        }
      });
    }

    const primeiroNome = descriptografar(sessao.primeiro_nome_cifrado) || "Cliente";
    const slug = normalizarSlugIndicacao(primeiroNome);
    const codigo = gerarTokenSeguro(20).replace(/[^a-zA-Z0-9]/g, "").slice(0, 28).toLowerCase();
    const codigoHash = indiceSeguro(`indicacao-link:${codigo}`);
    await criarLinkIndicacao({
      campanhaExpiraEm: campanha.expira_em,
      codigoHash,
      contaId: sessao.id,
      slug
    });

    return resposta.header("Cache-Control", "no-store").send({
      estado: "ok",
      indicacao: {
        ativa: true,
        expiraEm: campanha.expira_em.toISOString(),
        link: montarUrlIndicacao(slug, codigo),
        liquidadas: statusIndicacao.liquidadas,
        limiteMensal: 20,
        limiteSemanal: 5,
        recompensaAmigo: "R$ 10,00",
        recompensaIndicador: "R$ 25,00",
        status: statusIndicacao.status,
        totalPossivel: "R$ 500,00"
      }
    });
  }
);

servidor.post(
  "/indicacoes/convite",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "indicacao"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "indicacao", "/indicacoes/convite", [
      "codigo"
    ]) as CorpoConviteIndicacao | null;
    if (!corpo) return resposta;

    const codigo = typeof corpo.codigo === "string" ? corpo.codigo.trim().toLowerCase() : "";
    const codigoHash = codigoIndicacaoValido(codigo) ? indiceSeguro(`indicacao-link:${codigo}`) : "";
    const referencia = codigoHash || indiceSeguro(`indicacao-link-invalido:${contextoRequisicao(requisicao)}`);
    if (!(await validarRateLimitIndicacao(requisicao, resposta, "indicacao_convite", referencia, 8))) return resposta;

    const link = codigoHash ? await buscarLinkIndicacaoPorCodigo(codigoHash) : null;
    if (!link) {
      await atrasarFalhaAutenticacao();
      return resposta.header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Convite indisponível."
      });
    }

    const tokenConvite = gerarTokenSeguro();
    const convite = await criarConviteIndicacao({
      codigoHash,
      contextoHash: contextoRequisicao(requisicao),
      indicadorContaId: link.indicador_id,
      tokenHash: hashToken(tokenConvite)
    });
    if (!convite) {
      await atrasarFalhaAutenticacao();
      return resposta.header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Convite indisponível."
      });
    }

    const primeiroNome = descriptografar(link.primeiro_nome_cifrado) || "um cliente";
    return resposta
      .header("Cache-Control", "no-store")
      .header("Set-Cookie", serializarCookiesCompartilhados(cookiesNetCat.indicacao, tokenConvite, 45 * 60))
      .send({
        estado: "ok",
        convite: {
          primeiroNome,
          recompensaAmigo: "R$ 10,00",
          recompensaIndicador: "R$ 25,00",
          validoAte: convite.expira_em.toISOString()
        }
      });
  }
);

servidor.post(
  "/indicacoes/boas-vindas/dispensar",
  {
    config: {
      rateLimit: {
        max: 12,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "painel-cliente", "/indicacoes/boas-vindas/dispensar", []);
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    await marcarBoasVindasIndicacaoVista(sessao.id);
    await registrarEventoSeguranca("indicacao_boas_vindas_vista", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesIndicacao(requisicao, sessao.id));
    return resposta.header("Cache-Control", "no-store").send({ estado: "ok" });
  }
);

servidor.post(
  "/abertura/verificacao",
  {
    config: {
      rateLimit: {
        max: 12,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "abertura-conta"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const contextoAtual = contextoRequisicao(requisicao);
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "abertura-conta", "/abertura/verificacao", [
      "tipo",
      "tipoDocumento",
      "valor"
    ]) as CorpoVerificacaoAbertura | null;
    if (!corpo) return resposta;

    const tipo = typeof corpo.tipo === "string" ? corpo.tipo : "";
    const valorRecebido = typeof corpo.valor === "string" ? corpo.valor : "";
    const tipoDocumentoRecebido = typeof corpo.tipoDocumento === "string" ? corpo.tipoDocumento : "";

    if (!["documento", "email"].includes(tipo)) {
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Tipo de verificacao invalido."
      });
    }

    const valorNormalizado =
      tipo === "documento" ? somenteDigitos(valorRecebido).slice(0, 14) : normalizarEmail(valorRecebido).slice(0, 120);

    if (!valorNormalizado) {
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Valor de verificacao ausente."
      });
    }

    if (tipo === "documento") {
      if (!["cpf", "cnpj"].includes(tipoDocumentoRecebido)) {
        return resposta.code(400).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Formato de segurança inválido."
        });
      }

      const tipoDocumento = tipoDocumentoRecebido as TipoDocumento;
      const documentoValido = validarDocumento(tipoDocumento, valorNormalizado);

      if (!documentoValido) {
        return resposta.code(422).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: `${tipoDocumento.toUpperCase()} invalido.`
        });
      }
    } else if (!validarEmail(valorNormalizado)) {
      return resposta.code(422).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "E-mail invalido."
      });
    }

    const referenciaVerificacao = indiceSeguro(`abertura-verificacao:${tipo}:${valorNormalizado}`);
    const verificacoesRecentes = await contarEventosSegurancaPorReferencia(
      ["abertura_verificacao"],
      referenciaVerificacao,
      "10 minutes"
    );

    if (verificacoesRecentes >= 8) {
      await registrarEventoSeguranca("abertura_verificacao_bloqueada", referenciaVerificacao, contextoAtual);
      return resposta.code(429).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Muitas verificações para esta informação. Aguarde antes de tentar novamente."
      });
    }

    await registrarEventoSeguranca("abertura_verificacao", referenciaVerificacao, contextoAtual);

    const existente =
      tipo === "documento"
        ? documentosReservados.has(valorNormalizado) || (await documentoExiste(indiceSeguro(valorNormalizado)))
        : emailsReservados.has(valorNormalizado) || (await emailExiste(indiceSeguro(valorNormalizado)));

    return resposta.header("Cache-Control", "no-store").send({
      estado: "ok",
      disponivel: !existente,
      mensagem: existente
        ? "Não foi possível continuar com essa informação."
        : "Cadastro disponivel para continuar."
    });
  }
);

servidor.post(
  "/abertura/iniciar",
  {
    config: {
      rateLimit: {
        max: 8,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "abertura-conta"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "abertura-conta", "/abertura/iniciar", [
      "nomeCompleto",
      "tipoDocumento",
      "documento",
      "email",
      "emailConfirmacao",
      "aceitouSistema",
      "aceitouDados",
      "aceitouPrivacidade",
      "produto"
    ]) as CorpoIniciarAbertura | null;
    if (!corpo) return resposta;

    const nomeCompleto =
      typeof corpo.nomeCompleto === "string" ? normalizarNomeCompleto(corpo.nomeCompleto) : "";
    const tipoDocumento: TipoDocumento = corpo.tipoDocumento === "cnpj" ? "cnpj" : "cpf";
    const documento = typeof corpo.documento === "string" ? somenteDigitos(corpo.documento) : "";
    const email = typeof corpo.email === "string" ? normalizarEmail(corpo.email) : "";
    const emailConfirmacao =
      typeof corpo.emailConfirmacao === "string" ? normalizarEmail(corpo.emailConfirmacao) : "";
    const produto = typeof corpo.produto === "string" && validarProduto(corpo.produto) ? corpo.produto : "";

    const aceitesValidos =
      corpo.aceitouSistema === true &&
      corpo.aceitouDados === true &&
      corpo.aceitouPrivacidade === true;

    if (
      !validarNomeCompleto(nomeCompleto) ||
      !validarDocumento(tipoDocumento, documento) ||
      !validarEmail(email) ||
      email !== emailConfirmacao ||
      !aceitesValidos ||
      !produto
    ) {
      await registrarEventoSeguranca("abertura_recusada_validacao", null, contextoRequisicao(requisicao));
      return resposta.code(422).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível validar os dados para abertura."
      });
    }

    const documentoIndice = indiceSeguro(documento);
    const emailIndice = indiceSeguro(email);
    const tokenIndicacao = lerCookie(requisicao.headers.cookie, cookiesNetCat.indicacao);
    const conviteIndicacao = tokenIndicacao
      ? await buscarConviteIndicacao(hashToken(tokenIndicacao), contextoRequisicao(requisicao))
      : null;
    const contaIndicadora = conviteIndicacao
      ? await buscarContaPorId(conviteIndicacao.indicador_conta_id)
      : null;

    if (contaIndicadora?.documento_indice === documentoIndice || contaIndicadora?.email_indice === emailIndice) {
      if (conviteIndicacao) await bloquearIndicacao(conviteIndicacao.id);
      await registrarEventoSeguranca("abertura_indicacao_autoindicacao", null, contextoRequisicao(requisicao), detalhesIndicacao(requisicao));
      return resposta.code(422).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível validar os dados para abertura."
      });
    }

    const existente =
      documentosReservados.has(documento) ||
      emailsReservados.has(email) ||
      (await documentoExiste(documentoIndice)) ||
      (await emailExiste(emailIndice));

    if (existente) {
      await registrarEventoSeguranca("abertura_dado_ja_existente", null, contextoRequisicao(requisicao));
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível continuar com estes dados."
      });
    }

    const conta = await criarContaPendente({
      referenciaPublica: criarReferenciaPublica(),
      nomeCifrado: criptografar(nomeCompleto),
      primeiroNomeCifrado: criptografar(obterPrimeiroNome(nomeCompleto)),
      tipoDocumento,
      documentoIndice,
      documentoCifrado: criptografar(documento),
      emailIndice,
      emailCifrado: criptografar(email),
      produto: produto as ProdutoConta
    });

    const tokenAbertura = gerarTokenSeguro();
    await criarSessaoAbertura({
      tokenHash: hashToken(tokenAbertura),
      contaId: conta.id,
      contextoHash: contextoRequisicao(requisicao)
    });
    if (conviteIndicacao && tokenIndicacao) {
      await vincularConviteIndicacaoAConta({
        contextoHash: contextoRequisicao(requisicao),
        documentoIndice,
        emailIndice,
        indicadoContaId: conta.id,
        tokenHash: hashToken(tokenIndicacao)
      });
      await registrarEventoSeguranca("abertura_indicacao_vinculada", conta.referencia_publica, contextoRequisicao(requisicao), detalhesIndicacao(requisicao, conta.id));
    }

    return resposta
      .header("Cache-Control", "no-store")
      .header("Set-Cookie", serializarCookie(cookiesNetCat.abertura, tokenAbertura, 20 * 60))
      .send({
        estado: "ok",
        abertura: {
          proximaEtapa: "complemento",
          referencia: conta.referencia_publica
        }
      });
  }
);

servidor.post(
  "/abertura/cnpj/consulta",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "abertura-conta"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const contextoAtual = contextoRequisicao(requisicao);
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "abertura-conta", "/abertura/cnpj/consulta", [
      "documento"
    ]) as CorpoConsultaCnpjAbertura | null;
    if (!corpo) return resposta;

    const tokenAbertura = lerCookie(requisicao.headers.cookie, cookiesNetCat.abertura);
    const sessao = tokenAbertura ? await buscarSessaoAbertura(hashToken(tokenAbertura)) : null;
    const documento = typeof corpo.documento === "string" ? somenteDigitos(corpo.documento).slice(0, 14) : "";
    const documentoIndice = indiceSeguro(documento);

    if (
      !sessao ||
      sessao.contexto_hash !== contextoAtual ||
      sessao.tipo_documento !== "cnpj" ||
      sessao.documento_indice !== documentoIndice ||
      !validarDocumento("cnpj", documento)
    ) {
      await registrarEventoSeguranca("abertura_cnpj_sessao_invalida", null, contextoAtual);
      return resposta.code(403).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível confirmar os dados cadastrais agora."
      });
    }

    const referenciaConsulta = indiceSeguro(`cnpj-cadastro:${documento}`);
    const totalRecentes = await contarEventosSegurancaPorReferencia(
      ["abertura_cnpj_consulta"],
      referenciaConsulta,
      "1 minute"
    );

    if (totalRecentes >= 8) {
      await registrarEventoSeguranca("abertura_cnpj_consulta_bloqueada", sessao.referencia_publica, contextoAtual);
      return resposta.code(429).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Muitas verificações em sequência."
      });
    }

    const dadosCache = await buscarCnpjEmCache(documentoIndice);
    if (dadosCache) {
      await registrarEventoSeguranca("abertura_cnpj_cache", sessao.referencia_publica, contextoAtual);
      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        cnpj: dadosCache
      });
    }

    await registrarEventoSeguranca("abertura_cnpj_consulta", sessao.referencia_publica, contextoAtual);
    const agendamento = agendarConsultaCnpj(documento, documentoIndice);

    if (agendamento.estado === "adiado") {
      return resposta.header("Cache-Control", "no-store").send({
        estado: "adiado",
        mensagem: "Vamos concluir esta confirmação depois."
      });
    }

    return resposta.code(202).header("Cache-Control", "no-store").send({
      estado: "pendente",
      estimativaSegundos: agendamento.estimativaSegundos,
      mensagem: "Validando dados cadastrais."
    });
  }
);

servidor.post(
  "/abertura/cancelar",
  {
    config: {
      rateLimit: {
        max: 6,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "abertura-conta"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "abertura-conta", "/abertura/cancelar", []);
    if (!corpo) return resposta;

    const contextoAtual = contextoRequisicao(requisicao);
    const tokenAbertura = lerCookie(requisicao.headers.cookie, cookiesNetCat.abertura);
    const conta = tokenAbertura ? await cancelarSessaoAbertura(hashToken(tokenAbertura), contextoAtual) : null;

    if (conta) {
      await registrarEventoSeguranca("abertura_cancelada_usuario", conta.referencia_publica, contextoAtual);
    }

    return resposta
      .header("Cache-Control", "no-store")
      .header("Set-Cookie", apagarCookie(cookiesNetCat.abertura))
      .send({
        estado: "ok"
      });
  }
);

servidor.post(
  "/abertura/complemento",
  {
    config: {
      rateLimit: {
        max: 8,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "abertura-conta"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "abertura-conta", "/abertura/complemento", [
      "dataNascimento",
      "senha",
      "senhaConfirmacao"
    ]) as CorpoComplementoAbertura | null;
    if (!corpo) return resposta;

    const tokenAbertura = lerCookie(requisicao.headers.cookie, cookiesNetCat.abertura);
    const sessao = tokenAbertura ? await buscarSessaoAbertura(hashToken(tokenAbertura)) : null;
    const contextoAtual = contextoRequisicao(requisicao);

    if (!sessao || sessao.contexto_hash !== contextoAtual) {
      await registrarEventoSeguranca("abertura_complemento_sessao_invalida", null, contextoAtual);
      return resposta.code(403).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Sessão de abertura expirada."
      });
    }

    const dataNascimento = typeof corpo.dataNascimento === "string" ? corpo.dataNascimento : "";
    const senha = typeof corpo.senha === "string" ? somenteDigitos(corpo.senha) : "";
    const senhaConfirmacao =
      typeof corpo.senhaConfirmacao === "string" ? somenteDigitos(corpo.senhaConfirmacao) : "";
    const exigeNascimento = sessao.tipo_documento === "cpf";

    if (
      (exigeNascimento && !validarDataNascimento(dataNascimento)) ||
      !validarSenhaNumerica(senha, dataNascimento) ||
      senha !== senhaConfirmacao
    ) {
      await registrarEventoSeguranca("abertura_complemento_recusado", sessao.referencia_publica, contextoAtual);
      return resposta.code(422).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível concluir com os dados informados."
      });
    }

    const sessaoConsumida = await consumirSessaoAbertura(hashToken(tokenAbertura), contextoAtual);
    if (!sessaoConsumida) {
      await registrarEventoSeguranca("abertura_complemento_repetido", sessao.referencia_publica, contextoAtual);
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Esta etapa já foi processada."
      });
    }

    await concluirConta({
      contaId: sessaoConsumida.id,
      dataNascimentoCifrada: exigeNascimento ? criptografar(dataNascimento) : null,
      senhaHash: await criarHashSenha(senha)
    });
    await marcarIndicacaoContaAtivada(sessaoConsumida.id);
    await registrarSaldoInicialConta(sessaoConsumida.id, sessaoConsumida.referencia_publica);
    const cookieSessao = await criarCookieSessaoCliente(sessaoConsumida.id, requisicao);

    return resposta
      .header("Cache-Control", "no-store")
      .header("Set-Cookie", [apagarCookie(cookiesNetCat.abertura), ...apagarCookiesCompartilhados(cookiesNetCat.indicacao), ...cookieSessao])
      .send({
        estado: "ok",
        painel: {
          proximaRota: "/painel"
        }
      });
  }
);

servidor.post(
  "/auth/login",
  {
    config: {
      rateLimit: {
        max: 16,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "area-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "area-cliente", "/auth/login", [
      "documento",
      "senha"
    ]) as CorpoLogin | null;
    if (!corpo) return resposta;

    const documento = typeof corpo.documento === "string" ? somenteDigitos(corpo.documento) : "";
    const senha = typeof corpo.senha === "string" ? somenteDigitos(corpo.senha) : "";
    const documentoIndice = documento ? indiceSeguro(documento) : null;
    const contextoAtual = contextoRequisicao(requisicao);
    const tentativasDocumento = await contarEventosSegurancaPorReferencia(
      ["login_recusado"],
      documentoIndice,
      "10 minutes"
    );

    if (tentativasDocumento >= 5) {
      await registrarEventoSeguranca("login_bloqueado_documento", documentoIndice, contextoAtual);
      await atrasarFalhaAutenticacao();
      return resposta.code(429).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Muitas tentativas para esta identificação. Aguarde antes de tentar novamente."
      });
    }

    const conta = documentoIndice ? await buscarContaPorDocumento(documentoIndice) : null;

    if (!conta || conta.status !== "ativa" || !(await verificarSenha(senha, conta.senha_hash))) {
      await registrarEventoSeguranca("login_recusado", documentoIndice, contextoAtual);
      await atrasarFalhaAutenticacao();
      return resposta.code(401).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível acessar com estes dados."
      });
    }

    if (conta.dois_fatores_ativo) {
      if (!conta.dois_fatores_segredo_cifrado) {
        await registrarEventoSeguranca("login_2fa_configuracao_invalida", conta.referencia_publica, contextoAtual);
        await atrasarFalhaAutenticacao();
        return resposta.code(403).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Verificação em duas etapas indisponível para esta conta."
        });
      }

      const cookieDesafio = await criarCookieDesafio2fa(conta.id, requisicao);
      return resposta
        .header("Cache-Control", "no-store")
        .header("Set-Cookie", [
          ...cookieDesafio,
          ...apagarCookiesCompartilhados(cookiesNetCat.sessao)
        ])
        .send({
          estado: "verificacao_2fa",
          verificacao: {
            metodo: "totp",
            expiraEmSegundos: 240
          }
        });
    }

    const cookieSessao = await criarCookieSessaoCliente(conta.id, requisicao);
    return resposta
      .header("Cache-Control", "no-store")
      .header("Set-Cookie", [
        ...cookieSessao,
        ...apagarCookiesCompartilhados(cookiesNetCat.login2fa)
      ])
      .send({
      estado: "ok",
      painel: {
        proximaRota: "/painel"
      }
    });
  }
);

servidor.post(
  "/auth/login/2fa",
  {
    config: {
      rateLimit: {
        max: 12,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "area-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "area-cliente", "/auth/login/2fa", [
      "codigo"
    ]) as CorpoLogin2fa | null;
    if (!corpo) return resposta;

    const codigo = typeof corpo.codigo === "string" ? somenteDigitos(corpo.codigo).slice(0, 6) : "";
    const contextoAtual = contextoRequisicao(requisicao);
    const tokensDesafio = lerCookies(requisicao.headers.cookie, cookiesNetCat.login2fa);
    let tokenDesafio = "";
    let desafio: Awaited<ReturnType<typeof buscarDesafioLogin2fa>> | null = null;

    for (const tokenAtual of tokensDesafio) {
      const desafioAtual = await buscarDesafioLogin2fa(hashToken(tokenAtual), contextoAtual);
      if (!desafioAtual) continue;
      tokenDesafio = tokenAtual;
      desafio = desafioAtual;
      break;
    }

    if (!desafio || desafio.contexto_hash !== contextoAtual) {
      await registrarEventoSeguranca("login_2fa_desafio_invalido", null, contextoAtual);
      await atrasarFalhaAutenticacao();
      return resposta.code(403).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Verificação expirada. Acesse novamente."
      });
    }

    if (
      desafio.contexto_rede_hash !== contextoRedeRequisicao(requisicao) ||
      desafio.agente_hash !== agenteHashRequisicao(requisicao) ||
      desafio.sinal_cliente_hash !== sinalClienteHashRequisicao(requisicao)
    ) {
      await registrarEventoSeguranca("login_2fa_fingerprint_invalido", desafio.referencia_publica, contextoAtual);
      await atrasarFalhaAutenticacao();
      return resposta.code(403).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Verificação expirada. Acesse novamente."
      });
    }

    const tentativas2fa = await contarEventosSegurancaPorReferencia(
      ["login_2fa_recusado"],
      desafio.referencia_publica,
      "10 minutes"
    );

    if (tentativas2fa >= 6) {
      await registrarEventoSeguranca("login_2fa_bloqueado", desafio.referencia_publica, contextoAtual);
      await atrasarFalhaAutenticacao();
      return resposta.code(429).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Muitas verificações em sequência. Aguarde antes de tentar novamente."
      });
    }

    const segredo = desafio.dois_fatores_segredo_cifrado
      ? descriptografar(desafio.dois_fatores_segredo_cifrado)
      : "";
    const verificacao = validarCodigoTotp({
      segredo,
      codigo,
      ultimoContador: desafio.dois_fatores_ultimo_contador
        ? Number(desafio.dois_fatores_ultimo_contador)
        : null
    });

    if (!verificacao.valido || verificacao.contador === null) {
      await registrarEventoSeguranca("login_2fa_recusado", desafio.referencia_publica, contextoAtual);
      await atrasarFalhaAutenticacao();
      return resposta.code(401).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Código do autenticador inválido."
      });
    }

    const desafioConsumido = await consumirDesafioLogin2fa(hashToken(tokenDesafio), contextoAtual);
    const contadorAtualizado = await atualizarContadorDoisFatoresConta({
      contaId: desafio.id,
      contador: verificacao.contador
    });

    if (!desafioConsumido || !contadorAtualizado) {
      await registrarEventoSeguranca("login_2fa_replay", desafio.referencia_publica, contextoAtual);
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Código já processado."
      });
    }

    const cookieSessao = await criarCookieSessaoCliente(desafio.id, requisicao);
    return resposta
      .header("Cache-Control", "no-store")
      .header("Set-Cookie", [
        ...cookieSessao,
        ...apagarCookiesCompartilhados(cookiesNetCat.login2fa)
      ])
      .send({
        estado: "ok",
        painel: {
          proximaRota: "/painel"
        }
      });
  }
);

servidor.post(
  "/auth/2fa/preparar",
  {
    config: {
      rateLimit: {
        max: 8,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "painel-cliente", "/auth/2fa/preparar", []);
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;

    if (sessao.dois_fatores_ativo && sessao.dois_fatores_segredo_cifrado) {
      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        doisFatores: {
          ativo: true
        }
      });
    }

    const segredo = gerarSegredoTotp();
    const conta = `${descriptografar(sessao.nome_cifrado) || "Cliente NC Bank"} · ${sessao.referencia_publica}`;
    const uri = criarUriTotp({ segredo, identificador: conta });
    const qrSvg = await criarQrTotpSvg(uri);
    await prepararDoisFatoresConta({
      contaId: sessao.id,
      segredoCifrado: criptografar(segredo)
    });
    await registrarEventoSeguranca("2fa_preparado", sessao.referencia_publica, contextoRequisicao(requisicao));

    return resposta.header("Cache-Control", "no-store").send({
      estado: "ok",
      doisFatores: {
        ativo: false,
        emissor: "NC Bank",
        conta,
        chaveManual: segredo,
        qrSvg
      }
    });
  }
);

servidor.post(
  "/auth/2fa/ativar",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "painel-cliente", "/auth/2fa/ativar", [
      "codigo"
    ]) as CorpoAtivar2fa | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;

    const codigo = typeof corpo.codigo === "string" ? somenteDigitos(corpo.codigo).slice(0, 6) : "";
    const segredo = sessao.dois_fatores_segredo_cifrado
      ? descriptografar(sessao.dois_fatores_segredo_cifrado)
      : "";
    const verificacao = validarCodigoTotp({
      segredo,
      codigo,
      ultimoContador: sessao.dois_fatores_ultimo_contador
        ? Number(sessao.dois_fatores_ultimo_contador)
        : null
    });

    if (!verificacao.valido || verificacao.contador === null) {
      await registrarEventoSeguranca("2fa_ativacao_recusada", sessao.referencia_publica, contextoRequisicao(requisicao));
      await atrasarFalhaAutenticacao();
      return resposta.code(401).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Código do autenticador inválido."
      });
    }

    await ativarDoisFatoresConta({
      contaId: sessao.id
    });
    await registrarEventoSeguranca("2fa_ativado", sessao.referencia_publica, contextoRequisicao(requisicao));

    return resposta.header("Cache-Control", "no-store").send({
      estado: "ok",
      doisFatores: {
        ativo: true
      }
    });
  }
);

servidor.get("/auth/sessao", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) {
    return resposta;
  }

  const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
  if (!sessao) return resposta;

  try {
    await liquidarBonusIndicacaoPendente(sessao, requisicao);
  } catch {
    await registrarEventoSeguranca("indicacao_bonus_erro", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesIndicacao(requisicao, sessao.id));
  }
  try {
    await processarAgendamentosNexVencidos(sessao, requisicao);
  } catch {
    await registrarEventoSeguranca("nex_agendamento_processamento_erro", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
  }

  const saldoPainel = await obterSaldoPainelAutorizado(sessao, requisicao, resposta);
  if (!saldoPainel) return resposta;

  const nomeCompleto = descriptografar(sessao.nome_cifrado);
  const campanhaIndicacao = await buscarCampanhaIndicacao(sessao.id);
  const indicacaoRecebida = await buscarIndicacaoRecebida(sessao.id);
  const indicacaoLiberada = indicacaoRecebidaPodeIndicar(indicacaoRecebida);
  const statusIndicacao = await obterStatusIndicacaoPainel(sessao.id, campanhaIndicacao, indicacaoLiberada);
  const boasVindasIndicacao = await buscarBoasVindasIndicacaoPendente(sessao.id);
  return resposta.header("Cache-Control", "no-store").send({
    estado: "ok",
    cliente: {
      apresentacao: nomeCompleto || "Cliente NC Bank",
      documentoNex: formatarDocumentoNexExibicao(descriptografar(sessao.documento_cifrado), sessao.tipo_documento),
      produto: sessao.produto
    },
    seguranca: {
      doisFatoresAtivo: sessao.dois_fatores_ativo === true
    },
    painel: {
      saldoDisponivel: saldoPainel.saldoDisponivel,
      saldoDisponivelCentavos: saldoPainel.saldoDisponivelCentavos,
      saldoTotal: saldoPainel.saldoTotal,
      saldoTotalCentavos: saldoPainel.saldoTotalCentavos,
      moeda: saldoPainel.moeda,
      saldosVersao: saldoPainel.versao,
      nex: "ativo",
      cartao: sessao.produto === "credito-conta" ? "em análise" : "não solicitado"
    },
    indicacoes: {
      disponivel: statusIndicacao.disponivel,
      expiraEm: campanhaIndicacao?.expira_em.toISOString(),
      liquidadas: statusIndicacao.liquidadas,
      status: statusIndicacao.status,
      boasVindas: boasVindasIndicacao
        ? {
            indicadorPrimeiroNome: descriptografar(boasVindasIndicacao.indicador_primeiro_nome_cifrado) || "um amigo",
            recompensa: "R$ 10,00"
          }
        : null
    }
  });
});

servidor.post(
  "/nex/chaves/listar",
  {
    config: {
      rateLimit: {
        max: 45,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "painel-cliente", "/nex/chaves/listar", []);
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_chaves_listar", sessao, 40))) return resposta;

    const chaves = await buscarChavesNexConta(sessao.id);
    return resposta.header("Cache-Control", "no-store").send({
      estado: "ok",
      chaves: {
        itens: chaves.map((chave) => serializarChaveNex(chave, sessao))
      }
    });
  }
);

servidor.post(
  "/nex/chaves/criar",
  {
    config: {
      rateLimit: {
        max: 6,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/nex/chaves/criar",
      ["tipo", "valor"]
    ) as CorpoCriarChaveNex | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_chaves_criar", sessao, 8, "10 minutes"))) return resposta;

    const tipo = tipoChaveNexSeguro(corpo.tipo);
    const idempotencia = metadadosEnvelopeSeguro(corpo)?.idempotencia ?? "";
    const valor = tipo ? prepararValorChaveNex(tipo, corpo.valor, sessao) : null;
    if (!tipo || !idempotencia) {
      await registrarEventoSeguranca("nex_chave_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível criar essa chave agora."
      });
    }
    if (!valor) {
      await registrarEventoSeguranca("nex_chave_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      const mensagem =
        tipo === "email"
          ? "Use o e-mail cadastrado na sua conta."
          : tipo === "telefone"
            ? "Informe um telefone brasileiro válido com DDD."
            : "Não foi possível criar essa chave agora.";
      return resposta.code(422).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem
      });
    }

    try {
      const chave = await criarChaveNexConta({
        contaId: sessao.id,
        contextoHash: contextoRequisicao(requisicao),
        estado: valor.estado,
        idempotenciaChave: idempotencia,
        tipo,
        valorCifrado: valor.valorCifrado,
        valorExibicao: valor.valorExibicao,
        valorIndiceHmac: valor.valorIndiceHmac
      });

      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        chave: serializarChaveNex(chave, sessao)
      });
    } catch (erro) {
      const mensagemErro = erro instanceof Error ? erro.message : "";
      await registrarEventoSeguranca("nex_chave_criacao_recusada", sessao.referencia_publica, contextoRequisicao(requisicao), {
        ...detalhesSegurancaRequisicao(requisicao, sessao.id),
        detalhesCifrados: criptografar(JSON.stringify({ motivo: mensagemErro }))
      });

      if (mensagemErro === "chave_nex_cooldown") {
        return resposta.code(429).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Aguarde alguns instantes antes de alterar suas chaves."
        });
      }

      if (mensagemErro === "chave_nex_limite") {
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Você já criou 3 chaves aleatórias."
        });
      }

      if (mensagemErro === "chave_nex_tipo_existente") {
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Você já possui uma chave desse tipo."
        });
      }

      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível criar essa chave agora."
      });
    }
  }
);

servidor.post(
  "/nex/chaves/excluir",
  {
    config: {
      rateLimit: {
        max: 12,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/nex/chaves/excluir",
      ["id"]
    ) as CorpoExcluirChaveNex | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_chaves_excluir", sessao, 10, "10 minutes"))) return resposta;

    const id = typeof corpo.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(corpo.id)
      ? corpo.id
      : "";
    const idempotencia = metadadosEnvelopeSeguro(corpo)?.idempotencia ?? "";
    if (!id || !idempotencia) {
      await registrarEventoSeguranca("nex_chave_exclusao_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível remover essa chave agora."
      });
    }

    try {
      await removerChaveNexConta({
        chaveId: id,
        contaId: sessao.id,
        contextoHash: contextoRequisicao(requisicao),
        idempotenciaChave: idempotencia
      });
    } catch (erro) {
      const mensagemErro = erro instanceof Error ? erro.message : "erro";
      await registrarEventoSeguranca("nex_chave_exclusao_recusada", sessao.referencia_publica, contextoRequisicao(requisicao), {
        ...detalhesSegurancaRequisicao(requisicao, sessao.id),
        detalhesCifrados: criptografar(JSON.stringify({ motivo: mensagemErro }))
      });
      if (mensagemErro === "chave_nex_cooldown") {
        return resposta.code(429).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Aguarde alguns instantes antes de alterar suas chaves."
        });
      }
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível remover essa chave agora."
      });
    }

    return resposta.header("Cache-Control", "no-store").send({
      estado: "ok"
    });
  }
);

servidor.post(
  "/nex/recebimentos/qr/criar",
  {
    config: {
      rateLimit: {
        max: 40,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/nex/recebimentos/qr/criar",
      ["chaveId", "valorCentavos", "descricao"]
    ) as CorpoCriarQrRecebimentoNex | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_recebimento_qr_criar", sessao, 30, "10 minutes"))) return resposta;

    const chaveId =
      typeof corpo.chaveId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(corpo.chaveId)
        ? corpo.chaveId
        : "";
    const valorCentavosInformado =
      corpo.valorCentavos === undefined || corpo.valorCentavos === null
        ? 0
        : typeof corpo.valorCentavos === "number"
          ? corpo.valorCentavos
          : Number(corpo.valorCentavos);
    const descricao = normalizarDescricaoNex(corpo.descricao);

    if (!chaveId || !Number.isSafeInteger(valorCentavosInformado) || valorCentavosInformado < 0 || valorCentavosInformado > 100_000_000) {
      await registrarEventoSeguranca("nex_recebimento_qr_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível criar esse QR Code agora."
      });
    }

    try {
      const chaves = await buscarChavesNexConta(sessao.id);
      const chave = chaves.find((item) => item.id === chaveId && item.estado === "ativa") ?? null;
      if (!chave) throw new Error("chave_nex_indisponivel");

      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const payload = assinarPayloadQrRecebimentoNex({
        chaveDestino: serializarChaveNex(chave, sessao).valor,
        chaveRecebimento: gerarChaveRecebimentoNex(),
        chaveTipo: chave.tipo,
        ...(descricao ? { descricao } : {}),
        emissor: "NC Bank",
        expiraEm,
        referencia: criarReferenciaPublicaRecebimentoNex(),
        tipo: "NCBANK_NEX_QR",
        ...(valorCentavosInformado > 0 ? { valorCentavos: valorCentavosInformado } : {}),
        versao: 1
      });
      const conteudo = canonicalizarJsonSeguro(payload);
      const qrSvg = await criarQrRecebimentoNexSvg(conteudo);

      await registrarEventoSeguranca("nex_recebimento_qr_criado", sessao.referencia_publica, contextoRequisicao(requisicao), {
        ...detalhesSegurancaRequisicao(requisicao, sessao.id),
        detalhesCifrados: criptografar(JSON.stringify({
          chaveId: chave.id,
          referencia: payload.referencia,
          valorCentavos: valorCentavosInformado
        }))
      });

      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        qr: {
          chave: serializarChaveNex(chave, sessao),
          chaveRecebimento: payload.chaveRecebimento,
          conteudo,
          expiraEm,
          qrSvg,
          referencia: payload.referencia,
          ...(valorCentavosInformado > 0
            ? {
                valor: formatarMoeda(valorCentavosInformado),
                valorCentavos: valorCentavosInformado
              }
            : {})
        }
      });
    } catch {
      await registrarEventoSeguranca("nex_recebimento_qr_criacao_recusada", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível criar esse QR Code agora."
      });
    }
  }
);

servidor.post(
  "/nex/recebimentos/qr/validar",
  {
    config: {
      rateLimit: {
        max: 35,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/nex/recebimentos/qr/validar",
      ["conteudo"]
    ) as CorpoValidarQrRecebimentoNex | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_recebimento_qr_validar", sessao, 28, "10 minutes"))) return resposta;

    const payload = validarPayloadQrRecebimentoNex(corpo.conteudo);
    const chaveDestinoNormalizada = payload ? normalizarChaveDestinoNex(payload.chaveDestino) : null;
    if (!payload || !chaveDestinoNormalizada) {
      await registrarEventoSeguranca("nex_recebimento_qr_validacao_recusada", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível ler esse QR Code."
      });
    }

    try {
      const destinatario = await resolverDestinoChaveNex({
        chaveDestinoIndiceHmac: indiceChaveNex(chaveDestinoNormalizada),
        contaOrigemId: sessao.id
      });
      if (!destinatario) throw new Error("destino_nex_indisponivel");

      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        destinatario: serializarDestinatarioNex(destinatario),
        qr: {
          chaveDestino: payload.chaveDestino,
          chaveRecebimento: payload.chaveRecebimento,
          expiraEm: payload.expiraEm,
          referencia: payload.referencia,
          ...(payload.valorCentavos && payload.valorCentavos > 0
            ? {
                valor: formatarMoeda(payload.valorCentavos),
                valorCentavos: payload.valorCentavos
              }
            : {})
        }
      });
    } catch {
      await registrarEventoSeguranca("nex_recebimento_qr_destino_indisponivel", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível ler esse QR Code."
      });
    }
  }
);

servidor.post(
  "/nex/transferencias/resolver",
  {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/nex/transferencias/resolver",
      ["chaveDestino"]
    ) as CorpoResolverTransferenciaNex | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_transferencia_resolver", sessao, 24, "10 minutes"))) return resposta;

    const chaveDestinoNormalizada = normalizarChaveDestinoNex(corpo.chaveDestino);
    if (!chaveDestinoNormalizada) {
      await registrarEventoSeguranca("nex_transferencia_resolucao_recusada", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível localizar essa chave agora."
      });
    }

    try {
      const destinatario = await resolverDestinoChaveNex({
        chaveDestinoIndiceHmac: indiceChaveNex(chaveDestinoNormalizada),
        contaOrigemId: sessao.id
      });

      if (!destinatario) {
        await registrarEventoSeguranca("nex_transferencia_destino_indisponivel", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
        return resposta.code(404).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Não foi possível localizar essa chave agora."
        });
      }

      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        destinatario: serializarDestinatarioNex(destinatario)
      });
    } catch {
      await registrarEventoSeguranca("nex_transferencia_resolucao_erro", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível localizar essa chave agora."
      });
    }
  }
);

servidor.post(
  "/nex/transferencias/preparar",
  {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/nex/transferencias/preparar",
      ["chaveDestino", "valorCentavos", "descricao"]
    ) as CorpoPrepararTransferenciaNex | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_transferencia_preparar", sessao, 16, "10 minutes"))) return resposta;

    const chaveDestinoNormalizada = normalizarChaveDestinoNex(corpo.chaveDestino);
    const valorCentavos = typeof corpo.valorCentavos === "number" ? corpo.valorCentavos : Number(corpo.valorCentavos);
    const descricao = normalizarDescricaoNex(corpo.descricao) || "Transferência Nex";
    const idempotencia = metadadosEnvelopeSeguro(corpo)?.idempotencia ?? "";

    if (!chaveDestinoNormalizada || !Number.isSafeInteger(valorCentavos) || valorCentavos <= 0 || valorCentavos > 100_000_000 || !idempotencia) {
      await registrarEventoSeguranca("nex_transferencia_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível preparar essa transferência agora."
      });
    }

    try {
      const saldoSuficiente = await saldoDisponivelCobreValor(sessao, requisicao, resposta, valorCentavos);
      if (saldoSuficiente === null) return resposta;
      if (!saldoSuficiente) {
        await registrarEventoSeguranca("nex_transferencia_saldo_insuficiente", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Saldo insuficiente para essa transferência."
        });
      }

      const destinatario = await resolverDestinoChaveNex({
        chaveDestinoIndiceHmac: indiceChaveNex(chaveDestinoNormalizada),
        contaOrigemId: sessao.id
      });
      if (!destinatario) throw new Error("destino_nex_indisponivel");

      const transferencia = await prepararTransferenciaNex({
        chaveDestinoIndiceHmac: indiceChaveNex(chaveDestinoNormalizada),
        contaOrigemId: sessao.id,
        contextoHash: contextoRequisicao(requisicao),
        descricao,
        idempotenciaChave: idempotencia,
        referenciaPublica: criarReferenciaPublicaNex(),
        valorCentavos
      });

      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        transferencia: serializarTransferenciaNex(transferencia, destinatario)
      });
    } catch (erro) {
      await registrarEventoSeguranca("nex_transferencia_preparo_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      const mensagemErro = erro instanceof Error ? erro.message : "";
      if (mensagemErro === "transferencia_nex_origem_sem_chave") {
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Crie uma chave Nex ativa antes de enviar."
        });
      }
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível preparar essa transferência agora."
      });
    }
  }
);

servidor.post(
  "/nex/agendamentos/criar",
  {
    config: {
      rateLimit: {
        max: 16,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/nex/agendamentos/criar",
      ["chaveDestino", "valorCentavos", "descricao", "agendadoPara"]
    ) as CorpoCriarAgendamentoNex | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_agendamento_criar", sessao, 12, "10 minutes"))) return resposta;

    const chaveDestinoNormalizada = normalizarChaveDestinoNex(corpo.chaveDestino);
    const valorCentavos = typeof corpo.valorCentavos === "number" ? corpo.valorCentavos : Number(corpo.valorCentavos);
    const agendadoPara = normalizarDataAgendamentoNex(corpo.agendadoPara);
    const descricao = normalizarDescricaoNex(corpo.descricao) || "Transferência Nex agendada";
    const idempotencia = metadadosEnvelopeSeguro(corpo)?.idempotencia ?? "";

    if (
      !chaveDestinoNormalizada ||
      !Number.isSafeInteger(valorCentavos) ||
      valorCentavos <= 0 ||
      valorCentavos > 100_000_000 ||
      !agendadoPara ||
      !idempotencia
    ) {
      await registrarEventoSeguranca("nex_agendamento_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível criar esse agendamento agora."
      });
    }

    try {
      const chaveDestinoIndiceHmac = indiceChaveNex(chaveDestinoNormalizada);
      const destinatario = await resolverDestinoChaveNex({
        chaveDestinoIndiceHmac,
        contaOrigemId: sessao.id
      });
      if (!destinatario) throw new Error("destino_nex_indisponivel");

      const agendamento = await criarAgendamentoNexConta({
        agendadoPara,
        chaveDestinoIndiceHmac,
        contaOrigemId: sessao.id,
        contextoHash: contextoRequisicao(requisicao),
        contraparte: formatarNomeNexSeguro(
          descriptografar(destinatario.conta.nome_cifrado) ||
            descriptografar(destinatario.conta.primeiro_nome_cifrado) ||
            "Cliente NC Bank"
        ),
        descricao,
        idempotenciaChave: idempotencia,
        referenciaPublica: criarReferenciaPublicaNex(),
        valorCentavos
      });

      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        agendamento: serializarAgendamentoNex(agendamento, destinatario)
      });
    } catch (erro) {
      await registrarEventoSeguranca("nex_agendamento_criacao_recusada", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      const mensagemErro = erro instanceof Error ? erro.message : "";
      if (mensagemErro === "agendamento_nex_origem_sem_chave") {
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Crie uma chave Nex ativa antes de agendar."
        });
      }
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível criar esse agendamento agora."
      });
    }
  }
);

servidor.post(
  "/nex/transferencias/confirmar",
  {
    config: {
      rateLimit: {
        max: 12,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/nex/transferencias/confirmar",
      ["transferenciaId"]
    ) as CorpoConfirmarTransferenciaNex | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_transferencia_confirmar", sessao, 10, "10 minutes"))) return resposta;

    const transferenciaId =
      typeof corpo.transferenciaId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(corpo.transferenciaId)
        ? corpo.transferenciaId
        : "";
    const idempotencia = metadadosEnvelopeSeguro(corpo)?.idempotencia ?? "";

    if (!transferenciaId || !idempotencia) {
      await registrarEventoSeguranca("nex_transferencia_confirmacao_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível confirmar essa transferência agora."
      });
    }

    try {
      const transferenciaAtual = await buscarTransferenciaNexConta({
        contaOrigemId: sessao.id,
        transferenciaId
      });
      const contaDestino = transferenciaAtual ? await buscarContaPorId(transferenciaAtual.conta_destino_id) : null;
      if (!transferenciaAtual || !contaDestino) throw new Error("transferencia_nex_indisponivel");

      const transferencia = await confirmarTransferenciaNex({
        assinarLancamento: assinarLancamentoSaldo,
        assinarPartida: assinarPartidaDobradaSaldo,
        assinarSaldo: assinarSaldoConta,
        calcularMerkleRaiz: calcularMerkleRaizSaldo,
        contaOrigemId: sessao.id,
        contextoHash: contextoRequisicao(requisicao),
        idempotenciaChave: idempotencia,
        nomeDestino: descriptografar(contaDestino.nome_cifrado) || "Cliente NC Bank",
        nomeOrigem: descriptografar(sessao.nome_cifrado) || "Cliente NC Bank",
        transferenciaId
      });

      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        transferencia: serializarTransferenciaNex(transferencia)
      });
    } catch (erro) {
      await registrarEventoSeguranca("nex_transferencia_confirmacao_recusada", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      const mensagemErro = erro instanceof Error ? erro.message : "";
      if (mensagemErro === "saldo_insuficiente") {
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Saldo insuficiente para essa transferência."
        });
      }
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível confirmar essa transferência agora."
      });
    }
  }
);

servidor.post(
  "/nex/atividades",
  {
    config: {
      rateLimit: {
        max: 45,
        timeWindow: "1 minute"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/nex/atividades",
      ["limite", "pagina", "pesquisa"]
    ) as CorpoAtividadesNex | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "nex_atividades", sessao, 40))) return resposta;

    const limite = Math.max(1, Math.min(Number(corpo.limite ?? 12), 30));
    const pagina = Math.max(1, Math.min(Number(corpo.pagina ?? 1), 500));
    const pesquisa = normalizarPesquisaExtrato(corpo.pesquisa);
    if (!Number.isSafeInteger(limite) || !Number.isSafeInteger(pagina)) {
      await registrarEventoSeguranca("nex_atividades_parametro_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível carregar as atividades Nex agora."
      });
    }

    try {
      await processarAgendamentosNexVencidos(sessao, requisicao);
      const atividades = await buscarAtividadesNexConta(sessao.id, {
        limite,
        pagina,
        pesquisa: pesquisa ?? undefined
      });

      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        nex: {
          atividades: {
            itens: atividades.itens.map(serializarMovimento),
            limite,
            pagina,
            temMais: pagina * limite < atividades.total,
            total: atividades.total
          },
          recorrentes: atividades.contatos.map(serializarContatoNex),
          resumo: {
            contatos: atividades.contatos.length,
            transacoes: atividades.total
          }
        }
      });
    } catch {
      await registrarEventoSeguranca("nex_atividades_erro", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível carregar as atividades Nex agora."
      });
    }
  }
);

servidor.post(
  "/doacoes/instituto-murzo/doar",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/doacoes/instituto-murzo/doar",
      ["valorCentavos"]
    ) as CorpoDoacaoInstitutoMurzo | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "doacao_murzo_confirmar", sessao, 5, "10 minutes"))) return resposta;

    const valorCentavos = typeof corpo.valorCentavos === "number" ? corpo.valorCentavos : Number(corpo.valorCentavos);
    const idempotencia = metadadosEnvelopeSeguro(corpo)?.idempotencia ?? "";
    const idBase = idempotencia
      ? createHash("sha256").update(`murzo:${sessao.id}:${idempotencia}`).digest("hex").slice(0, 24)
      : "";
    const idempotenciaDoacao = idBase ? `doacao:murzo:${idBase}` : "";
    const referenciaPublica = criarReferenciaPublicaDoacaoMurzo();

    if (
      !Number.isSafeInteger(valorCentavos) ||
      valorCentavos <= 0 ||
      valorCentavos > 100_000_000 ||
      !idempotenciaDoacao
    ) {
      await registrarEventoSeguranca("doacao_murzo_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível preparar essa doação agora."
      });
    }

    try {
      const saldoSuficiente = await saldoDisponivelCobreValor(sessao, requisicao, resposta, valorCentavos);
      if (saldoSuficiente === null) return resposta;
      if (!saldoSuficiente) {
        await registrarEventoSeguranca("doacao_murzo_saldo_insuficiente", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Saldo insuficiente para concluir a doação."
        });
      }

      const movimento = await liquidarDoacaoInstitutoMurzoConta({
        assinarLancamento: assinarLancamentoSaldo,
        assinarPartida: assinarPartidaDobradaSaldo,
        assinarSaldo: assinarSaldoConta,
        calcularMerkleRaiz: calcularMerkleRaizSaldo,
        contaId: sessao.id,
        contraparte: participanteInstitutoMurzo.nome,
        descricao: "Doação Instituto Murzo",
        idempotenciaBase: idempotenciaDoacao,
        metadadosCifrados: criptografar(JSON.stringify({
          cnpj: documentoInstitutoMurzo,
          destino: participanteInstitutoMurzo.nome,
          origem: "doacao_instituto_murzo",
          referencia: referenciaPublica
        })),
        referenciaPublica,
        valorCentavos
      });
      const transacao = await consolidarComprovantePersistido(
        sessao.id,
        await serializarMovimentoDetalhado(movimento, sessao)
      );

      await registrarEventoSeguranca("doacao_murzo_liquidada", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        doacao: {
          destinatario: participanteInstitutoMurzo,
          referencia: transacao.referencia,
          transacaoId: movimento.id,
          valor: formatarMoeda(valorCentavos),
          valorCentavos
        }
      });
    } catch (erro) {
      const mensagemErro = erro instanceof Error ? erro.message : "";
      await registrarEventoSeguranca("doacao_murzo_recusada", sessao.referencia_publica, contextoRequisicao(requisicao), {
        ...detalhesSegurancaRequisicao(requisicao, sessao.id),
        detalhesCifrados: criptografar(JSON.stringify({ motivo: mensagemErro }))
      });

      if (mensagemErro === "saldo_insuficiente") {
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Saldo insuficiente para concluir a doação."
        });
      }

      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível concluir essa doação agora."
      });
    }
  }
);

servidor.post(
  "/pagamentos/boleto/validar",
  {
    config: {
      rateLimit: {
        max: 40,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/pagamentos/boleto/validar",
      ["codigo"]
    ) as CorpoPagamentoBoleto | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "pagamento_boleto_validar", sessao, 20, "10 minutes"))) return resposta;

    const validacao = validarBoletoBancario(corpo.codigo);
    if (!validacao.ok) {
      await registrarEventoSeguranca("pagamento_boleto_codigo_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: validacao.mensagem
      });
    }

    if (await boletoBancarioJaLiquidado(hashCodigoBarrasBoleto(validacao.boleto.codigoBarras))) {
      await registrarEventoSeguranca("pagamento_boleto_ja_pago", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Este boleto já foi pago."
      });
    }

    return resposta.header("Cache-Control", "no-store").send({
      estado: "ok",
      boleto: validacao.boleto
    });
  }
);

servidor.post(
  "/pagamentos/boleto/confirmar",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/pagamentos/boleto/confirmar",
      ["codigo"]
    ) as CorpoPagamentoBoleto | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "pagamento_boleto_confirmar", sessao, 6, "10 minutes"))) return resposta;

    const validacao = validarBoletoBancario(corpo.codigo);
    const idempotencia = metadadosEnvelopeSeguro(corpo)?.idempotencia ?? "";
    const codigoBarrasHash = validacao.ok ? hashCodigoBarrasBoleto(validacao.boleto.codigoBarras) : "";
    const idBase = idempotencia && validacao.ok
      ? createHash("sha256").update(`boleto:${sessao.id}:${validacao.boleto.codigoBarras}:${idempotencia}`).digest("hex").slice(0, 24)
      : "";
    const idempotenciaPagamento = idBase ? `pagamento:boleto:${idBase}` : "";
    const referenciaPublica = criarReferenciaPublicaPagamentoBoleto();

    if (!validacao.ok || !idempotenciaPagamento) {
      await registrarEventoSeguranca("pagamento_boleto_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: validacao.ok ? "Não foi possível preparar esse pagamento agora." : validacao.mensagem
      });
    }

    try {
      if (await boletoBancarioJaLiquidado(codigoBarrasHash)) {
        await registrarEventoSeguranca("pagamento_boleto_ja_pago", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Este boleto já foi pago."
        });
      }

      const saldoSuficiente = await saldoDisponivelCobreValor(sessao, requisicao, resposta, validacao.boleto.valorCentavos);
      if (saldoSuficiente === null) return resposta;
      if (!saldoSuficiente) {
        await registrarEventoSeguranca("pagamento_boleto_saldo_insuficiente", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Saldo insuficiente para concluir o pagamento."
        });
      }

      const movimento = await liquidarPagamentoBoletoConta({
        assinarLancamento: assinarLancamentoSaldo,
        assinarPartida: assinarPartidaDobradaSaldo,
        assinarSaldo: assinarSaldoConta,
        bancoCodigo: validacao.boleto.bancoCodigo,
        bancoNome: validacao.boleto.bancoNome,
        calcularMerkleRaiz: calcularMerkleRaizSaldo,
        codigoBarrasHash,
        contaId: sessao.id,
        contraparte: validacao.boleto.bancoNome,
        descricao: "Pagamento de boleto",
        idempotenciaBase: idempotenciaPagamento,
        metadadosCifrados: criptografar(JSON.stringify({
          bancoCodigo: validacao.boleto.bancoCodigo,
          bancoNome: validacao.boleto.bancoNome,
          codigoBarrasHash,
          codigoMascarado: mascararCodigoBoleto(validacao.boleto.linhaDigitavel),
          origem: "pagamento_boleto",
          referencia: referenciaPublica,
          valorCentavos: validacao.boleto.valorCentavos,
          vencimento: validacao.boleto.vencimento
        })),
        referenciaPublica,
        valorCentavos: validacao.boleto.valorCentavos
      });
      const transacao = await consolidarComprovantePersistido(
        sessao.id,
        await serializarMovimentoDetalhado(movimento, sessao)
      );

      await registrarEventoSeguranca("pagamento_boleto_liquidado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        pagamento: {
          bancoCodigo: validacao.boleto.bancoCodigo,
          bancoNome: validacao.boleto.bancoNome,
          referencia: transacao.referencia,
          transacaoId: movimento.id,
          valor: validacao.boleto.valor,
          valorCentavos: validacao.boleto.valorCentavos,
          vencimento: validacao.boleto.vencimento,
          vencimentoTexto: validacao.boleto.vencimentoTexto
        }
      });
    } catch (erro) {
      const mensagemErro = erro instanceof Error ? erro.message : "";
      await registrarEventoSeguranca("pagamento_boleto_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), {
        ...detalhesSegurancaRequisicao(requisicao, sessao.id),
        detalhesCifrados: criptografar(JSON.stringify({ motivo: mensagemErro }))
      });

      if (mensagemErro === "saldo_insuficiente") {
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Saldo insuficiente para concluir o pagamento."
        });
      }

      if (mensagemErro === "boleto_ja_pago") {
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Este boleto já foi pago."
        });
      }

      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível concluir esse pagamento agora."
      });
    }
  }
);

servidor.post(
  "/pagamentos/celular/validar",
  {
    config: {
      rateLimit: {
        max: 40,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/pagamentos/celular/validar",
      ["telefone"]
    ) as CorpoRecargaCelularValidar | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "recarga_celular_validar", sessao, 20, "10 minutes"))) return resposta;

    const validacao = validarRecargaCelular(corpo.telefone);
    if (!validacao.ok) {
      await registrarEventoSeguranca("recarga_celular_numero_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: validacao.mensagem
      });
    }

    return resposta.header("Cache-Control", "no-store").send({
      estado: "ok",
      recarga: validacao.recarga
    });
  }
);

servidor.post(
  "/pagamentos/celular/confirmar",
  {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/pagamentos/celular/confirmar",
      ["telefone", "valorCentavos"]
    ) as CorpoRecargaCelularConfirmar | null;
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "recarga_celular_confirmar", sessao, 6, "10 minutes"))) return resposta;

    const validacao = validarRecargaCelular(corpo.telefone);
    const valorCentavos = typeof corpo.valorCentavos === "number" ? corpo.valorCentavos : Number(corpo.valorCentavos);
    const idempotencia = metadadosEnvelopeSeguro(corpo)?.idempotencia ?? "";
    const idBase = idempotencia && validacao.ok
      ? createHash("sha256")
          .update(`recarga:${sessao.id}:${validacao.recarga.e164}:${valorCentavos}:${idempotencia}`)
          .digest("hex")
          .slice(0, 24)
      : "";
    const idempotenciaRecarga = idBase ? `pagamento:recarga:${idBase}` : "";
    const referenciaPublica = criarReferenciaPublicaRecargaCelular();

    if (
      !validacao.ok ||
      !idempotenciaRecarga ||
      !Number.isSafeInteger(valorCentavos) ||
      valorCentavos < valorMinimoRecargaCelularCentavos ||
      valorCentavos > valorMaximoRecargaCelularCentavos ||
      valorCentavos % 100 !== 0
    ) {
      await registrarEventoSeguranca("recarga_celular_payload_recusado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.code(400).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: validacao.ok ? "Informe um valor permitido para a recarga." : validacao.mensagem
      });
    }

    try {
      const saldoSuficiente = await saldoDisponivelCobreValor(sessao, requisicao, resposta, valorCentavos);
      if (saldoSuficiente === null) return resposta;
      if (!saldoSuficiente) {
        await registrarEventoSeguranca("recarga_celular_saldo_insuficiente", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Saldo insuficiente para concluir a recarga."
        });
      }

      const telefoneHash = indiceSeguro(`recarga-celular:v1:${validacao.recarga.e164}`);
      const telefoneMascarado = mascararTelefoneRecarga(validacao.recarga);
      const movimento = await liquidarRecargaCelularConta({
        assinarLancamento: assinarLancamentoSaldo,
        assinarPartida: assinarPartidaDobradaSaldo,
        assinarSaldo: assinarSaldoConta,
        calcularMerkleRaiz: calcularMerkleRaizSaldo,
        contaId: sessao.id,
        descricao: `Recarga de celular ${telefoneMascarado}`,
        idempotenciaBase: idempotenciaRecarga,
        metadadosCifrados: criptografar(JSON.stringify({
          ddd: validacao.recarga.ddd,
          operadora: validacao.recarga.operadora,
          origem: "recarga_celular",
          referencia: referenciaPublica,
          telefoneHash,
          telefoneMascarado,
          valorCentavos
        })),
        operadora: validacao.recarga.operadora,
        referenciaPublica,
        telefoneHash,
        valorCentavos
      });
      const transacao = await consolidarComprovantePersistido(
        sessao.id,
        await serializarMovimentoDetalhado(movimento, sessao)
      );

      await registrarEventoSeguranca("recarga_celular_liquidada", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        recarga: {
          operadora: validacao.recarga.operadora,
          referencia: transacao.referencia,
          telefone: validacao.recarga.telefone,
          transacaoId: movimento.id,
          valor: formatarMoeda(valorCentavos),
          valorCentavos
        }
      });
    } catch (erro) {
      const mensagemErro = erro instanceof Error ? erro.message : "";
      await registrarEventoSeguranca("recarga_celular_recusada", sessao.referencia_publica, contextoRequisicao(requisicao), {
        ...detalhesSegurancaRequisicao(requisicao, sessao.id),
        detalhesCifrados: criptografar(JSON.stringify({ motivo: mensagemErro }))
      });

      if (mensagemErro === "saldo_insuficiente") {
        return resposta.code(409).header("Cache-Control", "no-store").send({
          estado: "erro",
          mensagem: "Saldo insuficiente para concluir a recarga."
        });
      }

      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível concluir essa recarga agora."
      });
    }
  }
);

servidor.post(
  "/emprestimos/elegibilidade",
  {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: "10 minutes"
      }
    }
  },
  async (requisicao, resposta) => {
    if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
    if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
    const corpo = await validarJsonEnvelopeSeguro(
      requisicao,
      resposta,
      "painel-cliente",
      "/emprestimos/elegibilidade",
      []
    );
    if (!corpo) return resposta;

    const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
    if (!sessao) return resposta;
    if (!(await validarRateLimitFinanceiro(requisicao, resposta, "emprestimos_elegibilidade", sessao, 30, "10 minutes"))) {
      return resposta;
    }

    try {
      const elegibilidade = await obterElegibilidadeCreditoConta({
        contaId: sessao.id,
        criptografar
      });

      return resposta.header("Cache-Control", "no-store").send({
        estado: "ok",
        emprestimos: {
          elegibilidade: {
            atualizadoEm: elegibilidade.calculadoEm.toISOString(),
            estado: elegibilidade.estado,
            faixa: elegibilidade.faixa,
            limite: formatarMoeda(elegibilidade.limiteCentavos),
            limiteCentavos: elegibilidade.limiteCentavos,
            modelo: elegibilidade.modelo,
            motivo: elegibilidade.motivo,
            proximaAtualizacaoEm: elegibilidade.expiraEm.toISOString(),
            taxaMensal: formatarTaxaMensalCredito(elegibilidade.taxaMensalBps),
            taxaMensalBps: elegibilidade.taxaMensalBps
          }
        }
      });
    } catch (erro) {
      await registrarEventoSeguranca(
        "emprestimo_elegibilidade_recusada",
        sessao.referencia_publica,
        contextoRequisicao(requisicao),
        {
          ...detalhesSegurancaRequisicao(requisicao, sessao.id),
          detalhesCifrados: criptografar(JSON.stringify({ motivo: erro instanceof Error ? erro.message : "indisponivel" }))
        }
      );

      return resposta.code(409).header("Cache-Control", "no-store").send({
        estado: "erro",
        mensagem: "Não foi possível consultar a análise de crédito agora."
      });
    }
  }
);

servidor.post("/financeiro/saldo", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
  if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
  const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "painel-cliente", "/financeiro/saldo", []);
  if (!corpo) return resposta;

  const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
  if (!sessao) return resposta;
  if (!(await validarRateLimitFinanceiro(requisicao, resposta, "financeiro_saldo", sessao, 60))) return resposta;

  try {
    await processarAgendamentosNexVencidos(sessao, requisicao);
  } catch {
    await registrarEventoSeguranca("nex_agendamento_processamento_erro", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
  }

  const saldoPainel = await obterSaldoPainelAutorizado(sessao, requisicao, resposta);
  if (!saldoPainel) return resposta;

  return resposta.header("Cache-Control", "no-store").send({
    estado: "ok",
    saldo: {
      disponivel: saldoPainel.saldoDisponivel,
      disponivelCentavos: saldoPainel.saldoDisponivelCentavos,
      total: saldoPainel.saldoTotal,
      totalCentavos: saldoPainel.saldoTotalCentavos,
      moeda: saldoPainel.moeda
    }
  });
});

servidor.post("/financeiro/transacoes", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
  if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
  const corpo = await validarJsonEnvelopeSeguro(
    requisicao,
    resposta,
    "painel-cliente",
    "/financeiro/transacoes",
    ["pesquisa", "pagina", "limite", "ordenar", "periodo", "inicio", "fim", "categoria", "tipo"]
  ) as CorpoTransacoesFinanceiras | null;
  if (!corpo) return resposta;

  const filtros = normalizarFiltrosExtrato(corpo, { limiteMaximo: 50 });
  if (!filtros) {
    await registrarEventoSeguranca("financeiro_filtro_recusado", null, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao));
    return resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível processar a consulta."
    });
  }

  const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
  if (!sessao) return resposta;
  if (!(await validarRateLimitFinanceiro(requisicao, resposta, "financeiro_transacoes", sessao, 45))) return resposta;

  try {
    await processarAgendamentosNexVencidos(sessao, requisicao);
  } catch {
    await registrarEventoSeguranca("nex_agendamento_processamento_erro", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
  }

  const resultado = await buscarMovimentosFinanceirosConta(sessao.id, filtros);
  return resposta.header("Cache-Control", "no-store").send({
    estado: "ok",
    transacoes: {
      itens: resultado.itens.map(serializarMovimento),
      limite: filtros.limite,
      pagina: filtros.pagina,
      temMais: filtros.pagina * filtros.limite < resultado.total,
      total: resultado.total
    }
  });
});

servidor.post("/financeiro/transacao", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
  if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
  const corpo = await validarJsonEnvelopeSeguro(
    requisicao,
    resposta,
    "painel-cliente",
    "/financeiro/transacao",
    ["id"]
  ) as CorpoTransacaoFinanceira | null;
  if (!corpo) return resposta;

  const id = typeof corpo.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(corpo.id)
    ? corpo.id
    : "";
  if (!id) {
    await registrarEventoSeguranca("financeiro_transacao_id_recusado", null, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao));
    return resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível consultar a transação."
    });
  }

  const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
  if (!sessao) return resposta;
  if (!(await validarRateLimitFinanceiro(requisicao, resposta, "financeiro_transacao", sessao, 40))) return resposta;

  const movimento = await buscarMovimentoFinanceiroContaPorId(sessao.id, id);
  if (!movimento) {
    await registrarEventoSeguranca("financeiro_transacao_nao_encontrada", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
    return resposta.code(404).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível consultar a transação."
    });
  }

  return resposta.header("Cache-Control", "no-store").send({
    estado: "ok",
    transacao: await serializarMovimentoDetalhado(movimento, sessao)
  });
});

servidor.post("/financeiro/transacao/comprovante", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
  if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
  const corpo = await validarJsonEnvelopeSeguro(
    requisicao,
    resposta,
    "painel-cliente",
    "/financeiro/transacao/comprovante",
    ["id", "formato"]
  ) as CorpoComprovanteFinanceiro | null;
  if (!corpo) return resposta;

  const id =
    typeof corpo.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(corpo.id)
      ? corpo.id
      : "";
  const formato = corpo.formato === "png" ? "png" : corpo.formato === "pdf" ? "pdf" : "";

  if (!id || !formato) {
    await registrarEventoSeguranca("financeiro_comprovante_parametro_recusado", null, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao));
    return resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível gerar o comprovante."
    });
  }

  const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
  if (!sessao) return resposta;
  if (!(await validarRateLimitFinanceiro(requisicao, resposta, "financeiro_comprovante", sessao, 12))) return resposta;

  const movimento = await buscarMovimentoFinanceiroContaPorId(sessao.id, id);
  if (!movimento) {
    await registrarEventoSeguranca("financeiro_comprovante_nao_encontrado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
    return resposta.code(404).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível gerar o comprovante."
    });
  }

  if (movimento.status !== "liquidado") {
    await registrarEventoSeguranca("financeiro_comprovante_movimento_nao_liquidado", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
    return resposta.code(409).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível gerar o comprovante."
    });
  }

  let transacao: TransacaoDetalhadaPublica;

  try {
    transacao = await consolidarComprovantePersistido(sessao.id, await serializarMovimentoDetalhado(movimento, sessao));
  } catch {
    await registrarEventoSeguranca("financeiro_comprovante_divergente", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
    return resposta.code(409).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível gerar o comprovante."
    });
  }

  const arquivo = await gerarComprovanteTransacao(transacao, formato);
  const nome = `comprovante-netcatbank-${transacao.referencia.toLowerCase()}.${formato}`;

  await registrarEventoSeguranca("financeiro_comprovante_emitido", sessao.referencia_publica, contextoRequisicao(requisicao), {
    ...detalhesSegurancaRequisicao(requisicao, sessao.id),
    detalhesCifrados: criptografar(JSON.stringify({ formato }))
  });

  return resposta
    .header("Cache-Control", "no-store")
    .header("Cross-Origin-Resource-Policy", "same-origin")
    .header("Content-Disposition", `attachment; filename="${nome}"`)
    .header("Content-Security-Policy", "sandbox")
    .header("Content-Type", formato === "png" ? "image/png" : "application/pdf")
    .header("X-Content-Type-Options", "nosniff")
    .header("X-Download-Options", "noopen")
    .send(arquivo);
});

servidor.post("/financeiro/agendamentos", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
  if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
  const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "painel-cliente", "/financeiro/agendamentos", []);
  if (!corpo) return resposta;

  const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
  if (!sessao) return resposta;
  if (!(await validarRateLimitFinanceiro(requisicao, resposta, "financeiro_agendamentos", sessao, 30))) return resposta;

  try {
    await processarAgendamentosNexVencidos(sessao, requisicao);
  } catch {
    await registrarEventoSeguranca("nex_agendamento_processamento_erro", sessao.referencia_publica, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao, sessao.id));
  }

  const agendamentos = await buscarAgendamentosFinanceirosConta(sessao.id);
  return resposta.header("Cache-Control", "no-store").send({
    agendamentos: agendamentos.map((agendamento) => ({
      categoria: agendamento.categoria,
      contraparte: agendamento.contraparte,
      data: agendamento.agendado_para.toISOString(),
      descricao: agendamento.descricao,
      id: agendamento.id,
      referencia: agendamento.referencia_publica ?? undefined,
      status: agendamento.status,
      tipo: agendamento.direcao,
      tipoOperacao: agendamento.tipo,
      valor: `${agendamento.direcao === "entrada" ? "+" : "-"} ${formatarMoeda(Number(agendamento.valor_centavos))}`,
      valorCentavos: Number(agendamento.valor_centavos)
    })),
    estado: "ok"
  });
});

servidor.post("/financeiro/graficos", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
  if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
  const corpo = await validarJsonEnvelopeSeguro(
    requisicao,
    resposta,
    "painel-cliente",
    "/financeiro/graficos",
    ["mes"]
  ) as CorpoGraficosFinanceiros | null;
  if (!corpo) return resposta;

  const agora = new Date();
  const mesAtual = `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, "0")}`;
  const mes = mesGraficoValido(corpo.mes ?? mesAtual);
  if (!mes) {
    await registrarEventoSeguranca("financeiro_grafico_mes_recusado", null, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao));
    return resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível processar a consulta."
    });
  }

  const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
  if (!sessao) return resposta;
  if (!(await validarRateLimitFinanceiro(requisicao, resposta, "financeiro_graficos", sessao, 35))) return resposta;

  const grafico = await buscarGraficoFinanceiroConta(sessao.id, mes);
  return resposta.header("Cache-Control", "no-store").send({
    estado: "ok",
    graficos: {
      categorias: grafico.categorias.map((categoria) => ({
        categoria: categoria.categoria,
        direcao: categoria.direcao,
        valor: formatarMoeda(categoria.valorCentavos),
        valorCentavos: categoria.valorCentavos
      })),
      entradas: formatarMoeda(grafico.entradasCentavos),
      entradasCentavos: grafico.entradasCentavos,
      mes,
      saidas: formatarMoeda(grafico.saidasCentavos),
      saidasCentavos: grafico.saidasCentavos
    }
  });
});

servidor.post("/financeiro/extrato/download", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
  if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
  const corpo = await validarJsonEnvelopeSeguro(
    requisicao,
    resposta,
    "painel-cliente",
    "/financeiro/extrato/download",
    ["pesquisa", "pagina", "limite", "ordenar", "periodo", "inicio", "fim", "categoria", "tipo", "formato"]
  ) as CorpoTransacoesFinanceiras | null;
  if (!corpo) return resposta;

  const formato = formatoDownloadExtratoValido(corpo.formato);
  if (!formato) {
    await registrarEventoSeguranca(
      "financeiro_download_formato_recusado",
      null,
      contextoRequisicao(requisicao),
      detalhesSegurancaRequisicao(requisicao)
    );
    return resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Formato de extrato indisponível."
    });
  }

  const filtrosBase = normalizarFiltrosExtrato(corpo, { limiteMaximo: 50 });
  if (!filtrosBase) {
    await registrarEventoSeguranca("financeiro_download_filtro_recusado", null, contextoRequisicao(requisicao), detalhesSegurancaRequisicao(requisicao));
    return resposta.code(400).header("Cache-Control", "no-store").send({
      estado: "erro",
      mensagem: "Não foi possível processar a consulta."
    });
  }

  const sessao = await obterSessaoPainelAutorizada(requisicao, resposta);
  if (!sessao) return resposta;
  if (!(await validarRateLimitFinanceiro(requisicao, resposta, "financeiro_download", sessao, 8, "10 minutes"))) return resposta;

  const filtrosDownload: FiltrosMovimentosFinanceiros = {
    ...filtrosBase,
    limite: 5_000,
    pagina: 1
  };
  const resultado = await buscarMovimentosFinanceirosConta(sessao.id, filtrosDownload);
  const hoje = dataIsoCurta(new Date());
  const titulo = `Periodo ${filtrosDownload.inicio} a ${filtrosDownload.fim}`;
  const titular = titularExtratoFinanceiro(sessao);
  const arquivos: Record<FormatoDownloadExtrato, { conteudo: Buffer | string; contentType: string }> = {
    csv: {
      conteudo: gerarCsvExtrato(resultado.itens, titular, titulo),
      contentType: "text/csv; charset=utf-8"
    },
    ofx: {
      conteudo: gerarOfxExtrato(resultado.itens, titular, titulo),
      contentType: "application/x-ofx; charset=utf-8"
    },
    pdf: {
      conteudo: montarPdfExtrato(resultado.itens, titulo, titular),
      contentType: "application/pdf"
    }
  };
  const arquivo = arquivos[formato];

  await registrarEventoSeguranca(
    "financeiro_extrato_download_emitido",
    sessao.referencia_publica,
    contextoRequisicao(requisicao),
    {
      ...detalhesSegurancaRequisicao(requisicao, sessao.id),
      detalhesCifrados: criptografar(JSON.stringify({
        formato,
        itens: resultado.itens.length,
        periodoFim: filtrosDownload.fim,
        periodoInicio: filtrosDownload.inicio
      }))
    }
  );

  return resposta
    .header("Cache-Control", "no-store")
    .header("Content-Security-Policy", "sandbox")
    .header("Cross-Origin-Resource-Policy", "same-origin")
    .header("Content-Type", arquivo.contentType)
    .header("Content-Disposition", `attachment; filename="extrato-netcatbank-${hoje}.${formato}"`)
    .header("X-Content-Type-Options", "nosniff")
    .header("X-Download-Options", "noopen")
    .send(arquivo.conteudo);
});

servidor.post("/auth/sair", async (requisicao, resposta) => {
  if (!(await validarCabecalhosSensivel(requisicao, resposta, "painel-cliente"))) return resposta;
  if (!(await validarCsrfRequisicao(requisicao, resposta, { exigirCookie: true }))) return resposta;
  const corpo = await validarJsonEnvelopeSeguro(requisicao, resposta, "painel-cliente", "/auth/sair", []);
  if (!corpo) return resposta;

  const tokensSessao = lerCookies(requisicao.headers.cookie, cookiesNetCat.sessao);
  for (const tokenSessao of tokensSessao) {
    await encerrarSessaoCliente(hashToken(tokenSessao));
  }

  return resposta
    .header("Cache-Control", "no-store")
    .header("Clear-Site-Data", '"cache", "storage"')
    .header("Set-Cookie", cookiesLimpezaSessaoCliente())
    .send({ estado: "ok" });
});

servidor.setNotFoundHandler((requisicao, resposta) =>
  responderErro(
    404,
    "Endereço não encontrado.",
    "A rota solicitada não existe no canal interno do NetCat Bank.",
    "canal interno · rota não encontrada",
    requisicao,
    resposta
  )
);

servidor.setErrorHandler((erro, requisicao, resposta) => {
  servidor.log.error(erro);

  const statusCode =
    typeof erro === "object" && erro !== null && "statusCode" in erro
      ? (erro as { statusCode?: unknown }).statusCode
      : undefined;
  const codigo =
    typeof statusCode === "number" && statusCode >= 400
      ? statusCode
      : 500;
  const falhaServidor = codigo >= 500;
  const excessoRequisicoes = codigo === 429;

  return responderErro(
    codigo,
    falhaServidor
      ? "Serviço indisponível."
      : excessoRequisicoes
        ? "Muitas verificações em sequência."
        : "Solicitação bloqueada.",
    falhaServidor
      ? "Houve uma falha temporária ao processar esta solicitação."
      : excessoRequisicoes
        ? "Aguarde alguns segundos antes de tentar novamente."
        : "A solicitação não pôde ser concluída com os parâmetros enviados.",
    falhaServidor
      ? "canal interno · monitoramento de indisponibilidade"
      : excessoRequisicoes
        ? "canal interno · controle de requisições"
        : "canal interno · política de segurança",
    requisicao,
    resposta
  );
});

const iniciar = async () => {
  try {
    await prepararBanco();
    await servidor.listen({ host, port: porta });
  } catch (erro) {
    servidor.log.error(erro);
    process.exit(1);
  }
};

void iniciar();

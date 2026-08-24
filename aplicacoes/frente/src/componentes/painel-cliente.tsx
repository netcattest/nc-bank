"use client";

import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Barcode,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  Fingerprint,
  Gift,
  HandCoins,
  HeartHandshake,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  Menu,
  Phone,
  Plus,
  QrCode,
  ReceiptText,
  Repeat2,
  ScanBarcode,
  ShieldCheck,
  SendHorizontal,
  Share2,
  Shuffle,
  Smartphone,
  Trash2,
  WalletCards,
  X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { urlAreaCliente } from "../configuracao/publica";
import {
  buscarApiNetCat,
  cabecalhosEnvelopeNetCat,
  cabecalhosNetCat,
  criptografarPayloadNetCat,
  limparEstadoSensivelNetCat
} from "../seguranca/transporte";

type EstadoPainel = "carregando" | "autorizado" | "erro";
type EstadoJanelaPainel = "verificando" | "permitida" | "bloqueada";
export type TelaPainel =
  | "dashboard"
  | "nex"
  | "nex-chave"
  | "nex-enviar"
  | "nex-agendar"
  | "nex-receber"
  | "nex-escanear"
  | "nex-recorrentes"
  | "nex-atividades"
  | "agendamento"
  | "pagamentos"
  | "pagamento-boleto"
  | "recarga-celular"
  | "doacoes"
  | "doacao-instituto"
  | "emprestimos"
  | "emprestimos-como-funciona"
  | "saldo"
  | "extrato"
  | "graficos"
  | "transacao";
type TipoChaveNex = "aleatoria" | "email" | "telefone" | "documento";
type EtapaModalChaveNex = "tipo" | "dados" | "confirmar";
type EtapaEnvioNex = "chave" | "valor" | "revisao" | "sucesso";
type EtapaAgendamentoNex = "chave" | "data" | "valor" | "revisao" | "sucesso";
type EtapaDoacaoMurzo = "valor" | "revisao" | "sucesso";
type EtapaPagamentoBoleto = "codigo" | "revisao" | "sucesso";
type EtapaRecargaCelular = "numero" | "valor" | "revisao" | "sucesso";

type ChaveNexVisual = {
  criadaEm: string;
  estado?: "ativa" | "pendente_verificacao";
  id: string;
  tipo: TipoChaveNex;
  valor: string;
  verificacaoPendente?: boolean;
};

type RegistroJanelaPainel = {
  id: string;
  criadoEm: number;
  atualizadoEm: number;
  contexto: "painel-cliente";
};

type RespostaSessao = {
  estado?: string;
  cliente?: {
    apresentacao?: string;
    documentoNex?: string;
    produto?: string;
  };
  painel?: {
    saldoDisponivel?: string;
    saldoDisponivelCentavos?: number;
    saldoTotal?: string;
    saldoTotalCentavos?: number;
    moeda?: string;
    saldosVersao?: number;
    nex?: string;
    cartao?: string;
  };
  seguranca?: {
    doisFatoresAtivo?: boolean;
  };
  indicacoes?: {
    boasVindas?: {
      indicadorPrimeiroNome?: string;
      recompensa?: string;
    } | null;
    disponivel?: boolean;
    expiraEm?: string;
    liquidadas?: number;
    status?: StatusIndicacao;
  };
};

type RespostaCsrf = {
  controle?: {
    csrf?: string;
  };
};

type RespostaDoisFatores = {
  estado?: string;
  mensagem?: string;
  doisFatores?: {
    ativo?: boolean;
    emissor?: string;
    conta?: string;
    chaveManual?: string;
    qrSvg?: string;
  };
};

type EtapaDoisFatores = "convite" | "qr" | "confirmado";

type MovimentoFinanceiro = {
  categoria: string;
  comprovanteTitulo?: string;
  contraparte: string | null;
  data: string;
  descricao: string;
  id: string;
  instituicao?: string;
  liquidadoEm?: string;
  pagador?: ParticipanteComprovante;
  referencia?: string;
  recebedor?: ParticipanteComprovante;
  resumo?: string;
  status?: string;
  tipo: "entrada" | "saida";
  tipoOperacao: string;
  valor: string;
  valorCentavos: number;
};

type ParticipanteComprovante = {
  chave: string;
  documento: string;
  instituicao: string;
  nome: string;
};

type RespostaSaldoFinanceiro = {
  estado?: string;
  saldo?: {
    disponivel?: string;
    disponivelCentavos?: number;
    total?: string;
    totalCentavos?: number;
    moeda?: string;
  };
};

type RespostaTransacoesFinanceiras = {
  estado?: string;
  transacoes?: {
    itens?: MovimentoFinanceiro[];
    limite?: number;
    pagina?: number;
    temMais?: boolean;
    total?: number;
  };
};

type RespostaTransacaoFinanceira = {
  estado?: string;
  transacao?: MovimentoFinanceiro;
};

type RespostaAgendamentosFinanceiros = {
  estado?: string;
  agendamentos?: MovimentoFinanceiro[];
};

type RespostaDoacaoMurzo = {
  doacao?: {
    destinatario?: ParticipanteComprovante;
    referencia?: string;
    transacaoId?: string;
    valor?: string;
    valorCentavos?: number;
  };
  estado?: string;
  mensagem?: string;
};

type BoletoValidadoVisual = {
  bancoCodigo: string;
  bancoNome: string;
  codigoBarras: string;
  linhaDigitavel: string;
  moeda: "BRL";
  referencia: string;
  valor: string;
  valorCentavos: number;
  vencimento?: string | null;
  vencimentoTexto: string;
};

type RespostaValidacaoBoleto = {
  boleto?: BoletoValidadoVisual;
  estado?: string;
  mensagem?: string;
};

type PagamentoBoletoVisual = {
  bancoCodigo?: string;
  bancoNome?: string;
  referencia?: string;
  transacaoId?: string;
  valor?: string;
  valorCentavos?: number;
  vencimento?: string | null;
  vencimentoTexto?: string;
};

type RespostaPagamentoBoleto = {
  estado?: string;
  mensagem?: string;
  pagamento?: PagamentoBoletoVisual;
};

type RecargaCelularValidadaVisual = {
  ddd: string;
  e164: string;
  moeda: "BRL";
  numero: string;
  observacaoOperadora?: string;
  operadora: string;
  operadoraConfianca?: "estimada";
  telefone: string;
  valorMaximo: string;
  valorMaximoCentavos: number;
  valorMinimo: string;
  valorMinimoCentavos: number;
  valoresSugeridosCentavos: number[];
};

type RespostaValidacaoRecargaCelular = {
  estado?: string;
  mensagem?: string;
  recarga?: RecargaCelularValidadaVisual;
};

type PagamentoRecargaCelularVisual = {
  operadora?: string;
  referencia?: string;
  telefone?: string;
  transacaoId?: string;
  valor?: string;
  valorCentavos?: number;
};

type RespostaPagamentoRecargaCelular = {
  estado?: string;
  mensagem?: string;
  recarga?: PagamentoRecargaCelularVisual;
};

type ElegibilidadeEmprestimoVisual = {
  atualizadoEm?: string;
  estado?: "disponivel" | "analise";
  faixa?: "em_analise" | "inicial" | "moderada" | "forte";
  limite?: string;
  limiteCentavos?: number;
  modelo?: string;
  motivo?: string;
  proximaAtualizacaoEm?: string;
  taxaMensal?: string;
  taxaMensalBps?: number;
};

type RespostaElegibilidadeEmprestimo = {
  emprestimos?: {
    elegibilidade?: ElegibilidadeEmprestimoVisual;
  };
  estado?: string;
  mensagem?: string;
};

type RespostaGraficosFinanceiros = {
  estado?: string;
  graficos?: {
    categorias?: Array<{
      categoria: string;
      direcao?: "entrada" | "saida";
      valor: string;
      valorCentavos: number;
    }>;
    entradas?: string;
    entradasCentavos?: number;
    mes?: string;
    saidas?: string;
    saidasCentavos?: number;
  };
};

type RespostaLinkIndicacao = {
  estado?: string;
  indicacao?: {
    ativa?: boolean;
    expiraEm?: string;
    link?: string;
    liquidadas?: number;
    limiteMensal?: number;
    limiteSemanal?: number;
    motivo?: StatusIndicacao;
    recompensaAmigo?: string;
    recompensaIndicador?: string;
    status?: StatusIndicacao;
    totalPossivel?: string;
  };
};

type RespostaChavesNex = {
  chave?: ChaveNexVisual;
  chaves?: {
    itens?: ChaveNexVisual[];
  };
  estado?: string;
  mensagem?: string;
};

type DestinatarioNexVisual = {
  chave: string;
  chaveTipo?: TipoChaveNex;
  documento?: string;
  instituicao: string;
  nome: string;
};

type TransferenciaNexVisual = {
  destinatario?: DestinatarioNexVisual;
  estado?: string;
  expiraEm?: string;
  id: string;
  referencia?: string;
  transacaoId?: string;
  valor?: string;
  valorCentavos: number;
};

type RespostaResolverNex = {
  destinatario?: DestinatarioNexVisual;
  estado?: string;
  mensagem?: string;
};

type RespostaTransferenciaNex = {
  estado?: string;
  mensagem?: string;
  transferencia?: TransferenciaNexVisual;
};

type AgendamentoNexVisual = {
  agendadoPara: string;
  destinatario?: DestinatarioNexVisual;
  estado?: string;
  id: string;
  referencia?: string;
  valor?: string;
  valorCentavos: number;
};

type QrRecebimentoNexVisual = {
  chave: ChaveNexVisual;
  chaveRecebimento: string;
  conteudo: string;
  expiraEm: string;
  qrSvg: string;
  referencia: string;
  valor?: string;
  valorCentavos?: number;
};

type RespostaQrRecebimentoNex = {
  destinatario?: DestinatarioNexVisual;
  estado?: string;
  mensagem?: string;
  qr?: QrRecebimentoNexVisual & {
    chaveDestino?: string;
  };
};

type RespostaAgendamentoNex = {
  agendamento?: AgendamentoNexVisual;
  estado?: string;
  mensagem?: string;
};

type ContatoNexVisual = {
  chaveSugestao?: string | null;
  direcaoUltima?: "entrada" | "saida";
  nome: string;
  totalTransferencias?: number;
  ultimaEm: string;
  valor: string;
  valorCentavos: number;
};

type RespostaAtividadesNex = {
  estado?: string;
  mensagem?: string;
  nex?: {
    atividades?: {
      itens?: MovimentoFinanceiro[];
      limite?: number;
      pagina?: number;
      temMais?: boolean;
      total?: number;
    };
    recorrentes?: ContatoNexVisual[];
    resumo?: {
      contatos?: number;
      transacoes?: number;
    };
  };
};

type ModalAtivoPainel = "nenhum" | "boas-vindas-indicacao" | "indicacao" | "2fa";
type StatusIndicacao = "ativa" | "limite_atingido" | "expirada" | "indisponivel";

type AbaExtrato = "extrato" | "agendamentos";
type FiltroAbertoPainel = "ordenar" | "periodo" | "categoria" | "tipo" | "mes-grafico" | "";
type OpcaoFiltroPainel = {
  rotulo: string;
  valor: string;
};

type DetectorQrNavegador = {
  detect: (fonte: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

const chaveJanelaPainel = "netcatbank_nc_painel_janela_unica_q6v2";
const canalJanelaPainel = "netcatbank_nc_painel_janela_unica_canal_q6v2";
const chaveSaldoVisivel = "netcatbank_nc_saldo_visivel_v1";
const chaveQrNexLido = "netcatbank_nc_qr_nex_lido_v1";
const chaveEnvioNexPreparado = "netcatbank_nc_envio_nex_preparado_v1";
const chaveAbaExtratoInicial = "netcatbank_nc_painel_extrato_aba_inicial_v1";
const janelaPainelTtlMs = 45_000;
const janelaPainelPulsoMs = 2_000;
const valorMaximoQrRecebimentoCentavosNex = 100_000_000;
const tamanhoMaximoEntradaBoleto = 100;

const somenteDigitos = (valor: string) => valor.replace(/\D/g, "");

const formatarCodigoAutenticador = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 6);
  return digitos.replace(/^(\d{3})(\d+)/, "$1 $2");
};

const formatarNomePainel = (nome: string) => {
  const partes = nome.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (partes.length <= 1) return partes[0] || "cliente";

  const inicialSobrenome = partes[1]?.charAt(0).toLocaleUpperCase("pt-BR") ?? "";
  return `${partes[0]} ${inicialSobrenome}`;
};

const normalizarChaveNex = (tipo: TipoChaveNex, valor: string) => {
  if (tipo === "telefone") return somenteDigitos(valor).slice(0, 11);
  if (tipo === "documento") return valor === "documento-cadastrado" ? valor : somenteDigitos(valor).slice(0, 14);
  if (tipo === "email") return valor.toLowerCase().replace(/\s/g, "").slice(0, 120);
  return valor.trim().slice(0, 80);
};

const formatarTelefoneNex = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
};

const formatarTelefoneRecargaCelular = (valor: string) => {
  let digitos = somenteDigitos(valor).slice(0, 13);
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2);
  return formatarTelefoneNex(digitos);
};

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

const pareceTelefoneNex = (valor: string) => {
  const texto = valor.trim();
  const digitos = somenteDigitos(texto);
  const textoMinusculo = texto.toLocaleLowerCase("pt-BR");
  if (!texto || textoMinusculo.startsWith("ncb-nex-") || textoMinusculo.startsWith("nex-")) return false;
  if (/[a-z@]/i.test(texto) || /[./]/.test(texto)) return false;
  return texto.startsWith("+55") || texto.startsWith("(") || digitos.length === 10;
};

const formatarMoedaNex = (centavos: number) =>
  new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency"
  }).format(centavos / 100);

const formatarValorEntradaNex = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 12);
  const centavos = Number(digitos || "0");
  return formatarMoedaNex(centavos);
};

const centavosValorEntradaNex = (valor: string) => Number(somenteDigitos(valor) || "0");

const formatarCodigoBoletoEntrada = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 47);

  if (digitos.length > 44) {
    const partes = [
      digitos.slice(0, 5),
      digitos.slice(5, 10),
      digitos.slice(10, 15),
      digitos.slice(15, 21),
      digitos.slice(21, 26),
      digitos.slice(26, 32),
      digitos.slice(32, 33),
      digitos.slice(33, 47)
    ];
    return [
      partes[0] && `${partes[0]}${partes[1] ? `.${partes[1]}` : ""}`,
      partes[2] && `${partes[2]}${partes[3] ? `.${partes[3]}` : ""}`,
      partes[4] && `${partes[4]}${partes[5] ? `.${partes[5]}` : ""}`,
      partes[6],
      partes[7]
    ].filter(Boolean).join(" ");
  }

  return digitos.replace(/(\d{5})(?=\d)/g, "$1 ").trim();
};

const codigoBoletoPodeValidar = (valor: string) => {
  const tamanho = somenteDigitos(valor).length;
  return tamanho === 44 || tamanho === 47;
};

const doisDigitos = (valor: number) => String(valor).padStart(2, "0");

const dataIsoLocalNex = (data: Date) =>
  `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;

const horarioInicialAgendamentoNex = () => {
  const data = new Date(Date.now() + 10 * 60 * 1000);
  return {
    data: dataIsoLocalNex(data),
    hora: doisDigitos(data.getHours()),
    minuto: doisDigitos(data.getMinutes())
  };
};

const inicioDiaNex = (data: Date) => {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
};

const primeiroDiaMesNex = (dataIso: string) => {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(dataIso) ? new Date(`${dataIso}T00:00:00`) : new Date();
  return new Date(data.getFullYear(), data.getMonth(), 1);
};

const mesIsoNex = (data: Date) => `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}`;

const criarDiasCalendarioNex = (mesIso: string) => {
  const [anoTexto, mesTexto] = mesIso.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto) - 1;
  const primeiroDia = new Date(ano, mes, 1);
  const inicio = new Date(primeiroDia);
  inicio.setDate(primeiroDia.getDate() - primeiroDia.getDay());
  const hojeInicio = inicioDiaNex(new Date()).getTime();

  return Array.from({ length: 42 }, (_, indice) => {
    const data = new Date(inicio);
    data.setDate(inicio.getDate() + indice);
    return {
      foraDoMes: data.getMonth() !== mes,
      passado: inicioDiaNex(data).getTime() < hojeInicio,
      rotulo: String(data.getDate()),
      valor: dataIsoLocalNex(data)
    };
  });
};

const dataAgendamentoEhHojeNex = (dataIso: string) => dataIso === dataIsoLocalNex(new Date());

const horarioMinimoAgendamentoNex = (dataIso: string) => {
  if (!dataAgendamentoEhHojeNex(dataIso)) return { hora: 0, minuto: 0 };
  const minimo = new Date(Date.now() + 60_000);
  return {
    hora: minimo.getHours(),
    minuto: minimo.getMinutes()
  };
};

const ajustarHorarioAgendamentoNex = (dataIso: string, hora: string, minuto: string) => {
  const minimo = horarioMinimoAgendamentoNex(dataIso);
  let horaNumero = Math.max(0, Math.min(23, Number(hora)));
  let minutoNumero = Math.max(0, Math.min(59, Number(minuto)));

  if (
    dataAgendamentoEhHojeNex(dataIso) &&
    (horaNumero < minimo.hora || (horaNumero === minimo.hora && minutoNumero < minimo.minuto))
  ) {
    horaNumero = minimo.hora;
    minutoNumero = minimo.minuto;
  }

  return {
    hora: doisDigitos(horaNumero),
    minuto: doisDigitos(minutoNumero)
  };
};

const opcoesHorasAgendamentoNex = (dataIso: string) => {
  const minimo = horarioMinimoAgendamentoNex(dataIso);
  const horaInicial = dataAgendamentoEhHojeNex(dataIso) ? minimo.hora : 0;
  return Array.from({ length: 24 - horaInicial }, (_, indice) => doisDigitos(horaInicial + indice));
};

const opcoesMinutosAgendamentoNex = (dataIso: string, hora: string) => {
  const minimo = horarioMinimoAgendamentoNex(dataIso);
  const horaNumero = Number(hora);
  const minutoInicial = dataAgendamentoEhHojeNex(dataIso) && horaNumero === minimo.hora ? minimo.minuto : 0;
  return Array.from({ length: 60 - minutoInicial }, (_, indice) => doisDigitos(minutoInicial + indice));
};

const combinarDataHoraAgendamentoNex = (data: string, hora: string, minuto: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const horaNumero = Number(hora);
  const minutoNumero = Number(minuto);
  if (!Number.isInteger(horaNumero) || horaNumero < 0 || horaNumero > 23) return null;
  if (!Number.isInteger(minutoNumero) || minutoNumero < 0 || minutoNumero > 59) return null;
  const combinada = new Date(`${data}T${doisDigitos(horaNumero)}:${doisDigitos(minutoNumero)}:00`);
  if (!Number.isFinite(combinada.getTime())) return null;
  return combinada;
};

const formatarDataHoraAgendamentoNex = (dataIso: string) => {
  const data = new Date(dataIso);
  if (!Number.isFinite(data.getTime())) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(data);
};

const rotuloTipoChaveNex = (tipo: TipoChaveNex) => {
  if (tipo === "aleatoria") return "Chave aleatória";
  if (tipo === "documento") return "CPF/CNPJ";
  if (tipo === "telefone") return "Telefone";
  return "E-mail";
};

const valorExibicaoChaveNex = (chave: ChaveNexVisual) =>
  chave.valor || (chave.tipo === "documento" ? "Documento cadastrado da conta" : "Chave Nex");

const IconeNex = ({ tamanho = 19 }: { tamanho?: number }) => (
  <svg
    className="painel__icone-nex"
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.9"
    aria-hidden="true"
  >
    <path d="M12 2.8 16.15 7 12 11.15 7.85 7 12 2.8Z" />
    <path d="M17 7.85 21.2 12 17 16.15 12.85 12 17 7.85Z" />
    <path d="M12 12.85 16.15 17 12 21.2 7.85 17 12 12.85Z" />
    <path d="M7 7.85 11.15 12 7 16.15 2.8 12 7 7.85Z" />
    <path d="M9.2 12h5.6M12 9.2v5.6" />
  </svg>
);

const IconeInvestir = ({ tamanho = 19 }: { tamanho?: number }) => (
  <svg
    className="painel__icone-investir"
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.9"
    aria-hidden="true"
  >
    <path d="M4 19.2h16" />
    <path d="M6.2 16.5v-4.1M11.8 16.5V8.6M17.4 16.5V5.4" />
    <path d="M5.2 10.9 10 7.1l4.1 2.8L19.2 4.8" />
    <path d="M15.8 4.8h3.4v3.4" />
  </svg>
);

const IconePagamentos = ({ tamanho = 19 }: { tamanho?: number }) => (
  <svg
    className="painel__icone-pagamentos"
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.9"
    aria-hidden="true"
  >
    <path d="M5.2 4.8h13.6A1.8 1.8 0 0 1 20.6 6.6v10.8a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8V6.6a1.8 1.8 0 0 1 1.8-1.8Z" />
    <path d="M7.1 8.2h9.8M7.1 12h5.8M7.1 15.8h3.4" />
    <path d="m15.1 14.8 1.7 1.7 3.1-4" />
  </svg>
);

const IconeEmprestimo = ({ tamanho = 19 }: { tamanho?: number }) => (
  <svg
    className="painel__icone-emprestimo"
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.9"
    aria-hidden="true"
  >
    <path d="M4.2 13.4h4.5l2.2 2.1a2.7 2.7 0 0 0 1.9.8h2.8a1.4 1.4 0 0 0 0-2.8h-2.4" />
    <path d="m8.7 13.4 2.6-2.6a3.2 3.2 0 0 1 2.3-.9H17a3 3 0 0 1 2 .8l1.6 1.4" />
    <path d="M4.2 10.1V17" />
    <path d="M15.9 4.4a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0Z" />
    <path d="M13.5 2v4.8" />
  </svg>
);

const IconeSetaHistorico = ({ direcao }: { direcao: "voltar" | "avancar" }) => (
  <svg
    className="painel__icone-historico"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2.2"
    aria-hidden="true"
  >
    {direcao === "voltar" ? (
      <>
        <path d="M15 6 9 12l6 6" />
        <path d="M10 12h10" />
      </>
    ) : (
      <>
        <path d="m9 6 6 6-6 6" />
        <path d="M14 12H4" />
      </>
    )}
  </svg>
);

const IconeLupaNc = ({ tamanho = 20 }: { tamanho?: number }) => (
  <svg
    className="painel-financeiro__icone"
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle cx="10.6" cy="10.6" r="6.2" />
    <path d="m15.4 15.4 4.4 4.4" />
    <path d="M8.3 10.6h4.6" />
  </svg>
);

const IconeGraficoNc = ({ tamanho = 20 }: { tamanho?: number }) => (
  <svg
    className="painel-financeiro__icone"
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M4 19h16" />
    <path d="M6.5 16.2v-4.4" />
    <path d="M12 16.2V7.6" />
    <path d="M17.5 16.2v-7" />
    <path d="m5.8 10.2 4.1-3.1 4.2 2.4 4.1-4.1" />
  </svg>
);

const IconeDownloadNc = ({ tamanho = 20 }: { tamanho?: number }) => (
  <svg
    className="painel-financeiro__icone"
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M12 3v10" />
    <path d="m8 9 4 4 4-4" />
    <path d="M5 17.8h14" />
    <path d="M7.4 21h9.2" />
  </svg>
);

const IconeBonusNc = ({ tamanho = 18 }: { tamanho?: number }) => (
  <svg
    className="painel-financeiro__icone painel-financeiro__icone--bonus"
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.9"
    aria-hidden="true"
  >
    <path d="M12 3.4 14.2 8.2l5.2.6-3.85 3.6 1 5.12L12 14.95 7.45 17.52l1-5.12L4.6 8.8l5.2-.6L12 3.4Z" />
    <path d="M12 8.2v4.9" />
    <path d="M9.55 10.65h4.9" />
  </svg>
);

const IconeBoasVindasNc = ({ tamanho = 18 }: { tamanho?: number }) => (
  <svg
    className="painel-financeiro__icone painel-financeiro__icone--boas-vindas"
    width={tamanho}
    height={tamanho}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.9"
    aria-hidden="true"
  >
    <path d="M4.4 10.2h15.2v8.2a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8v-8.2Z" />
    <path d="M3.6 7.2h16.8v3H3.6z" />
    <path d="M12 7.2v13" />
    <path d="M9 7.2C6.6 7 5.4 5.9 5.8 4.5c.4-1.5 2.4-1.4 3.5.1L12 7.2" />
    <path d="M15 7.2c2.4-.2 3.6-1.3 3.2-2.7-.4-1.5-2.4-1.4-3.5.1L12 7.2" />
  </svg>
);

const bloquearCodigoAutenticadorInvalido = (evento: React.FormEvent<HTMLInputElement>) => {
  const texto = (evento.nativeEvent as InputEvent).data;
  if (texto && !/^\d+$/.test(texto)) {
    evento.preventDefault();
  }
};

const gerarIdJanelaPainel = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const sufixo = Math.random().toString(16).slice(2);
  return `janela_${Date.now()}_${sufixo}`;
};

const mesAtualIso = () => {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
};

const mesesDisponiveisAnoAtual = () => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mesAtual = agora.getMonth();
  const formatador = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  });

  return Array.from({ length: mesAtual + 1 }, (_, indice) => {
    const data = new Date(ano, mesAtual - indice, 1);
    return {
      rotulo: formatador.format(data).replace(/^\p{L}/u, (letra) => letra.toLocaleUpperCase("pt-BR")),
      valor: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`
    };
  });
};

const formatarGrupoMes = (data: Date) => {
  const rotulo = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(data);
  return rotulo.replace(/^\p{L}/u, (letra) => letra.toLocaleUpperCase("pt-BR"));
};

const formatarGrupoDia = (data: Date) => {
  const hoje = new Date();
  const hojeInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const dataInicio = new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
  const diferencaDias = Math.round((hojeInicio - dataInicio) / 86_400_000);

  if (diferencaDias === 0) return "Hoje";
  if (diferencaDias === 1) return "Ontem";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short"
  })
    .format(data)
    .replace(".", "");
};

const agruparTransacoes = (itens: MovimentoFinanceiro[]) => {
  const grupos = new Map<string, Map<string, MovimentoFinanceiro[]>>();

  for (const item of itens) {
    const data = new Date(item.data);
    const mes = formatarGrupoMes(data);
    const dia = formatarGrupoDia(data);
    if (!grupos.has(mes)) grupos.set(mes, new Map());
    const grupoDia = grupos.get(mes);
    if (!grupoDia?.has(dia)) grupoDia?.set(dia, []);
    grupoDia?.get(dia)?.push(item);
  }

  return Array.from(grupos.entries()).map(([mes, dias]) => ({
    mes,
    dias: Array.from(dias.entries()).map(([dia, transacoes]) => ({
      dia,
      transacoes
    }))
  }));
};

const valorMascarado = "R$ •••••";
const valoresRapidosDoacaoMurzoCentavos = [1_000, 2_500, 5_000, 10_000];

const institutoMurzoPainel = {
  conta: "Doações sociais NC Bank",
  cnpj: "47.683.291/0001-08",
  cnpjMascarado: "47.683.291/****-08",
  fundacao: "2018",
  instituicao: "NC Bank",
  local: "São Paulo, SP",
  nome: "Instituto Murzo"
};

const opcoesOrdenacaoExtrato: OpcaoFiltroPainel[] = [
  { rotulo: "Ordenar: recentes", valor: "recentes" },
  { rotulo: "Ordenar: antigas", valor: "antigas" },
  { rotulo: "Ordenar: maior valor", valor: "valor_maior" },
  { rotulo: "Ordenar: menor valor", valor: "valor_menor" }
];

const opcoesPeriodoExtrato: OpcaoFiltroPainel[] = [
  { rotulo: "Período: 90 dias", valor: "90d" },
  { rotulo: "Período: 30 dias", valor: "30d" },
  { rotulo: "Período: este mês", valor: "mes_atual" }
];

const opcoesCategoriaExtrato: OpcaoFiltroPainel[] = [
  { rotulo: "Categoria: todas", valor: "" },
  { rotulo: "Geral", valor: "geral" },
  { rotulo: "Serviços", valor: "servicos" },
  { rotulo: "Pagamentos", valor: "pagamentos" },
  { rotulo: "Doações", valor: "doacoes" },
  { rotulo: "Cartões", valor: "cartoes" },
  { rotulo: "Investimentos", valor: "investimentos" },
  { rotulo: "Bônus", valor: "bonus" }
];

const opcoesTipoExtrato: OpcaoFiltroPainel[] = [
  { rotulo: "Tipo: todos", valor: "todos" },
  { rotulo: "Entradas", valor: "entrada" },
  { rotulo: "Saídas", valor: "saida" }
];

const rotulosCategoriasFinanceiras: Record<string, string> = {
  alimentacao: "Alimentação",
  bonus: "Bônus",
  cartoes: "Cartões",
  geral: "Geral",
  investimentos: "Investimentos",
  lazer: "Lazer",
  moradia: "Moradia",
  pagamentos: "Pagamentos",
  servicos: "Serviços",
  doacoes: "Doações",
  transporte: "Transporte"
};

const normalizarInstituicaoBoletoPainel = (valor?: string | null) => {
  const texto = (valor ?? "").normalize("NFKC").trim().replace(/\s{2,}/g, " ");
  const indice = texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

  if (!texto) return "Banco emissor";
  if (indice.includes("nu pagamentos") || indice.includes("nubank") || indice === "nu") return "NU Bank";
  return texto;
};

const lerRegistroJanelaPainel = () => {
  try {
    const bruto = localStorage.getItem(chaveJanelaPainel);
    if (!bruto) return null;
    const registro = JSON.parse(bruto) as Partial<RegistroJanelaPainel>;
    if (
      typeof registro.id !== "string" ||
      typeof registro.criadoEm !== "number" ||
      typeof registro.atualizadoEm !== "number"
    ) {
      return null;
    }

    return registro as RegistroJanelaPainel;
  } catch {
    return null;
  }
};

const registroJanelaAtivo = (
  registro: RegistroJanelaPainel | null,
  agora = Date.now()
): registro is RegistroJanelaPainel =>
  Boolean(registro && agora - registro.atualizadoEm < janelaPainelTtlMs);

const gravarRegistroJanelaPainel = (registro: RegistroJanelaPainel) => {
  localStorage.setItem(chaveJanelaPainel, JSON.stringify(registro));
};

const removerRegistroJanelaPainel = (id: string) => {
  if (!id) return;

  try {
    const registro = lerRegistroJanelaPainel();
    if (registro?.id === id) {
      localStorage.removeItem(chaveJanelaPainel);
    }
  } catch {
  }
};

let csrfPainelCache: { expiraEm: number; token: string } | null = null;
let csrfPainelPromessa: Promise<string> | null = null;

const limparCsrfPainel = () => {
  csrfPainelCache = null;
  csrfPainelPromessa = null;
};

const aguardarPainel = (ms: number) => new Promise<void>((resolver) => window.setTimeout(resolver, ms));

const obterCsrf = async (opcoes: { renovar?: boolean } = {}) => {
  const agora = Date.now();
  if (!opcoes.renovar && csrfPainelCache && csrfPainelCache.expiraEm > agora) {
    return csrfPainelCache.token;
  }

  if (!opcoes.renovar && csrfPainelPromessa) return csrfPainelPromessa;

  csrfPainelPromessa = (async () => {
    const resposta = await buscarApiNetCat("/seguranca/csrf", {
      cache: "no-store",
      credentials: "include",
      headers: await cabecalhosNetCat("csrf-publico")
    });
    const conteudo = (await resposta.json().catch(() => null)) as RespostaCsrf | null;
    if (!resposta.ok || !conteudo?.controle?.csrf) {
      limparCsrfPainel();
      throw new Error("csrf");
    }
    csrfPainelCache = {
      expiraEm: Date.now() + 24 * 60 * 1000,
      token: conteudo.controle.csrf
    };
    return conteudo.controle.csrf;
  })();

  try {
    return await csrfPainelPromessa;
  } finally {
    csrfPainelPromessa = null;
  }
};

const limparPayloadFinanceiro = (payload: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, valor]) => valor !== undefined && typeof valor !== "function" && typeof valor !== "symbol")
  );

class ErroApiNetCat extends Error {
  status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = "ErroApiNetCat";
    this.status = status;
  }
}

const mensagemErroApiNetCat = (erro: unknown, fallback: string) =>
  erro instanceof ErroApiNetCat && erro.message && erro.message !== "financeiro" ? erro.message : fallback;

export function PainelCliente({
  telaInicial = "dashboard",
  agendamentoId,
  transacaoId
}: {
  agendamentoId?: string;
  telaInicial?: TelaPainel;
  transacaoId?: string;
}) {
  const [estado, setEstado] = useState<EstadoPainel>("carregando");
  const [estadoJanela, setEstadoJanela] = useState<EstadoJanelaPainel>("verificando");
  const [dados, setDados] = useState<RespostaSessao | null>(null);
  const [saldoFinanceiro, setSaldoFinanceiro] = useState<RespostaSaldoFinanceiro["saldo"] | null>(null);
  const [transacoes, setTransacoes] = useState<MovimentoFinanceiro[]>([]);
  const [totalTransacoes, setTotalTransacoes] = useState(0);
  const [transacaoDetalhe, setTransacaoDetalhe] = useState<MovimentoFinanceiro | null>(null);
  const [carregandoTransacaoDetalhe, setCarregandoTransacaoDetalhe] = useState(false);
  const [mensagemTransacaoDetalhe, setMensagemTransacaoDetalhe] = useState("");
  const [agendamentoDetalhe, setAgendamentoDetalhe] = useState<MovimentoFinanceiro | null>(null);
  const [carregandoAgendamentoDetalhe, setCarregandoAgendamentoDetalhe] = useState(false);
  const [mensagemAgendamentoDetalhe, setMensagemAgendamentoDetalhe] = useState("");
  const [modalComprovanteAberto, setModalComprovanteAberto] = useState(false);
  const [baixandoComprovante, setBaixandoComprovante] = useState<"pdf" | "png" | "">("");
  const [modalExtratoAberto, setModalExtratoAberto] = useState(false);
  const [baixandoExtrato, setBaixandoExtrato] = useState<"pdf" | "csv" | "ofx" | "">("");
  const [agendamentos, setAgendamentos] = useState<MovimentoFinanceiro[]>([]);
  const [graficos, setGraficos] = useState<RespostaGraficosFinanceiros["graficos"] | null>(null);
  const [abaExtrato, setAbaExtrato] = useState<AbaExtrato>("extrato");
  const [filtroAberto, setFiltroAberto] = useState<FiltroAbertoPainel>("");
  const [pesquisaExtrato, setPesquisaExtrato] = useState("");
  const [ordenarExtrato, setOrdenarExtrato] = useState("recentes");
  const [periodoExtrato, setPeriodoExtrato] = useState("90d");
  const [categoriaExtrato, setCategoriaExtrato] = useState("");
  const [tipoExtrato, setTipoExtrato] = useState("todos");
  const [paginaExtrato, setPaginaExtrato] = useState(1);
  const [mesGrafico, setMesGrafico] = useState(mesAtualIso);
  const [carregandoFinanceiro, setCarregandoFinanceiro] = useState(false);
  const [mensagemFinanceira, setMensagemFinanceira] = useState("");
  const [modal2faAberto, setModal2faAberto] = useState(false);
  const [modalAtivo, setModalAtivo] = useState<ModalAtivoPainel>("nenhum");
  const [etapa2fa, setEtapa2fa] = useState<EtapaDoisFatores>("convite");
  const [configuracao2fa, setConfiguracao2fa] = useState<RespostaDoisFatores["doisFatores"] | null>(null);
  const [codigo2fa, setCodigo2fa] = useState("");
  const [mensagem2fa, setMensagem2fa] = useState("");
  const [processando2fa, setProcessando2fa] = useState(false);
  const [popup2faDispensado, setPopup2faDispensado] = useState(false);
  const [linkIndicacao, setLinkIndicacao] = useState("");
  const [mensagemIndicacao, setMensagemIndicacao] = useState("");
  const [statusIndicacaoModal, setStatusIndicacaoModal] = useState<StatusIndicacao>("ativa");
  const [processandoIndicacao, setProcessandoIndicacao] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [boasVindasIndicacaoVisivel, setBoasVindasIndicacaoVisivel] = useState(false);
  const [folhaMobileAberta, setFolhaMobileAberta] = useState(false);
  const [saldosVisiveis, setSaldosVisiveis] = useState(true);
  const [tipoChaveNex, setTipoChaveNex] = useState<TipoChaveNex>("aleatoria");
  const [entradaChaveNex, setEntradaChaveNex] = useState("");
  const [chavesNex, setChavesNex] = useState<ChaveNexVisual[]>([]);
  const [carregandoChavesNex, setCarregandoChavesNex] = useState(true);
  const [chavesNexCarregadas, setChavesNexCarregadas] = useState(false);
  const [mensagemNex, setMensagemNex] = useState("");
  const [processandoChaveNex, setProcessandoChaveNex] = useState(false);
  const [etapaEnvioNex, setEtapaEnvioNex] = useState<EtapaEnvioNex>("chave");
  const [chaveDestinoNex, setChaveDestinoNex] = useState("");
  const [destinatarioNex, setDestinatarioNex] = useState<DestinatarioNexVisual | null>(null);
  const [valorEnvioNex, setValorEnvioNex] = useState(formatarMoedaNex(0));
  const [transferenciaNex, setTransferenciaNex] = useState<TransferenciaNexVisual | null>(null);
  const [mensagemEnvioNex, setMensagemEnvioNex] = useState("");
  const [processandoEnvioNex, setProcessandoEnvioNex] = useState(false);
  const horarioInicialAgenda = horarioInicialAgendamentoNex();
  const [etapaAgendamentoNex, setEtapaAgendamentoNex] = useState<EtapaAgendamentoNex>("chave");
  const [chaveAgendamentoNex, setChaveAgendamentoNex] = useState("");
  const [destinatarioAgendamentoNex, setDestinatarioAgendamentoNex] = useState<DestinatarioNexVisual | null>(null);
  const [dataAgendamentoNex, setDataAgendamentoNex] = useState(horarioInicialAgenda.data);
  const [horaAgendamentoNex, setHoraAgendamentoNex] = useState(horarioInicialAgenda.hora);
  const [minutoAgendamentoNex, setMinutoAgendamentoNex] = useState(horarioInicialAgenda.minuto);
  const [calendarioAgendamentoAberto, setCalendarioAgendamentoAberto] = useState(false);
  const [mesCalendarioAgendamentoNex, setMesCalendarioAgendamentoNex] = useState(() =>
    mesIsoNex(primeiroDiaMesNex(horarioInicialAgenda.data))
  );
  const [valorAgendamentoNex, setValorAgendamentoNex] = useState(formatarMoedaNex(0));
  const [agendamentoNex, setAgendamentoNex] = useState<AgendamentoNexVisual | null>(null);
  const [mensagemAgendamentoNex, setMensagemAgendamentoNex] = useState("");
  const [processandoAgendamentoNex, setProcessandoAgendamentoNex] = useState(false);
  const [indiceChaveRecebimentoNex, setIndiceChaveRecebimentoNex] = useState(0);
  const [qrsRecebimentoNex, setQrsRecebimentoNex] = useState<Record<string, QrRecebimentoNexVisual>>({});
  const [qrPersonalizadoNex, setQrPersonalizadoNex] = useState<QrRecebimentoNexVisual | null>(null);
  const [modalValorRecebimentoNexAberto, setModalValorRecebimentoNexAberto] = useState(false);
  const [valorRecebimentoNex, setValorRecebimentoNex] = useState(formatarMoedaNex(0));
  const [mensagemRecebimentoNex, setMensagemRecebimentoNex] = useState("");
  const [processandoRecebimentoNex, setProcessandoRecebimentoNex] = useState(false);
  const [modalDoacaoMurzoAberto, setModalDoacaoMurzoAberto] = useState(false);
  const [etapaDoacaoMurzo, setEtapaDoacaoMurzo] = useState<EtapaDoacaoMurzo>("valor");
  const [valorDoacaoMurzo, setValorDoacaoMurzo] = useState(formatarMoedaNex(0));
  const [mensagemDoacaoMurzo, setMensagemDoacaoMurzo] = useState("");
  const [processandoDoacaoMurzo, setProcessandoDoacaoMurzo] = useState(false);
  const [transacaoDoacaoMurzoId, setTransacaoDoacaoMurzoId] = useState("");
  const doacaoMurzoEmAndamento = useRef(false);
  const [etapaPagamentoBoleto, setEtapaPagamentoBoleto] = useState<EtapaPagamentoBoleto>("codigo");
  const [codigoBoleto, setCodigoBoleto] = useState("");
  const [boletoValidado, setBoletoValidado] = useState<BoletoValidadoVisual | null>(null);
  const [pagamentoBoleto, setPagamentoBoleto] = useState<PagamentoBoletoVisual | null>(null);
  const [mensagemBoleto, setMensagemBoleto] = useState("");
  const [processandoBoleto, setProcessandoBoleto] = useState(false);
  const [etapaRecargaCelular, setEtapaRecargaCelular] = useState<EtapaRecargaCelular>("numero");
  const [telefoneRecargaCelular, setTelefoneRecargaCelular] = useState("");
  const [recargaCelularValidada, setRecargaCelularValidada] = useState<RecargaCelularValidadaVisual | null>(null);
  const [valorRecargaCelular, setValorRecargaCelular] = useState(formatarMoedaNex(0));
  const [pagamentoRecargaCelular, setPagamentoRecargaCelular] = useState<PagamentoRecargaCelularVisual | null>(null);
  const [mensagemRecargaCelular, setMensagemRecargaCelular] = useState("");
  const [processandoRecargaCelular, setProcessandoRecargaCelular] = useState(false);
  const [elegibilidadeEmprestimo, setElegibilidadeEmprestimo] = useState<ElegibilidadeEmprestimoVisual | null>(null);
  const [carregandoEmprestimos, setCarregandoEmprestimos] = useState(false);
  const [mensagemEmprestimos, setMensagemEmprestimos] = useState("");
  const [cameraScannerBoletoAtiva, setCameraScannerBoletoAtiva] = useState(false);
  const [scannerBoletoAutorizado, setScannerBoletoAutorizado] = useState(false);
  const [scannerBoletoDispensado, setScannerBoletoDispensado] = useState(false);
  const [modalPermissaoCameraBoletoAberto, setModalPermissaoCameraBoletoAberto] = useState(false);
  const [processandoScannerBoleto, setProcessandoScannerBoleto] = useState(false);
  const [conteudoQrManualNex, setConteudoQrManualNex] = useState("");
  const [mensagemScannerNex, setMensagemScannerNex] = useState("");
  const [cameraScannerNexAtiva, setCameraScannerNexAtiva] = useState(false);
  const [scannerNexAutorizado, setScannerNexAutorizado] = useState(false);
  const [scannerNexDispensado, setScannerNexDispensado] = useState(false);
  const [modalPermissaoCameraNexAberto, setModalPermissaoCameraNexAberto] = useState(false);
  const [processandoScannerNex, setProcessandoScannerNex] = useState(false);
  const [atividadesNex, setAtividadesNex] = useState<MovimentoFinanceiro[]>([]);
  const [contatosNex, setContatosNex] = useState<ContatoNexVisual[]>([]);
  const [totalAtividadesNex, setTotalAtividadesNex] = useState(0);
  const [totalContatosNex, setTotalContatosNex] = useState(0);
  const [paginaAtividadesNex, setPaginaAtividadesNex] = useState(1);
  const [paginaContatosNex, setPaginaContatosNex] = useState(1);
  const [pesquisaAtividadesNex, setPesquisaAtividadesNex] = useState("");
  const [carregandoAtividadesNex, setCarregandoAtividadesNex] = useState(false);
  const [modalChaveNexAberto, setModalChaveNexAberto] = useState(false);
  const [etapaModalChaveNex, setEtapaModalChaveNex] = useState<EtapaModalChaveNex>("tipo");
  const [chaveExclusaoNex, setChaveExclusaoNex] = useState<ChaveNexVisual | null>(null);
  const idJanela = useRef("");
  const possuiTravaJanela = useRef(false);
  const autoResolveuChaveNex = useRef(false);
  const videoScannerBoleto = useRef<HTMLVideoElement | null>(null);
  const streamScannerBoleto = useRef<MediaStream | null>(null);
  const scannerBoletoProcessando = useRef(false);
  const videoScannerNex = useRef<HTMLVideoElement | null>(null);
  const streamScannerNex = useRef<MediaStream | null>(null);
  const scannerNexProcessando = useRef(false);

  useEffect(() => {
    const id = gerarIdJanelaPainel();
    const criadoEm = Date.now();
    let ativo = true;
    let temporizadorPulso: number | undefined;
    let temporizadorSondagem: number | undefined;
    let canal: BroadcastChannel | null = null;

    idJanela.current = id;

    const registroAtual = (): RegistroJanelaPainel => ({
      id,
      criadoEm,
      atualizadoEm: Date.now(),
      contexto: "painel-cliente"
    });

    const bloquearJanela = () => {
      if (!ativo) return;
      possuiTravaJanela.current = false;
      setEstadoJanela("bloqueada");
    };

    const publicarJanelaAtiva = () => {
      if (!possuiTravaJanela.current) return;

      try {
        const registro = registroAtual();
        gravarRegistroJanelaPainel(registro);
        canal?.postMessage({
          tipo: "painel-ativo",
          id,
          criadoEm: registro.criadoEm,
          atualizadoEm: registro.atualizadoEm
        });
      } catch {
      }
    };

    const assumirJanela = () => {
      const registroExistente = lerRegistroJanelaPainel();

      if (registroJanelaAtivo(registroExistente) && registroExistente?.id !== id) {
        bloquearJanela();
        return;
      }

      try {
        gravarRegistroJanelaPainel(registroAtual());
        const confirmacao = lerRegistroJanelaPainel();

        if (confirmacao?.id !== id) {
          bloquearJanela();
          return;
        }

        possuiTravaJanela.current = true;
        setEstadoJanela("permitida");
        temporizadorPulso = window.setInterval(() => {
          const registro = lerRegistroJanelaPainel();

          if (registroJanelaAtivo(registro) && registro?.id !== id) {
            if (criadoEm <= registro.criadoEm) {
              publicarJanelaAtiva();
              return;
            }

            bloquearJanela();
            return;
          }

          publicarJanelaAtiva();
        }, janelaPainelPulsoMs);
      } catch {
        bloquearJanela();
      }
    };

    try {
      canal = new BroadcastChannel(canalJanelaPainel);
      canal.onmessage = (evento) => {
        const mensagem = evento.data as { tipo?: string; id?: string; criadoEm?: number } | undefined;

        if (!mensagem || mensagem.id === id) return;

        if (mensagem.tipo === "sondar-painel" && possuiTravaJanela.current) {
          publicarJanelaAtiva();
          return;
        }

        if (mensagem.tipo === "painel-ativo" && !possuiTravaJanela.current) {
          bloquearJanela();
          return;
        }

        if (mensagem.tipo === "painel-ativo" && possuiTravaJanela.current) {
          if (typeof mensagem.criadoEm === "number" && mensagem.criadoEm < criadoEm) {
            bloquearJanela();
            return;
          }

          publicarJanelaAtiva();
        }
      };
      canal.postMessage({ tipo: "sondar-painel", id, criadoEm });
    } catch {
      canal = null;
    }

    const registroExistente = lerRegistroJanelaPainel();
    if (registroJanelaAtivo(registroExistente) && registroExistente?.id !== id) {
      bloquearJanela();
    } else {
      temporizadorSondagem = window.setTimeout(assumirJanela, canal ? 360 : 0);
    }

    const aoAlterarStorage = (evento: StorageEvent) => {
      if (evento.key !== chaveJanelaPainel || !ativo) return;

      const registro = lerRegistroJanelaPainel();
      if (!registroJanelaAtivo(registro) || registro?.id === id) return;

      if (!possuiTravaJanela.current) {
        bloquearJanela();
        return;
      }

      if (criadoEm <= registro.criadoEm) {
        publicarJanelaAtiva();
        return;
      }

      bloquearJanela();
    };

    const aoOcultarPagina = () => removerRegistroJanelaPainel(id);

    window.addEventListener("storage", aoAlterarStorage);
    window.addEventListener("pagehide", aoOcultarPagina);

    return () => {
      ativo = false;
      if (temporizadorSondagem) window.clearTimeout(temporizadorSondagem);
      if (temporizadorPulso) window.clearInterval(temporizadorPulso);
      window.removeEventListener("storage", aoAlterarStorage);
      window.removeEventListener("pagehide", aoOcultarPagina);
      canal?.close();
      removerRegistroJanelaPainel(id);
    };
  }, []);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chaveSaldoVisivel);
      if (salvo === "oculto") setSaldosVisiveis(false);
      if (salvo === "visivel") setSaldosVisiveis(true);
    } catch {
    }

    const aoAlterarStorage = (evento: StorageEvent) => {
      if (evento.key !== chaveSaldoVisivel) return;
      setSaldosVisiveis(evento.newValue !== "oculto");
    };

    window.addEventListener("storage", aoAlterarStorage);
    return () => window.removeEventListener("storage", aoAlterarStorage);
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem("netcatbank_nc_chave_nex_visual_v1");
    } catch {
    }
  }, []);

  const alternarSaldosVisiveis = useCallback(() => {
    setSaldosVisiveis((valorAtual) => {
      const proximo = !valorAtual;
      try {
        localStorage.setItem(chaveSaldoVisivel, proximo ? "visivel" : "oculto");
      } catch {
      }
      return proximo;
    });
  }, []);

  const copiarChaveNex = useCallback((valor: string) => {
    if (!valor) return;
    void navigator.clipboard
      ?.writeText(valor)
      .then(() => setMensagemNex("Chave copiada."))
      .catch(() => setMensagemNex("Não foi possível copiar agora."));
  }, []);

  useEffect(() => {
    if (estadoJanela !== "permitida") return;
    let ativo = true;

    const carregar = async () => {
      try {
        const resposta = await buscarApiNetCat("/auth/sessao", {
          cache: "no-store",
          credentials: "include",
          headers: await cabecalhosNetCat("painel-cliente")
        });
        const conteudo = (await resposta.json().catch(() => null)) as RespostaSessao | null;

        if (!ativo) return;
        if (!resposta.ok || conteudo?.estado !== "ok") {
          setEstado("erro");
          window.setTimeout(() => window.location.assign(urlAreaCliente), 900);
          return;
        }

        setDados(conteudo);
        setEstado("autorizado");
      } catch {
        if (!ativo) return;
        setEstado("erro");
        window.setTimeout(() => window.location.assign(urlAreaCliente), 900);
      }
    };

    void carregar();
    return () => {
      ativo = false;
    };
  }, [estadoJanela]);

  const sair = useCallback(async () => {
    try {
      const csrf = await obterCsrf();
      const corpoSeguro = await criptografarPayloadNetCat({}, {
        csrf,
        fluxo: "painel-cliente",
        rota: "/auth/sair"
      });
      await buscarApiNetCat("/auth/sair", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "painel-cliente",
          rota: "/auth/sair"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro)
      });
    } catch {
    } finally {
      removerRegistroJanelaPainel(idJanela.current);
      possuiTravaJanela.current = false;
      limparEstadoSensivelNetCat();
      try {
        sessionStorage.removeItem(chaveQrNexLido);
        sessionStorage.removeItem(chaveEnvioNexPreparado);
        for (let indice = sessionStorage.length - 1; indice >= 0; indice -= 1) {
          const chave = sessionStorage.key(indice);
          if (chave?.startsWith("netcatbank_nc_2fa_dispensado_sessao_v1:")) {
            sessionStorage.removeItem(chave);
          }
        }
      } catch {
      }
    }
    window.location.assign(urlAreaCliente);
  }, []);

  const chamarFinanceiro = useCallback(async <Resposta,>(
    rota: string,
    payload: Record<string, unknown> = {},
    opcoes: { baixar?: boolean } = {}
  ) => {
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      const csrf = await obterCsrf({ renovar: tentativa > 0 });
      const payloadSeguro = limparPayloadFinanceiro(payload);
      const corpoSeguro = await criptografarPayloadNetCat(payloadSeguro, {
        csrf,
        fluxo: "painel-cliente",
        rota
      });
      const resposta = await buscarApiNetCat(rota, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "painel-cliente",
          rota
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro)
      });

      if (resposta.ok) {
        if (opcoes.baixar) {
          return resposta as Resposta;
        }

        return (await resposta.json()) as Resposta;
      }

      let mensagem = "";
      try {
        const conteudo = (await resposta.clone().json()) as { mensagem?: unknown } | null;
        mensagem = typeof conteudo?.mensagem === "string" ? conteudo.mensagem : "";
      } catch {
        mensagem = "";
      }

      if (resposta.status === 403 && tentativa === 0) {
        limparCsrfPainel();
        continue;
      }

      throw new ErroApiNetCat(mensagem || "financeiro", resposta.status);
    }

    throw new ErroApiNetCat("financeiro", 0);
  }, []);

  const carregarChavesNex = useCallback(async () => {
    setCarregandoChavesNex(true);
    try {
      const conteudo = await chamarFinanceiro<RespostaChavesNex>("/nex/chaves/listar");
      if (conteudo.estado !== "ok") throw new Error("nex");
      const itens = conteudo.chaves?.itens ?? [];
      setChavesNex(itens);
      setChavesNexCarregadas(true);
      setMensagemNex((mensagemAtual) =>
        mensagemAtual === "Não foi possível carregar suas chaves Nex agora." ? "" : mensagemAtual
      );
      return itens;
    } finally {
      setCarregandoChavesNex(false);
    }
  }, [chamarFinanceiro]);

  const registrarChaveNexVisual = useCallback(async (tipo: TipoChaveNex, valorInformado: string) => {
    const valor = normalizarChaveNex(tipo, valorInformado);

    if (tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
      setMensagemNex("Informe o e-mail cadastrado na sua conta.");
      return;
    }

    if (tipo === "telefone" && !telefoneBrasileiroNexValido(valor)) {
      setMensagemNex("Informe um telefone brasileiro válido com DDD.");
      return;
    }

    if (tipo === "aleatoria" && chavesNex.filter((chave) => chave.tipo === "aleatoria").length >= 3) {
      setMensagemNex("Você já criou 3 chaves aleatórias.");
      return;
    }

    if (tipo !== "aleatoria" && chavesNex.some((chave) => chave.tipo === tipo)) {
      setMensagemNex(`Você já possui uma chave do tipo ${rotuloTipoChaveNex(tipo)}.`);
      return;
    }

    setProcessandoChaveNex(true);
    setMensagemNex("");

    try {
      const payload: Record<string, unknown> = { tipo };
      if (tipo === "email" || tipo === "telefone") payload.valor = valorInformado;
      const conteudo = await chamarFinanceiro<RespostaChavesNex>("/nex/chaves/criar", payload);
      if (conteudo.estado !== "ok") throw new Error("nex");
      await carregarChavesNex();
      setMensagemNex(conteudo.chave?.verificacaoPendente ? "Chave criada e aguardando verificação." : "Chave Nex criada.");
      setModalChaveNexAberto(false);
      setEtapaModalChaveNex("tipo");
      setEntradaChaveNex("");
    } catch (erro) {
      setMensagemNex(mensagemErroApiNetCat(erro, "Não foi possível criar essa chave agora."));
    } finally {
      setProcessandoChaveNex(false);
    }
  }, [carregarChavesNex, chamarFinanceiro, chavesNex]);

  const excluirChaveNex = useCallback(async () => {
    if (!chaveExclusaoNex) return;
    setProcessandoChaveNex(true);
    setMensagemNex("");

    try {
      const conteudo = await chamarFinanceiro<RespostaChavesNex>("/nex/chaves/excluir", {
        id: chaveExclusaoNex.id
      });
      if (conteudo.estado !== "ok") throw new Error("nex");
      await carregarChavesNex();
      setMensagemNex("Chave Nex removida.");
      setChaveExclusaoNex(null);
    } catch (erro) {
      setMensagemNex(mensagemErroApiNetCat(erro, "Não foi possível remover essa chave agora."));
    } finally {
      setProcessandoChaveNex(false);
    }
  }, [carregarChavesNex, chamarFinanceiro, chaveExclusaoNex]);

  useEffect(() => {
    if (estado !== "autorizado") return;
    let ativo = true;
    let temporizador: number | undefined;

    const carregar = async (tentativa = 0) => {
      try {
        await carregarChavesNex();
      } catch {
        if (ativo) {
          if (tentativa === 0) {
            temporizador = window.setTimeout(() => void carregar(1), 650);
            return;
          }
          setChavesNexCarregadas(true);
          setMensagemNex("Não foi possível carregar suas chaves Nex agora.");
        }
      }
    };

    void carregar();
    return () => {
      ativo = false;
      if (temporizador) window.clearTimeout(temporizador);
    };
  }, [carregarChavesNex, estado]);

  const carregarAtividadesNex = useCallback(async (pagina = paginaAtividadesNex) => {
    setCarregandoAtividadesNex(true);
    setMensagemNex("");

    try {
      let conteudo: RespostaAtividadesNex | null = null;
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        try {
          conteudo = await chamarFinanceiro<RespostaAtividadesNex>("/nex/atividades", {
            limite: telaInicial === "nex" ? 8 : 18,
            pagina,
            pesquisa: pesquisaAtividadesNex || undefined
          });
          break;
        } catch (erro) {
          if (tentativa > 0) throw erro;
          await aguardarPainel(420);
        }
      }
      if (conteudo?.estado !== "ok") throw new Error("nex");
      setAtividadesNex(conteudo.nex?.atividades?.itens ?? []);
      setContatosNex(conteudo.nex?.recorrentes ?? []);
      setTotalAtividadesNex(conteudo.nex?.atividades?.total ?? 0);
      setTotalContatosNex(conteudo.nex?.resumo?.contatos ?? conteudo.nex?.recorrentes?.length ?? 0);
    } catch {
      setMensagemNex("Não foi possível carregar as atividades Nex agora.");
    } finally {
      setCarregandoAtividadesNex(false);
    }
  }, [chamarFinanceiro, paginaAtividadesNex, pesquisaAtividadesNex, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado" || !["nex", "nex-recorrentes", "nex-atividades"].includes(telaInicial)) return;
    void carregarAtividadesNex(paginaAtividadesNex);
  }, [carregarAtividadesNex, estado, paginaAtividadesNex, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado") return;

    let temporizador: number | undefined;
    const eventos = ["pointerdown", "keydown", "scroll", "touchstart", "visibilitychange"];
    const reiniciar = () => {
      if (document.visibilityState === "hidden") return;
      if (temporizador) window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => {
        void sair();
      }, 14 * 60 * 1000);
    };

    reiniciar();
    for (const evento of eventos) {
      window.addEventListener(evento, reiniciar, { passive: true });
    }

    return () => {
      if (temporizador) window.clearTimeout(temporizador);
      for (const evento of eventos) {
        window.removeEventListener(evento, reiniciar);
      }
    };
  }, [estado, sair]);

  useEffect(() => {
    if (!filtroAberto) return;

    const fecharFiltro = (evento: PointerEvent) => {
      const alvo = evento.target as Element | null;
      if (!alvo?.closest(".painel-financeiro__select")) {
        setFiltroAberto("");
      }
    };

    window.addEventListener("pointerdown", fecharFiltro);
    return () => window.removeEventListener("pointerdown", fecharFiltro);
  }, [filtroAberto]);

  useEffect(() => {
    if (estado !== "autorizado") return;
    setBoasVindasIndicacaoVisivel(Boolean(dados?.indicacoes?.boasVindas));
  }, [dados?.indicacoes?.boasVindas, estado]);

  useEffect(() => {
    if (estado !== "autorizado" || !boasVindasIndicacaoVisivel) return;
    if (modalAtivo === "nenhum") setModalAtivo("boas-vindas-indicacao");
  }, [boasVindasIndicacaoVisivel, estado, modalAtivo]);

  useEffect(() => {
    if (estado !== "autorizado" || dados?.seguranca?.doisFatoresAtivo !== false) return;
    if (boasVindasIndicacaoVisivel || modalAtivo !== "nenhum") return;

    const chaveDispensa = `netcatbank_nc_2fa_dispensado_sessao_v1:${dados?.cliente?.apresentacao ?? "cliente"}`;
    try {
      if (sessionStorage.getItem(chaveDispensa) === "sim") {
        setPopup2faDispensado(true);
        return;
      }
    } catch {
    }
    if (popup2faDispensado || modal2faAberto) return;

    setEtapa2fa("convite");
    setModalAtivo("2fa");
    setModal2faAberto(true);
  }, [
    boasVindasIndicacaoVisivel,
    dados?.cliente?.apresentacao,
    dados?.seguranca?.doisFatoresAtivo,
    estado,
    modal2faAberto,
    modalAtivo,
    popup2faDispensado
  ]);

  useEffect(() => {
    if (estado !== "autorizado") return;
    let ativo = true;

    const carregarSaldo = async () => {
      try {
        const conteudo = await chamarFinanceiro<RespostaSaldoFinanceiro>("/financeiro/saldo");
        if (ativo && conteudo.estado === "ok") setSaldoFinanceiro(conteudo.saldo ?? null);
      } catch {
        if (ativo && telaInicial === "saldo") setMensagemFinanceira("Não foi possível carregar os dados financeiros agora.");
      }
    };

    void carregarSaldo();
    return () => {
      ativo = false;
    };
  }, [chamarFinanceiro, estado, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "emprestimos") return;
    let ativo = true;

    const carregarElegibilidade = async () => {
      setCarregandoEmprestimos(true);
      setMensagemEmprestimos("");

      try {
        const conteudo = await chamarFinanceiro<RespostaElegibilidadeEmprestimo>("/emprestimos/elegibilidade");
        if (!ativo) return;
        if (conteudo.estado !== "ok" || !conteudo.emprestimos?.elegibilidade) throw new Error("emprestimos");
        setElegibilidadeEmprestimo(conteudo.emprestimos.elegibilidade);
      } catch {
        if (ativo) {
          setElegibilidadeEmprestimo(null);
          setMensagemEmprestimos("Não foi possível carregar sua análise de crédito agora.");
        }
      } finally {
        if (ativo) setCarregandoEmprestimos(false);
      }
    };

    void carregarElegibilidade();
    return () => {
      ativo = false;
    };
  }, [chamarFinanceiro, estado, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado") return;
    if (!["dashboard", "nex", "pagamentos", "saldo", "extrato"].includes(telaInicial)) return;

    let ativo = true;
    const carregarTransacoes = async () => {
      setCarregandoFinanceiro(true);
      setMensagemFinanceira("");

      try {
        const payload =
          telaInicial === "extrato"
            ? {
                categoria: categoriaExtrato || undefined,
                limite: 20,
                ordenar: ordenarExtrato,
                pagina: paginaExtrato,
                periodo: periodoExtrato,
                pesquisa: pesquisaExtrato,
                tipo: tipoExtrato
              }
            : {
                categoria: telaInicial === "pagamentos" ? "pagamentos" : undefined,
                limite: telaInicial === "pagamentos" ? 3 : telaInicial === "saldo" || telaInicial === "nex" ? 8 : 5,
                ordenar: "recentes",
                pagina: 1,
                periodo: "90d",
                pesquisa: telaInicial === "saldo" ? pesquisaExtrato : "",
                tipo: "todos"
              };
        let conteudo: RespostaTransacoesFinanceiras | null = null;
        for (let tentativa = 0; tentativa < 2; tentativa += 1) {
          try {
            conteudo = await chamarFinanceiro<RespostaTransacoesFinanceiras>("/financeiro/transacoes", payload);
            break;
          } catch (erro) {
            if (tentativa > 0) throw erro;
            await aguardarPainel(420);
          }
        }

        if (!ativo) return;
        if (conteudo?.estado !== "ok") throw new Error("financeiro");
        setTransacoes(conteudo.transacoes?.itens ?? []);
        setTotalTransacoes(conteudo.transacoes?.total ?? 0);
      } catch {
        if (ativo) {
          setMensagemFinanceira("Não foi possível carregar as transações agora.");
        }
      } finally {
        if (ativo) setCarregandoFinanceiro(false);
      }
    };

    void carregarTransacoes();
    return () => {
      ativo = false;
    };
  }, [
    categoriaExtrato,
    chamarFinanceiro,
    estado,
    ordenarExtrato,
    paginaExtrato,
    periodoExtrato,
    pesquisaExtrato,
    telaInicial,
    tipoExtrato
  ]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "extrato") return;

    try {
      if (sessionStorage.getItem(chaveAbaExtratoInicial) === "agendamentos") {
        setAbaExtrato("agendamentos");
      }
      sessionStorage.removeItem(chaveAbaExtratoInicial);
    } catch {
    }
  }, [estado, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "transacao") return;

    let ativo = true;
    const idSeguro =
      typeof transacaoId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transacaoId)
        ? transacaoId
        : "";

    const carregarTransacao = async () => {
      setTransacaoDetalhe(null);
      setMensagemTransacaoDetalhe("");

      if (!idSeguro) {
        setMensagemTransacaoDetalhe("Não foi possível localizar esta transação.");
        return;
      }

      setCarregandoTransacaoDetalhe(true);
      try {
        let conteudo: RespostaTransacaoFinanceira | null = null;
        for (let tentativa = 0; tentativa < 2; tentativa += 1) {
          try {
            conteudo = await chamarFinanceiro<RespostaTransacaoFinanceira>("/financeiro/transacao", {
              id: idSeguro
            });
            break;
          } catch (erro) {
            if (tentativa > 0) throw erro;
            await aguardarPainel(420);
          }
        }

        if (!ativo) return;
        if (!conteudo || conteudo.estado !== "ok" || !conteudo.transacao) {
          setMensagemTransacaoDetalhe("Não foi possível localizar esta transação.");
          return;
        }

        setTransacaoDetalhe(conteudo.transacao);
      } catch {
        if (ativo) setMensagemTransacaoDetalhe("Não foi possível carregar esta transação agora.");
      } finally {
        if (ativo) setCarregandoTransacaoDetalhe(false);
      }
    };

    void carregarTransacao();
    return () => {
      ativo = false;
    };
  }, [chamarFinanceiro, estado, telaInicial, transacaoId]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "extrato" || abaExtrato !== "agendamentos") return;
    let ativo = true;

    const carregarAgendamentos = async () => {
      try {
        const conteudo = await chamarFinanceiro<RespostaAgendamentosFinanceiros>("/financeiro/agendamentos");
        if (ativo) setAgendamentos(conteudo.agendamentos ?? []);
      } catch {
        if (ativo) setAgendamentos([]);
      }
    };

    void carregarAgendamentos();
    return () => {
      ativo = false;
    };
  }, [abaExtrato, chamarFinanceiro, estado, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "agendamento") return;
    let ativo = true;
    const idSeguro =
      typeof agendamentoId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(agendamentoId)
        ? agendamentoId
        : "";

    const carregarAgendamento = async () => {
      setAgendamentoDetalhe(null);
      setMensagemAgendamentoDetalhe("");

      if (!idSeguro) {
        setMensagemAgendamentoDetalhe("Não foi possível localizar este agendamento.");
        return;
      }

      setCarregandoAgendamentoDetalhe(true);
      try {
        const conteudo = await chamarFinanceiro<RespostaAgendamentosFinanceiros>("/financeiro/agendamentos");
        if (!ativo) return;
        const agendamento = conteudo.agendamentos?.find((item) => item.id === idSeguro) ?? null;
        if (!agendamento) {
          setMensagemAgendamentoDetalhe("Não foi possível localizar este agendamento.");
          return;
        }
        setAgendamentoDetalhe(agendamento);
      } catch {
        if (ativo) setMensagemAgendamentoDetalhe("Não foi possível carregar este agendamento agora.");
      } finally {
        if (ativo) setCarregandoAgendamentoDetalhe(false);
      }
    };

    void carregarAgendamento();
    return () => {
      ativo = false;
    };
  }, [agendamentoId, chamarFinanceiro, estado, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "graficos") return;
    let ativo = true;

    const carregarGraficos = async () => {
      setCarregandoFinanceiro(true);
      setMensagemFinanceira("");

      try {
        const conteudo = await chamarFinanceiro<RespostaGraficosFinanceiros>("/financeiro/graficos", {
          mes: mesGrafico
        });
        if (ativo) setGraficos(conteudo.graficos ?? null);
      } catch {
        if (ativo) {
          setGraficos(null);
          setMensagemFinanceira("Não foi possível carregar os gráficos agora.");
        }
      } finally {
        if (ativo) setCarregandoFinanceiro(false);
      }
    };

    void carregarGraficos();
    return () => {
      ativo = false;
    };
  }, [chamarFinanceiro, estado, mesGrafico, telaInicial]);

  const dispensarDoisFatores = () => {
    try {
      sessionStorage.setItem(
        `netcatbank_nc_2fa_dispensado_sessao_v1:${dados?.cliente?.apresentacao ?? "cliente"}`,
        "sim"
      );
    } catch {
    }
    setPopup2faDispensado(true);
    setModal2faAberto(false);
    setModalAtivo("nenhum");
    setEtapa2fa("convite");
    setMensagem2fa("");
    setCodigo2fa("");
  };

  const prepararDoisFatores = async () => {
    setProcessando2fa(true);
    setMensagem2fa("");

    try {
      const csrf = await obterCsrf();
      const corpoSeguro = await criptografarPayloadNetCat({}, {
        csrf,
        fluxo: "painel-cliente",
        rota: "/auth/2fa/preparar"
      });
      const resposta = await buscarApiNetCat("/auth/2fa/preparar", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "painel-cliente",
          rota: "/auth/2fa/preparar"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro)
      });
      const conteudo = (await resposta.json().catch(() => null)) as RespostaDoisFatores | null;

      if (!resposta.ok || conteudo?.estado !== "ok") {
        setMensagem2fa(conteudo?.mensagem ?? "Não foi possível preparar a verificação agora.");
        return;
      }

      if (conteudo.doisFatores?.ativo) {
        setDados((valorAtual) =>
          valorAtual
            ? {
                ...valorAtual,
                seguranca: {
                  ...valorAtual.seguranca,
                  doisFatoresAtivo: true
                }
              }
            : valorAtual
        );
        setEtapa2fa("confirmado");
        return;
      }

      setConfiguracao2fa(conteudo.doisFatores ?? null);
      setCodigo2fa("");
      setEtapa2fa("qr");
    } catch {
      setMensagem2fa("Não foi possível conectar ao ambiente seguro de verificação.");
    } finally {
      setProcessando2fa(false);
    }
  };

  const ativarDoisFatores = async () => {
    const codigo = somenteDigitos(codigo2fa).slice(0, 6);
    if (!/^\d{6}$/.test(codigo)) {
      setMensagem2fa("Informe o código de 6 números do aplicativo autenticador.");
      return;
    }

    setProcessando2fa(true);
    setMensagem2fa("");

    try {
      const csrf = await obterCsrf();
      const corpoSeguro = await criptografarPayloadNetCat({ codigo }, {
        csrf,
        fluxo: "painel-cliente",
        rota: "/auth/2fa/ativar"
      });
      const resposta = await buscarApiNetCat("/auth/2fa/ativar", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "painel-cliente",
          rota: "/auth/2fa/ativar"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro)
      });
      const conteudo = (await resposta.json().catch(() => null)) as RespostaDoisFatores | null;

      if (!resposta.ok || conteudo?.estado !== "ok") {
        setMensagem2fa(conteudo?.mensagem ?? "Não foi possível ativar a verificação agora.");
        return;
      }

      setDados((valorAtual) =>
        valorAtual
          ? {
              ...valorAtual,
              seguranca: {
                ...valorAtual.seguranca,
                doisFatoresAtivo: true
              }
            }
          : valorAtual
      );
      setEtapa2fa("confirmado");
      window.setTimeout(() => {
        setModal2faAberto(false);
        setModalAtivo("nenhum");
      }, 4300);
    } catch {
      setMensagem2fa("Não foi possível validar o código neste momento.");
    } finally {
      setProcessando2fa(false);
    }
  };

  const abrirIndicacao = async () => {
    const statusAtual = dados?.indicacoes?.status ?? "ativa";
    setModalAtivo("indicacao");
    setMensagemIndicacao("");
    setLinkCopiado(false);
    setStatusIndicacaoModal(statusAtual);
    if (statusAtual === "limite_atingido") {
      setLinkIndicacao("");
      return;
    }
    if (linkIndicacao) return;

    setProcessandoIndicacao(true);
    try {
      const conteudo = await chamarFinanceiro<RespostaLinkIndicacao>("/indicacoes/link");
      const statusRecebido = conteudo.indicacao?.status ?? conteudo.indicacao?.motivo ?? "indisponivel";
      if (statusRecebido === "limite_atingido") {
        setStatusIndicacaoModal("limite_atingido");
        setLinkIndicacao("");
        return;
      }
      if (conteudo.estado !== "ok" || conteudo.indicacao?.ativa === false || !conteudo.indicacao?.link) {
        setMensagemIndicacao("A campanha de indicação não está disponível para esta conta agora.");
        return;
      }
      setStatusIndicacaoModal("ativa");
      setLinkIndicacao(conteudo.indicacao.link);
    } catch {
      setMensagemIndicacao("Não foi possível preparar seu link de indicação agora.");
    } finally {
      setProcessandoIndicacao(false);
    }
  };

  const copiarLinkIndicacao = async () => {
    if (!linkIndicacao) return;
    try {
      await navigator.clipboard.writeText(linkIndicacao);
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 2800);
    } catch {
      setMensagemIndicacao("Não foi possível copiar automaticamente. Selecione o link e copie manualmente.");
    }
  };

  const fecharBoasVindasIndicacao = async () => {
    setBoasVindasIndicacaoVisivel(false);
    setModalAtivo("nenhum");
    try {
      await chamarFinanceiro<{ estado?: string }>("/indicacoes/boas-vindas/dispensar");
    } catch {
    }
  };

  const validarEntradaChaveDestinoNex = (valor: string) => {
    const texto = valor.trim();
    if (!texto) return "Informe a chave Nex para continuar.";
    if (pareceTelefoneNex(texto) && !telefoneBrasileiroNexValido(texto)) {
      return "Informe um telefone brasileiro válido com DDD.";
    }
    return "";
  };

  const garantirChaveNexParaEnvio = async (definirMensagem: (mensagem: string) => void = setMensagemEnvioNex) => {
    const chaveAtiva = (chaves: ChaveNexVisual[]) =>
      chaves.some((chave) => chave.estado === "ativa" || (!chave.estado && !chave.verificacaoPendente));

    let chavesAtuais = chavesNex;
    if (chavesAtuais.length === 0) {
      try {
        chavesAtuais = await carregarChavesNex();
      } catch {
        chavesAtuais = [];
      }
    }

    if (chaveAtiva(chavesAtuais)) return true;

    definirMensagem("Você ainda não tem uma chave Nex ativa. Vamos criar uma chave aleatória segura para esta operação e para as próximas.");

    try {
      const conteudo = await chamarFinanceiro<RespostaChavesNex>("/nex/chaves/criar", {
        tipo: "aleatoria"
      });
      if (conteudo.estado !== "ok" || !conteudo.chave) throw new Error("nex");
      const chavesAtualizadas = await carregarChavesNex();
      if (!chaveAtiva(chavesAtualizadas)) throw new Error("nex");
      definirMensagem("Chave aleatória criada com segurança. Você já pode continuar.");
      return true;
    } catch (erro) {
      definirMensagem(mensagemErroApiNetCat(erro, "Não foi possível criar a chave automática agora."));
      return false;
    }
  };

  const resolverDestinoNex = async (chaveInformada = chaveDestinoNex) => {
    const chave = chaveInformada.trim().slice(0, 160);
    const erro = validarEntradaChaveDestinoNex(chave);
    if (erro) {
      setMensagemEnvioNex(erro);
      return;
    }

    setChaveDestinoNex(chave);
    setProcessandoEnvioNex(true);
    setMensagemEnvioNex("");
    setDestinatarioNex(null);
    setTransferenciaNex(null);

    try {
      const conteudo = await chamarFinanceiro<RespostaResolverNex>("/nex/transferencias/resolver", {
        chaveDestino: chave
      });
      if (conteudo.estado !== "ok" || !conteudo.destinatario) throw new Error("nex");
      setDestinatarioNex(conteudo.destinatario);
      setEtapaEnvioNex("valor");
    } catch (erro) {
      setMensagemEnvioNex(mensagemErroApiNetCat(erro, "Não foi possível localizar essa chave agora."));
    } finally {
      setProcessandoEnvioNex(false);
    }
  };

  const prepararEnvioNex = async () => {
    if (!destinatarioNex) {
      setEtapaEnvioNex("chave");
      return;
    }

    const valorCentavos = centavosValorEntradaNex(valorEnvioNex);
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
      setMensagemEnvioNex("Informe um valor válido para enviar.");
      return;
    }
    if (typeof saldoFinanceiro?.disponivelCentavos === "number" && valorCentavos > saldoFinanceiro.disponivelCentavos) {
      setMensagemEnvioNex("O valor informado é maior que o saldo disponível.");
      return;
    }

    setProcessandoEnvioNex(true);
    setMensagemEnvioNex("");

    try {
      const chavePropriaOk = await garantirChaveNexParaEnvio();
      if (!chavePropriaOk) return;

      const conteudo = await chamarFinanceiro<RespostaTransferenciaNex>("/nex/transferencias/preparar", {
        chaveDestino: chaveDestinoNex.trim(),
        descricao: "Transferência Nex",
        valorCentavos
      });
      if (conteudo.estado !== "ok" || !conteudo.transferencia) throw new Error("nex");
      setTransferenciaNex(conteudo.transferencia);
      if (conteudo.transferencia.destinatario) setDestinatarioNex(conteudo.transferencia.destinatario);
      setEtapaEnvioNex("revisao");
    } catch (erro) {
      setMensagemEnvioNex(mensagemErroApiNetCat(erro, "Não foi possível preparar essa transferência agora."));
    } finally {
      setProcessandoEnvioNex(false);
    }
  };

  const confirmarEnvioNex = async () => {
    if (!transferenciaNex?.id) return;
    setProcessandoEnvioNex(true);
    setMensagemEnvioNex("");

    try {
      const conteudo = await chamarFinanceiro<RespostaTransferenciaNex>("/nex/transferencias/confirmar", {
        transferenciaId: transferenciaNex.id
      });
      if (conteudo.estado !== "ok" || !conteudo.transferencia) throw new Error("nex");
      setTransferenciaNex(conteudo.transferencia);
      setEtapaEnvioNex("sucesso");
      if (conteudo.transferencia.transacaoId) {
        window.setTimeout(() => {
          window.location.assign(`/painel/transacao/${encodeURIComponent(conteudo.transferencia?.transacaoId ?? "")}`);
        }, 950);
      }
    } catch (erro) {
      setMensagemEnvioNex(mensagemErroApiNetCat(erro, "Não foi possível confirmar essa transferência agora."));
    } finally {
      setProcessandoEnvioNex(false);
    }
  };

  const resolverDestinoAgendamentoNex = async () => {
    const erro = validarEntradaChaveDestinoNex(chaveAgendamentoNex);
    if (erro) {
      setMensagemAgendamentoNex(erro);
      return;
    }

    setProcessandoAgendamentoNex(true);
    setMensagemAgendamentoNex("");
    setDestinatarioAgendamentoNex(null);
    setAgendamentoNex(null);

    try {
      const conteudo = await chamarFinanceiro<RespostaResolverNex>("/nex/transferencias/resolver", {
        chaveDestino: chaveAgendamentoNex.trim()
      });
      if (conteudo.estado !== "ok" || !conteudo.destinatario) throw new Error("nex");
      setDestinatarioAgendamentoNex(conteudo.destinatario);
      setEtapaAgendamentoNex("data");
    } catch (erro) {
      setMensagemAgendamentoNex(mensagemErroApiNetCat(erro, "Não foi possível localizar essa chave agora."));
    } finally {
      setProcessandoAgendamentoNex(false);
    }
  };

  const validarDataAgendamentoNex = () => {
    const dataHora = combinarDataHoraAgendamentoNex(dataAgendamentoNex, horaAgendamentoNex, minutoAgendamentoNex);
    if (!dataHora || dataHora.getTime() < Date.now() + 60_000) {
      setMensagemAgendamentoNex("Escolha uma data e horário futuros para agendar.");
      return null;
    }
    setMensagemAgendamentoNex("");
    return dataHora;
  };

  const continuarDataAgendamentoNex = () => {
    if (!validarDataAgendamentoNex()) return;
    setEtapaAgendamentoNex("valor");
  };

  const prepararRevisaoAgendamentoNex = () => {
    if (!destinatarioAgendamentoNex) {
      setEtapaAgendamentoNex("chave");
      return;
    }
    if (!validarDataAgendamentoNex()) {
      setEtapaAgendamentoNex("data");
      return;
    }
    const valorCentavos = centavosValorEntradaNex(valorAgendamentoNex);
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
      setMensagemAgendamentoNex("Informe um valor válido para agendar.");
      return;
    }
    setMensagemAgendamentoNex("");
    setEtapaAgendamentoNex("revisao");
  };

  const confirmarAgendamentoNex = async () => {
    if (!destinatarioAgendamentoNex) return;
    const dataHora = validarDataAgendamentoNex();
    const valorCentavos = centavosValorEntradaNex(valorAgendamentoNex);
    if (!dataHora || !Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) return;

    setProcessandoAgendamentoNex(true);
    setMensagemAgendamentoNex("");

    try {
      const chavePropriaOk = await garantirChaveNexParaEnvio(setMensagemAgendamentoNex);
      if (!chavePropriaOk) return;

      const conteudo = await chamarFinanceiro<RespostaAgendamentoNex>("/nex/agendamentos/criar", {
        agendadoPara: dataHora.toISOString(),
        chaveDestino: chaveAgendamentoNex.trim(),
        descricao: "Transferência Nex agendada",
        valorCentavos
      });
      if (conteudo.estado !== "ok" || !conteudo.agendamento) throw new Error("nex");
      setAgendamentoNex(conteudo.agendamento);
      if (conteudo.agendamento.destinatario) setDestinatarioAgendamentoNex(conteudo.agendamento.destinatario);
      setEtapaAgendamentoNex("sucesso");
    } catch (erro) {
      setMensagemAgendamentoNex(mensagemErroApiNetCat(erro, "Não foi possível criar esse agendamento agora."));
    } finally {
      setProcessandoAgendamentoNex(false);
    }
  };

  const criarQrRecebimentoNex = async (chave: ChaveNexVisual, valorCentavos = 0) => {
    setProcessandoRecebimentoNex(true);
    setMensagemRecebimentoNex("");

    try {
      const conteudo = await chamarFinanceiro<RespostaQrRecebimentoNex>("/nex/recebimentos/qr/criar", {
        chaveId: chave.id,
        valorCentavos: valorCentavos > 0 ? valorCentavos : undefined
      });
      if (conteudo.estado !== "ok" || !conteudo.qr) throw new Error("nex");
      const chaveCache = `${chave.id}:${valorCentavos > 0 ? valorCentavos : 0}`;
      setQrsRecebimentoNex((atuais) => ({
        ...atuais,
        [chaveCache]: conteudo.qr as QrRecebimentoNexVisual
      }));
      return conteudo.qr as QrRecebimentoNexVisual;
    } catch (erro) {
      setMensagemRecebimentoNex(mensagemErroApiNetCat(erro, "Não foi possível criar esse QR Code agora."));
      return null;
    } finally {
      setProcessandoRecebimentoNex(false);
    }
  };

  const criarQrPersonalizadoNex = async () => {
    const chavesAtivas = chavesNex.filter((chave) => chave.estado === "ativa" || (!chave.estado && !chave.verificacaoPendente));
    const chave = chavesAtivas[indiceChaveRecebimentoNex] ?? chavesAtivas[0] ?? null;
    if (!chave) {
      setMensagemRecebimentoNex("Crie uma chave Nex ativa antes de gerar QR Code.");
      return;
    }

    const valorCentavos = centavosValorEntradaNex(valorRecebimentoNex);
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos < 0) {
      setMensagemRecebimentoNex("Informe um valor válido ou deixe R$ 0,00 para quem pagar escolher.");
      return;
    }
    if (valorCentavos > valorMaximoQrRecebimentoCentavosNex) {
      setMensagemRecebimentoNex("O valor máximo para este QR Code é R$ 1.000.000,00.");
      return;
    }

    const qr = await criarQrRecebimentoNex(chave, valorCentavos);
    if (!qr) return;
    setQrPersonalizadoNex(qr);
    setModalValorRecebimentoNexAberto(false);
  };

  const validarCodigoBoleto = useCallback(async (codigoEntrada = codigoBoleto) => {
    const codigo = codigoEntrada.trim();
    if (!codigoBoletoPodeValidar(codigo)) {
      setMensagemBoleto("Informe uma linha digitável de 47 dígitos ou um código de barras de 44 dígitos.");
      return null;
    }

    setProcessandoBoleto(true);
    setMensagemBoleto("");
    setBoletoValidado(null);
    setPagamentoBoleto(null);

    try {
      const conteudo = await chamarFinanceiro<RespostaValidacaoBoleto>("/pagamentos/boleto/validar", {
        codigo
      });
      if (conteudo.estado !== "ok" || !conteudo.boleto) throw new Error("boleto");
      setBoletoValidado(conteudo.boleto);
      setCodigoBoleto(conteudo.boleto.linhaDigitavel);
      setEtapaPagamentoBoleto("revisao");
      return conteudo.boleto;
    } catch (erro) {
      setMensagemBoleto(mensagemErroApiNetCat(erro, "Não foi possível validar esse boleto agora."));
      return null;
    } finally {
      setProcessandoBoleto(false);
    }
  }, [chamarFinanceiro, codigoBoleto]);

  const confirmarPagamentoBoleto = useCallback(async () => {
    const boleto = boletoValidado;
    if (!boleto) {
      setEtapaPagamentoBoleto("codigo");
      setMensagemBoleto("Valide o boleto antes de confirmar.");
      return;
    }
    if (typeof saldoFinanceiro?.disponivelCentavos === "number" && boleto.valorCentavos > saldoFinanceiro.disponivelCentavos) {
      setMensagemBoleto("Saldo insuficiente para concluir o pagamento.");
      return;
    }

    setProcessandoBoleto(true);
    setMensagemBoleto("");

    try {
      const conteudo = await chamarFinanceiro<RespostaPagamentoBoleto>("/pagamentos/boleto/confirmar", {
        codigo: boleto.codigoBarras
      });
      if (conteudo.estado !== "ok" || !conteudo.pagamento?.transacaoId) throw new Error("boleto");
      setPagamentoBoleto(conteudo.pagamento);
      setEtapaPagamentoBoleto("sucesso");
      window.setTimeout(() => {
        window.location.assign(`/painel/transacao/${encodeURIComponent(conteudo.pagamento?.transacaoId ?? "")}`);
      }, 1100);
    } catch (erro) {
      setMensagemBoleto(mensagemErroApiNetCat(erro, "Não foi possível concluir esse pagamento agora."));
    } finally {
      setProcessandoBoleto(false);
    }
  }, [boletoValidado, chamarFinanceiro, saldoFinanceiro?.disponivelCentavos]);

  const validarNumeroRecargaCelular = useCallback(async () => {
    const telefone = telefoneRecargaCelular.trim();
    if (somenteDigitos(telefone).length < 11) {
      setMensagemRecargaCelular("Informe um celular brasileiro com DDD.");
      return;
    }

    setProcessandoRecargaCelular(true);
    setMensagemRecargaCelular("");
    setRecargaCelularValidada(null);
    setPagamentoRecargaCelular(null);

    try {
      const conteudo = await chamarFinanceiro<RespostaValidacaoRecargaCelular>("/pagamentos/celular/validar", {
        telefone
      });
      if (conteudo.estado !== "ok" || !conteudo.recarga) throw new Error("recarga");
      setRecargaCelularValidada(conteudo.recarga);
      setTelefoneRecargaCelular(conteudo.recarga.telefone);
      setValorRecargaCelular(formatarMoedaNex(conteudo.recarga.valoresSugeridosCentavos[0] ?? conteudo.recarga.valorMinimoCentavos));
      setEtapaRecargaCelular("valor");
    } catch (erro) {
      setMensagemRecargaCelular(mensagemErroApiNetCat(erro, "Não foi possível validar esse número agora."));
    } finally {
      setProcessandoRecargaCelular(false);
    }
  }, [chamarFinanceiro, telefoneRecargaCelular]);

  const prepararRevisaoRecargaCelular = useCallback(() => {
    if (!recargaCelularValidada) {
      setEtapaRecargaCelular("numero");
      return;
    }

    const valorCentavos = centavosValorEntradaNex(valorRecargaCelular);
    if (
      !Number.isSafeInteger(valorCentavos) ||
      valorCentavos < recargaCelularValidada.valorMinimoCentavos ||
      valorCentavos > recargaCelularValidada.valorMaximoCentavos ||
      valorCentavos % 100 !== 0
    ) {
      setMensagemRecargaCelular(
        `Escolha um valor entre ${recargaCelularValidada.valorMinimo} e ${recargaCelularValidada.valorMaximo}.`
      );
      return;
    }
    if (typeof saldoFinanceiro?.disponivelCentavos === "number" && valorCentavos > saldoFinanceiro.disponivelCentavos) {
      setMensagemRecargaCelular("Saldo insuficiente para concluir a recarga.");
      return;
    }

    setMensagemRecargaCelular("");
    setEtapaRecargaCelular("revisao");
  }, [recargaCelularValidada, saldoFinanceiro?.disponivelCentavos, valorRecargaCelular]);

  const confirmarRecargaCelular = useCallback(async () => {
    if (!recargaCelularValidada) {
      setEtapaRecargaCelular("numero");
      return;
    }

    const valorCentavos = centavosValorEntradaNex(valorRecargaCelular);
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) return;

    setProcessandoRecargaCelular(true);
    setMensagemRecargaCelular("");

    try {
      const conteudo = await chamarFinanceiro<RespostaPagamentoRecargaCelular>("/pagamentos/celular/confirmar", {
        telefone: recargaCelularValidada.e164,
        valorCentavos
      });
      if (conteudo.estado !== "ok" || !conteudo.recarga?.transacaoId) throw new Error("recarga");
      setPagamentoRecargaCelular(conteudo.recarga);
      setEtapaRecargaCelular("sucesso");
      window.setTimeout(() => {
        window.location.assign(`/painel/transacao/${encodeURIComponent(conteudo.recarga?.transacaoId ?? "")}`);
      }, 1100);
    } catch (erro) {
      setMensagemRecargaCelular(mensagemErroApiNetCat(erro, "Não foi possível concluir essa recarga agora."));
    } finally {
      setProcessandoRecargaCelular(false);
    }
  }, [chamarFinanceiro, recargaCelularValidada, valorRecargaCelular]);

  const abrirScannerBoleto = useCallback(async () => {
    setMensagemBoleto("");
    setScannerBoletoDispensado(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setMensagemBoleto("Este navegador não oferece acesso à câmera. Digite a linha do boleto no campo.");
      return;
    }

    try {
      const consulta = await navigator.permissions?.query({ name: "camera" as PermissionName });
      if (consulta?.state === "granted") {
        setScannerBoletoAutorizado(true);
        setModalPermissaoCameraBoletoAberto(false);
        return;
      }
    } catch {
    }

    setModalPermissaoCameraBoletoAberto(true);
  }, []);

  const processarCodigoBarrasBoleto = useCallback(async (codigoLido: string) => {
    if (scannerBoletoProcessando.current) return;
    const codigoFormatado = formatarCodigoBoletoEntrada(codigoLido);
    if (!codigoBoletoPodeValidar(codigoFormatado)) {
      setMensagemBoleto("Código lido incompleto. Posicione o boleto dentro da área iluminada.");
      return;
    }

    scannerBoletoProcessando.current = true;
    setProcessandoScannerBoleto(true);
    setCodigoBoleto(codigoFormatado);

    try {
      const boleto = await validarCodigoBoleto(codigoFormatado);
      if (boleto) {
        setScannerBoletoDispensado(true);
        setScannerBoletoAutorizado(false);
      }
    } finally {
      scannerBoletoProcessando.current = false;
      setProcessandoScannerBoleto(false);
    }
  }, [validarCodigoBoleto]);

  const processarConteudoQrNex = useCallback(async (conteudoQr: string) => {
    const conteudo = conteudoQr.trim();
    if (!conteudo || scannerNexProcessando.current) return;

    scannerNexProcessando.current = true;
    setProcessandoScannerNex(true);
    setMensagemScannerNex("");

    try {
      const respostaQr = await chamarFinanceiro<RespostaQrRecebimentoNex>("/nex/recebimentos/qr/validar", {
        conteudo
      });
      if (respostaQr.estado !== "ok" || !respostaQr.qr?.chaveDestino || !respostaQr.destinatario) {
        throw new Error("nex");
      }

      try {
        sessionStorage.setItem(
          chaveQrNexLido,
          JSON.stringify({
            chaveDestino: respostaQr.qr.chaveDestino,
            criadoEm: Date.now(),
            destinatario: respostaQr.destinatario,
            valorCentavos: respostaQr.qr.valorCentavos ?? 0
          })
        );
      } catch {
      }

      window.location.assign("/painel/nex/enviar");
    } catch (erro) {
      scannerNexProcessando.current = false;
      setMensagemScannerNex(mensagemErroApiNetCat(erro, "Não foi possível ler esse QR Code."));
    } finally {
      setProcessandoScannerNex(false);
    }
  }, [chamarFinanceiro]);

  const iniciarEnvioContatoNex = (contato: ContatoNexVisual) => {
    try {
      if (contato.chaveSugestao) {
        sessionStorage.setItem(
          chaveEnvioNexPreparado,
          JSON.stringify({
            auto: true,
            chaveDestino: contato.chaveSugestao.slice(0, 160),
            criadoEm: Date.now()
          })
        );
      } else {
        sessionStorage.removeItem(chaveEnvioNexPreparado);
      }
    } catch {
    }
    window.location.assign("/painel/nex/enviar");
  };

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "pagamento-boleto") return;

    setCameraScannerBoletoAtiva(false);
    setScannerBoletoAutorizado(false);
    setScannerBoletoDispensado(false);
    setModalPermissaoCameraBoletoAberto(false);

    return () => {
      streamScannerBoleto.current?.getTracks().forEach((faixa) => faixa.stop());
      streamScannerBoleto.current = null;
      scannerBoletoProcessando.current = false;
      setCameraScannerBoletoAtiva(false);
      setModalPermissaoCameraBoletoAberto(false);
    };
  }, [estado, telaInicial]);

  useEffect(() => {
    if (
      estado !== "autorizado" ||
      telaInicial !== "pagamento-boleto" ||
      !scannerBoletoAutorizado ||
      scannerBoletoDispensado
    ) return;
    let ativo = true;
    let quadro = 0;

    const pararCamera = () => {
      if (quadro) window.cancelAnimationFrame(quadro);
      streamScannerBoleto.current?.getTracks().forEach((faixa) => faixa.stop());
      streamScannerBoleto.current = null;
      setCameraScannerBoletoAtiva(false);
    };

    const iniciarCamera = async () => {
      const Detector = (window as typeof window & {
        BarcodeDetector?: {
          new (opcoes: { formats: string[] }): DetectorQrNavegador;
          getSupportedFormats?: () => Promise<string[]>;
        };
      }).BarcodeDetector;

      if (!Detector) {
        setMensagemBoleto("Este navegador não consegue ler código de barras pela câmera. Digite a linha do boleto no campo.");
        setScannerBoletoAutorizado(false);
        setScannerBoletoDispensado(true);
        return;
      }

      try {
        const stream = await navigator.mediaDevices?.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            height: { ideal: 1080 },
            width: { ideal: 1440 }
          }
        });

        if (!ativo || !stream || !videoScannerBoleto.current) {
          stream?.getTracks().forEach((faixa) => faixa.stop());
          return;
        }

        const formatosPreferidos = ["itf", "code_128", "codabar", "ean_13"];
        const formatosSuportados = await Detector.getSupportedFormats?.().catch(() => null);
        const formatos = Array.isArray(formatosSuportados)
          ? formatosPreferidos.filter((formato) => formatosSuportados.includes(formato))
          : formatosPreferidos;
        const detector = new Detector({ formats: formatos.length > 0 ? formatos : formatosPreferidos });

        streamScannerBoleto.current = stream;
        videoScannerBoleto.current.srcObject = stream;
        await videoScannerBoleto.current.play().catch(() => undefined);
        setCameraScannerBoletoAtiva(true);

        const detectar = async () => {
          if (!ativo || !videoScannerBoleto.current || scannerBoletoProcessando.current) return;

          try {
            if (videoScannerBoleto.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              const codigos = await detector.detect(videoScannerBoleto.current);
              const valor = codigos.find((codigo) => codigo.rawValue)?.rawValue;
              if (valor) {
                await processarCodigoBarrasBoleto(valor);
                return;
              }
            }
          } catch {
          }

          quadro = window.requestAnimationFrame(detectar);
        };

        quadro = window.requestAnimationFrame(detectar);
      } catch {
        setMensagemBoleto("Não foi possível abrir a câmera. Autorize o acesso ou digite a linha do boleto.");
        setScannerBoletoAutorizado(false);
        setScannerBoletoDispensado(true);
      }
    };

    void iniciarCamera();

    return () => {
      ativo = false;
      pararCamera();
      scannerBoletoProcessando.current = false;
    };
  }, [estado, processarCodigoBarrasBoleto, scannerBoletoAutorizado, scannerBoletoDispensado, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "nex-enviar") return;

    if (!autoResolveuChaveNex.current) {
      try {
        const bruto = sessionStorage.getItem(chaveQrNexLido);
        const qr = JSON.parse(bruto ?? "null") as {
          chaveDestino?: string;
          criadoEm?: number;
          destinatario?: DestinatarioNexVisual;
          valorCentavos?: number;
        } | null;

        if (qr?.chaveDestino && qr.destinatario && typeof qr.criadoEm === "number" && Date.now() - qr.criadoEm < 90_000) {
          setChaveDestinoNex(qr.chaveDestino.slice(0, 160));
          setDestinatarioNex(qr.destinatario);
          setValorEnvioNex(formatarMoedaNex(Number(qr.valorCentavos ?? 0)));
          setEtapaEnvioNex("valor");
          autoResolveuChaveNex.current = true;
        }

        sessionStorage.removeItem(chaveQrNexLido);
        if (autoResolveuChaveNex.current) return;
      } catch {
        try {
          sessionStorage.removeItem(chaveQrNexLido);
        } catch {
        }
      }
    }

    if (!autoResolveuChaveNex.current) {
      try {
        const bruto = sessionStorage.getItem(chaveEnvioNexPreparado);
        const envio = JSON.parse(bruto ?? "null") as {
          auto?: boolean;
          chaveDestino?: string;
          criadoEm?: number;
        } | null;
        const chave = typeof envio?.chaveDestino === "string" ? envio.chaveDestino.slice(0, 160) : "";

        sessionStorage.removeItem(chaveEnvioNexPreparado);
        if (chave && typeof envio?.criadoEm === "number" && Date.now() - envio.criadoEm < 90_000) {
          setChaveDestinoNex(chave);
          if (envio.auto && etapaEnvioNex === "chave" && !destinatarioNex && !processandoEnvioNex) {
            autoResolveuChaveNex.current = true;
            void resolverDestinoNex(chave);
          }
        }
      } catch {
        try {
          sessionStorage.removeItem(chaveEnvioNexPreparado);
        } catch {
        }
      }
    }
  }, [chaveDestinoNex, destinatarioNex, estado, etapaEnvioNex, processandoEnvioNex, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "nex-receber") return;
    const chavesAtivas = chavesNex.filter((chave) => chave.estado === "ativa" || (!chave.estado && !chave.verificacaoPendente));
    const chave = chavesAtivas[indiceChaveRecebimentoNex] ?? chavesAtivas[0] ?? null;
    if (!chave || qrsRecebimentoNex[`${chave.id}:0`] || processandoRecebimentoNex) return;
    void criarQrRecebimentoNex(chave);
  }, [chavesNex, estado, indiceChaveRecebimentoNex, processandoRecebimentoNex, qrsRecebimentoNex, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "nex-escanear") return;
    let ativo = true;

    setCameraScannerNexAtiva(false);
    setScannerNexAutorizado(false);
    setScannerNexDispensado(false);
    setModalPermissaoCameraNexAberto(false);

    const verificarPermissao = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMensagemScannerNex("Este navegador não oferece acesso à câmera. Cole o conteúdo do QR no campo abaixo.");
        return;
      }

      try {
        const consulta = await navigator.permissions?.query({ name: "camera" as PermissionName });
        if (!ativo) return;

        if (consulta?.state === "granted") {
          setScannerNexAutorizado(true);
          setModalPermissaoCameraNexAberto(false);
          return;
        }

        setModalPermissaoCameraNexAberto(true);
      } catch {
        if (ativo) setModalPermissaoCameraNexAberto(true);
      }
    };

    void verificarPermissao();

    return () => {
      ativo = false;
      setModalPermissaoCameraNexAberto(false);
    };
  }, [estado, telaInicial]);

  useEffect(() => {
    if (estado !== "autorizado" || telaInicial !== "nex-escanear" || !scannerNexAutorizado || scannerNexDispensado) return;
    let ativo = true;
    let quadro = 0;

    const pararCamera = () => {
      if (quadro) window.cancelAnimationFrame(quadro);
      streamScannerNex.current?.getTracks().forEach((faixa) => faixa.stop());
      streamScannerNex.current = null;
      setCameraScannerNexAtiva(false);
    };

    const iniciarCamera = async () => {
      const Detector = (window as typeof window & {
        BarcodeDetector?: new (opcoes: { formats: string[] }) => DetectorQrNavegador;
      }).BarcodeDetector;

      if (!Detector) {
        setMensagemScannerNex("Este navegador não consegue ler QR Code pela câmera. Cole o conteúdo do QR no campo abaixo.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices?.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            height: { ideal: 1080 },
            width: { ideal: 1080 }
          }
        });

        if (!ativo || !stream || !videoScannerNex.current) {
          stream?.getTracks().forEach((faixa) => faixa.stop());
          return;
        }

        streamScannerNex.current = stream;
        videoScannerNex.current.srcObject = stream;
        await videoScannerNex.current.play().catch(() => undefined);
        setCameraScannerNexAtiva(true);
        const detector = new Detector({ formats: ["qr_code"] });

        const detectar = async () => {
          if (!ativo || !videoScannerNex.current || scannerNexProcessando.current) return;

          try {
            if (videoScannerNex.current.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              const codigos = await detector.detect(videoScannerNex.current);
              const valor = codigos.find((codigo) => codigo.rawValue)?.rawValue;
              if (valor) {
                await processarConteudoQrNex(valor);
                return;
              }
            }
          } catch {
          }

          quadro = window.requestAnimationFrame(detectar);
        };

        quadro = window.requestAnimationFrame(detectar);
      } catch {
        setMensagemScannerNex("Não foi possível abrir a câmera. Autorize o acesso ou cole o conteúdo do QR no campo abaixo.");
      }
    };

    void iniciarCamera();

    return () => {
      ativo = false;
      pararCamera();
      scannerNexProcessando.current = false;
    };
  }, [estado, processarConteudoQrNex, scannerNexAutorizado, scannerNexDispensado, telaInicial]);

  if (estadoJanela === "bloqueada") {
    return (
      <main className="painel painel--janela-bloqueada" data-tela-segura="painel-cliente">
        <section>
          <img src="/marca/logo-netcatbank-branca.webp" alt="NetCat Bank" />
          <h1>Painel já aberto</h1>
          <p>
            Por segurança, o NC Bank permite apenas uma janela do painel por navegador. Continue usando a
            janela que já está ativa.
          </p>
        </section>
      </main>
    );
  }

  if (estadoJanela === "verificando" || estado !== "autorizado") {
    return (
      <main className="painel painel--carregando" data-tela-segura="painel-cliente">
        <section>
          <ShieldCheck size={34} />
          <h1>
            {estadoJanela === "verificando"
              ? "Validando janela segura"
              : estado === "carregando"
                ? "Validando sessão segura"
                : "Sessão não autorizada"}
          </h1>
          <p>
            {estadoJanela === "verificando"
              ? "Aguarde um instante."
              : estado === "carregando"
                ? "Aguarde um instante."
                : "Redirecionando para o acesso do cliente."}
          </p>
          {(estadoJanela === "verificando" || estado === "carregando") && (
            <div className="painel__barra-carregamento" aria-hidden="true">
              <span />
            </div>
          )}
        </section>
      </main>
    );
  }

  const apresentacao = dados?.cliente?.apresentacao || "cliente";
  const apresentacaoPainel = formatarNomePainel(apresentacao);
  const doisFatoresAtivo = dados?.seguranca?.doisFatoresAtivo === true;
  const chaveNex = chavesNex[0] ?? null;
  const totalChavesAleatorias = chavesNex.filter((chave) => chave.tipo === "aleatoria").length;
  const saldoDisponivel = saldoFinanceiro?.disponivel ?? dados?.painel?.saldoDisponivel ?? "R$ 0,00";
  const saldoTotal = saldoFinanceiro?.total ?? dados?.painel?.saldoTotal ?? "R$ 0,00";
  const saldoDisponivelExibido = saldosVisiveis ? saldoDisponivel : valorMascarado;
  const saldoTotalExibido = saldosVisiveis ? saldoTotal : valorMascarado;
  const valorDoacaoMurzoCentavos = centavosValorEntradaNex(valorDoacaoMurzo);
  const saldoAposDoacaoMurzoCentavos =
    typeof saldoFinanceiro?.disponivelCentavos === "number"
      ? Math.max(0, saldoFinanceiro.disponivelCentavos - valorDoacaoMurzoCentavos)
      : null;
  const saldoAposDoacaoMurzo = saldoAposDoacaoMurzoCentavos === null ? valorMascarado : formatarMoedaNex(saldoAposDoacaoMurzoCentavos);
  const saldoAposPagamentoBoletoCentavos =
    boletoValidado && typeof saldoFinanceiro?.disponivelCentavos === "number"
      ? Math.max(0, saldoFinanceiro.disponivelCentavos - boletoValidado.valorCentavos)
      : null;
  const saldoAposPagamentoBoleto = saldoAposPagamentoBoletoCentavos === null ? valorMascarado : formatarMoedaNex(saldoAposPagamentoBoletoCentavos);
  const valorRecargaCelularCentavos = centavosValorEntradaNex(valorRecargaCelular);
  const saldoAposRecargaCelularCentavos =
    typeof saldoFinanceiro?.disponivelCentavos === "number"
      ? Math.max(0, saldoFinanceiro.disponivelCentavos - valorRecargaCelularCentavos)
      : null;
  const saldoAposRecargaCelular = saldoAposRecargaCelularCentavos === null ? valorMascarado : formatarMoedaNex(saldoAposRecargaCelularCentavos);
  const emprestimoDisponivel = elegibilidadeEmprestimo?.estado === "disponivel" && (elegibilidadeEmprestimo.limiteCentavos ?? 0) > 0;
  const creditoDisponivelEmprestimo = carregandoEmprestimos
    ? "Calculando..."
    : emprestimoDisponivel
      ? elegibilidadeEmprestimo?.limite ?? "R$ 0,00"
      : "Em análise";
  const taxaInicialEmprestimo = emprestimoDisponivel ? elegibilidadeEmprestimo?.taxaMensal ?? "" : "";
  const textoStatusEmprestimo =
    mensagemEmprestimos ||
    (!emprestimoDisponivel && !carregandoEmprestimos
      ? elegibilidadeEmprestimo?.motivo ?? "Movimente sua conta para aumentar suas chances de crédito."
      : "");
  const mesesGrafico = mesesDisponiveisAnoAtual();
  const transacoesAgrupadas = agruparTransacoes(transacoes);
  const saldosCentavosGraficos = (graficos?.entradasCentavos ?? 0) + (graficos?.saidasCentavos ?? 0);
  const classeModal2fa =
    etapa2fa === "convite"
      ? "painel-2fa__modal painel-2fa__modal--convite"
      : "painel-2fa__modal painel-2fa__modal--compacto";
  const acoesRapidas = [
    {
      titulo: "Nex",
      icone: <IconeNex tamanho={26} />,
      url: "/painel/nex"
    },
    {
      titulo: "Pagar",
      icone: <IconePagamentos tamanho={25} />,
      url: "/painel/pagamentos"
    },
    {
      titulo: "Transferir",
      icone: <SendHorizontal size={25} />,
      url: "/painel/nex/enviar"
    },
    {
      titulo: "Depositar",
      icone: <ArrowDownToLine size={25} />
    },
    {
      titulo: "Cobrar",
      icone: <HandCoins size={25} />
    }
  ];
  const navegacaoPainel = [
    { titulo: "Conta", icone: <Landmark size={19} />, url: "/painel" },
    { titulo: "Nex", icone: <IconeNex />, url: "/painel/nex" },
    { titulo: "Pagamentos", icone: <IconePagamentos />, url: "/painel/pagamentos" },
    { titulo: "Empréstimos", icone: <IconeEmprestimo />, url: "/painel/emprestimos" },
    { titulo: "Cartões", icone: <WalletCards size={19} />, url: "/painel" },
    { titulo: "Investimentos", icone: <IconeInvestir />, url: "/painel/graficos" }
  ];
  const itemNavegacaoAtivo = (titulo: string) =>
    (telaInicial === "dashboard" && titulo === "Conta") ||
    (telaInicial.startsWith("nex") && titulo === "Nex") ||
    ((telaInicial === "pagamentos" || telaInicial.startsWith("pagamento") || telaInicial.startsWith("recarga") || telaInicial.startsWith("doacao")) && titulo === "Pagamentos") ||
    ((telaInicial === "emprestimos" || telaInicial === "emprestimos-como-funciona") && titulo === "Empréstimos");
  const statusIndicacaoPainel = dados?.indicacoes?.status ?? (dados?.indicacoes?.disponivel === false ? "indisponivel" : "ativa");
  const indicacoesDisponiveis =
    statusIndicacaoPainel === "ativa" || statusIndicacaoPainel === "limite_atingido";
  const indicacaoModalLimite = statusIndicacaoModal === "limite_atingido";
  const payloadFiltrosExtrato = {
    categoria: categoriaExtrato || undefined,
    limite: 20,
    ordenar: ordenarExtrato,
    pagina: paginaExtrato,
    periodo: periodoExtrato,
    pesquisa: pesquisaExtrato,
    tipo: tipoExtrato
  };
  const temPaginaAnteriorExtrato = paginaExtrato > 1;
  const temPaginaProximaExtrato = paginaExtrato * 20 < totalTransacoes;
  const mostrarPaginacaoExtrato = temPaginaAnteriorExtrato || temPaginaProximaExtrato;
  const temPaginaAnteriorAtividadesNex = paginaAtividadesNex > 1;
  const temPaginaProximaAtividadesNex = paginaAtividadesNex * 18 < totalAtividadesNex;
  const mostrarPaginacaoAtividadesNex = temPaginaAnteriorAtividadesNex || temPaginaProximaAtividadesNex;
  const contatosPorPaginaNex = 12;
  const totalContatosNexEfetivo = totalContatosNex || contatosNex.length;
  const contatosNexPagina = contatosNex.slice(
    (paginaContatosNex - 1) * contatosPorPaginaNex,
    paginaContatosNex * contatosPorPaginaNex
  );
  const temPaginaAnteriorContatosNex = paginaContatosNex > 1;
  const temPaginaProximaContatosNex = paginaContatosNex * contatosPorPaginaNex < totalContatosNexEfetivo;
  const mostrarPaginacaoContatosNex = temPaginaAnteriorContatosNex || temPaginaProximaContatosNex;
  const transacoesNex = atividadesNex.length > 0 ? atividadesNex : transacoes.filter((item) => item.tipoOperacao === "nex");
  const pagamentosRecentes = transacoes
    .filter((item) => item.tipoOperacao === "pagamento" || item.tipoOperacao === "recarga")
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 3);
  const scannerBoletoAberto = scannerBoletoAutorizado && !scannerBoletoDispensado;
  const contatosNexFallback = Array.from(
    new Map(
      transacoesNex
        .filter((item) => item.contraparte)
        .map((item) => [
          item.contraparte,
          {
            chaveSugestao: null,
            nome: item.contraparte ?? "Contato Nex",
            totalTransferencias: 1,
            ultimaEm: item.data,
            valor: item.valor,
            valorCentavos: item.valorCentavos
          }
        ])
    ).values()
  ).slice(0, 3);
  const contatosNexResumo = contatosNex.length > 0 ? contatosNex.slice(0, 3) : contatosNexFallback;
  const chavesAtivasRecebimentoNex = chavesNex.filter((chave) => chave.estado === "ativa" || (!chave.estado && !chave.verificacaoPendente));
  const totalChavesRecebimentoNex = chavesAtivasRecebimentoNex.length;
  const indiceChaveRecebimentoSeguroNex = Math.min(
    Math.max(indiceChaveRecebimentoNex, 0),
    Math.max(totalChavesRecebimentoNex - 1, 0)
  );
  const podeVoltarChaveRecebimentoNex = totalChavesRecebimentoNex > 1 && indiceChaveRecebimentoSeguroNex > 0;
  const podeAvancarChaveRecebimentoNex =
    totalChavesRecebimentoNex > 1 && indiceChaveRecebimentoSeguroNex < totalChavesRecebimentoNex - 1;
  const classeQrRecebimentoNex = `painel-nex-receber__qr ${
    totalChavesRecebimentoNex <= 1 ? "painel-nex-receber__qr--sem-navegacao" : ""
  }`;
  const chaveRecebimentoAtual = chavesAtivasRecebimentoNex[indiceChaveRecebimentoSeguroNex] ?? null;
  const qrRecebimentoAtual = chaveRecebimentoAtual ? qrsRecebimentoNex[`${chaveRecebimentoAtual.id}:0`] : null;
  const diasCalendarioAgendamentoNex = criarDiasCalendarioNex(mesCalendarioAgendamentoNex);
  const opcoesHorasNex = opcoesHorasAgendamentoNex(dataAgendamentoNex);
  const opcoesMinutosNex = opcoesMinutosAgendamentoNex(dataAgendamentoNex, horaAgendamentoNex);
  const opcoesHorasVisiveisNex = opcoesHorasNex.includes(horaAgendamentoNex)
    ? opcoesHorasNex
    : [horaAgendamentoNex, ...opcoesHorasNex].sort();
  const opcoesMinutosVisiveisNex = opcoesMinutosNex.includes(minutoAgendamentoNex)
    ? opcoesMinutosNex
    : [minutoAgendamentoNex, ...opcoesMinutosNex].sort();
  const mesCalendarioDataAgendamentoNex = primeiroDiaMesNex(`${mesCalendarioAgendamentoNex}-01`);
  const mesAtualCalendarioAgendamentoNex = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const podeVoltarMesCalendarioAgendamentoNex =
    new Date(mesCalendarioDataAgendamentoNex.getFullYear(), mesCalendarioDataAgendamentoNex.getMonth() - 1, 1).getTime() >=
    mesAtualCalendarioAgendamentoNex;
  const rotuloMesCalendarioAgendamentoNex = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  })
    .format(mesCalendarioDataAgendamentoNex)
    .replace(/^\p{L}/u, (letra) => letra.toLocaleUpperCase("pt-BR"));
  const rotuloDataAgendamentoNex =
    dataAgendamentoEhHojeNex(dataAgendamentoNex)
      ? "Hoje"
      : new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit",
          month: "long",
          year: "numeric"
        }).format(new Date(`${dataAgendamentoNex}T00:00:00`));
  const dataHoraAgendamentoSelecionada = combinarDataHoraAgendamentoNex(
    dataAgendamentoNex,
    horaAgendamentoNex,
    minutoAgendamentoNex
  );
  const dataHoraAgendamentoTexto = dataHoraAgendamentoSelecionada
    ? formatarDataHoraAgendamentoNex(dataHoraAgendamentoSelecionada.toISOString())
    : "Data não definida";
  const rotuloDocumentoContaNex = somenteDigitos(dados?.cliente?.documentoNex ?? "").length > 11 ? "CNPJ" : "CPF";
  const rotuloTipoChaveContaNex = (tipo: TipoChaveNex) => (tipo === "documento" ? rotuloDocumentoContaNex : rotuloTipoChaveNex(tipo));
  const rotuloChaveRecebimentoContaNex = (chave: ChaveNexVisual) =>
    `${rotuloTipoChaveContaNex(chave.tipo)}: ${valorExibicaoChaveNex(chave)}`;
  const opcoesChaveNex: Array<{
    descricao: string;
    icone: ReactNode;
    tipo: TipoChaveNex;
    titulo: string;
  }> = [
    {
      descricao: "Uma sequência exclusiva gerada pelo sistema para aumentar sua privacidade nas transações.",
      icone: <Shuffle size={20} />,
      tipo: "aleatoria",
      titulo: "Chave aleatória"
    },
    {
      descricao: "Receba transferências utilizando seu endereço de e-mail como chave Nex.",
      icone: <Mail size={20} />,
      tipo: "email",
      titulo: "E-mail"
    },
    {
      descricao: "Receba pagamentos utilizando seu número de celular cadastrado.",
      icone: <Phone size={20} />,
      tipo: "telefone",
      titulo: "Telefone"
    },
    {
      descricao: "Utilize o documento vinculado à sua conta para receber pagamentos via Nex.",
      icone: <Fingerprint size={20} />,
      tipo: "documento",
      titulo: rotuloDocumentoContaNex
    }
  ];
  const abrirModalDoacaoMurzo = () => {
    setModalDoacaoMurzoAberto(true);
    setEtapaDoacaoMurzo("valor");
    setValorDoacaoMurzo(formatarMoedaNex(0));
    setMensagemDoacaoMurzo("");
    setTransacaoDoacaoMurzoId("");
  };
  const fecharModalDoacaoMurzo = () => {
    if (processandoDoacaoMurzo) return;
    setModalDoacaoMurzoAberto(false);
    setEtapaDoacaoMurzo("valor");
    setMensagemDoacaoMurzo("");
  };
  const revisarDoacaoMurzo = () => {
    const valorCentavos = centavosValorEntradaNex(valorDoacaoMurzo);
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
      setMensagemDoacaoMurzo("Informe um valor válido para doar.");
      return;
    }
    if (typeof saldoFinanceiro?.disponivelCentavos === "number" && valorCentavos > saldoFinanceiro.disponivelCentavos) {
      setMensagemDoacaoMurzo("O valor informado é maior que o saldo disponível.");
      return;
    }

    setMensagemDoacaoMurzo("");
    setEtapaDoacaoMurzo("revisao");
  };
  const confirmarDoacaoMurzo = async () => {
    const valorCentavos = centavosValorEntradaNex(valorDoacaoMurzo);
    if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0) {
      setEtapaDoacaoMurzo("valor");
      setMensagemDoacaoMurzo("Informe um valor válido para doar.");
      return;
    }
    if (doacaoMurzoEmAndamento.current || processandoDoacaoMurzo) return;

    doacaoMurzoEmAndamento.current = true;
    setProcessandoDoacaoMurzo(true);
    setMensagemDoacaoMurzo("");

    try {
      const conteudo = await chamarFinanceiro<RespostaDoacaoMurzo>("/doacoes/instituto-murzo/doar", {
        valorCentavos
      });
      if (conteudo.estado !== "ok" || !conteudo.doacao?.transacaoId) throw new Error("doacao");
      setTransacaoDoacaoMurzoId(conteudo.doacao.transacaoId);
      setEtapaDoacaoMurzo("sucesso");
      window.setTimeout(() => {
        window.location.assign(`/painel/transacao/${encodeURIComponent(conteudo.doacao?.transacaoId ?? "")}`);
      }, 1100);
    } catch (erro) {
      setMensagemDoacaoMurzo(mensagemErroApiNetCat(erro, "Não foi possível concluir essa doação agora."));
    } finally {
      doacaoMurzoEmAndamento.current = false;
      setProcessandoDoacaoMurzo(false);
    }
  };
  const selecionarDataAgendamentoNex = (dataIso: string) => {
    if (inicioDiaNex(new Date(`${dataIso}T00:00:00`)).getTime() < inicioDiaNex(new Date()).getTime()) return;
    const horario = ajustarHorarioAgendamentoNex(dataIso, horaAgendamentoNex, minutoAgendamentoNex);
    setDataAgendamentoNex(dataIso);
    setHoraAgendamentoNex(horario.hora);
    setMinutoAgendamentoNex(horario.minuto);
    setCalendarioAgendamentoAberto(false);
    setMensagemAgendamentoNex("");
  };
  const navegarMesCalendarioAgendamentoNex = (direcao: -1 | 1) => {
    const proximo = new Date(
      mesCalendarioDataAgendamentoNex.getFullYear(),
      mesCalendarioDataAgendamentoNex.getMonth() + direcao,
      1
    );
    if (direcao < 0 && proximo.getTime() < mesAtualCalendarioAgendamentoNex) return;
    setMesCalendarioAgendamentoNex(mesIsoNex(proximo));
  };
  const selecionarHoraAgendamentoNex = (hora: string) => {
    const horario = ajustarHorarioAgendamentoNex(dataAgendamentoNex, hora, minutoAgendamentoNex);
    setHoraAgendamentoNex(horario.hora);
    setMinutoAgendamentoNex(horario.minuto);
    setMensagemAgendamentoNex("");
  };
  const selecionarMinutoAgendamentoNex = (minuto: string) => {
    const horario = ajustarHorarioAgendamentoNex(dataAgendamentoNex, horaAgendamentoNex, minuto);
    setHoraAgendamentoNex(horario.hora);
    setMinutoAgendamentoNex(horario.minuto);
    setMensagemAgendamentoNex("");
  };
  const abrirModalNovaChaveNex = () => {
    setTipoChaveNex("aleatoria");
    setEntradaChaveNex("");
    setMensagemNex("");
    setEtapaModalChaveNex("tipo");
    setModalChaveNexAberto(true);
  };
  const fecharModalChaveNex = () => {
    setModalChaveNexAberto(false);
    setEtapaModalChaveNex("tipo");
    setEntradaChaveNex("");
  };
  const avancarModalChaveNex = () => {
    setMensagemNex("");

    if (etapaModalChaveNex === "tipo") {
      if (tipoChaveNex === "aleatoria" && totalChavesAleatorias >= 3) {
        setMensagemNex("Você já criou 3 chaves aleatórias.");
        return;
      }
      if (tipoChaveNex !== "aleatoria" && chavesNex.some((chave) => chave.tipo === tipoChaveNex)) {
        setMensagemNex(`Você já possui uma chave do tipo ${rotuloTipoChaveNex(tipoChaveNex)}.`);
        return;
      }

      setEntradaChaveNex(
        tipoChaveNex === "aleatoria"
          ? ""
          : tipoChaveNex === "documento"
            ? "documento-cadastrado"
            : ""
      );
      setEtapaModalChaveNex("dados");
      return;
    }

    if (etapaModalChaveNex === "dados") {
      if (tipoChaveNex === "aleatoria" || tipoChaveNex === "documento") {
        setEtapaModalChaveNex("confirmar");
        return;
      }

      const valor = normalizarChaveNex(tipoChaveNex, entradaChaveNex);
      if (tipoChaveNex === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
        setMensagemNex("Informe um e-mail válido.");
        return;
      }
      if (tipoChaveNex === "telefone" && !telefoneBrasileiroNexValido(valor)) {
        setMensagemNex("Informe um telefone brasileiro válido com DDD.");
        return;
      }
      setEtapaModalChaveNex("confirmar");
      return;
    }

    void registrarChaveNexVisual(tipoChaveNex, entradaChaveNex);
  };
  const voltarModalChaveNex = () => {
    if (etapaModalChaveNex === "confirmar") {
      setEtapaModalChaveNex("dados");
      return;
    }
    if (etapaModalChaveNex === "dados") {
      setEtapaModalChaveNex("tipo");
      return;
    }
    fecharModalChaveNex();
  };
  const abrirDetalheTransacao = (item: MovimentoFinanceiro) => {
    if (!item.id) return;
    if (item.status === "agendado") {
      window.location.assign(`/painel/agendamento/${encodeURIComponent(item.id)}`);
      return;
    }
    window.location.assign(`/painel/transacao/${encodeURIComponent(item.id)}`);
  };
  const iconeMovimento = (item: MovimentoFinanceiro) => {
    if (item.tipoOperacao === "bonus" && item.descricao.toLocaleLowerCase("pt-BR").includes("boas-vindas")) {
      return <IconeBoasVindasNc tamanho={18} />;
    }
    if (item.tipoOperacao === "bonus") return <IconeBonusNc tamanho={18} />;
    if (item.tipoOperacao === "nex") return <IconeNex tamanho={18} />;
    if (item.tipoOperacao === "pagamento") return <IconePagamentos tamanho={18} />;
    if (item.tipoOperacao === "recarga") return <Smartphone size={18} />;
    if (item.tipoOperacao === "doacao") return <HeartHandshake size={18} />;
    if (item.tipoOperacao === "cartao") return <WalletCards size={18} />;
    return item.tipo === "entrada" ? <ArrowDownToLine size={18} /> : <ArrowRight size={18} />;
  };
  const participanteFallback = (tipo: "pagador" | "recebedor", item: MovimentoFinanceiro): ParticipanteComprovante => {
    if (item.tipoOperacao === "pagamento") {
      return tipo === "recebedor"
        ? {
            chave: "Boleto bancário liquidado",
            documento: "Dados protegidos do beneficiário",
            instituicao: normalizarInstituicaoBoletoPainel(item.instituicao ?? item.contraparte),
            nome: "Beneficiário do boleto"
          }
        : {
            chave: "Conta debitada",
            documento: "Documento da conta",
            instituicao: "NC Bank",
            nome: apresentacao
          };
    }

    if (item.tipoOperacao === "recarga") {
      return tipo === "recebedor"
        ? {
            chave: item.descricao.match(/\(\d{2}\)\s9\*{4}-\d{4}/)?.[0] ?? "Número de celular validado",
            documento: "Linha pré-paga",
            instituicao: item.instituicao ?? item.contraparte ?? "Operadora móvel",
            nome: item.contraparte ?? "Operadora móvel"
          }
        : {
            chave: "Conta debitada",
            documento: "Documento da conta",
            instituicao: "NC Bank",
            nome: apresentacao
          };
    }

    return {
      chave:
        item.tipoOperacao === "doacao"
          ? institutoMurzoPainel.conta
          : item.tipoOperacao === "nex"
            ? "Conta NC Bank"
            : "Dados da contraparte",
      documento:
        item.tipoOperacao === "doacao"
          ? institutoMurzoPainel.cnpjMascarado
          : item.tipoOperacao === "nex"
            ? "CPF/CNPJ não disponível"
            : "CPF/CNPJ da contraparte",
      instituicao: item.instituicao ?? "NC Bank",
      nome:
        item.tipoOperacao === "doacao" && tipo === "recebedor"
          ? institutoMurzoPainel.nome
          : tipo === "recebedor" && item.tipo === "entrada"
            ? apresentacao
            : item.contraparte ?? "NC Bank"
    };
  };
  const rotuloFiltro = (opcoes: OpcaoFiltroPainel[], valor: string) =>
    opcoes.find((opcao) => opcao.valor === valor)?.rotulo ?? opcoes[0]?.rotulo ?? "";
  const renderFiltro = (
    id: FiltroAbertoPainel,
    opcoes: OpcaoFiltroPainel[],
    valor: string,
    aoSelecionar: (valor: string) => void
  ) => (
    <div className="painel-financeiro__select">
      <button
        aria-expanded={filtroAberto === id}
        onClick={() => setFiltroAberto((atual) => (atual === id ? "" : id))}
        type="button"
      >
        {rotuloFiltro(opcoes, valor)}
        <ChevronRight size={16} />
      </button>
      {filtroAberto === id && (
        <div className="painel-financeiro__select-menu" role="listbox">
          {opcoes.map((opcao) => (
            <button
              aria-selected={opcao.valor === valor}
              key={opcao.valor || opcao.rotulo}
              onClick={() => {
                aoSelecionar(opcao.valor);
                setFiltroAberto("");
              }}
              role="option"
              type="button"
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  const baixarExtrato = async (formato: "pdf" | "csv" | "ofx") => {
    if (baixandoExtrato) return;
    setBaixandoExtrato(formato);
    setMensagemFinanceira("");

    try {
      const resposta = await chamarFinanceiro<Response>(
        "/financeiro/extrato/download",
        {
          ...payloadFiltrosExtrato,
          formato
        },
        { baixar: true }
      );
      const blob = await resposta.blob();
      const nome =
        resposta.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? `extrato-netcatbank.${formato}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setModalExtratoAberto(false);
    } catch {
      setMensagemFinanceira("Não foi possível baixar o extrato agora.");
    } finally {
      setBaixandoExtrato("");
    }
  };
  const baixarComprovante = async (formato: "pdf" | "png") => {
    if (!transacaoDetalhe?.id) return;

    setBaixandoComprovante(formato);
    setMensagemTransacaoDetalhe("");

    try {
      const resposta = await chamarFinanceiro<Response>(
        "/financeiro/transacao/comprovante",
        {
          formato,
          id: transacaoDetalhe.id
        },
        { baixar: true }
      );
      const blob = await resposta.blob();
      const nome =
        resposta.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? `comprovante-netcatbank.${formato}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setModalComprovanteAberto(false);
    } catch {
      setMensagemTransacaoDetalhe("Não foi possível gerar o comprovante agora.");
    } finally {
      setBaixandoComprovante("");
    }
  };
  const renderMovimentos = (itens: MovimentoFinanceiro[]) => {
    if (carregandoFinanceiro) {
      return <div className="painel-financeiro__vazio">Carregando transações...</div>;
    }

    if (mensagemFinanceira && itens.length === 0) {
      return <div className="painel-financeiro__vazio">{mensagemFinanceira}</div>;
    }

    if (itens.length === 0) {
      return <div className="painel-financeiro__vazio">Nenhuma transação encontrada.</div>;
    }

    return itens.map((item) => {
      const detalheDisponivel = Boolean(item.id);

      return (
      <button
        className={`painel-dashboard__movimento ${
          detalheDisponivel ? "painel-dashboard__movimento--clicavel" : "painel-dashboard__movimento--sem-detalhe"
        } ${
          item.tipoOperacao === "bonus" ? "painel-dashboard__movimento--bonus" : ""
        }`}
        disabled={!detalheDisponivel}
        key={item.id || `${item.descricao}-${item.data}`}
        onClick={() => abrirDetalheTransacao(item)}
        type="button"
      >
        <i className={item.tipoOperacao === "bonus" ? "painel-dashboard__icone-bonus" : undefined}>
          {iconeMovimento(item)}
        </i>
        <span>
          <strong>{item.descricao}</strong>
          <small>{item.contraparte ?? item.categoria}</small>
        </span>
        <em className={item.tipo === "entrada" ? "painel-dashboard__entrada" : "painel-dashboard__saida"}>
          {item.valor}
          <small>{formatarGrupoDia(new Date(item.data))}</small>
        </em>
      </button>
      );
    });
  };

  return (
    <main
      className={`painel ${folhaMobileAberta ? "painel--folha-aberta" : ""}`}
      data-tela-segura="painel-cliente"
    >
      <aside className="painel__lateral">
        <div className="painel__marca">
          <img src="/marca/logo-netcatbank-branca.webp" alt="NetCat Bank" />
          <div>
            <span>NC Bank</span>
            <small>Conta digital</small>
          </div>
        </div>
        <nav aria-label="Navegação do painel">
          {navegacaoPainel.map((item) => {
            return (
              <a aria-current={itemNavegacaoAtivo(item.titulo) ? "page" : undefined} href={item.url} key={item.titulo} title={item.titulo}>
                {item.icone}
                <span>{item.titulo}</span>
              </a>
            );
          })}
        </nav>
        {indicacoesDisponiveis && (
          <button className="painel__indique" onClick={() => void abrirIndicacao()} type="button">
            <Gift size={24} />
            <span>
              <strong>Indique e ganhe</strong>
              <small>Ganhe até R$500 indicando amigos.</small>
            </span>
            <ChevronRight size={18} />
          </button>
        )}
        <button className="painel__sair" onClick={sair} type="button">
          <LogOut size={18} />
          <span>Sair</span>
        </button>
      </aside>

      <nav className="painel__mobile-nav" aria-label="Navegação móvel do painel">
        {navegacaoPainel.slice(0, 3).map((item) => {
          return (
            <a aria-current={itemNavegacaoAtivo(item.titulo) ? "page" : undefined} href={item.url} key={item.titulo}>
              {item.icone}
              <span>{item.titulo}</span>
            </a>
          );
        })}
        <button onClick={() => setFolhaMobileAberta(true)} type="button">
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </nav>

      {folhaMobileAberta && (
        <div className="painel__folha-fundo" onClick={() => setFolhaMobileAberta(false)} role="presentation">
          <section className="painel__folha" onClick={(evento) => evento.stopPropagation()} aria-label="Menu do painel">
            <span />
            <div className="painel__folha-cabecalho">
              <strong>NC Bank</strong>
              <button aria-label="Fechar menu" onClick={() => setFolhaMobileAberta(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="painel__folha-grade">
              {navegacaoPainel.map((item) => (
                <a href={item.url} key={item.titulo} onClick={() => setFolhaMobileAberta(false)}>
                  {item.icone}
                  {item.titulo}
                </a>
              ))}
            </div>
            {indicacoesDisponiveis && (
              <button
                className="painel__folha-sair painel__folha-indique"
                onClick={() => {
                  setFolhaMobileAberta(false);
                  void abrirIndicacao();
                }}
                type="button"
              >
                <Gift size={18} />
                Indique e ganhe
              </button>
            )}
            <button className="painel__folha-sair" onClick={sair} type="button">
              <LogOut size={18} />
              Sair da conta
            </button>
          </section>
        </div>
      )}

      <section className="painel__conteudo">
        {telaInicial === "dashboard" && (
          <header className="painel__topo painel-dashboard__topo">
            <div>
              <h1>Olá, {apresentacaoPainel}.</h1>
              <p>Que bom te ver por aqui!</p>
            </div>
          </header>
        )}

        {telaInicial === "dashboard" && (
          <div className="painel-dashboard">
            <section className="painel-dashboard__principal" aria-label="Resumo financeiro NC Bank">
              <article
                className="painel-dashboard__saldo painel-dashboard__saldo--clicavel"
                onClick={() => window.location.assign("/painel/saldo")}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter" || evento.key === " ") window.location.assign("/painel/saldo");
                }}
                role="link"
                tabIndex={0}
              >
                <div>
                  <span>
                    Saldo disponível
                    <button
                      aria-label={saldosVisiveis ? "Ocultar saldos" : "Mostrar saldos"}
                      aria-pressed={saldosVisiveis}
                      className="painel-dashboard__olho"
                      onClick={(evento) => {
                        evento.stopPropagation();
                        alternarSaldosVisiveis();
                      }}
                      type="button"
                    >
                      {saldosVisiveis ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </span>
                  <strong>{saldoDisponivelExibido}</strong>
                  <small>Saldo total {saldoTotalExibido}</small>
                </div>
              </article>

              <article className="painel-dashboard__extrato">
                <div className="painel-dashboard__cabecalho-card">
                  <strong>Últimas transações</strong>
                  <a href="/painel/extrato">Ver tudo</a>
                </div>
                {renderMovimentos(transacoes.slice(0, 3))}
              </article>
            </section>

            <aside className="painel-dashboard__lateral" aria-label="Ações rápidas">
              <section className="painel-dashboard__acoes">
                <strong>Ações rápidas</strong>
                <div>
                  {acoesRapidas.map((acao) => (
                    <button
                      key={acao.titulo}
                      onClick={() => {
                        if (acao.url) window.location.assign(acao.url);
                      }}
                      type="button"
                    >
                      {acao.icone}
                      <span>{acao.titulo}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="painel-dashboard__ajuda">
                <ShieldCheck size={22} />
                <div>
                  <strong>{doisFatoresAtivo ? "Proteção ativa" : "Proteção recomendada"}</strong>
                  <span>{doisFatoresAtivo ? "2FA e sessão protegida." : "Ative o 2FA para reforçar seu acesso."}</span>
                </div>
                <ArrowRight size={18} />
              </section>
            </aside>
          </div>
        )}

        {telaInicial === "emprestimos" && (
          <div className="painel-emprestimos">
            <header className="painel-nex__topo painel-emprestimos__topo">
              <div>
                <h1>Empréstimos</h1>
                <p>Consulte ofertas disponíveis para sua conta.</p>
              </div>
            </header>

            <article className="painel-emprestimos__hero">
              <picture aria-hidden="true">
                <img src="/marca/emprestimos-hero-netcatbank.png" alt="" />
              </picture>
              <div>
                <span className="painel-emprestimos__rotulo">
                  Crédito disponível para você
                  <span className="painel-emprestimos__ajuda" aria-label="Valor sujeito à análise no momento da simulação." tabIndex={0}>
                    <CircleHelp size={14} />
                    <em>Valor sujeito à análise no momento da simulação.</em>
                  </span>
                </span>
                <strong>{creditoDisponivelEmprestimo}</strong>
                {emprestimoDisponivel ? (
                  <small>
                    Taxa a partir de <b>{taxaInicialEmprestimo}</b>
                  </small>
                ) : (
                  <small>{carregandoEmprestimos ? "Consultando análise protegida." : "Pré-análise em andamento."}</small>
                )}
                {textoStatusEmprestimo && <p className="painel-emprestimos__status">{textoStatusEmprestimo}</p>}
                <div className="painel-emprestimos__hero-acoes" aria-label="Ações de empréstimo">
                  <span className="botao botao--primario">{emprestimoDisponivel ? "Simular empréstimo" : "Aguardar análise"}</span>
                  <a className="painel-emprestimos__link" href="/painel/emprestimos/como-funciona">
                    Entenda como funciona
                    <ArrowRight size={16} />
                  </a>
                </div>
              </div>
            </article>

            <section className="painel-emprestimos__tipos" aria-label="Tipos de empréstimo">
              <div className="painel-emprestimos__cabecalho">
                <span>Escolha o tipo de empréstimo ideal para você</span>
                <HandCoins size={20} />
              </div>
              <div className="painel-emprestimos__opcoes">
                {[
                  {
                    descricao: "Dinheiro direto na conta para organizar planos, compras ou imprevistos.",
                    icone: <IconeEmprestimo tamanho={23} />,
                    taxa: emprestimoDisponivel ? `Taxa a partir de ${taxaInicialEmprestimo}` : "Disponível após análise",
                    titulo: "Crédito pessoal"
                  },
                  {
                    descricao: "Antecipe parcelas do saque-aniversário com contratação simplificada.",
                    icone: <ShieldCheck size={23} />,
                    taxa: "Taxa a partir de 1,79% a.m.",
                    titulo: "Antecipação do FGTS"
                  }
                ].map((opcao) => (
                  <article className="painel-emprestimos__opcao" key={opcao.titulo}>
                    <i>{opcao.icone}</i>
                    <span>
                      <strong>{opcao.titulo}</strong>
                      <small>{opcao.descricao}</small>
                    </span>
                    <em>{opcao.taxa}</em>
                    <span className="painel-emprestimos__simular">
                      Simular
                      <ArrowRight size={16} />
                    </span>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {telaInicial === "emprestimos-como-funciona" && (
          <div className="painel-emprestimos painel-emprestimos--como-funciona">
            <header className="painel-nex__topo painel-emprestimos__topo">
              <a className="painel-financeiro__voltar" href="/painel/emprestimos">
                <ArrowLeft size={17} />
                Voltar
              </a>
              <div>
                <h1>Como funciona a análise</h1>
                <p>Entenda a pré-análise de crédito da sua conta NC Bank.</p>
              </div>
            </header>

            <section className="painel-emprestimos-explicacao">
              <article className="painel-emprestimos-explicacao__principal">
                <picture className="painel-emprestimos-explicacao__principal-bg" aria-hidden="true">
                  <img src="/marca/emprestimos-analise-governanca-netcatbank.png" alt="" />
                </picture>
                <span>Governança de crédito</span>
                <h2>A disponibilidade nasce de uma leitura comportamental, auditável e protegida.</h2>
                <p>
                  A pré-análise observa a relação da conta com o NC Bank: histórico de movimentação, regularidade de uso,
                  saldo disponível, pagamentos realizados e tempo de relacionamento. O valor exibido é uma indicação para
                  simulação, não uma aprovação definitiva. Antes da contratação, a proposta passa por revisão de crédito,
                  confirmação das condições e aceite do cliente.
                </p>
              </article>

              <section className="painel-emprestimos-explicacao__analise" aria-label="Composição da análise de crédito">
                <article className="painel-emprestimos-explicacao__grafico">
                  <div className="painel-emprestimos-explicacao__titulo">
                    <span>Composição da pré-análise</span>
                    <strong>Sinais avaliados</strong>
                  </div>
                  {[
                    { rotulo: "Uso recente da conta", valor: "34%", largura: "78%" },
                    { rotulo: "Volume transacionado", valor: "28%", largura: "66%" },
                    { rotulo: "Diversidade de operações", valor: "16%", largura: "46%" },
                    { rotulo: "Relacionamento", valor: "12%", largura: "36%" },
                    { rotulo: "Consistência de saldo", valor: "8%", largura: "28%" }
                  ].map((linha) => (
                    <div className="painel-emprestimos-explicacao__barra" key={linha.rotulo}>
                      <span>
                        <strong>{linha.rotulo}</strong>
                        <em>{linha.valor}</em>
                      </span>
                      <i>
                        <b style={{ width: linha.largura }} />
                      </i>
                    </div>
                  ))}
                </article>

                <article className="painel-emprestimos-explicacao__resumo">
                  <span>Janela atual</span>
                  <strong>Até 2h</strong>
                  <p>
                    A disponibilidade é revisada em intervalos para evitar mudanças a cada movimentação isolada. A análise
                    valoriza consistência ao longo do tempo, não apenas uma compra, recarga ou transferência recente.
                  </p>
                </article>
              </section>

              <div className="painel-emprestimos-explicacao__grid">
                <article>
                  <i><ShieldCheck size={22} /></i>
                  <strong>Segurança e privacidade</strong>
                  <span>Suas informações são tratadas em ambiente protegido e usadas apenas para avaliar disponibilidade e segurança da proposta.</span>
                </article>
                <article>
                  <i><Repeat2 size={22} /></i>
                  <strong>Atualização controlada</strong>
                  <span>A análise é mantida por até 2 horas para evitar oscilações a cada transação ou abertura de tela.</span>
                </article>
                <article>
                  <i><Landmark size={22} /></i>
                  <strong>Governança bancária</strong>
                  <span>A análise segue critérios de crédito responsável, controles de risco e revisão antes de qualquer contratação.</span>
                </article>
              </div>

              <section className="painel-emprestimos-explicacao__linha" aria-label="Linha de decisão">
                {[
                  {
                    titulo: "Coleta protegida",
                    texto: "A consulta acontece somente dentro da sua área logada, com validação de segurança da conta."
                  },
                  {
                    titulo: "Leitura do relacionamento",
                    texto: "São considerados histórico de uso, movimentações concluídas, saldo e frequência dos serviços."
                  },
                  {
                    titulo: "Faixa inicial",
                    texto: "Quando há dados suficientes, a conta pode receber um valor inicial para simulação."
                  },
                  {
                    titulo: "Revisão na simulação",
                    texto: "A próxima etapa apresenta parcelas, custo total, condições e confirmação antes do aceite."
                  }
                ].map((passo, indice) => (
                  <article key={passo.titulo}>
                    <em>{indice + 1}</em>
                    <span>
                      <strong>{passo.titulo}</strong>
                      <small>{passo.texto}</small>
                    </span>
                  </article>
                ))}
              </section>

              <section className="painel-emprestimos-explicacao__passos" aria-label="Critérios da análise">
                {[
                  "Movimentações frequentes e compatíveis com o perfil da conta ajudam a formar histórico.",
                  "Entradas, pagamentos, recargas e transferências liquidadas aumentam a leitura de uso real.",
                  "Contas muito recentes ou com pouco movimento podem permanecer em análise por mais tempo.",
                  "A oferta inicial pode mudar após revisão de risco, política de crédito e confirmação das condições."
                ].map((item, indice) => (
                  <article key={item}>
                    <em>{indice + 1}</em>
                    <span>{item}</span>
                  </article>
                ))}
              </section>

              <section className="painel-emprestimos-explicacao__duas-colunas" aria-label="O que influencia a análise">
                <article>
                  <strong>O que costuma ajudar</strong>
                  <span>Receber e movimentar valores com regularidade, usar serviços da conta, pagar compromissos em dia e manter um padrão de uso compatível com sua rotina financeira.</span>
                </article>
                <article>
                  <strong>Por que pode aparecer em análise</strong>
                  <span>Conta recém-ativada, pouco histórico de movimentação, uso ainda irregular ou ausência de uma oferta disponível para o perfil naquele ciclo de análise.</span>
                </article>
              </section>
            </section>
          </div>
        )}

        {telaInicial === "pagamentos" && (
          <div className="painel-pagamentos">
            <header className="painel-nex__topo painel-pagamentos__topo">
              <div>
                <h1>Pagamentos</h1>
                <p>Pague boletos, organize serviços.</p>
              </div>
            </header>

            <article className="painel-pagamentos__hero">
              <picture aria-hidden="true">
                <img src="/marca/pagamentos-boleto-netcatbank.png" alt="" />
              </picture>
              <div>
                <span>
                  <img src="/marca/logo-netcatbank-branca.webp" alt="" />
                  NC Bank
                </span>
                <h2>Pagamentos rápidos. Tudo em um só lugar.</h2>
                <p>Escaneie o código de barras, cole a linha digitável e acompanhe o histórico dos seus pagamentos com praticidade e segurança.</p>
              </div>
            </article>

            <section className="painel-pagamentos__acoes" aria-label="Ações rápidas de pagamentos">
              {[
                {
                  descricao: "Enviar e receber por chave.",
                  icone: <IconeNex tamanho={24} />,
                  titulo: "Nex",
                  url: "/painel/nex"
                },
                {
                  descricao: "Código de barras ou linha digitável.",
                  icone: <ReceiptText size={24} />,
                  titulo: "Pagar boleto",
                  url: "/painel/pagamentos/boleto"
                },
                {
                  descricao: "Créditos para celular pré-pago.",
                  icone: <Smartphone size={24} />,
                  titulo: "Recarga de celular",
                  url: "/painel/pagamentos/celular"
                },
                {
                  descricao: "Contribuições para campanhas.",
                  icone: <HeartHandshake size={24} />,
                  titulo: "Doações",
                  url: "/painel/pagamentos/doacoes"
                }
              ].map((acao) => (
                <button
                  key={acao.titulo}
                  onClick={() => {
                    if (acao.url) {
                      window.location.assign(acao.url);
                      return;
                    }
                  }}
                  type="button"
                >
                  <i>{acao.icone}</i>
                  <span>
                    <strong>{acao.titulo}</strong>
                    <small>{acao.descricao}</small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </section>

            <section className="painel-pagamentos__grid">
              <article className="painel-pagamentos__boleto" id="painel-pagamentos-boleto">
                <div className="painel-pagamentos__boleto-texto">
                  <span>Pagar boleto</span>
                  <h2>Como deseja pagar?</h2>
                  <p>Utilize a câmera para ler o código de barras ou insira a linha digitável.</p>
                </div>
                <div className="painel-pagamentos__boleto-acoes">
                  <button onClick={() => window.location.assign("/painel/pagamentos/boleto")} type="button">
                    <ScanBarcode size={34} />
                    <strong>Escanear código de barras</strong>
                    <small>Use a câmera para capturar o boleto.</small>
                  </button>
                  <span>ou</span>
                  <button onClick={() => window.location.assign("/painel/pagamentos/boleto")} type="button">
                    <Barcode size={30} />
                    <strong>Inserir código do boleto</strong>
                  </button>
                </div>
              </article>

              <aside className="painel-pagamentos__recentes">
                <div className="painel-nex__cabecalho">
                  <span>Pagamentos recentes</span>
                  <ReceiptText size={19} />
                </div>
                {pagamentosRecentes.length > 0 ? (
                  <div>
                    {pagamentosRecentes.map((item) => (
                      <button key={item.id || `${item.descricao}-${item.data}`} onClick={() => abrirDetalheTransacao(item)} type="button">
                        <i>
                          {iconeMovimento(item)}
                        </i>
                        <span>
                          <strong>{item.descricao}</strong>
                          <small>{item.contraparte ?? formatarGrupoDia(new Date(item.data))}</small>
                        </span>
                        <em>{item.valor}</em>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="painel-pagamentos__vazio">
                    <ReceiptText size={30} />
                    <strong>Nenhum pagamento recente</strong>
                    <span>Depois do primeiro boleto pago, ele aparece aqui para consulta rápida.</span>
                  </div>
                )}
              </aside>
            </section>
          </div>
        )}

        {telaInicial === "pagamento-boleto" && (
          <div className="painel-boleto painel-nex painel-nex--envio">
            <header className="painel-nex__topo painel-pagamentos__topo">
              <a className="painel-financeiro__voltar" href="/painel/pagamentos">
                <ArrowLeft size={17} />
                Voltar
              </a>
              <div>
                <h1>Pagar boleto</h1>
                <p>Digite a linha digitável ou leia o código de barras.</p>
              </div>
            </header>

            <section className="painel-nex-envio painel-boleto__fluxo">
              <article className="painel-nex-envio__etapas painel-boleto__etapas" aria-label="Etapas do pagamento de boleto">
                {[
                  { id: "codigo", rotulo: "Código" },
                  { id: "revisao", rotulo: "Revisão" },
                  { id: "sucesso", rotulo: "Pagamento" }
                ].map((etapa, indice) => {
                  const etapas = ["codigo", "revisao", "sucesso"];
                  const ativa = etapaPagamentoBoleto === etapa.id;
                  const concluida = etapas.indexOf(etapaPagamentoBoleto) > indice;
                  return (
                    <span
                      className={ativa ? "painel-nex-envio__etapa--ativa" : concluida ? "painel-nex-envio__etapa--ok" : undefined}
                      key={etapa.id}
                    >
                      <i>{concluida ? <CheckCircle2 size={15} /> : indice + 1}</i>
                      {etapa.rotulo}
                    </span>
                  );
                })}
              </article>

              {etapaPagamentoBoleto === "codigo" && (
                <>
                  {!scannerBoletoAberto && (
                    <section className="painel-boleto__entrada">
                      <article className="painel-nex-envio__card painel-boleto__card-codigo">
                        <div className="painel-nex-envio__intro">
                          <i><Barcode size={24} /></i>
                          <span>
                            <strong>Código do boleto</strong>
                            <small>Linha digitável de 47 dígitos ou código de barras de 44 dígitos.</small>
                          </span>
                        </div>
                        <label className="painel-nex__campo painel-nex-envio__campo painel-boleto__campo">
                          <span>Linha digitável ou código de barras</span>
                          <input
                            autoComplete="off"
                            data-ncbank-sensivel="true"
                            inputMode="numeric"
                            maxLength={tamanhoMaximoEntradaBoleto}
                            onBeforeInput={(evento) => {
                              const texto = (evento.nativeEvent as InputEvent).data;
                              if (texto && /[^\d\s.-]/.test(texto)) evento.preventDefault();
                            }}
                            onChange={(evento) => {
                              setCodigoBoleto(formatarCodigoBoletoEntrada(evento.target.value));
                              setMensagemBoleto("");
                              setBoletoValidado(null);
                              setPagamentoBoleto(null);
                            }}
                            placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                            value={codigoBoleto}
                          />
                        </label>
                        {mensagemBoleto && <div className="painel-nex__mensagem">{mensagemBoleto}</div>}
                        <button
                          className="botao botao--primario painel-nex-envio__botao"
                          disabled={processandoBoleto || !codigoBoletoPodeValidar(codigoBoleto)}
                          onClick={() => void validarCodigoBoleto()}
                          type="button"
                        >
                          {processandoBoleto ? "Validando..." : "Continuar"}
                          <ArrowRight size={18} />
                        </button>
                      </article>

                      <button className="painel-boleto__scanner-card" onClick={() => void abrirScannerBoleto()} type="button">
                        <span>
                          <ScanBarcode size={34} />
                          <i aria-hidden="true" />
                        </span>
                        <strong>Escanear código</strong>
                        <small>A câmera lê o código de barras e valida o boleto antes da revisão.</small>
                      </button>
                    </section>
                  )}

                  {scannerBoletoAberto && (
                    <section className="painel-boleto-scanner">
                      <article className={`painel-nex-scanner__camera painel-boleto-scanner__camera ${!cameraScannerBoletoAtiva ? "painel-nex-scanner__camera--aguardando" : ""}`}>
                        <video ref={videoScannerBoleto} playsInline muted />
                        <span aria-hidden="true" />
                        <strong>
                          {processandoScannerBoleto
                            ? "Validando código..."
                            : cameraScannerBoletoAtiva
                              ? "Procurando código de barras"
                              : "Abrindo câmera"}
                        </strong>
                      </article>
                      <div className="painel-boleto-scanner__acoes">
                        <button
                          className="botao botao--cliente"
                          onClick={() => {
                            streamScannerBoleto.current?.getTracks().forEach((faixa) => faixa.stop());
                            streamScannerBoleto.current = null;
                            setCameraScannerBoletoAtiva(false);
                            setScannerBoletoAutorizado(false);
                            setScannerBoletoDispensado(true);
                          }}
                          type="button"
                        >
                          Fechar scanner
                        </button>
                      </div>
                      {mensagemBoleto && <div className="painel-nex__mensagem">{mensagemBoleto}</div>}
                    </section>
                  )}
                </>
              )}

              {etapaPagamentoBoleto === "revisao" && boletoValidado && (
                <article className="painel-nex-envio__card painel-nex-envio__card--revisao painel-boleto__revisao">
                  <div className="painel-nex-envio__intro">
                    <i><ShieldCheck size={24} /></i>
                    <span>
                      <strong>Revise o pagamento</strong>
                      <small>Os dados abaixo foram calculados a partir do boleto validado.</small>
                    </span>
                  </div>
                  <div className="painel-nex-envio__saldo">
                    <span>
                      Saldo disponível
                      <button
                        aria-label={saldosVisiveis ? "Ocultar saldos" : "Mostrar saldos"}
                        aria-pressed={saldosVisiveis}
                        className="painel-dashboard__olho"
                        onClick={alternarSaldosVisiveis}
                        type="button"
                      >
                        {saldosVisiveis ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </span>
                    <strong>{saldoDisponivelExibido}</strong>
                    <small>Após o pagamento {saldosVisiveis ? saldoAposPagamentoBoleto : valorMascarado}</small>
                  </div>
                  <dl className="painel-nex-envio__resumo painel-boleto__resumo">
                    <div>
                      <dt>Valor</dt>
                      <dd>{boletoValidado.valor}</dd>
                    </div>
                    <div>
                      <dt>Banco emissor</dt>
                      <dd>{boletoValidado.bancoNome}</dd>
                    </div>
                    <div>
                      <dt>Código do banco</dt>
                      <dd>{boletoValidado.bancoCodigo}</dd>
                    </div>
                    <div>
                      <dt>Vencimento</dt>
                      <dd>{boletoValidado.vencimentoTexto}</dd>
                    </div>
                    <div>
                      <dt>Referência</dt>
                      <dd>{boletoValidado.referencia}</dd>
                    </div>
                    <div>
                      <dt>Linha digitável</dt>
                      <dd>{boletoValidado.linhaDigitavel}</dd>
                    </div>
                  </dl>
                  {mensagemBoleto && <div className="painel-nex__mensagem">{mensagemBoleto}</div>}
                  <div className="painel-nex-envio__acoes">
                    <button className="botao botao--cliente" disabled={processandoBoleto} onClick={() => setEtapaPagamentoBoleto("codigo")} type="button">
                      Voltar
                    </button>
                    <button className="botao botao--primario" disabled={processandoBoleto} onClick={() => void confirmarPagamentoBoleto()} type="button">
                      {processandoBoleto ? "Pagando..." : "Pagar boleto"}
                      <ReceiptText size={18} />
                    </button>
                  </div>
                </article>
              )}

              {etapaPagamentoBoleto === "sucesso" && (
                <article className="painel-nex-envio__card painel-nex-envio__sucesso" role="status">
                  <CheckCircle2 size={52} />
                  <span>Pagamento realizado</span>
                  <h2>{pagamentoBoleto?.valor ?? boletoValidado?.valor ?? "Boleto pago"}</h2>
                  <p>A tela da transação será aberta automaticamente.</p>
                  {pagamentoBoleto?.transacaoId && (
                    <a className="botao botao--primario" href={`/painel/transacao/${encodeURIComponent(pagamentoBoleto.transacaoId)}`}>
                      Abrir detalhes
                      <ArrowRight size={18} />
                    </a>
                  )}
                </article>
              )}
            </section>
          </div>
        )}

        {telaInicial === "recarga-celular" && (
          <div className="painel-recarga painel-nex painel-nex--envio">
            <header className="painel-nex__topo painel-pagamentos__topo">
              <a className="painel-financeiro__voltar" href="/painel/pagamentos">
                <ArrowLeft size={17} />
                Voltar
              </a>
              <div>
                <h1>Recarga de celular</h1>
                <p>Valide o número, escolha o valor e confirme a recarga.</p>
              </div>
            </header>

            <section className="painel-nex-envio painel-recarga__fluxo">
              <article className="painel-nex-envio__etapas painel-recarga__etapas" aria-label="Etapas da recarga de celular">
                {[
                  { id: "numero", rotulo: "Número" },
                  { id: "valor", rotulo: "Valor" },
                  { id: "revisao", rotulo: "Revisão" },
                  { id: "sucesso", rotulo: "Recarga" }
                ].map((etapa, indice) => {
                  const etapas = ["numero", "valor", "revisao", "sucesso"];
                  const ativa = etapaRecargaCelular === etapa.id;
                  const concluida = etapas.indexOf(etapaRecargaCelular) > indice;
                  return (
                    <span
                      className={ativa ? "painel-nex-envio__etapa--ativa" : concluida ? "painel-nex-envio__etapa--ok" : undefined}
                      key={etapa.id}
                    >
                      <i>{concluida ? <CheckCircle2 size={15} /> : indice + 1}</i>
                      {etapa.rotulo}
                    </span>
                  );
                })}
              </article>

              {etapaRecargaCelular === "numero" && (
                <article className="painel-nex-envio__card painel-recarga__card">
                  <div className="painel-nex-envio__intro">
                    <i><Smartphone size={24} /></i>
                    <span>
                      <strong>Qual celular receberá a recarga?</strong>
                      <small>Use um número brasileiro com DDD.</small>
                    </span>
                  </div>
                  <label className="painel-nex__campo painel-nex-envio__campo painel-recarga__telefone">
                    <span>Número do celular</span>
                    <input
                      autoComplete="off"
                      data-ncbank-sensivel="true"
                      inputMode="tel"
                      maxLength={20}
                      onBeforeInput={(evento) => {
                        const texto = (evento.nativeEvent as InputEvent).data;
                        if (texto && /[^\d\s()+-]/.test(texto)) evento.preventDefault();
                      }}
                      onChange={(evento) => {
                        setTelefoneRecargaCelular(formatarTelefoneRecargaCelular(evento.target.value));
                        setMensagemRecargaCelular("");
                        setRecargaCelularValidada(null);
                        setPagamentoRecargaCelular(null);
                      }}
                      placeholder="(11) 99999-9999"
                      value={telefoneRecargaCelular}
                    />
                  </label>
                  {mensagemRecargaCelular && <div className="painel-nex__mensagem">{mensagemRecargaCelular}</div>}
                  <button
                    className="botao botao--primario painel-nex-envio__botao"
                    disabled={processandoRecargaCelular || somenteDigitos(telefoneRecargaCelular).length < 11}
                    onClick={() => void validarNumeroRecargaCelular()}
                    type="button"
                  >
                    {processandoRecargaCelular ? "Validando..." : "Continuar"}
                    <ArrowRight size={18} />
                  </button>
                </article>
              )}

              {etapaRecargaCelular === "valor" && recargaCelularValidada && (
                <article className="painel-nex-envio__card painel-recarga__card">
                  <div className="painel-recarga__operadora">
                    <i><Smartphone size={24} /></i>
                    <span>
                      <small className="painel-recarga__rotulo-operadora">
                        Operadora
                        <span
                          aria-label="Números portados podem pertencer a outra prestadora."
                          className="painel-recarga__ajuda-operadora"
                          tabIndex={0}
                        >
                          <CircleHelp size={14} />
                          <em>Números portados podem pertencer a outra prestadora.</em>
                        </span>
                      </small>
                      <strong>{recargaCelularValidada.operadora}</strong>
                      <em>{recargaCelularValidada.telefone}</em>
                    </span>
                  </div>
                  <div className="painel-nex-envio__saldo">
                    <span>
                      Saldo disponível
                      <button
                        aria-label={saldosVisiveis ? "Ocultar saldos" : "Mostrar saldos"}
                        aria-pressed={saldosVisiveis}
                        className="painel-dashboard__olho"
                        onClick={alternarSaldosVisiveis}
                        type="button"
                      >
                        {saldosVisiveis ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                    </span>
                    <strong>{saldoDisponivelExibido}</strong>
                    <small>Após a recarga {saldosVisiveis ? saldoAposRecargaCelular : valorMascarado}</small>
                  </div>
                  <div className="painel-recarga__valores" aria-label="Valores sugeridos">
                    {recargaCelularValidada.valoresSugeridosCentavos.map((valor) => (
                      <button
                        aria-pressed={valorRecargaCelularCentavos === valor}
                        key={valor}
                        onClick={() => {
                          setValorRecargaCelular(formatarMoedaNex(valor));
                          setMensagemRecargaCelular("");
                        }}
                        type="button"
                      >
                        {formatarMoedaNex(valor)}
                      </button>
                    ))}
                  </div>
                  <label className="painel-nex__campo painel-nex-envio__valor painel-recarga__valor">
                    <span>Valor da recarga</span>
                    <input
                      inputMode="numeric"
                      onChange={(evento) => {
                        setValorRecargaCelular(formatarValorEntradaNex(evento.target.value));
                        setMensagemRecargaCelular("");
                      }}
                      value={valorRecargaCelular}
                    />
                  </label>
                  {mensagemRecargaCelular && <div className="painel-nex__mensagem">{mensagemRecargaCelular}</div>}
                  <div className="painel-nex-envio__acoes">
                    <button className="botao botao--cliente" onClick={() => setEtapaRecargaCelular("numero")} type="button">
                      Voltar
                    </button>
                    <button className="botao botao--primario" onClick={prepararRevisaoRecargaCelular} type="button">
                      Revisar
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </article>
              )}

              {etapaRecargaCelular === "revisao" && recargaCelularValidada && (
                <article className="painel-nex-envio__card painel-nex-envio__card--revisao painel-recarga__card">
                  <div className="painel-nex-envio__intro">
                    <i><ShieldCheck size={24} /></i>
                    <span>
                      <strong>Revise a recarga</strong>
                      <small>A confirmação final acontece em ambiente seguro NC Bank.</small>
                    </span>
                  </div>
                  <dl className="painel-nex-envio__resumo painel-recarga__resumo">
                    <div>
                      <dt>Valor</dt>
                      <dd>{formatarMoedaNex(valorRecargaCelularCentavos)}</dd>
                    </div>
                    <div>
                      <dt>Celular</dt>
                      <dd>{recargaCelularValidada.telefone}</dd>
                    </div>
                    <div>
                      <dt>Operadora</dt>
                      <dd>{recargaCelularValidada.operadora}</dd>
                    </div>
                    <div>
                      <dt>Extrato</dt>
                      <dd>Recarga de celular</dd>
                    </div>
                    <div>
                      <dt>Saldo após recarga</dt>
                      <dd>{saldosVisiveis ? saldoAposRecargaCelular : valorMascarado}</dd>
                    </div>
                    <div>
                      <dt>Referência</dt>
                      <dd>Gerada na liquidação</dd>
                    </div>
                  </dl>
                  {mensagemRecargaCelular && <div className="painel-nex__mensagem">{mensagemRecargaCelular}</div>}
                  <div className="painel-nex-envio__acoes">
                    <button className="botao botao--cliente" disabled={processandoRecargaCelular} onClick={() => setEtapaRecargaCelular("valor")} type="button">
                      Voltar
                    </button>
                    <button className="botao botao--primario" disabled={processandoRecargaCelular} onClick={() => void confirmarRecargaCelular()} type="button">
                      {processandoRecargaCelular ? "Recarregando..." : "Confirmar recarga"}
                      <Smartphone size={18} />
                    </button>
                  </div>
                </article>
              )}

              {etapaRecargaCelular === "sucesso" && (
                <article className="painel-nex-envio__card painel-nex-envio__sucesso" role="status">
                  <CheckCircle2 size={52} />
                  <span>Recarga realizada</span>
                  <h2>{pagamentoRecargaCelular?.valor ?? formatarMoedaNex(valorRecargaCelularCentavos)}</h2>
                  <p>{pagamentoRecargaCelular?.operadora ?? recargaCelularValidada?.operadora ?? "Operadora"} · {pagamentoRecargaCelular?.telefone ?? recargaCelularValidada?.telefone ?? "Celular validado"}</p>
                  {pagamentoRecargaCelular?.transacaoId && (
                    <a className="botao botao--primario" href={`/painel/transacao/${encodeURIComponent(pagamentoRecargaCelular.transacaoId)}`}>
                      Abrir detalhes
                      <ArrowRight size={18} />
                    </a>
                  )}
                </article>
              )}
            </section>
          </div>
        )}

        {telaInicial === "doacoes" && (
          <div className="painel-doacoes">
            <header className="painel-nex__topo painel-doacoes__topo">
              <a className="painel-financeiro__voltar" href="/painel/pagamentos">
                <ArrowLeft size={17} />
                Voltar
              </a>
              <div>
                <h1>Doações</h1>
                <p>Escolha uma instituição verificada e doe qualquer quantia.</p>
              </div>
            </header>

            <article className="painel-doacoes__hero">
              <div>
                <span>Doação social</span>
                <h2>Contribua com projetos acompanhados pelo NC Bank.</h2>
                <p>
                  O valor é debitado da sua conta, registrado no extrato como doação e acompanhado por comprovante
                  próprio da transação.
                </p>
              </div>
              <picture aria-hidden="true">
                <img src="/marca/doacao-social-ncbank.png" alt="" />
              </picture>
            </article>

            <section className="painel-doacoes__lista" aria-label="Instituições disponíveis para doação">
              <a className="painel-doacoes__instituto" href="/painel/pagamentos/doacoes/instituto-murzo">
                <img src="/marca/instituto-murzo-logo.png" alt="" />
                <span>
                  <strong>{institutoMurzoPainel.nome}</strong>
                  <small>Proteção, acolhimento e cuidado contínuo para animais em situação de abandono.</small>
                </span>
                <em>Doe qualquer quantia</em>
                <ChevronRight size={18} />
              </a>
            </section>
          </div>
        )}

        {telaInicial === "doacao-instituto" && (
          <div className="painel-doacoes painel-doacoes--detalhe">
            <header className="painel-nex__topo painel-doacoes__topo">
              <a className="painel-financeiro__voltar" href="/painel/pagamentos/doacoes">
                <ArrowLeft size={17} />
                Voltar
              </a>
              <div>
                <h1>{institutoMurzoPainel.nome}</h1>
              </div>
            </header>

            <section className="painel-doacoes-detalhe painel-doacoes-detalhe--sem-dados">
              <article className="painel-doacoes-detalhe__principal">
                <div className="painel-doacoes-detalhe__banner">
                  <img src="/marca/instituto-murzo-detalhe.png" alt={institutoMurzoPainel.nome} />
                </div>
                <div className="painel-doacoes-detalhe__texto">
                  <span>Instituição verificada</span>
                  <h2>Cuidado responsável para animais resgatados.</h2>
                  <p>
                    O Instituto Murzo atua no acolhimento, tratamento veterinário e encaminhamento para adoção
                    responsável. As doações ajudam na compra de ração, medicamentos, vacinas e manutenção dos espaços
                    de recuperação.
                  </p>
                </div>
                <div className="painel-doacoes-detalhe__impacto" aria-label="Áreas de uso da doação">
                  <span>Alimentação</span>
                  <span>Tratamento veterinário</span>
                  <span>Acolhimento</span>
                  <span>Adoção responsável</span>
                </div>
                <button className="botao botao--primario painel-doacoes-detalhe__botao" onClick={abrirModalDoacaoMurzo} type="button">
                  Fazer doação
                  <HeartHandshake size={18} />
                </button>
              </article>
            </section>
          </div>
        )}

        {telaInicial === "nex" && (
          <div className="painel-nex">
            <header className="painel-nex__topo">
              <div>
                <h1>Nex</h1>
                <p>Envie, receba e organize suas transferências em uma área dedicada.</p>
              </div>
            </header>

            <article className="painel-nex__hero">
              <picture aria-hidden="true">
                <source srcSet="/marca/nex-banner-netcatbank.avif" type="image/avif" />
                <source srcSet="/marca/nex-banner-netcatbank.webp" type="image/webp" />
                <img src="/marca/nex-banner-netcatbank.png" alt="" />
              </picture>
              <div>
                <span>Nex sem limite</span>
                <h2>Transferências rápidas com uma chave protegida.</h2>
                <p>Uma experiência direta para enviar, receber e voltar aos contatos que você já movimentou.</p>
                <a className="botao botao--primario painel-nex__hero-acao" href="/painel/nex/chave">
                  <KeyRound size={18} />
                  <span>{carregandoChavesNex && !chavesNexCarregadas ? "Carregando chaves..." : chavesNex.length > 0 ? "Gerenciar chaves" : "Criar minha chave"}</span>
                </a>
              </div>
            </article>

            <section className="painel-nex__resumo">
              <article className="painel-nex__chave">
                <div className="painel-nex__cabecalho">
                  <span>Chave Nex</span>
                  <KeyRound size={19} />
                </div>
                {carregandoChavesNex && !chavesNexCarregadas ? (
                  <div className="painel-nex__vazio">
                    <KeyRound size={28} />
                    <strong>Carregando chaves</strong>
                    <span>Consultando suas chaves Nex com segurança.</span>
                  </div>
                ) : chaveNex ? (
                  <>
                    <strong>{valorExibicaoChaveNex(chaveNex)}</strong>
                    <small>
                      {rotuloTipoChaveContaNex(chaveNex.tipo)} · {chavesNex.length} chave(s)
                      {chaveNex.verificacaoPendente ? " · pendente de verificação" : ""}
                    </small>
                    <div>
                      <button onClick={() => copiarChaveNex(valorExibicaoChaveNex(chaveNex))} type="button">
                        <Copy size={17} />
                        Copiar
                      </button>
                      <a href="/painel/nex/chave">
                        <KeyRound size={17} />
                        Gerenciar
                      </a>
                    </div>
                  </>
                ) : mensagemNex === "Não foi possível carregar suas chaves Nex agora." ? (
                  <>
                    <strong>Chaves indisponíveis agora</strong>
                    <small>Não foi possível consultar suas chaves Nex neste instante.</small>
                    <button className="painel-nex__link-destaque" onClick={() => void carregarChavesNex()} type="button">
                      Tentar novamente
                      <ArrowRight size={17} />
                    </button>
                  </>
                ) : (
                  <>
                    <strong>Nenhuma chave criada</strong>
                    <small>Escolha e configure sua primeira chave em uma etapa dedicada.</small>
                    <a className="painel-nex__link-destaque" href="/painel/nex/chave">
                      Criar chave Nex
                      <ArrowRight size={17} />
                    </a>
                  </>
                )}
              </article>

              <article className="painel-nex__acoes">
                <div className="painel-nex__cabecalho">
                  <span>Ações rápidas</span>
                  <QrCode size={19} />
                </div>
                <div>
	                  {[
	                    { titulo: "Enviar", icone: <SendHorizontal size={22} />, url: "/painel/nex/enviar" },
	                    { titulo: "Receber", icone: <QrCode size={22} />, url: "/painel/nex/receber" },
	                    { titulo: "Escanear", icone: <QrCode size={22} />, url: "/painel/nex/escanear" },
	                    { titulo: "Agendar", icone: <Repeat2 size={22} />, url: "/painel/nex/agendar" }
	                  ].map((acao) => (
	                    <button
	                      key={acao.titulo}
	                      onClick={() => {
	                        if (acao.url) window.location.assign(acao.url);
	                      }}
	                      type="button"
	                    >
	                      {acao.icone}
	                      <span>{acao.titulo}</span>
	                    </button>
                  ))}
                </div>
              </article>
            </section>

            <section className="painel-nex__grid">
              <article className="painel-nex__card painel-nex__recorrentes">
	                <div className="painel-nex__cabecalho">
	                  <span>Envie novamente</span>
	                  <a href="/painel/nex/envie-novamente">Ver todos</a>
	                </div>
	                {contatosNexResumo.length > 0 ? (
	                  <div className="painel-nex__contatos">
	                    {contatosNexResumo.map((contato) => (
	                      <button key={`${contato.nome}-${contato.ultimaEm}`} onClick={() => iniciarEnvioContatoNex(contato)} type="button">
	                        <i>{contato.nome.slice(0, 1).toLocaleUpperCase("pt-BR")}</i>
	                        <span>
	                          <strong>{contato.nome}</strong>
	                          <small>{contato.valor} · {formatarGrupoDia(new Date(contato.ultimaEm))}</small>
	                        </span>
	                        <ArrowRight size={17} />
	                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="painel-nex__vazio">
                    <IconeNex tamanho={28} />
                    <strong>Nenhum contato Nex ainda</strong>
                    <span>Depois da primeira transferência, seus contatos recentes aparecem aqui.</span>
                  </div>
                )}
              </article>

              <article className="painel-nex__card painel-nex__atividades">
	                <div className="painel-nex__cabecalho">
	                  <span>Atividade recente</span>
	                  <a href="/painel/nex/atividades">Ver tudo</a>
	                </div>
                {transacoesNex.length > 0 ? renderMovimentos(transacoesNex.slice(0, 3)) : (
                  <div className="painel-nex__vazio">
                    <ArrowDownToLine size={28} />
                    <strong>Sem atividades Nex</strong>
                    <span>Envios e recebimentos pelo Nex serão listados aqui.</span>
                  </div>
                )}
              </article>
            </section>
          </div>
	        )}

	        {telaInicial === "nex-receber" && (
	          <div className="painel-nex painel-nex--receber">
	            <header className="painel-nex__topo">
	              <a className="painel-financeiro__voltar" href="/painel/nex">
	                <ArrowLeft size={17} />
	                Voltar
	              </a>
	              <div>
	                <h1>Receber Nex</h1>
	                <p>Mostre um QR Code da sua chave ou crie um QR com valor definido.</p>
	              </div>
	            </header>

	            {qrPersonalizadoNex ? (
	              <section className="painel-nex-receber painel-nex-receber--dedicado">
	                <article className="painel-nex-receber__qr painel-nex-receber__qr--grande">
	                  <span>QR Code criado</span>
	                  <div dangerouslySetInnerHTML={{ __html: qrPersonalizadoNex.qrSvg }} />
	                  <strong>{qrPersonalizadoNex.valor ?? "Valor livre"}</strong>
	                  <small>{rotuloChaveRecebimentoContaNex(qrPersonalizadoNex.chave)}</small>
	                </article>
	                <div className="painel-nex-receber__acoes">
	                  <button className="botao botao--cliente" onClick={() => setQrPersonalizadoNex(null)} type="button">
	                    Criar outro
	                  </button>
	                  <button className="botao botao--primario" onClick={() => copiarChaveNex(qrPersonalizadoNex.conteudo)} type="button">
	                    Copiar conteúdo
	                    <Copy size={18} />
	                  </button>
	                </div>
	              </section>
	            ) : (
	              <section className="painel-nex-receber">
	                {chavesAtivasRecebimentoNex.length === 0 ? (
	                  <div className="painel-nex__vazio">
	                    <KeyRound size={32} />
	                    <strong>Nenhuma chave ativa</strong>
	                    <span>Crie uma chave Nex ativa para receber por QR Code.</span>
	                    <a className="botao botao--primario" href="/painel/nex/chave">
	                      Gerenciar chaves
	                      <ArrowRight size={18} />
	                    </a>
	                  </div>
	                ) : (
	                  <>
	                    <article className={classeQrRecebimentoNex}>
	                      {totalChavesRecebimentoNex > 1 && (
	                        podeVoltarChaveRecebimentoNex ? (
	                          <button
	                            aria-label="Chave anterior"
	                            onClick={() => setIndiceChaveRecebimentoNex(indiceChaveRecebimentoSeguroNex - 1)}
	                            type="button"
	                          >
	                            <ArrowLeft size={20} />
	                          </button>
	                        ) : (
	                          <span className="painel-nex-receber__qr-navegacao-espaco" aria-hidden="true" />
	                        )
	                      )}
	                      <div className="painel-nex-receber__qr-centro">
	                        {qrRecebimentoAtual ? (
	                          <div dangerouslySetInnerHTML={{ __html: qrRecebimentoAtual.qrSvg }} />
	                        ) : (
	                          <div className="painel-nex-receber__qr-carregando">
	                            <QrCode size={42} />
	                            <span>{processandoRecebimentoNex ? "Criando QR..." : "Preparando QR"}</span>
	                          </div>
	                        )}
	                        {chaveRecebimentoAtual && (
	                          <>
	                            <strong>{rotuloTipoChaveContaNex(chaveRecebimentoAtual.tipo)}</strong>
	                            <small>{valorExibicaoChaveNex(chaveRecebimentoAtual)}</small>
	                          </>
	                        )}
	                      </div>
	                      {totalChavesRecebimentoNex > 1 && (
	                        podeAvancarChaveRecebimentoNex ? (
	                          <button
	                            aria-label="Próxima chave"
	                            onClick={() => setIndiceChaveRecebimentoNex(indiceChaveRecebimentoSeguroNex + 1)}
	                            type="button"
	                          >
	                            <ArrowRight size={20} />
	                          </button>
	                        ) : (
	                          <span className="painel-nex-receber__qr-navegacao-espaco" aria-hidden="true" />
	                        )
	                      )}
	                    </article>
	                    <div className="painel-nex-receber__acoes">
	                      <button className="botao botao--cliente" onClick={() => qrRecebimentoAtual && copiarChaveNex(qrRecebimentoAtual.conteudo)} type="button">
	                        Copiar QR
	                        <Copy size={18} />
	                      </button>
	                      <button className="botao botao--primario" onClick={() => setModalValorRecebimentoNexAberto(true)} type="button">
	                        Personalizar valor
	                        <Plus size={18} />
	                      </button>
	                    </div>
	                    {mensagemRecebimentoNex && <div className="painel-nex__mensagem">{mensagemRecebimentoNex}</div>}
	                  </>
	                )}
	              </section>
	            )}
	          </div>
	        )}

	        {telaInicial === "nex-escanear" && (
	          <div className="painel-nex painel-nex--scanner">
	            <header className="painel-nex__topo">
	              <a className="painel-financeiro__voltar" href="/painel/nex">
	                <ArrowLeft size={17} />
	                Voltar
	              </a>
	              <div>
	                <h1>Escanear Nex</h1>
	                <p>Aponte a câmera para um QR Code Nex para preencher o envio.</p>
	              </div>
	            </header>

	            <section className="painel-nex-scanner">
	              <article className={`painel-nex-scanner__camera ${!scannerNexAutorizado || scannerNexDispensado ? "painel-nex-scanner__camera--aguardando" : ""}`}>
	                {scannerNexAutorizado && !scannerNexDispensado ? (
	                  <>
	                    <video ref={videoScannerNex} playsInline muted />
	                    <span aria-hidden="true" />
	                  </>
	                ) : (
	                  <div className="painel-nex-scanner__espera" aria-hidden="true">
	                    <QrCode size={46} />
	                    <i />
	                  </div>
	                )}
	                <strong>
	                  {processandoScannerNex
	                    ? "Lendo QR Code..."
	                    : cameraScannerNexAtiva
	                      ? "Procurando QR Code"
	                      : scannerNexDispensado
	                        ? "Câmera desativada"
	                        : "Aguardando permissão"}
	                </strong>
	              </article>
	              <article className="painel-nex-scanner__manual">
	                <div className="painel-nex-envio__intro">
	                  <i><QrCode size={24} /></i>
	                  <span>
	                    <strong>Colar conteúdo do QR</strong>
	                    <small>Use esta opção se a câmera não estiver disponível.</small>
	                  </span>
	                </div>
	                <label className="painel-nex__campo">
	                  <span>Conteúdo do QR Code</span>
	                  <textarea
	                    maxLength={2500}
	                    onChange={(evento) => {
	                      setConteudoQrManualNex(evento.target.value.slice(0, 2500));
	                      setMensagemScannerNex("");
	                    }}
	                    placeholder="Cole aqui o conteúdo do QR Code Nex"
	                    value={conteudoQrManualNex}
	                  />
	                </label>
	                {mensagemScannerNex && <div className="painel-nex__mensagem">{mensagemScannerNex}</div>}
	                <button className="botao botao--primario" disabled={processandoScannerNex || !conteudoQrManualNex.trim()} onClick={() => void processarConteudoQrNex(conteudoQrManualNex)} type="button">
	                  {processandoScannerNex ? "Validando..." : "Continuar"}
	                  <ArrowRight size={18} />
	                </button>
	              </article>
	            </section>
	          </div>
	        )}
	
	        {telaInicial === "nex-enviar" && (
	          <div className="painel-nex painel-nex--envio">
	            <header className="painel-nex__topo">
	              <a className="painel-financeiro__voltar" href="/painel/nex">
	                <ArrowLeft size={17} />
	                Voltar
	              </a>
	              <div>
	                <h1>Enviar Nex</h1>
	                <p>Informe a chave, confira o destinatário e confirme a transferência.</p>
	              </div>
	            </header>

	            <section className="painel-nex-envio">
	              <article className="painel-nex-envio__etapas" aria-label="Etapas do envio Nex">
	                {[
	                  { id: "chave", rotulo: "Chave" },
	                  { id: "valor", rotulo: "Valor" },
	                  { id: "revisao", rotulo: "Revisão" },
	                  { id: "sucesso", rotulo: "Envio" }
	                ].map((etapa, indice) => {
	                  const etapas = ["chave", "valor", "revisao", "sucesso"];
	                  const ativa = etapaEnvioNex === etapa.id;
	                  const concluida = etapas.indexOf(etapaEnvioNex) > indice;
	                  return (
	                    <span
	                      className={ativa ? "painel-nex-envio__etapa--ativa" : concluida ? "painel-nex-envio__etapa--ok" : undefined}
	                      key={etapa.id}
	                    >
	                      <i>{concluida ? <CheckCircle2 size={15} /> : indice + 1}</i>
	                      {etapa.rotulo}
	                    </span>
	                  );
	                })}
	              </article>

	              {etapaEnvioNex === "chave" && (
	                <article className="painel-nex-envio__card painel-nex-envio__card--chave">
	                  <div className="painel-nex-envio__intro">
	                    <i><KeyRound size={24} /></i>
	                    <span>
	                      <strong>Para quem você quer enviar?</strong>
	                      <small>Use chave aleatória, e-mail, telefone, CPF ou CNPJ.</small>
	                    </span>
	                  </div>
	                  {!chavesNex.some((chave) => chave.estado === "ativa" || (!chave.estado && !chave.verificacaoPendente)) && (
	                    <div className="painel-nex-envio__aviso-chave">
	                      <ShieldCheck size={18} />
	                      <span>Antes do envio, o NC Bank criará uma chave aleatória segura para esta conta.</span>
	                    </div>
	                  )}
	                  <label className="painel-nex__campo painel-nex-envio__campo">
	                    <span>Chave Nex</span>
	                    <input
	                      autoCapitalize="off"
	                      autoComplete="off"
	                      autoCorrect="off"
	                      maxLength={160}
	                      onChange={(evento) => {
	                        autoResolveuChaveNex.current = true;
	                        setChaveDestinoNex(evento.target.value.slice(0, 160));
	                        setMensagemEnvioNex("");
	                        setDestinatarioNex(null);
	                        setTransferenciaNex(null);
	                      }}
	                      placeholder="ncb-nex..., e-mail, telefone, CPF ou CNPJ"
	                      spellCheck={false}
	                      value={chaveDestinoNex}
	                    />
	                  </label>
	                  {mensagemEnvioNex && <div className="painel-nex__mensagem">{mensagemEnvioNex}</div>}
	                  <button className="botao botao--primario painel-nex-envio__botao" disabled={processandoEnvioNex} onClick={() => void resolverDestinoNex()} type="button">
	                    {processandoEnvioNex ? "Pesquisando..." : "Pesquisar chave"}
	                    <ArrowRight size={18} />
	                  </button>
	                </article>
	              )}

	              {etapaEnvioNex === "valor" && destinatarioNex && (
	                <article className="painel-nex-envio__card">
	                  <div className="painel-nex-envio__saldo">
	                    <span>
	                      Saldo disponível
	                      <button
	                        aria-label={saldosVisiveis ? "Ocultar saldos" : "Mostrar saldos"}
	                        aria-pressed={saldosVisiveis}
	                        className="painel-dashboard__olho"
	                        onClick={alternarSaldosVisiveis}
	                        type="button"
	                      >
	                        {saldosVisiveis ? <Eye size={16} /> : <EyeOff size={16} />}
	                      </button>
	                    </span>
	                    <strong>{saldoDisponivelExibido}</strong>
	                  </div>
	                  <div className="painel-nex-envio__destino">
	                    <i>{destinatarioNex.nome.slice(0, 1).toLocaleUpperCase("pt-BR")}</i>
	                    <span>
	                      <small>Destinatário</small>
	                      <strong>{destinatarioNex.nome}</strong>
	                      <em>{destinatarioNex.instituicao} · {destinatarioNex.chave}</em>
	                    </span>
	                  </div>
	                  <label className="painel-nex__campo painel-nex-envio__valor">
	                    <span>Valor</span>
	                    <input
	                      inputMode="numeric"
	                      onChange={(evento) => {
	                        setValorEnvioNex(formatarValorEntradaNex(evento.target.value));
	                        setMensagemEnvioNex("");
	                      }}
	                      value={valorEnvioNex}
	                    />
	                  </label>
	                  {mensagemEnvioNex && <div className="painel-nex__mensagem">{mensagemEnvioNex}</div>}
	                  <div className="painel-nex-envio__acoes">
	                    <button className="botao botao--cliente" onClick={() => setEtapaEnvioNex("chave")} type="button">
	                      Voltar
	                    </button>
	                    <button className="botao botao--primario" disabled={processandoEnvioNex} onClick={() => void prepararEnvioNex()} type="button">
	                      {processandoEnvioNex ? "Preparando..." : "Continuar"}
	                      <ArrowRight size={18} />
	                    </button>
	                  </div>
	                </article>
	              )}

	              {etapaEnvioNex === "revisao" && transferenciaNex && destinatarioNex && (
	                <article className="painel-nex-envio__card painel-nex-envio__card--revisao">
	                  <div className="painel-nex-envio__intro">
	                    <i><ShieldCheck size={24} /></i>
	                    <span>
	                      <strong>Revise antes de enviar</strong>
	                      <small>A transferência será liquidada pelo NC Bank.</small>
	                    </span>
	                  </div>
	                  <dl className="painel-nex-envio__resumo">
	                    <div>
	                      <dt>Valor</dt>
	                      <dd>{transferenciaNex.valor ?? formatarMoedaNex(transferenciaNex.valorCentavos)}</dd>
	                    </div>
	                    <div>
	                      <dt>Recebedor</dt>
	                      <dd>{destinatarioNex.nome}</dd>
	                    </div>
	                    <div>
	                      <dt>Documento</dt>
	                      <dd>{destinatarioNex.documento ?? "Protegido"}</dd>
	                    </div>
	                    <div>
	                      <dt>Chave</dt>
	                      <dd>{destinatarioNex.chave}</dd>
	                    </div>
	                    <div>
	                      <dt>Instituição</dt>
	                      <dd>{destinatarioNex.instituicao}</dd>
	                    </div>
	                    <div>
	                      <dt>Referência</dt>
	                      <dd>{transferenciaNex.referencia ?? "Nex"}</dd>
	                    </div>
	                  </dl>
	                  {mensagemEnvioNex && <div className="painel-nex__mensagem">{mensagemEnvioNex}</div>}
	                  <div className="painel-nex-envio__acoes">
	                    <button className="botao botao--cliente" onClick={() => setEtapaEnvioNex("valor")} type="button">
	                      Voltar
	                    </button>
	                    <button className="botao botao--primario" disabled={processandoEnvioNex} onClick={() => void confirmarEnvioNex()} type="button">
	                      {processandoEnvioNex ? "Enviando..." : "Enviar agora"}
	                      <SendHorizontal size={18} />
	                    </button>
	                  </div>
	                </article>
	              )}

	              {etapaEnvioNex === "sucesso" && transferenciaNex && (
	                <article className="painel-nex-envio__card painel-nex-envio__sucesso" role="status">
	                  <CheckCircle2 size={52} />
	                  <span>Transferência enviada</span>
	                  <h2>{transferenciaNex.valor ?? formatarMoedaNex(transferenciaNex.valorCentavos)}</h2>
	                  <p>A tela da transação será aberta automaticamente.</p>
	                  {transferenciaNex.transacaoId && (
	                    <a className="botao botao--primario" href={`/painel/transacao/${encodeURIComponent(transferenciaNex.transacaoId)}`}>
	                      Abrir detalhes
	                      <ArrowRight size={18} />
	                    </a>
	                  )}
	                </article>
	              )}
	            </section>
	          </div>
	        )}

	        {telaInicial === "nex-agendar" && (
	          <div className="painel-nex painel-nex--envio painel-nex--agendar">
	            <header className="painel-nex__topo">
	              <a className="painel-financeiro__voltar" href="/painel/nex">
	                <ArrowLeft size={17} />
	                Voltar
	              </a>
	              <div>
	                <h1>Agendar Nex</h1>
	                <p>Escolha a chave, defina o horário e revise antes de salvar o agendamento.</p>
	              </div>
	            </header>

	            <section className="painel-nex-envio">
	              <article className="painel-nex-envio__etapas" aria-label="Etapas do agendamento Nex">
	                {[
	                  { id: "chave", rotulo: "Chave" },
	                  { id: "data", rotulo: "Data" },
	                  { id: "valor", rotulo: "Valor" },
	                  { id: "revisao", rotulo: "Revisão" },
	                  { id: "sucesso", rotulo: "Agendar" }
	                ].map((etapa, indice) => {
	                  const etapas = ["chave", "data", "valor", "revisao", "sucesso"];
	                  const ativa = etapaAgendamentoNex === etapa.id;
	                  const concluida = etapas.indexOf(etapaAgendamentoNex) > indice;
	                  return (
	                    <span
	                      className={ativa ? "painel-nex-envio__etapa--ativa" : concluida ? "painel-nex-envio__etapa--ok" : undefined}
	                      key={etapa.id}
	                    >
	                      <i>{concluida ? <CheckCircle2 size={15} /> : indice + 1}</i>
	                      {etapa.rotulo}
	                    </span>
	                  );
	                })}
	              </article>

	              {etapaAgendamentoNex === "chave" && (
	                <article className="painel-nex-envio__card painel-nex-envio__card--chave">
	                  <div className="painel-nex-envio__intro">
	                    <i><KeyRound size={24} /></i>
	                    <span>
	                      <strong>Para quem será o agendamento?</strong>
	                      <small>Use chave aleatória, e-mail, telefone, CPF ou CNPJ.</small>
	                    </span>
	                  </div>
	                  {!chavesNex.some((chave) => chave.estado === "ativa" || (!chave.estado && !chave.verificacaoPendente)) && (
	                    <div className="painel-nex-envio__aviso-chave">
	                      <ShieldCheck size={18} />
	                      <span>Antes de agendar, o NC Bank criará uma chave aleatória segura para esta conta.</span>
	                    </div>
	                  )}
	                  <label className="painel-nex__campo painel-nex-envio__campo">
	                    <span>Chave Nex</span>
	                    <input
	                      autoCapitalize="off"
	                      autoComplete="off"
	                      autoCorrect="off"
	                      maxLength={160}
	                      onChange={(evento) => {
	                        setChaveAgendamentoNex(evento.target.value.slice(0, 160));
	                        setMensagemAgendamentoNex("");
	                        setDestinatarioAgendamentoNex(null);
	                        setAgendamentoNex(null);
	                      }}
	                      placeholder="ncb-nex..., e-mail, telefone, CPF ou CNPJ"
	                      spellCheck={false}
	                      value={chaveAgendamentoNex}
	                    />
	                  </label>
	                  {mensagemAgendamentoNex && <div className="painel-nex__mensagem">{mensagemAgendamentoNex}</div>}
	                  <button className="botao botao--primario painel-nex-envio__botao" disabled={processandoAgendamentoNex} onClick={() => void resolverDestinoAgendamentoNex()} type="button">
	                    {processandoAgendamentoNex ? "Pesquisando..." : "Pesquisar chave"}
	                    <ArrowRight size={18} />
	                  </button>
	                </article>
	              )}

	              {etapaAgendamentoNex === "data" && destinatarioAgendamentoNex && (
	                <article className="painel-nex-envio__card painel-nex-agenda__card">
	                  <div className="painel-nex-envio__destino">
	                    <i>{destinatarioAgendamentoNex.nome.slice(0, 1).toLocaleUpperCase("pt-BR")}</i>
	                    <span>
	                      <small>Destinatário</small>
	                      <strong>{destinatarioAgendamentoNex.nome}</strong>
	                      <em>{destinatarioAgendamentoNex.instituicao} · {destinatarioAgendamentoNex.chave}</em>
	                    </span>
	                  </div>
	                  <div className="painel-nex-agenda__data">
	                    <button
	                      aria-expanded={calendarioAgendamentoAberto}
	                      className="painel-nex-agenda__abrir-calendario"
	                      onClick={() => setCalendarioAgendamentoAberto((valor) => !valor)}
	                      type="button"
	                    >
	                      <span>Data</span>
	                      <strong>{rotuloDataAgendamentoNex}</strong>
	                      <ChevronRight size={18} />
	                    </button>
	                    <button
	                      className="painel-nex-agenda__hoje"
	                      onClick={() => {
	                        const hoje = dataIsoLocalNex(new Date());
	                        const horario = ajustarHorarioAgendamentoNex(hoje, horaAgendamentoNex, minutoAgendamentoNex);
	                        setDataAgendamentoNex(hoje);
	                        setHoraAgendamentoNex(horario.hora);
	                        setMinutoAgendamentoNex(horario.minuto);
	                        setMesCalendarioAgendamentoNex(mesIsoNex(new Date()));
	                        setCalendarioAgendamentoAberto(true);
	                        setMensagemAgendamentoNex("");
	                      }}
	                      type="button"
	                    >
	                      Hoje
	                    </button>
	                    {calendarioAgendamentoAberto && (
	                      <div className="painel-nex-agenda__calendario" aria-label="Escolher data">
	                        <div className="painel-nex-agenda__calendario-topo">
	                          <button
	                            aria-label="Mês anterior"
	                            disabled={!podeVoltarMesCalendarioAgendamentoNex}
	                            onClick={() => navegarMesCalendarioAgendamentoNex(-1)}
	                            type="button"
	                          >
	                            <ArrowLeft size={17} />
	                          </button>
	                          <strong>{rotuloMesCalendarioAgendamentoNex}</strong>
	                          <button aria-label="Próximo mês" onClick={() => navegarMesCalendarioAgendamentoNex(1)} type="button">
	                            <ArrowRight size={17} />
	                          </button>
	                        </div>
	                        <div className="painel-nex-agenda__semana" aria-hidden="true">
	                          {["D", "S", "T", "Q", "Q", "S", "S"].map((dia, indice) => (
	                            <span key={`${dia}-${indice}`}>{dia}</span>
	                          ))}
	                        </div>
	                        <div className="painel-nex-agenda__dias">
	                          {diasCalendarioAgendamentoNex.map((data) => (
	                            <button
	                              aria-pressed={dataAgendamentoNex === data.valor}
	                              className={data.foraDoMes ? "painel-nex-agenda__dia--fora" : undefined}
	                              disabled={data.passado}
	                              key={data.valor}
	                              onClick={() => selecionarDataAgendamentoNex(data.valor)}
	                              type="button"
	                            >
	                              {data.rotulo}
	                            </button>
	                          ))}
	                        </div>
	                      </div>
	                    )}
	                  </div>
	                  <div className="painel-nex-agenda__hora">
	                    <label className="painel-nex__campo">
	                      <span>Hora</span>
	                      <select onChange={(evento) => selecionarHoraAgendamentoNex(evento.target.value)} value={horaAgendamentoNex}>
	                        {opcoesHorasVisiveisNex.map((hora) => (
	                          <option key={hora} value={hora}>
	                            {hora}
	                          </option>
	                        ))}
	                      </select>
	                    </label>
	                    <label className="painel-nex__campo">
	                      <span>Minuto</span>
	                      <select onChange={(evento) => selecionarMinutoAgendamentoNex(evento.target.value)} value={minutoAgendamentoNex}>
	                        {opcoesMinutosVisiveisNex.map((minuto) => (
	                          <option key={minuto} value={minuto}>
	                            {minuto}
	                          </option>
	                        ))}
	                      </select>
	                    </label>
	                  </div>
	                  <div className="painel-nex-agenda__resumo-tempo">
	                    <Repeat2 size={18} />
	                    <span>{dataHoraAgendamentoTexto}</span>
	                  </div>
	                  {mensagemAgendamentoNex && <div className="painel-nex__mensagem">{mensagemAgendamentoNex}</div>}
	                  <div className="painel-nex-envio__acoes">
	                    <button className="botao botao--cliente" onClick={() => setEtapaAgendamentoNex("chave")} type="button">
	                      Voltar
	                    </button>
	                    <button className="botao botao--primario" onClick={continuarDataAgendamentoNex} type="button">
	                      Continuar
	                      <ArrowRight size={18} />
	                    </button>
	                  </div>
	                </article>
	              )}

	              {etapaAgendamentoNex === "valor" && destinatarioAgendamentoNex && (
	                <article className="painel-nex-envio__card">
	                  <div className="painel-nex-envio__saldo">
	                    <span>
	                      Saldo disponível hoje
	                      <button
	                        aria-label={saldosVisiveis ? "Ocultar saldos" : "Mostrar saldos"}
	                        aria-pressed={saldosVisiveis}
	                        className="painel-dashboard__olho"
	                        onClick={alternarSaldosVisiveis}
	                        type="button"
	                      >
	                        {saldosVisiveis ? <Eye size={16} /> : <EyeOff size={16} />}
	                      </button>
	                    </span>
	                    <strong>{saldoDisponivelExibido}</strong>
	                    <small>A validação do saldo acontece novamente na data agendada.</small>
	                  </div>
	                  <label className="painel-nex__campo painel-nex-envio__valor">
	                    <span>Valor</span>
	                    <input
	                      inputMode="numeric"
	                      onChange={(evento) => {
	                        setValorAgendamentoNex(formatarValorEntradaNex(evento.target.value));
	                        setMensagemAgendamentoNex("");
	                      }}
	                      value={valorAgendamentoNex}
	                    />
	                  </label>
	                  {mensagemAgendamentoNex && <div className="painel-nex__mensagem">{mensagemAgendamentoNex}</div>}
	                  <div className="painel-nex-envio__acoes">
	                    <button className="botao botao--cliente" onClick={() => setEtapaAgendamentoNex("data")} type="button">
	                      Voltar
	                    </button>
	                    <button className="botao botao--primario" onClick={prepararRevisaoAgendamentoNex} type="button">
	                      Revisar
	                      <ArrowRight size={18} />
	                    </button>
	                  </div>
	                </article>
	              )}

	              {etapaAgendamentoNex === "revisao" && destinatarioAgendamentoNex && (
	                <article className="painel-nex-envio__card painel-nex-envio__card--revisao">
	                  <div className="painel-nex-envio__intro">
	                    <i><ShieldCheck size={24} /></i>
	                    <span>
	                      <strong>Revise o agendamento</strong>
	                      <small>O dinheiro só será debitado na data marcada, se houver saldo.</small>
	                    </span>
	                  </div>
	                  <dl className="painel-nex-envio__resumo">
	                    <div>
	                      <dt>Valor</dt>
	                      <dd>{formatarMoedaNex(centavosValorEntradaNex(valorAgendamentoNex))}</dd>
	                    </div>
	                    <div>
	                      <dt>Data</dt>
	                      <dd>{dataHoraAgendamentoTexto}</dd>
	                    </div>
	                    <div>
	                      <dt>Recebedor</dt>
	                      <dd>{destinatarioAgendamentoNex.nome}</dd>
	                    </div>
	                    <div>
	                      <dt>Documento</dt>
	                      <dd>{destinatarioAgendamentoNex.documento ?? "Protegido"}</dd>
	                    </div>
	                    <div>
	                      <dt>Chave</dt>
	                      <dd>{destinatarioAgendamentoNex.chave}</dd>
	                    </div>
	                    <div>
	                      <dt>Instituição</dt>
	                      <dd>{destinatarioAgendamentoNex.instituicao}</dd>
	                    </div>
	                  </dl>
	                  {mensagemAgendamentoNex && <div className="painel-nex__mensagem">{mensagemAgendamentoNex}</div>}
	                  <div className="painel-nex-envio__acoes">
	                    <button className="botao botao--cliente" disabled={processandoAgendamentoNex} onClick={() => setEtapaAgendamentoNex("valor")} type="button">
	                      Voltar
	                    </button>
	                    <button className="botao botao--primario" disabled={processandoAgendamentoNex} onClick={() => void confirmarAgendamentoNex()} type="button">
	                      {processandoAgendamentoNex ? "Agendando..." : "Agendar"}
	                      <Repeat2 size={18} />
	                    </button>
	                  </div>
	                </article>
	              )}

	              {etapaAgendamentoNex === "sucesso" && agendamentoNex && (
	                <article className="painel-nex-envio__card painel-nex-envio__sucesso" role="status">
	                  <CheckCircle2 size={52} />
	                  <span>Agendamento criado</span>
	                  <h2>{agendamentoNex.valor ?? formatarMoedaNex(agendamentoNex.valorCentavos)}</h2>
	                  <p>{formatarDataHoraAgendamentoNex(agendamentoNex.agendadoPara)}</p>
	                  <button
	                    className="botao botao--primario"
	                    onClick={() => {
	                      try {
	                        sessionStorage.setItem(chaveAbaExtratoInicial, "agendamentos");
	                      } catch {
	                      }
	                      window.location.assign("/painel/extrato");
	                    }}
	                    type="button"
	                  >
	                    Abrir agendamentos
	                    <ArrowRight size={18} />
	                  </button>
	                </article>
	              )}
	            </section>
	          </div>
	        )}

        {telaInicial === "nex-recorrentes" && (
	          <div className="painel-nex painel-nex--lista">
	            <header className="painel-nex__topo">
	              <a className="painel-financeiro__voltar" href="/painel/nex">
	                <ArrowLeft size={17} />
	                Voltar
	              </a>
	              <div>
	                <h1>Envie novamente</h1>
	                <p>Contatos recentes para uma nova transferência Nex.</p>
	              </div>
	            </header>

	            <section className="painel-nex-lista">
	              {mensagemNex && <div className="painel-nex__mensagem">{mensagemNex}</div>}
	              {carregandoAtividadesNex ? (
	                <div className="painel-nex__vazio">Carregando contatos...</div>
	              ) : contatosNex.length > 0 ? (
	                <>
	                  <div className="painel-nex-lista__contatos">
	                    {contatosNexPagina.map((contato) => (
	                      <button key={`${contato.nome}-${contato.ultimaEm}`} onClick={() => iniciarEnvioContatoNex(contato)} type="button">
	                        <i>{contato.nome.slice(0, 1).toLocaleUpperCase("pt-BR")}</i>
	                        <span>
	                          <strong>{contato.nome}</strong>
	                          <small>{contato.totalTransferencias ?? 1} transferência(s) · {formatarGrupoDia(new Date(contato.ultimaEm))}</small>
	                        </span>
	                        <em>{contato.valor}</em>
	                        <ArrowRight size={18} />
	                      </button>
	                    ))}
	                  </div>
	                  {mostrarPaginacaoContatosNex && (
	                    <div className="painel-financeiro__paginacao">
	                      <span>{totalContatosNexEfetivo} contatos</span>
	                      {temPaginaAnteriorContatosNex && (
	                        <button onClick={() => setPaginaContatosNex((valor) => Math.max(1, valor - 1))} type="button">
	                          Anterior
	                        </button>
	                      )}
	                      {temPaginaProximaContatosNex && (
	                        <button onClick={() => setPaginaContatosNex((valor) => valor + 1)} type="button">
	                          Próxima
	                        </button>
	                      )}
	                    </div>
	                  )}
	                </>
	              ) : (
	                <div className="painel-nex__vazio">
	                  <IconeNex tamanho={30} />
	                  <strong>Nenhum contato Nex ainda</strong>
	                  <span>Depois da primeira transferência, os contatos aparecem aqui.</span>
	                </div>
	              )}
	            </section>
	          </div>
	        )}

	        {telaInicial === "nex-atividades" && (
	          <div className="painel-nex painel-nex--lista">
	            <header className="painel-nex__topo">
	              <a className="painel-financeiro__voltar" href="/painel/nex">
	                <ArrowLeft size={17} />
	                Voltar
	              </a>
	              <div>
	                <h1>Atividades Nex</h1>
	                <p>Histórico das suas transferências Nex.</p>
	              </div>
	            </header>

	            <section className="painel-nex-lista">
	              <div className="painel-financeiro__filtros painel-nex-lista__filtros">
	                <label className="painel-financeiro__busca">
	                  <IconeLupaNc />
	                  <input
	                    maxLength={80}
	                    onChange={(evento) => {
	                      setPaginaAtividadesNex(1);
	                      setPesquisaAtividadesNex(evento.target.value.slice(0, 80));
	                    }}
	                    placeholder="Pesquisar atividade"
	                    value={pesquisaAtividadesNex}
	                  />
	                </label>
	              </div>
	              {mensagemNex && <div className="painel-nex__mensagem">{mensagemNex}</div>}
	              {carregandoAtividadesNex ? (
	                <div className="painel-nex__vazio">Carregando atividades...</div>
	              ) : atividadesNex.length > 0 ? (
	                <>
	                  <div className="painel-nex-lista__atividades">
	                    {renderMovimentos(atividadesNex)}
	                  </div>
	                  {mostrarPaginacaoAtividadesNex && (
	                    <div className="painel-financeiro__paginacao">
	                      <span>{totalAtividadesNex} atividades</span>
	                      {temPaginaAnteriorAtividadesNex && (
	                        <button onClick={() => setPaginaAtividadesNex((valor) => Math.max(1, valor - 1))} type="button">
	                          Anterior
	                        </button>
	                      )}
	                      {temPaginaProximaAtividadesNex && (
	                        <button onClick={() => setPaginaAtividadesNex((valor) => valor + 1)} type="button">
	                          Próxima
	                        </button>
	                      )}
	                    </div>
	                  )}
	                </>
	              ) : (
	                <div className="painel-nex__vazio">
	                  <ArrowDownToLine size={30} />
	                  <strong>Sem atividades Nex</strong>
	                  <span>Envios e recebimentos pelo Nex aparecerão aqui.</span>
	                </div>
	              )}
	            </section>
	          </div>
	        )}

	        {telaInicial === "nex-chave" && (
          <div className="painel-nex painel-nex--chave">
            <header className="painel-nex__topo">
              <a className="painel-financeiro__voltar" href="/painel/nex">
                <ArrowLeft size={17} />
                Voltar
              </a>
              <div>
                <h1>Gerenciar chaves Nex</h1>
                <p>Organize as chaves usadas para receber transferências.</p>
              </div>
            </header>

            <section className="painel-nex-chave">
              <article className="painel-nex-chave__principal">
                <div className="painel-nex__cabecalho">
                  <span>Chaves atuais</span>
                  <KeyRound size={19} />
                </div>

                {mensagemNex && <div className="painel-nex__mensagem">{mensagemNex}</div>}

                {chavesNex.length > 0 ? (
                  <div className="painel-nex-chave__lista">
                    {chavesNex.map((chave) => (
                      <article className="painel-nex-chave__item" key={chave.id}>
                        <i>
                          {chave.tipo === "aleatoria" && <Shuffle size={19} />}
                          {chave.tipo === "email" && <Mail size={19} />}
                          {chave.tipo === "telefone" && <Phone size={19} />}
                          {chave.tipo === "documento" && <Fingerprint size={19} />}
                        </i>
                        <span>
                          <strong>{valorExibicaoChaveNex(chave)}</strong>
                          <small>
                            {rotuloTipoChaveContaNex(chave.tipo)}
                            {chave.verificacaoPendente ? " · pendente de verificação" : ""}
                          </small>
                        </span>
                        <div>
                          <button aria-label="Copiar chave" onClick={() => copiarChaveNex(valorExibicaoChaveNex(chave))} type="button">
                            <Copy size={17} />
                          </button>
                          <button aria-label="Apagar chave" onClick={() => setChaveExclusaoNex(chave)} type="button">
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="painel-nex__vazio">
                    <KeyRound size={30} />
                    <strong>Nenhuma chave Nex criada</strong>
                    <span>Adicione uma chave para receber transferências pelo Nex.</span>
                  </div>
                )}
              </article>

              <aside className="painel-nex-chave__resumo">
                <span>Nova chave</span>
                <strong>Adicione uma chave Nex</strong>
                <small>
                  Você pode usar e-mail, telefone, {rotuloDocumentoContaNex} cadastrado ou até 3 chaves aleatórias.
                </small>
                <button onClick={abrirModalNovaChaveNex} type="button">
                  <Plus size={17} />
                  Adicionar chave
                </button>
              </aside>
            </section>
          </div>
        )}

        {telaInicial === "saldo" && (
          <div className="painel-financeiro painel-financeiro--saldo">
            <a className="painel-financeiro__voltar" href="/painel">
              <ArrowLeft size={17} />
              Voltar
            </a>

            <section className="painel-financeiro__hero">
              <div>
                <span>
                  Saldo atual
                  <button
                    aria-label={saldosVisiveis ? "Ocultar saldos" : "Mostrar saldos"}
                    aria-pressed={saldosVisiveis}
                    className="painel-dashboard__olho"
                    onClick={alternarSaldosVisiveis}
                    type="button"
                  >
                    {saldosVisiveis ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </span>
                <strong>{saldoDisponivelExibido}</strong>
                <small>Saldo total {saldoTotalExibido}</small>
              </div>
              <div className="painel-financeiro__atalhos">
                <a href="/painel/extrato">
                  <IconeDownloadNc />
                  Extrato
                </a>
                <a href="/painel/graficos">
                  <IconeGraficoNc />
                  Gráficos
                </a>
              </div>
            </section>

            <section className="painel-financeiro__card">
              <div className="painel-financeiro__cabecalho">
                <h2>Últimas transações</h2>
                <label className="painel-financeiro__busca">
                  <IconeLupaNc />
                  <input
                    maxLength={80}
                    onChange={(evento) => setPesquisaExtrato(evento.target.value.slice(0, 80))}
                    placeholder="Pesquisar"
                    value={pesquisaExtrato}
                  />
                </label>
              </div>
              {renderMovimentos(transacoes)}
            </section>
          </div>
        )}

        {telaInicial === "extrato" && (
          <div className="painel-financeiro painel-financeiro--extrato">
            <section className="painel-financeiro__cabecalho painel-financeiro__cabecalho--linha">
              <div>
                <a className="painel-financeiro__voltar" href="/painel">
                  <ArrowLeft size={17} />
                  Voltar
                </a>
                <h2>Extrato</h2>
                <div className="painel-financeiro__abas">
                  <button aria-pressed={abaExtrato === "extrato"} onClick={() => setAbaExtrato("extrato")} type="button">
                    Extrato
                  </button>
                  <button aria-pressed={abaExtrato === "agendamentos"} onClick={() => setAbaExtrato("agendamentos")} type="button">
                    Agendamentos
                  </button>
                </div>
              </div>
              <div className="painel-financeiro__acoes">
                <button onClick={() => setModalExtratoAberto(true)} type="button">
                  <IconeDownloadNc />
                  Download
                </button>
              </div>
            </section>

            {abaExtrato === "extrato" ? (
              <section className="painel-financeiro__card">
                <div className="painel-financeiro__filtros">
                  <label className="painel-financeiro__busca">
                    <IconeLupaNc />
                    <input
                      maxLength={80}
                      onChange={(evento) => {
                        setPaginaExtrato(1);
                        setPesquisaExtrato(evento.target.value.slice(0, 80));
                      }}
                      placeholder="Pesquisar no extrato"
                      value={pesquisaExtrato}
                    />
                  </label>
                  {renderFiltro("ordenar", opcoesOrdenacaoExtrato, ordenarExtrato, (valor) => {
                    setPaginaExtrato(1);
                    setOrdenarExtrato(valor);
                  })}
                  {renderFiltro("periodo", opcoesPeriodoExtrato, periodoExtrato, (valor) => {
                    setPaginaExtrato(1);
                    setPeriodoExtrato(valor);
                  })}
                  {renderFiltro("categoria", opcoesCategoriaExtrato, categoriaExtrato, (valor) => {
                    setPaginaExtrato(1);
                    setCategoriaExtrato(valor);
                  })}
                  {renderFiltro("tipo", opcoesTipoExtrato, tipoExtrato, (valor) => {
                    setPaginaExtrato(1);
                    setTipoExtrato(valor);
                  })}
                </div>

                {mensagemFinanceira && <div className="painel-financeiro__alerta">{mensagemFinanceira}</div>}

                {transacoesAgrupadas.length === 0 ? (
                  <div className="painel-financeiro__vazio">
                    {mensagemFinanceira || "Nenhuma transação encontrada."}
                  </div>
                ) : (
                  transacoesAgrupadas.map((grupo) => (
                    <div className="painel-financeiro__grupo" key={grupo.mes}>
                      <h3>{grupo.mes}</h3>
                      {grupo.dias.map((dia) => (
                        <div key={`${grupo.mes}-${dia.dia}`}>
                          <h4>{dia.dia}</h4>
                          {renderMovimentos(dia.transacoes)}
                        </div>
                      ))}
                    </div>
                  ))
                )}

                {mostrarPaginacaoExtrato && (
                  <div className="painel-financeiro__paginacao">
                    <span>{totalTransacoes} transações</span>
                    {temPaginaAnteriorExtrato && (
                      <button onClick={() => setPaginaExtrato((valor) => Math.max(1, valor - 1))} type="button">
                        Anterior
                      </button>
                    )}
                    {temPaginaProximaExtrato && (
                      <button onClick={() => setPaginaExtrato((valor) => valor + 1)} type="button">
                        Próxima
                      </button>
                    )}
                  </div>
                )}
              </section>
            ) : (
              <section className="painel-financeiro__card">
                {agendamentos.length === 0 ? (
                  <div className="painel-financeiro__estado-vazio">
                    <h3>Você não possui agendamentos</h3>
                    <p>As suas transações agendadas e débitos automáticos aparecerão aqui.</p>
                  </div>
                ) : (
                  renderMovimentos(agendamentos)
                )}
              </section>
            )}
          </div>
        )}

        {telaInicial === "graficos" && (
          <div className="painel-financeiro painel-financeiro--graficos">
            <section className="painel-financeiro__cabecalho painel-financeiro__cabecalho--linha">
              <div>
                <a className="painel-financeiro__voltar" href="/painel/saldo">
                  <ArrowLeft size={17} />
                  Voltar
                </a>
                <h2>Gráficos financeiros</h2>
                <p>Resumo das entradas e saídas do período selecionado.</p>
              </div>
              {renderFiltro("mes-grafico", mesesGrafico, mesGrafico, setMesGrafico)}
            </section>

            <section className="painel-financeiro__graficos">
              <article className="painel-financeiro__card">
                <span>Entradas</span>
                <strong>{saldosVisiveis ? graficos?.entradas ?? "R$ 0,00" : valorMascarado}</strong>
                <b>
                  <i style={{ width: `${saldosCentavosGraficos ? ((graficos?.entradasCentavos ?? 0) / saldosCentavosGraficos) * 100 : 0}%` }} />
                </b>
              </article>
              <article className="painel-financeiro__card">
                <span>Saídas</span>
                <strong>{saldosVisiveis ? graficos?.saidas ?? "R$ 0,00" : valorMascarado}</strong>
                <b>
                  <i style={{ width: `${saldosCentavosGraficos ? ((graficos?.saidasCentavos ?? 0) / saldosCentavosGraficos) * 100 : 0}%` }} />
                </b>
              </article>
            </section>

            <section className="painel-financeiro__card">
              <h2>Por categoria</h2>
              {(graficos?.categorias ?? []).length === 0 ? (
                <div className="painel-financeiro__vazio">Sem movimentos no mês selecionado.</div>
              ) : (
                graficos?.categorias?.map((categoria) => (
                  <div className="painel-financeiro__categoria" key={`${categoria.direcao ?? "movimento"}-${categoria.categoria}`}>
                    <span>
                      {rotulosCategoriasFinanceiras[categoria.categoria] ?? categoria.categoria}
                      <small>{categoria.direcao === "entrada" ? "Entrada" : "Saída"}</small>
                    </span>
                    <strong>{saldosVisiveis ? categoria.valor : valorMascarado}</strong>
                  </div>
                ))
              )}
            </section>
          </div>
        )}

        {telaInicial === "agendamento" && (
          <div className="painel-financeiro painel-financeiro--transacao">
            <section className="painel-financeiro__cabecalho painel-financeiro__cabecalho--linha">
              <div>
                <a className="painel-financeiro__voltar" href="/painel/extrato">
                  <ArrowLeft size={17} />
                  Voltar ao extrato
                </a>
                <h2>Detalhes do agendamento</h2>
                <p>Transferência programada pelo NC Bank.</p>
              </div>
            </section>

            {carregandoAgendamentoDetalhe && (
              <section className="painel-transacao-tela">
                <div className="painel-financeiro__vazio">Carregando agendamento...</div>
              </section>
            )}

            {!carregandoAgendamentoDetalhe && mensagemAgendamentoDetalhe && !agendamentoDetalhe && (
              <section className="painel-transacao-tela">
                <div className="painel-financeiro__estado-vazio">
                  <h3>{mensagemAgendamentoDetalhe}</h3>
                  <p>Confira a aba de agendamentos no extrato e tente novamente.</p>
                  <a className="botao botao--primario" href="/painel/extrato">
                    Abrir extrato
                    <ArrowRight size={18} />
                  </a>
                </div>
              </section>
            )}

            {agendamentoDetalhe &&
              (() => {
                const dataAgendada = new Date(agendamentoDetalhe.data);
                const dataAgendadaCurta = new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                }).format(dataAgendada);
                const referencia =
                  agendamentoDetalhe.referencia ?? `NX-${agendamentoDetalhe.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;

                return (
                  <section className="painel-transacao-tela painel-transacao-tela--agendada">
                    <div className="painel-transacao-tela__topo">
                      <i>
                        <Repeat2 size={22} />
                      </i>
                      <span>Transferência agendada</span>
                      <h2>{agendamentoDetalhe.descricao}</h2>
                      <strong className={agendamentoDetalhe.tipo === "entrada" ? "painel-dashboard__entrada" : "painel-dashboard__saida"}>
                        {agendamentoDetalhe.valor}
                      </strong>
                    </div>

                    <section className="painel-transacao-tela__secao">
                      <h3>Sobre o agendamento</h3>
                      <dl className="painel-transacao-tela__dados">
                        <div>
                          <dt>Data agendada</dt>
                          <dd title={new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(dataAgendada)}>
                            {dataAgendadaCurta}
                          </dd>
                        </div>
                        <div>
                          <dt>Horário</dt>
                          <dd>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(dataAgendada)}</dd>
                        </div>
                        <div>
                          <dt>ID do agendamento</dt>
                          <dd>{referencia}</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd>Agendado</dd>
                        </div>
                        <div>
                          <dt>Categoria</dt>
                          <dd>{rotulosCategoriasFinanceiras[agendamentoDetalhe.categoria] ?? agendamentoDetalhe.categoria}</dd>
                        </div>
                        <div>
                          <dt>Tipo</dt>
                          <dd>{agendamentoDetalhe.tipo === "entrada" ? "Entrada" : "Saída"}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className="painel-transacao-tela__partes">
                      <article>
                        <h3>Destino</h3>
                        <dl>
                          <div>
                            <dt>Nome</dt>
                            <dd>{agendamentoDetalhe.contraparte ?? "Cliente NC Bank"}</dd>
                          </div>
                          <div>
                            <dt>Instituição</dt>
                            <dd>{agendamentoDetalhe.instituicao ?? "NC Bank"}</dd>
                          </div>
                          <div>
                            <dt>Data de débito</dt>
                            <dd>{dataHoraAgendamentoTexto && agendamentoDetalhe.id === agendamentoNex?.id ? dataHoraAgendamentoTexto : formatarDataHoraAgendamentoNex(agendamentoDetalhe.data)}</dd>
                          </div>
                        </dl>
                      </article>

                      <article>
                        <h3>Conta de origem</h3>
                        <dl>
                          <div>
                            <dt>Nome</dt>
                            <dd>{apresentacao}</dd>
                          </div>
                          <div>
                            <dt>Instituição</dt>
                            <dd>NC Bank</dd>
                          </div>
                          <div>
                            <dt>Validação</dt>
                            <dd>Saldo conferido novamente na data agendada</dd>
                          </div>
                        </dl>
                      </article>
                    </section>

                    <p className="painel-transacao-tela__resumo">
                      O valor será debitado somente na data marcada. Se não houver saldo suficiente, o agendamento será encerrado.
                    </p>
                  </section>
                );
              })()}
          </div>
        )}

        {telaInicial === "transacao" && (
          <div className="painel-financeiro painel-financeiro--transacao">
            <section className="painel-financeiro__cabecalho painel-financeiro__cabecalho--linha">
              <div>
                <a className="painel-financeiro__voltar" href="/painel/extrato">
                  <ArrowLeft size={17} />
                  Voltar ao extrato
                </a>
                <h2>Detalhes da transação</h2>
                <p>Dados consultados do NC Bank.</p>
              </div>
            </section>

            {carregandoTransacaoDetalhe && (
              <section className="painel-transacao-tela">
                <div className="painel-financeiro__vazio">Carregando transação...</div>
              </section>
            )}

            {!carregandoTransacaoDetalhe && mensagemTransacaoDetalhe && !transacaoDetalhe && (
              <section className="painel-transacao-tela">
                <div className="painel-financeiro__estado-vazio">
                  <h3>{mensagemTransacaoDetalhe}</h3>
                  <p>Confira o extrato e tente novamente.</p>
                  <a className="botao botao--primario" href="/painel/extrato">
                    Abrir extrato
                    <ArrowRight size={18} />
                  </a>
                </div>
              </section>
            )}

            {transacaoDetalhe &&
              (() => {
                const transacaoBoleto = transacaoDetalhe.tipoOperacao === "pagamento";
                const transacaoRecarga = transacaoDetalhe.tipoOperacao === "recarga";
                const recebedor = transacaoDetalhe.recebedor ?? participanteFallback("recebedor", transacaoDetalhe);
                const pagador = transacaoDetalhe.pagador ?? participanteFallback("pagador", transacaoDetalhe);
                const instituicaoRecebedor = transacaoBoleto
                  ? normalizarInstituicaoBoletoPainel(
                      recebedor.instituicao === "NC Bank"
                        ? transacaoDetalhe.contraparte ?? recebedor.instituicao
                        : recebedor.instituicao
                    )
                  : recebedor.instituicao;
                const dataTransacao = new Date(transacaoDetalhe.liquidadoEm ?? transacaoDetalhe.data);
                const dataTransacaoCurta = new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric"
                }).format(dataTransacao);
                const referencia =
                  transacaoDetalhe.referencia ?? `NC-${transacaoDetalhe.id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;

                return (
                  <section className="painel-transacao-tela">
                    <div className="painel-transacao-tela__topo">
                      <i className={transacaoDetalhe.tipoOperacao === "bonus" ? "painel-dashboard__icone-bonus" : undefined}>
                        {iconeMovimento(transacaoDetalhe)}
                      </i>
                      <span>{transacaoDetalhe.comprovanteTitulo ?? (transacaoDetalhe.tipo === "entrada" ? "Transferência recebida" : "Transferência enviada")}</span>
                      <h2>{transacaoDetalhe.descricao}</h2>
                      <strong className={transacaoDetalhe.tipo === "entrada" ? "painel-dashboard__entrada" : "painel-dashboard__saida"}>
                        {transacaoDetalhe.valor}
                      </strong>
                      {transacaoDetalhe.status !== "falhou" && (
                        <button className="botao botao--primario painel-transacao-tela__compartilhar" onClick={() => setModalComprovanteAberto(true)} type="button">
                          Compartilhar
                          <ArrowDownToLine size={18} />
                        </button>
                      )}
                    </div>

                    <section className="painel-transacao-tela__secao">
                      <h3>Sobre a transação</h3>
                      <dl className="painel-transacao-tela__dados">
                        <div>
                          <dt>Data da transação</dt>
                          <dd title={new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(dataTransacao)}>
                            {dataTransacaoCurta}
                          </dd>
                        </div>
                        <div>
                          <dt>Horário</dt>
                          <dd>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(dataTransacao)}</dd>
                        </div>
                        <div>
                          <dt>ID da transação</dt>
                          <dd>{referencia}</dd>
                        </div>
                        <div>
                          <dt>Status</dt>
                          <dd>{transacaoDetalhe.status === "liquidado" || !transacaoDetalhe.status ? "Liquidada" : transacaoDetalhe.status}</dd>
                        </div>
                        <div>
                          <dt>Categoria</dt>
                          <dd>{rotulosCategoriasFinanceiras[transacaoDetalhe.categoria] ?? transacaoDetalhe.categoria}</dd>
                        </div>
                        <div>
                          <dt>Tipo</dt>
                          <dd>{transacaoDetalhe.tipo === "entrada" ? "Entrada" : "Saída"}</dd>
                        </div>
                      </dl>
                    </section>

                    <section className="painel-transacao-tela__partes">
                      <article>
                        <h3>{transacaoBoleto ? "Beneficiário do boleto" : transacaoRecarga ? "Operadora" : "Quem recebeu"}</h3>
                        <dl>
                          <div>
                            <dt>Nome</dt>
                            <dd>{recebedor.nome}</dd>
                          </div>
                          <div>
                            <dt>CPF/CNPJ</dt>
                            <dd>{recebedor.documento}</dd>
                          </div>
                          <div>
                            <dt>Instituição</dt>
                            <dd>{instituicaoRecebedor}</dd>
                          </div>
                          <div>
                            <dt>{transacaoBoleto ? "Identificação" : transacaoRecarga ? "Linha" : "Chave Nex"}</dt>
                            <dd>{recebedor.chave}</dd>
                          </div>
                        </dl>
                      </article>

                      <article>
                        <h3>{transacaoBoleto || transacaoRecarga ? "Pagador" : "Quem pagou"}</h3>
                        <dl>
                          <div>
                            <dt>Nome</dt>
                            <dd>{pagador.nome}</dd>
                          </div>
                          <div>
                            <dt>CPF/CNPJ</dt>
                            <dd>{pagador.documento}</dd>
                          </div>
                          <div>
                            <dt>Instituição</dt>
                            <dd>{pagador.instituicao}</dd>
                          </div>
                          <div>
                            <dt>{transacaoBoleto || transacaoRecarga ? "Origem" : "Chave Nex"}</dt>
                            <dd>{pagador.chave}</dd>
                          </div>
                        </dl>
                      </article>
                    </section>

                    <p className="painel-transacao-tela__resumo">
                      {transacaoDetalhe.resumo ??
                        (transacaoDetalhe.tipoOperacao === "bonus"
                          ? "Bônus registrado como movimento real no extrato NC Bank."
                          : "Movimento registrado no extrato NC Bank.")}
                    </p>
                  </section>
                );
              })()}
          </div>
        )}
      </section>

      {modalDoacaoMurzoAberto && (
        <div className="painel-doacao-modal" onClick={fecharModalDoacaoMurzo} role="presentation">
          <section
            className="painel-doacao-modal__caixa"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Doação para Instituto Murzo"
          >
            <div className="painel-doacao-modal__topo">
              <img src="/marca/instituto-murzo-logo.png" alt="" />
              <span>{institutoMurzoPainel.nome}</span>
              <button aria-label="Fechar doação" disabled={processandoDoacaoMurzo} onClick={fecharModalDoacaoMurzo} type="button">
                <X size={18} />
              </button>
            </div>

            {etapaDoacaoMurzo === "valor" && (
              <>
                <div className="painel-doacao-modal__saldo">
                  <span>
                    Saldo disponível
                    <button
                      aria-label={saldosVisiveis ? "Ocultar saldos" : "Mostrar saldos"}
                      aria-pressed={saldosVisiveis}
                      className="painel-dashboard__olho"
                      onClick={alternarSaldosVisiveis}
                      type="button"
                    >
                      {saldosVisiveis ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </span>
                  <strong>{saldoDisponivelExibido}</strong>
                </div>
                <label className="painel-nex__campo painel-nex-envio__valor painel-doacao-modal__valor">
                  <span>Valor da doação</span>
                  <input
                    autoComplete="off"
                    data-ncbank-sensivel="true"
                    inputMode="numeric"
                    maxLength={18}
                    onChange={(evento) => {
                      setValorDoacaoMurzo(formatarValorEntradaNex(evento.target.value));
                      setMensagemDoacaoMurzo("");
                    }}
                    value={valorDoacaoMurzo}
                  />
                </label>
                <div className="painel-doacao-modal__rapidos" aria-label="Valores rápidos">
                  {valoresRapidosDoacaoMurzoCentavos.map((valor) => (
                    <button
                      aria-pressed={valorDoacaoMurzoCentavos === valor}
                      key={valor}
                      onClick={() => {
                        setValorDoacaoMurzo(formatarMoedaNex(valor));
                        setMensagemDoacaoMurzo("");
                      }}
                      type="button"
                    >
                      {formatarMoedaNex(valor)}
                    </button>
                  ))}
                </div>
                {mensagemDoacaoMurzo && <div className="painel-nex__mensagem">{mensagemDoacaoMurzo}</div>}
                <div className="painel-doacao-modal__acoes">
                  <button className="botao botao--cliente" onClick={fecharModalDoacaoMurzo} type="button">
                    Cancelar
                  </button>
                  <button className="botao botao--primario" disabled={processandoDoacaoMurzo} onClick={revisarDoacaoMurzo} type="button">
                    Continuar
                    <ArrowRight size={18} />
                  </button>
                </div>
              </>
            )}

            {etapaDoacaoMurzo === "revisao" && (
              <>
                <div className="painel-doacao-modal__revisao-topo">
                  <HeartHandshake size={32} />
                  <span>Revise sua doação</span>
                  <strong>{formatarMoedaNex(valorDoacaoMurzoCentavos)}</strong>
                </div>
                <dl className="painel-doacao-modal__resumo">
                  <div>
                    <dt>Destino</dt>
                    <dd>{institutoMurzoPainel.nome}</dd>
                  </div>
                  <div>
                    <dt>CNPJ</dt>
                    <dd>{institutoMurzoPainel.cnpjMascarado}</dd>
                  </div>
                  <div>
                    <dt>Saldo após doação</dt>
                    <dd>{saldosVisiveis ? saldoAposDoacaoMurzo : valorMascarado}</dd>
                  </div>
                  <div>
                    <dt>Registro no extrato</dt>
                    <dd>Doação Instituto Murzo</dd>
                  </div>
                </dl>
                {mensagemDoacaoMurzo && <div className="painel-nex__mensagem">{mensagemDoacaoMurzo}</div>}
                <div className="painel-doacao-modal__acoes">
                  <button className="botao botao--cliente" disabled={processandoDoacaoMurzo} onClick={() => setEtapaDoacaoMurzo("valor")} type="button">
                    Voltar
                  </button>
                  <button className="botao botao--primario" disabled={processandoDoacaoMurzo} onClick={() => void confirmarDoacaoMurzo()} type="button">
                    {processandoDoacaoMurzo ? "Enviando..." : "Confirmar doação"}
                    <HeartHandshake size={18} />
                  </button>
                </div>
              </>
            )}

            {etapaDoacaoMurzo === "sucesso" && (
              <div className="painel-doacao-modal__sucesso" role="status">
                <CheckCircle2 size={52} />
                <span>Doação enviada</span>
                <h2>{formatarMoedaNex(valorDoacaoMurzoCentavos)}</h2>
                <p>A transação será aberta automaticamente.</p>
                {transacaoDoacaoMurzoId && (
                  <a className="botao botao--primario" href={`/painel/transacao/${encodeURIComponent(transacaoDoacaoMurzoId)}`}>
                    Abrir transação
                    <ArrowRight size={18} />
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {modalValorRecebimentoNexAberto && chaveRecebimentoAtual && (
        <div className="painel-nex-modal" onClick={() => setModalValorRecebimentoNexAberto(false)} role="presentation">
          <section
            className="painel-nex-modal__caixa painel-nex-modal__caixa--valor-qr"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Personalizar valor do QR Nex"
          >
            <div className="painel-nex-modal__topo">
              <span>Receber Nex</span>
              <h2>Personalizar valor do QR Code.</h2>
            </div>
            <label className="painel-nex__campo painel-nex-envio__valor painel-nex-receber__valor-campo">
              <span>Valor a receber</span>
              <input
                autoComplete="off"
                data-ncbank-sensivel="true"
                inputMode="numeric"
                maxLength={18}
                onChange={(evento) => {
                  setValorRecebimentoNex(formatarValorEntradaNex(evento.target.value));
                  setMensagemRecebimentoNex("");
                }}
                value={valorRecebimentoNex}
              />
            </label>
            {mensagemRecebimentoNex && <div className="painel-nex__mensagem">{mensagemRecebimentoNex}</div>}
            <div className="painel-nex-modal__acoes">
              <button className="botao botao--cliente" onClick={() => setModalValorRecebimentoNexAberto(false)} type="button">
                Cancelar
              </button>
              <button className="botao botao--primario" disabled={processandoRecebimentoNex} onClick={() => void criarQrPersonalizadoNex()} type="button">
                <span>{processandoRecebimentoNex ? "Criando..." : "Criar QR Code"}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
      )}

      {modalPermissaoCameraBoletoAberto && telaInicial === "pagamento-boleto" && (
        <div className="painel-nex-modal" onClick={() => setModalPermissaoCameraBoletoAberto(false)} role="presentation">
          <section
            className="painel-nex-modal__caixa painel-nex-modal__caixa--camera"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Permitir câmera para escanear boleto"
          >
            <div className="painel-nex-camera-aviso painel-boleto-camera-aviso" aria-hidden="true">
              <div>
                <Barcode size={44} />
                <span />
              </div>
            </div>
            <div className="painel-nex-modal__topo">
              <span>Pagar boleto</span>
              <h2>Permita o uso da câmera.</h2>
              <p>O navegador vai pedir autorização para ler o código de barras. A câmera fica ativa somente nesta tela.</p>
            </div>
            <div className="painel-nex-modal__acoes">
              <button
                className="botao botao--cliente"
                onClick={() => {
                  setScannerBoletoDispensado(true);
                  setScannerBoletoAutorizado(false);
                  setModalPermissaoCameraBoletoAberto(false);
                }}
                type="button"
              >
                Agora não
              </button>
              <button
                className="botao botao--primario"
                onClick={() => {
                  setScannerBoletoDispensado(false);
                  setScannerBoletoAutorizado(true);
                  setModalPermissaoCameraBoletoAberto(false);
                }}
                type="button"
              >
                Continuar
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
      )}

      {modalPermissaoCameraNexAberto && telaInicial === "nex-escanear" && (
        <div className="painel-nex-modal" onClick={() => setModalPermissaoCameraNexAberto(false)} role="presentation">
          <section
            className="painel-nex-modal__caixa painel-nex-modal__caixa--camera"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Permitir câmera para escanear QR Nex"
          >
            <div className="painel-nex-camera-aviso" aria-hidden="true">
              <div>
                <QrCode size={44} />
                <span />
              </div>
            </div>
            <div className="painel-nex-modal__topo">
              <span>Escanear Nex</span>
              <h2>Permita o uso da câmera.</h2>
              <p>O navegador vai pedir autorização para ler o QR Code. A câmera fica ativa somente nesta tela.</p>
            </div>
            <div className="painel-nex-modal__acoes">
              <button
                className="botao botao--cliente"
                onClick={() => {
                  setScannerNexDispensado(true);
                  setScannerNexAutorizado(false);
                  setModalPermissaoCameraNexAberto(false);
                }}
                type="button"
              >
                Agora não
              </button>
              <button
                className="botao botao--primario"
                onClick={() => {
                  setScannerNexDispensado(false);
                  setScannerNexAutorizado(true);
                  setModalPermissaoCameraNexAberto(false);
                }}
                type="button"
              >
                Continuar
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
      )}

      {modalChaveNexAberto && (
        <div className="painel-nex-modal" onClick={fecharModalChaveNex} role="presentation">
          <section
            className="painel-nex-modal__caixa"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Adicionar chave Nex"
          >
            <div className="painel-nex-modal__topo">
              <span>Chave Nex</span>
              <h2>
                {etapaModalChaveNex === "tipo"
                  ? "Escolha o tipo de chave."
                  : etapaModalChaveNex === "dados"
                    ? "Informe os dados da chave."
                    : "Confirme a criação da chave."}
              </h2>
            </div>

            {etapaModalChaveNex === "tipo" && (
              <div className="painel-nex__opcoes-chave">
                {opcoesChaveNex.map((opcao) => (
                  <button
                    aria-pressed={tipoChaveNex === opcao.tipo}
                    key={opcao.tipo}
                    onClick={() => {
                      setTipoChaveNex(opcao.tipo);
                      setEntradaChaveNex("");
                      setMensagemNex("");
                    }}
                    type="button"
                  >
                    {opcao.icone}
                    <span>
                      <strong>{opcao.titulo}</strong>
                      <small>{opcao.descricao}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {etapaModalChaveNex === "dados" && (
              <div className="painel-nex-chave__formulario">
                {tipoChaveNex === "aleatoria" && (
                  <div className="painel-nex-chave__aleatoria">
                    <Shuffle size={22} />
                    <span>Vamos gerar uma chave aleatória.</span>
                  </div>
                )}

                {tipoChaveNex === "documento" && (
                  <div className="painel-nex-chave__aleatoria">
                    <Fingerprint size={22} />
                    <span>Vamos usar o {rotuloDocumentoContaNex} cadastrado na sua conta.</span>
                  </div>
                )}

                {(tipoChaveNex === "email" || tipoChaveNex === "telefone") && (
                  <label className="painel-nex__campo">
                    <span>{tipoChaveNex === "email" ? "E-mail" : "Telefone"}</span>
                    <input
                      autoComplete={tipoChaveNex === "email" ? "email" : "tel"}
                      inputMode={tipoChaveNex === "email" ? "email" : "tel"}
                      maxLength={tipoChaveNex === "email" ? 120 : 16}
                      onChange={(evento) =>
                        setEntradaChaveNex(
                          tipoChaveNex === "telefone"
                            ? formatarTelefoneNex(evento.target.value)
                            : normalizarChaveNex(tipoChaveNex, evento.target.value)
                        )
                      }
                      placeholder={tipoChaveNex === "email" ? "voce@email.com" : "(11) 99999-9999"}
                      value={entradaChaveNex}
                    />
                  </label>
                )}
              </div>
            )}

            {etapaModalChaveNex === "confirmar" && (
              <div className="painel-nex-modal__confirmacao">
                <KeyRound size={24} />
                <span>{rotuloTipoChaveContaNex(tipoChaveNex)}</span>
                <strong>
                  {tipoChaveNex === "documento"
                    ? dados?.cliente?.documentoNex ?? `${rotuloDocumentoContaNex} cadastrado da conta`
                    : tipoChaveNex === "aleatoria"
                      ? "Gerada pelo NC Bank"
                      : tipoChaveNex === "telefone"
                        ? formatarTelefoneNex(entradaChaveNex)
                        : entradaChaveNex}
                </strong>
              </div>
            )}

            {mensagemNex && <div className="painel-nex__mensagem">{mensagemNex}</div>}

            <div className="painel-nex-modal__acoes">
              <button className="botao botao--cliente" disabled={processandoChaveNex} onClick={voltarModalChaveNex} type="button">
                {etapaModalChaveNex === "tipo" ? "Cancelar" : "Voltar"}
              </button>
              <button className="botao botao--primario" disabled={processandoChaveNex} onClick={avancarModalChaveNex} type="button">
                <span>{processandoChaveNex ? "Processando..." : etapaModalChaveNex === "confirmar" ? "Criar chave" : "Continuar"}</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
      )}

      {chaveExclusaoNex && (
        <div className="painel-nex-modal" onClick={() => setChaveExclusaoNex(null)} role="presentation">
          <section
            className="painel-nex-modal__caixa painel-nex-modal__caixa--confirmacao"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Apagar chave Nex"
          >
            <div className="painel-nex-modal__topo">
              <span>Apagar chave</span>
              <h2>Deseja remover esta chave Nex?</h2>
              <p>Depois da remoção, ela deixa de aparecer como opção para recebimentos nesta conta.</p>
            </div>
            <div className="painel-nex-modal__confirmacao">
              <Trash2 size={24} />
              <span>{rotuloTipoChaveContaNex(chaveExclusaoNex.tipo)}</span>
              <strong>{valorExibicaoChaveNex(chaveExclusaoNex)}</strong>
            </div>
            <div className="painel-nex-modal__acoes">
              <button className="botao botao--cliente" disabled={processandoChaveNex} onClick={() => setChaveExclusaoNex(null)} type="button">
                Manter chave
              </button>
              <button className="botao botao--primario" disabled={processandoChaveNex} onClick={() => void excluirChaveNex()} type="button">
                <span>{processandoChaveNex ? "Processando..." : "Apagar chave"}</span>
                <Trash2 size={18} />
              </button>
            </div>
          </section>
        </div>
      )}

      {modalExtratoAberto && (
        <div
          className="painel-comprovante-modal"
          onClick={() => {
            if (!baixandoExtrato) setModalExtratoAberto(false);
          }}
          role="presentation"
        >
          <section
            className="painel-comprovante-modal__caixa painel-comprovante-modal__caixa--extrato"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Baixar extrato"
          >
            <div className="painel-comprovante-modal__topo">
              <span>Extrato NC Bank</span>
              <h2>Escolha o formato</h2>
              <p>O arquivo inclui identificação da conta, titular, CPF/CNPJ, e-mail cadastrado e os filtros aplicados.</p>
            </div>
            <div className="painel-comprovante-modal__opcoes painel-comprovante-modal__opcoes--tres">
              <button
                disabled={Boolean(baixandoExtrato)}
                onClick={() => void baixarExtrato("pdf")}
                type="button"
              >
                <ReceiptText size={22} />
                <strong>PDF</strong>
                <small>{baixandoExtrato === "pdf" ? "Gerando..." : "Para visualizar ou enviar"}</small>
              </button>
              <button
                disabled={Boolean(baixandoExtrato)}
                onClick={() => void baixarExtrato("csv")}
                type="button"
              >
                <IconeDownloadNc />
                <strong>CSV</strong>
                <small>{baixandoExtrato === "csv" ? "Gerando..." : "Para planilhas"}</small>
              </button>
              <button
                disabled={Boolean(baixandoExtrato)}
                onClick={() => void baixarExtrato("ofx")}
                type="button"
              >
                <Landmark size={22} />
                <strong>OFX</strong>
                <small>{baixandoExtrato === "ofx" ? "Gerando..." : "Para conciliadores"}</small>
              </button>
            </div>
            <div className="painel-comprovante-modal__acoes">
              <button className="botao botao--cliente" disabled={Boolean(baixandoExtrato)} onClick={() => setModalExtratoAberto(false)} type="button">
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}

      {modalComprovanteAberto && transacaoDetalhe && (
        <div className="painel-comprovante-modal" onClick={() => setModalComprovanteAberto(false)} role="presentation">
          <section
            className="painel-comprovante-modal__caixa"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Compartilhar comprovante"
          >
            <div className="painel-comprovante-modal__topo">
              <span>Comprovante NC Bank</span>
              <h2>Escolha o formato</h2>
            </div>
            <div className="painel-comprovante-modal__opcoes">
              <button
                disabled={Boolean(baixandoComprovante)}
                onClick={() => void baixarComprovante("pdf")}
                type="button"
              >
                <ArrowDownToLine size={22} />
                <strong>PDF</strong>
                {baixandoComprovante === "pdf" && <small>Gerando...</small>}
              </button>
              <button
                disabled={Boolean(baixandoComprovante)}
                onClick={() => void baixarComprovante("png")}
                type="button"
              >
                <CheckCircle2 size={22} />
                <strong>Imagem PNG</strong>
                {baixandoComprovante === "png" && <small>Gerando...</small>}
              </button>
            </div>
            <div className="painel-comprovante-modal__acoes">
              <button className="botao botao--cliente" onClick={() => setModalComprovanteAberto(false)} type="button">
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}

      {modalAtivo === "boas-vindas-indicacao" && dados?.indicacoes?.boasVindas && (
        <div className="painel-indicacao-modal" onClick={() => void fecharBoasVindasIndicacao()} role="presentation">
          <section
            className="painel-indicacao-modal__caixa painel-indicacao-modal__caixa--boas-vindas"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Bônus de boas-vindas"
          >
            <picture className="painel-indicacao-modal__visual">
              <source srcSet="/marca/indicacao-boas-vindas-netcatbank.avif" type="image/avif" />
              <source srcSet="/marca/indicacao-boas-vindas-netcatbank.webp" type="image/webp" />
              <img src="/marca/indicacao-boas-vindas-netcatbank.png" alt="" />
            </picture>
            <div className="painel-indicacao-modal__conteudo">
              <h2>{dados.indicacoes.boasVindas.indicadorPrimeiroNome} convidou você para o NC Bank.</h2>
              <p>
                Seu bônus de {dados.indicacoes.boasVindas.recompensa ?? "R$ 10,00"} já está disponível na sua conta NC Bank para você usar como quiser.
              </p>
              <button className="botao botao--primario" onClick={() => void fecharBoasVindasIndicacao()} type="button">
                Entendi
                <CheckCircle2 size={18} />
              </button>
            </div>
          </section>
        </div>
      )}

      {modalAtivo === "indicacao" && (
        <div className="painel-indicacao-modal" onClick={() => setModalAtivo("nenhum")} role="presentation">
          <section
            className="painel-indicacao-modal__caixa"
            onClick={(evento) => evento.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Indique e ganhe"
          >
            <picture className="painel-indicacao-modal__visual">
              <source srcSet="/marca/indicacao-popup-modal-netcatbank.avif" type="image/avif" />
              <source srcSet="/marca/indicacao-popup-modal-netcatbank.webp" type="image/webp" />
              <img src="/marca/indicacao-popup-modal-netcatbank.png" alt="" />
            </picture>
            <div className="painel-indicacao-modal__conteudo">
              {indicacaoModalLimite ? (
                <>
                  <h2>Você já ganhou R$500 com indicações.</h2>
                  <p>
                    Sua campanha chegou ao limite de amigos indicados. Obrigado por trazer novas pessoas para o NC Bank.
                  </p>
                </>
              ) : (
                <>
                  <h2>Ganhe até R$500 indicando amigos.</h2>
                  <p>
                    Cada amigo novo que abrir a conta pelo seu link recebe R$10 de boas-vindas. Você recebe R$25
                    por indicação.
                  </p>
                  <label className="painel-indicacao-modal__link">
                    <span className="painel-indicacao-modal__link-rotulo">
                      Seu link de indicação
                      <span className="painel-indicacao-modal__ajuda" tabIndex={0} aria-label="Regras da indicação">
                        <CircleHelp size={17} />
                        <span>
                          Até 20 indicações por mês e 5 indicações por semana.
                          <br />A promoção vale por 30 dias.
                        </span>
                      </span>
                    </span>
                    <span className="painel-indicacao-modal__link-campo">
                      <input readOnly value={processandoIndicacao ? "Preparando link..." : linkIndicacao} />
                    </span>
                  </label>
                  {mensagemIndicacao && <div className="painel-2fa__mensagem">{mensagemIndicacao}</div>}
                </>
              )}
              <div className="painel-indicacao-modal__acoes">
                <button className="botao botao--cliente" onClick={() => setModalAtivo("nenhum")} type="button">
                  Agora não
                </button>
                {!indicacaoModalLimite && (
                  <button
                    className="botao botao--primario"
                    disabled={processandoIndicacao || !linkIndicacao}
                    onClick={() => void copiarLinkIndicacao()}
                    type="button"
                  >
                    {linkCopiado ? "Link copiado" : processandoIndicacao ? "Preparando..." : "Copiar link"}
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {modal2faAberto && modalAtivo === "2fa" && (
        <div className="painel-2fa" onClick={dispensarDoisFatores} role="presentation">
          <section
            className={classeModal2fa}
            onClick={(evento) => evento.stopPropagation()}
            aria-label="Ativar verificação em duas etapas"
            role="dialog"
            aria-modal="true"
          >
            {etapa2fa === "convite" && (
              <picture className="painel-2fa__visual" aria-hidden="true">
                <source srcSet="/marca/painel-2fa-netcatbank.avif" type="image/avif" />
                <source srcSet="/marca/painel-2fa-netcatbank.webp" type="image/webp" />
                <img src="/marca/painel-2fa-netcatbank.png" alt="" />
              </picture>
            )}

            <div className="painel-2fa__conteudo">
              {etapa2fa === "convite" && (
                <>
                  <h2>Reforce a segurança da sua conta.</h2>
                  <p>
                    Adicione uma camada extra de proteção ao seu acesso usando a verificação em duas etapas.
                  </p>
                  {mensagem2fa && <div className="painel-2fa__mensagem">{mensagem2fa}</div>}
                  <div className="painel-2fa__acoes">
                    <button className="botao botao--cliente" onClick={dispensarDoisFatores} type="button">
                      Agora não
                    </button>
                    <button className="botao botao--primario" disabled={processando2fa} onClick={prepararDoisFatores} type="button">
                      {processando2fa ? "Preparando..." : "Ativar 2FA"}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}

              {etapa2fa === "qr" && (
                <>
                  <h2>Escaneie o QR e confirme o primeiro código.</h2>
                  <div className="painel-2fa__qr-bloco">
                    <div className="painel-2fa__qr">
                      <div dangerouslySetInnerHTML={{ __html: configuracao2fa?.qrSvg ?? "" }} />
                      <strong>NC Bank</strong>
                    </div>
                    <div>
                      <p>Abra o aplicativo autenticador, toque em adicionar conta e escaneie este QR.</p>
                      <small>Chave manual: {configuracao2fa?.chaveManual}</small>
                    </div>
                  </div>
                  <label className="painel-2fa__codigo">
                    <span>Código de 6 números</span>
                    <input
                      autoCapitalize="off"
                      autoComplete="one-time-code"
                      autoCorrect="off"
                      data-1p-ignore="true"
                      data-form-type="other"
                      data-lpignore="true"
                      data-ncbank-sensivel="true"
                      enterKeyHint="done"
                      inputMode="numeric"
                      maxLength={7}
                      onBeforeInput={bloquearCodigoAutenticadorInvalido}
                      onChange={(evento) => {
                        setCodigo2fa(somenteDigitos(evento.target.value).slice(0, 6));
                        setMensagem2fa("");
                      }}
                      pattern="[0-9 ]{7}"
                      placeholder="000 000"
                      spellCheck={false}
                      value={formatarCodigoAutenticador(codigo2fa)}
                    />
                  </label>
                  {mensagem2fa && <div className="painel-2fa__mensagem">{mensagem2fa}</div>}
                  <div className="painel-2fa__acoes">
                    <button className="botao botao--cliente" onClick={() => setEtapa2fa("convite")} type="button">
                      Voltar
                    </button>
                    <button className="botao botao--primario" disabled={processando2fa} onClick={ativarDoisFatores} type="button">
                      {processando2fa ? "Validando..." : "Confirmar ativação"}
                      <ShieldCheck size={18} />
                    </button>
                  </div>
                </>
              )}

              {etapa2fa === "confirmado" && (
                <div className="painel-2fa__confirmado" role="status">
                  <CheckCircle2 size={42} />
                  <span>2FA ativo</span>
                  <h2>Verificação em duas etapas ativada.</h2>
                  <p>Os próximos acessos ao painel vão exigir o código do aplicativo autenticador.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  FileCheck2,
  Landmark,
  LockKeyhole,
  ShieldCheck
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { urlPainel } from "../configuracao/publica";
import {
  buscarApiNetCat,
  cabecalhosEnvelopeNetCat,
  cabecalhosNetCat,
  criptografarPayloadNetCat
} from "../seguranca/transporte";

type TipoDocumento = "cpf" | "cnpj";
type Etapa =
  | "nome"
  | "documento"
  | "email"
  | "confirmar-email"
  | "termos"
  | "produto"
  | "dados-cnpj"
  | "nascimento"
  | "senha"
  | "confirmar-senha"
  | "boas-vindas";
type ProdutoEscolhido = "credito-conta" | "somente-conta" | "";
type ProdutoAtivo = Exclude<ProdutoEscolhido, "">;
type EstadoConsulta = "vazio" | "consultando" | "disponivel" | "indisponivel" | "bloqueado" | "erro";
type TipoBloqueioTemporario = "documento" | "email" | "fluxo";
type ModoCalendarioNascimento = "dias" | "meses" | "anos";

type DadosAbertura = {
  nomeCompleto: string;
  tipoDocumento: TipoDocumento;
  documento: string;
  email: string;
  emailConfirmacao: string;
  aceitouSistema: boolean;
  aceitouDados: boolean;
  aceitouPrivacidade: boolean;
  produto: ProdutoEscolhido;
  dataNascimento: string;
  senha: string;
  senhaConfirmacao: string;
};

type RespostaVerificacao = {
  estado?: string;
  disponivel?: boolean;
  mensagem?: string;
};

type RespostaCsrf = {
  controle?: {
    csrf?: string;
  };
};

type RespostaApi = {
  estado?: string;
  mensagem?: string;
  abertura?: {
    referencia?: string;
  };
};

type DadosCnpj = {
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

type RespostaConsultaCnpj = {
  cnpj?: DadosCnpj;
  estado?: "ok" | "pendente" | "adiado" | "erro";
  estimativaSegundos?: number;
  mensagem?: string;
};

type EstadoConsultaCnpj = "vazio" | "consultando" | "pendente" | "ok" | "adiado" | "erro";

type CodigoErroCanalSeguro = "csrf" | "transporte" | "criptografia" | "tempo" | "rede";
type ErroCanalSeguro = Error & {
  codigoNetCat?: CodigoErroCanalSeguro;
  status?: number;
};

type PropriedadesFluxoAberturaConta = {
  variante?: "padrao" | "indicacao";
};

const caminhoMarca = "/marca";
const chaveLocal = "netcatbank_nc_abertura_conta_v9t3";
const chaveRateLimit = "netcatbank_nc_rate_abertura_k7m2";
const nomeCookie = "ncbank_netcatbank_abertura_segura_v9t3";
const mensagemInicialMurphy = "Murphy está preparando sua abertura...";
const limiteNomeCompleto = 70;

const etapasCadastro: Etapa[] = [
  "nome",
  "documento",
  "email",
  "confirmar-email",
  "termos",
  "produto"
];

const etapasComplementoCpf: Etapa[] = [
  "nascimento",
  "senha",
  "confirmar-senha",
  "boas-vindas"
];

const etapasComplementoCnpj: Etapa[] = [
  "dados-cnpj",
  "senha",
  "confirmar-senha",
  "boas-vindas"
];

const etapaRotulo: Record<Etapa, string> = {
  nome: "Nome",
  documento: "Documento",
  email: "E-mail",
  "confirmar-email": "Confirmação",
  termos: "Termos",
  produto: "Escolha",
  "dados-cnpj": "Empresa",
  nascimento: "Nascimento",
  senha: "Senha",
  "confirmar-senha": "Confirmação",
  "boas-vindas": "Pronto"
};

const produtoRotulo: Record<ProdutoAtivo, string> = {
  "credito-conta": "Cartão de crédito + conta",
  "somente-conta": "Somente a conta"
};

const mesesCalendario = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];

const diasSemanaCalendario = ["D", "S", "T", "Q", "Q", "S", "S"];

const visualPorEtapa: Record<Etapa, { arquivo: string; alt: string }> = {
  nome: {
    arquivo: "abertura-cartoes-netcatbank",
    alt: "Cartões premium do NetCat Bank com acabamento preto e branco"
  },
  documento: {
    arquivo: "abertura-pagamento-netcatbank",
    alt: "Cartão NetCat Bank sendo aproximado de uma maquininha em um balcão moderno"
  },
  email: {
    arquivo: "abertura-app-netcatbank",
    alt: "Aplicativo bancário escuro com cartão premium do NetCat Bank"
  },
  "confirmar-email": {
    arquivo: "abertura-confirmacao-netcatbank",
    alt: "Confirmação digital do NetCat Bank com celular, envelope e código de segurança"
  },
  termos: {
    arquivo: "abertura-termos-netcatbank",
    alt: "Termos de privacidade do NetCat Bank com celular, cartão e cadeado"
  },
  produto: {
    arquivo: "abertura-logo-final-netcatbank",
    alt: "Marca luminosa do NetCat Bank em ambiente digital premium"
  },
  "dados-cnpj": {
    arquivo: "abertura-app-netcatbank",
    alt: "Dados empresariais protegidos do NetCat Bank"
  },
  nascimento: {
    arquivo: "abertura-nascimento-netcatbank",
    alt: "Calendário escuro com verificação de segurança do NetCat Bank"
  },
  senha: {
    arquivo: "abertura-senha-netcatbank",
    alt: "Cadeado digital e pontos de senha do NetCat Bank"
  },
  "confirmar-senha": {
    arquivo: "abertura-senha-netcatbank",
    alt: "Cadeado digital e pontos de senha do NetCat Bank"
  },
  "boas-vindas": {
    arquivo: "abertura-logo-final-netcatbank",
    alt: "Marca luminosa do NetCat Bank em ambiente digital premium"
  }
};

const dadosIniciais: DadosAbertura = {
  nomeCompleto: "",
  tipoDocumento: "cpf",
  documento: "",
  email: "",
  emailConfirmacao: "",
  aceitouSistema: false,
  aceitouDados: false,
  aceitouPrivacidade: false,
  produto: "",
  dataNascimento: "",
  senha: "",
  senhaConfirmacao: ""
};

const somenteDigitos = (valor: string) => valor.replace(/\D/g, "");

const normalizarNomeCompleto = (valor: string) =>
  valor
    .replace(/[^\p{L}\s'-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, limiteNomeCompleto)
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s'-])(\p{L})/gu, (_, prefixo: string, letra: string) =>
      `${prefixo}${letra.toLocaleUpperCase("pt-BR")}`
    );

const limparEmail = (valor: string) =>
  valor
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/[^\w.!#$%&'*+/=?^`{|}~@-]/g, "")
    .slice(0, 120);

const formatarCpf = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 11);
  return digitos
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
};

const formatarCnpj = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 14);
  return digitos
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
};

const formatarDocumento = (tipo: TipoDocumento, valor: string) =>
  tipo === "cpf" ? formatarCpf(valor) : formatarCnpj(valor);

const todosIguais = (valor: string) => /^(\d)\1+$/.test(valor);

const validarCpf = (valor: string) => {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;

  const calcular = (tamanho: number) => {
    const soma = cpf
      .slice(0, tamanho)
      .split("")
      .reduce((total, numero, indice) => total + Number(numero) * (tamanho + 1 - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcular(9) === Number(cpf[9]) && calcular(10) === Number(cpf[10]);
};

const validarCnpj = (valor: string) => {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;

  const calcular = (tamanho: number) => {
    const pesos =
      tamanho === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = cnpj
      .slice(0, tamanho)
      .split("")
      .reduce((total, numero, indice) => total + Number(numero) * (pesos[indice] ?? 0), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  return calcular(12) === Number(cnpj[12]) && calcular(13) === Number(cnpj[13]);
};

const validarEmail = (valor: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor) && valor.length <= 120;

const validarDataNascimento = (valor: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) return false;

  const hoje = new Date();
  const idade =
    hoje.getUTCFullYear() -
    data.getUTCFullYear() -
    (hoje.getUTCMonth() < data.getUTCMonth() ||
    (hoje.getUTCMonth() === data.getUTCMonth() && hoje.getUTCDate() < data.getUTCDate())
      ? 1
      : 0);

  return idade >= 18 && idade <= 120;
};

const senhasSequenciais = new Set([
  "012345",
  "123456",
  "234567",
  "345678",
  "456789",
  "024680",
  "135790",
  "987654",
  "876543",
  "765432",
  "654321",
  "543210",
  "975310",
  "086420",
  "102030",
  "010203",
  "112233",
  "332211",
  "121212",
  "101010",
  "202020",
  "123123",
  "321321"
]);

const dataIsoParaDate = (valor: string) => {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return null;
  const data = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  return Number.isNaN(data.getTime()) ? null : data;
};

const formatarDataIso = (data: Date) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const dataMaximaNascimento = () => {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setFullYear(data.getFullYear() - 18);
  return data;
};

const dataMinimaNascimento = () => {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setFullYear(data.getFullYear() - 120);
  return data;
};

const formatarDataApresentacao = (valor: string) => {
  const data = dataIsoParaDate(valor);
  return data ? data.toLocaleDateString("pt-BR") : "";
};

const formatarDataDigitada = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 8);
  return digitos
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
};

const dataDigitadaParaIso = (valor: string) => {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 8) return "";

  const dia = Number(digitos.slice(0, 2));
  const mes = Number(digitos.slice(2, 4));
  const ano = Number(digitos.slice(4, 8));
  const data = new Date(ano, mes - 1, dia);

  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return "";
  }

  return formatarDataIso(data);
};

const senhaUsaDataNascimento = (senha: string, dataNascimento: string) => {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataNascimento);
  if (!partes) return false;
  const [, ano = "", mes = "", dia = ""] = partes;
  const anoCurto = ano.slice(2);
  return [
    `${dia}${mes}${anoCurto}`,
    `${anoCurto}${mes}${dia}`,
    `${mes}${dia}${anoCurto}`,
    `${dia}${anoCurto}${mes}`
  ].includes(senha);
};

const possuiSequenciaAritmetica = (senha: string) => {
  const numeros = senha.split("").map(Number);
  const diferencas = numeros.slice(1).map((numero, indice) => numero - (numeros[indice] ?? 0));
  const primeiraDiferenca = diferencas[0] ?? 99;
  return diferencas.every((diferenca) => diferenca === primeiraDiferenca) && Math.abs(primeiraDiferenca) <= 2;
};

const possuiParesPrevisiveis = (senha: string) => {
  const [primeiroPar = 0, segundoPar = 0, terceiroPar = 0] = [
    senha.slice(0, 2),
    senha.slice(2, 4),
    senha.slice(4, 6)
  ].map(Number);
  const primeiraDiferenca = segundoPar - primeiroPar;
  const segundaDiferenca = terceiroPar - segundoPar;
  return primeiraDiferenca === segundaDiferenca && Math.abs(primeiraDiferenca) <= 12;
};

const validarSenhaNumerica = (valor: string, dataNascimento = "") => {
  const senha = somenteDigitos(valor);
  if (!/^\d{6}$/.test(senha)) return false;
  if (/^(\d)\1{5}$/.test(senha)) return false;
  if (senhasSequenciais.has(senha)) return false;
  if (/^(\d{2})\1{2}$/.test(senha)) return false;
  if (/^(\d{3})\1$/.test(senha)) return false;
  if (possuiSequenciaAritmetica(senha)) return false;
  if (possuiParesPrevisiveis(senha)) return false;
  if (senhaUsaDataNascimento(senha, dataNascimento)) return false;
  return true;
};

const obterSaudacaoBrasilia = () => {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo"
    }).format(new Date())
  );

  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
};

const gerarProtocolo = () => {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const sufixo = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `NCB-${new Date().getFullYear()}-${sufixo}`;
};

const bloquearNomeInvalido = (evento: React.FormEvent<HTMLInputElement>) => {
  const texto = (evento.nativeEvent as InputEvent).data;
  if (texto && !/^[\p{L}\s'-]+$/u.test(texto)) {
    evento.preventDefault();
  }
};

const bloquearDigitoInvalido = (evento: React.FormEvent<HTMLInputElement>) => {
  const texto = (evento.nativeEvent as InputEvent).data;
  if (texto && !/^\d+$/.test(texto)) {
    evento.preventDefault();
  }
};

const lerTentativas = () => {
  try {
    return JSON.parse(localStorage.getItem(chaveRateLimit) ?? "{}") as Record<string, number[]>;
  } catch {
    return {};
  }
};

const registrarTentativa = (acao: string, maximo: number, janelaMs = 5_000) => {
  const agora = Date.now();
  const tentativas = lerTentativas();
  const atuais = (tentativas[acao] ?? []).filter((tempo) => agora - tempo < janelaMs);

  if (atuais.length >= maximo) {
    const primeiraTentativa = atuais[0] ?? agora;
    const restanteMs = janelaMs - (agora - primeiraTentativa);
    return {
      liberado: false,
      segundos: Math.max(1, Math.ceil(restanteMs / 1000))
    };
  }

  tentativas[acao] = [...atuais, agora];
  localStorage.setItem(chaveRateLimit, JSON.stringify(tentativas));
  return { liberado: true, segundos: 0 };
};

const criarErroCanalSeguro = (
  codigoNetCat: CodigoErroCanalSeguro,
  mensagem: string,
  status?: number
) => {
  const erro = new Error(mensagem) as ErroCanalSeguro;
  erro.codigoNetCat = codigoNetCat;
  erro.status = status;
  return erro;
};

const erroCanalSeguro = (erro: unknown) => erro as ErroCanalSeguro;

const mensagemCanalSeguro = (erro: unknown) => {
  const falha = erroCanalSeguro(erro);

  if (falha.name === "AbortError" || falha.codigoNetCat === "tempo") {
    return "A verificação demorou mais que o esperado. Tente novamente em instantes.";
  }

  if (falha.codigoNetCat === "csrf") {
    return "A sessão segura não foi confirmada. Atualize a página e tente novamente.";
  }

  if (falha.codigoNetCat === "transporte" || falha.message === "transporte") {
    return "Não consegui abrir o canal criptografado com a API agora.";
  }

  if (falha.codigoNetCat === "criptografia") {
    return "Seu navegador não concluiu a criptografia local desta etapa.";
  }

  return "Não consegui alcançar o NC Bank. Verifique a conexão e tente novamente.";
};

const obterCsrf = async () => {
  try {
    const resposta = await buscarApiNetCat("/seguranca/csrf", {
      cache: "no-store",
      credentials: "include",
      headers: await cabecalhosNetCat("csrf-publico")
    });
    const conteudo = (await resposta.json().catch(() => null)) as (RespostaCsrf & RespostaApi) | null;
    if (!resposta.ok || !conteudo?.controle?.csrf) {
      throw criarErroCanalSeguro(
        "csrf",
        conteudo?.mensagem ?? "csrf",
        resposta.status
      );
    }
    return conteudo.controle.csrf;
  } catch (erro) {
    if (erroCanalSeguro(erro).codigoNetCat) throw erro;
    throw criarErroCanalSeguro("rede", "csrf");
  }
};

export function FluxoAberturaConta({ variante = "padrao" }: PropriedadesFluxoAberturaConta) {
  const [dados, setDados] = useState<DadosAbertura>(dadosIniciais);
  const [etapa, setEtapa] = useState<Etapa>("nome");
  const [introConcluida, setIntroConcluida] = useState(false);
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [saudacao, setSaudacao] = useState("Olá");
  const [textoMurphy, setTextoMurphy] = useState(mensagemInicialMurphy);
  const [erros, setErros] = useState<string[]>([]);
  const [consultaDocumento, setConsultaDocumento] = useState<EstadoConsulta>("vazio");
  const [consultaEmail, setConsultaEmail] = useState<EstadoConsulta>("vazio");
  const [mensagemConsulta, setMensagemConsulta] = useState("");
  const [bloqueioTemporario, setBloqueioTemporario] = useState<{
    tipo: TipoBloqueioTemporario;
    terminaEm: number;
  } | null>(null);
  const [segundosBloqueio, setSegundosBloqueio] = useState(0);
  const [produtoPendente, setProdutoPendente] = useState<ProdutoAtivo | "">("");
  const [processandoApi, setProcessandoApi] = useState(false);
  const [referenciaAbertura, setReferenciaAbertura] = useState("");
  const [transicaoComplemento, setTransicaoComplemento] = useState(false);
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [modoCalendario, setModoCalendario] = useState<ModoCalendarioNascimento>("dias");
  const [textoDataNascimento, setTextoDataNascimento] = useState("");
  const [dadosCnpj, setDadosCnpj] = useState<DadosCnpj | null>(null);
  const [estadoConsultaCnpj, setEstadoConsultaCnpj] = useState<EstadoConsultaCnpj>("vazio");
  const [estimativaCnpj, setEstimativaCnpj] = useState(0);
  const [mensagemCnpj, setMensagemCnpj] = useState("");
  const [mesCalendario, setMesCalendario] = useState(() => {
    const data = dataMaximaNascimento();
    data.setDate(1);
    return data;
  });
  const campoAtual = useRef<HTMLInputElement>(null);
  const temporizadorTransicao = useRef<number | null>(null);
  const temporizadorCnpj = useRef<number | null>(null);
  const inicioConsultaCnpj = useRef<number | null>(null);
  const consultaCnpjEmAndamento = useRef(false);
  const ultimaConsulta = useRef<Record<string, EstadoConsulta>>({});

  const etapaCadastro = etapasCadastro.includes(etapa);
  const etapasComplemento = dados.tipoDocumento === "cnpj" ? etapasComplementoCnpj : etapasComplementoCpf;
  const etapasGrupo = etapaCadastro ? etapasCadastro : etapasComplemento;
  const indiceEtapaGrupo = etapasGrupo.indexOf(etapa);
  const fluxoIndicacao = variante === "indicacao";
  const faseRotulo = etapaCadastro
    ? fluxoIndicacao
      ? "Cadastro pelo convite"
      : "Cadastro inicial"
    : "Complemento seguro";
  const visual = visualPorEtapa[etapa];
  const primeiroNome = dados.nomeCompleto.trim().split(" ")[0] || "cliente";
  const documentoValido =
    dados.tipoDocumento === "cpf" ? validarCpf(dados.documento) : validarCnpj(dados.documento);
  const emailValido = validarEmail(dados.email);
  const diasCalendario = useMemo(() => {
    const primeiroDia = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), 1);
    const totalDias = new Date(mesCalendario.getFullYear(), mesCalendario.getMonth() + 1, 0).getDate();
    const dias: Array<Date | null> = Array.from({ length: primeiroDia.getDay() }, () => null);

    for (let dia = 1; dia <= totalDias; dia += 1) {
      dias.push(new Date(mesCalendario.getFullYear(), mesCalendario.getMonth(), dia));
    }

    while (dias.length % 7 !== 0) dias.push(null);
    return dias;
  }, [mesCalendario]);
  const minimoNascimento = dataMinimaNascimento();
  const maximoNascimento = dataMaximaNascimento();
  const anosCalendario = useMemo(() => {
    const anoMinimo = minimoNascimento.getFullYear();
    const anoMaximo = maximoNascimento.getFullYear();
    return Array.from({ length: anoMaximo - anoMinimo + 1 }, (_, indice) => anoMaximo - indice);
  }, [maximoNascimento, minimoNascimento]);

  const mensagemMurphy = useMemo(() => {
    if (!introConcluida) {
      return "Eu sou Murphy, assistente do NC Bank. Vou conduzir sua abertura com segurança e pedir algumas informações.";
    }
    if (transicaoComplemento) {
      return `${primeiroNome}, sua conta foi reservada. Falta só mais algumas informações para completar seu acesso.`;
    }
    if (etapa === "nome") {
      return "Para começar, digite seu nome completo exatamente como você usa nos documentos.";
    }
    if (etapa === "documento") {
      return `Perfeito, ${primeiroNome}. Agora preciso do seu documento para localizar seu cadastro e seguir com a abertura da conta.`;
    }
    if (etapa === "email") {
      return `${primeiroNome}, informe um e-mail que você utiliza.`;
    }
    if (etapa === "confirmar-email") {
      return "Ótimo. Repita o e-mail para confirmar que está tudo certo antes de continuar.";
    }
    if (etapa === "termos") {
      return `${primeiroNome}, Falta aceitar os Termos de Uso, o Tratamento de Dados e a Política de Privacidade para concluir a preparação da sua conta.`;
    }
    if (etapa === "produto") {
      return `Tudo certo, ${primeiroNome}. Sua abertura está pronta para escolha: conta completa com cartão por análise ou somente a conta NC Bank.`;
    }
    if (etapa === "dados-cnpj") {
      return `${primeiroNome}, vou conferir os dados públicos da empresa para você confirmar antes de continuar.`;
    }
    if (etapa === "nascimento") {
      return `${primeiroNome}, a conta já foi reservada. Agora preciso da sua data de nascimento para concluir a análise cadastral.`;
    }
    if (etapa === "senha") {
      return "Escolha uma senha de 6 números. Evite sequências, repetições e datas óbvias.";
    }
    if (etapa === "confirmar-senha") {
      return "Confirme sua senha. Depois disso, você poderá acessar sua conta no NC Bank.";
    }
    return `Bem-vindo ao NC Bank, ${primeiroNome}. Sua conta foi preparada e o painel seguro está abrindo.`;
  }, [etapa, introConcluida, primeiroNome, saudacao, transicaoComplemento]);

  useEffect(() => {
    setSaudacao(obterSaudacaoBrasilia());
    const protocoloGerado = gerarProtocolo();
    setProtocolo(protocoloGerado);
    localStorage.setItem(
      chaveLocal,
      JSON.stringify({
        etapa: "nome",
        protocolo: protocoloGerado,
        iniciadoEm: new Date().toISOString()
      })
    );
    document.cookie = `${nomeCookie}=fluxo_ativo; Path=/; SameSite=Strict; Secure; Max-Age=1800`;
  }, []);

  useEffect(() => {
    if (!protocolo) return;
    localStorage.setItem(
      chaveLocal,
      JSON.stringify({
        etapa,
        fase: etapaCadastro ? "cadastro" : "complemento",
        protocolo,
        produto: dados.produto || undefined,
        termosAceitos:
          dados.aceitouSistema && dados.aceitouDados && dados.aceitouPrivacidade
            ? "completo"
            : undefined,
        atualizadoEm: new Date().toISOString()
      })
    );
  }, [
    dados.aceitouDados,
    dados.aceitouPrivacidade,
    dados.aceitouSistema,
    dados.produto,
    etapa,
    etapaCadastro,
    protocolo
  ]);

  useEffect(() => {
    setTextoMurphy("");
    let indice = 0;
    let finalizador: number | undefined;
    const temporizador = window.setInterval(() => {
      indice += 1;
      setTextoMurphy(mensagemMurphy.slice(0, indice));
      if (indice >= mensagemMurphy.length) {
        window.clearInterval(temporizador);
        if (!introConcluida) {
          finalizador = window.setTimeout(() => setIntroConcluida(true), 3400);
        }
      }
    }, 20);

    return () => {
      window.clearInterval(temporizador);
      if (finalizador) window.clearTimeout(finalizador);
    };
  }, [introConcluida, mensagemMurphy]);

  useEffect(
    () => () => {
      if (temporizadorTransicao.current) {
        window.clearTimeout(temporizadorTransicao.current);
      }
      if (temporizadorCnpj.current) {
        window.clearTimeout(temporizadorCnpj.current);
      }
    },
    []
  );

  useEffect(() => {
    setTentouAvancar(false);
    setErros([]);
    setMensagemConsulta("");
    setCalendarioAberto(false);
    window.setTimeout(() => campoAtual.current?.focus(), 120);
  }, [etapa]);

  useEffect(() => {
    if (!bloqueioTemporario) return;

    const atualizarBloqueio = () => {
      const restante = Math.max(0, Math.ceil((bloqueioTemporario.terminaEm - Date.now()) / 1000));
      setSegundosBloqueio(restante);

      if (restante <= 0) {
        if (bloqueioTemporario.tipo === "documento") setConsultaDocumento("vazio");
        if (bloqueioTemporario.tipo === "email") setConsultaEmail("vazio");
        setBloqueioTemporario(null);
        setMensagemConsulta("");
        setErros([]);
      }
    };

    atualizarBloqueio();
    const temporizador = window.setInterval(atualizarBloqueio, 250);
    return () => window.clearInterval(temporizador);
  }, [bloqueioTemporario]);

  const iniciarBloqueioTemporario = (tipo: TipoBloqueioTemporario, segundos: number) => {
    const duracao = Math.max(1, Math.min(segundos, 5));
    setSegundosBloqueio(duracao);
    setBloqueioTemporario({
      tipo,
      terminaEm: Date.now() + duracao * 1000
    });
  };

  const atualizar = <Campo extends keyof DadosAbertura>(campo: Campo, valor: DadosAbertura[Campo]) => {
    setDados((estadoAtual) => ({
      ...estadoAtual,
      [campo]: valor
    }));
  };

  const trocarTipoDocumento = (tipoDocumento: TipoDocumento) => {
    setDados((estadoAtual) => ({
      ...estadoAtual,
      tipoDocumento,
      documento: ""
    }));
    setDadosCnpj(null);
    setEstadoConsultaCnpj("vazio");
    setEstimativaCnpj(0);
    setMensagemCnpj("");
    inicioConsultaCnpj.current = null;
    consultaCnpjEmAndamento.current = false;
    if (temporizadorCnpj.current) {
      window.clearTimeout(temporizadorCnpj.current);
      temporizadorCnpj.current = null;
    }
    setConsultaDocumento("vazio");
    setMensagemConsulta("");
    ultimaConsulta.current = {};
  };

  const validarNomeCompleto = () => {
    const partes = dados.nomeCompleto
      .trim()
      .split(" ")
      .filter((parte) => parte.length >= 2);
    return partes.length >= 2;
  };

  const registrarResultadoConsulta = (
    tipo: "documento" | "email",
    chaveConsulta: string,
    disponivel: boolean
  ) => {
    const novoEstado: EstadoConsulta = disponivel ? "disponivel" : "indisponivel";
    ultimaConsulta.current[chaveConsulta] = novoEstado;

    if (tipo === "documento") setConsultaDocumento(novoEstado);
    if (tipo === "email") setConsultaEmail(novoEstado);
    setMensagemConsulta(
      disponivel
        ? tipo === "documento"
          ? "Documento validado."
          : "E-mail validado."
        : "Não foi possível continuar com essa informação."
    );
    return disponivel;
  };

  const consultarDisponibilidade = async (tipo: "documento" | "email") => {
    const valor =
      tipo === "documento" ? somenteDigitos(dados.documento) : dados.email.trim().toLowerCase();
    const chaveConsulta = `${tipo}:${valor}`;
    const estadoCache = ultimaConsulta.current[chaveConsulta];

    if (estadoCache === "disponivel") return registrarResultadoConsulta(tipo, chaveConsulta, true);
    if (estadoCache === "indisponivel") return registrarResultadoConsulta(tipo, chaveConsulta, false);

    const limite = registrarTentativa(`consulta-${tipo}`, 8);
    if (!limite.liberado) {
      if (tipo === "documento") setConsultaDocumento("bloqueado");
      if (tipo === "email") setConsultaEmail("bloqueado");
      setMensagemConsulta("");
      iniciarBloqueioTemporario(tipo, limite.segundos);
      return false;
    }

    if (tipo === "documento") setConsultaDocumento("consultando");
    if (tipo === "email") setConsultaEmail("consultando");
    setMensagemConsulta("Consultando disponibilidade com segurança...");
    const controlador = new AbortController();
    const limiteTempo = window.setTimeout(() => controlador.abort(), 4500);

    try {
      const csrf = await obterCsrf();
      let corpoSeguro;

      try {
        corpoSeguro = await criptografarPayloadNetCat({
          tipo,
          tipoDocumento: dados.tipoDocumento,
          valor
        }, {
          csrf,
          fluxo: "abertura-conta",
          rota: "/abertura/verificacao"
        });
      } catch (erro) {
        if (erroCanalSeguro(erro).message === "transporte") {
          throw criarErroCanalSeguro("transporte", "transporte");
        }

        throw criarErroCanalSeguro("criptografia", "criptografia");
      }

      const resposta = await buscarApiNetCat("/abertura/verificacao", {
        method: "POST",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "abertura-conta",
          rota: "/abertura/verificacao"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro),
        cache: "no-store",
        credentials: "include",
        signal: controlador.signal
      });

      if (!resposta.ok) {
        if (resposta.status === 429) {
          if (tipo === "documento") setConsultaDocumento("bloqueado");
          if (tipo === "email") setConsultaEmail("bloqueado");
          setMensagemConsulta("");
          iniciarBloqueioTemporario(tipo, 5);
          return false;
        }

        const conteudoErro = (await resposta.json().catch(() => null)) as RespostaVerificacao | null;
        if (tipo === "documento") setConsultaDocumento("erro");
        if (tipo === "email") setConsultaEmail("erro");
        setMensagemConsulta(
          conteudoErro?.mensagem ?? "A verificação recusou os dados informados. Confira e tente novamente."
        );
        return false;
      }

      const conteudo = (await resposta.json()) as RespostaVerificacao;
      return registrarResultadoConsulta(tipo, chaveConsulta, conteudo.disponivel === true);
    } catch (erro) {
      if (tipo === "documento") setConsultaDocumento("erro");
      if (tipo === "email") setConsultaEmail("erro");
      setMensagemConsulta(mensagemCanalSeguro(erro));
      return false;
    } finally {
      window.clearTimeout(limiteTempo);
    }
  };

  const iniciarAberturaApi = async () => {
    setProcessandoApi(true);
    setMensagemConsulta("Reservando sua abertura no ambiente seguro...");

    try {
      const csrf = await obterCsrf();
      const corpoSeguro = await criptografarPayloadNetCat({
        nomeCompleto: dados.nomeCompleto,
        tipoDocumento: dados.tipoDocumento,
        documento: somenteDigitos(dados.documento),
        email: dados.email,
        emailConfirmacao: dados.emailConfirmacao,
        aceitouSistema: dados.aceitouSistema,
        aceitouDados: dados.aceitouDados,
        aceitouPrivacidade: dados.aceitouPrivacidade,
        produto: dados.produto
      }, {
        csrf,
        fluxo: "abertura-conta",
        rota: "/abertura/iniciar"
      });
      const resposta = await buscarApiNetCat("/abertura/iniciar", {
        method: "POST",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "abertura-conta",
          rota: "/abertura/iniciar"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro),
        cache: "no-store",
        credentials: "include"
      });
      const conteudo = (await resposta.json().catch(() => null)) as RespostaApi | null;

      if (!resposta.ok || conteudo?.estado !== "ok") {
        setErros([conteudo?.mensagem ?? "Não foi possível reservar sua abertura agora."]);
        setMensagemConsulta("");
        return false;
      }

      setReferenciaAbertura(conteudo.abertura?.referencia ?? "");
      setMensagemConsulta("");
      return true;
    } catch {
      setErros(["Não foi possível conectar ao ambiente seguro agora."]);
      setMensagemConsulta("");
      return false;
    } finally {
      setProcessandoApi(false);
    }
  };

  const limparTemporizadorConsultaCnpj = () => {
    if (temporizadorCnpj.current) {
      window.clearTimeout(temporizadorCnpj.current);
      temporizadorCnpj.current = null;
    }
  };

  const consultarDadosCnpj = async () => {
    if (dados.tipoDocumento !== "cnpj" || consultaCnpjEmAndamento.current) return;
    if (!inicioConsultaCnpj.current) inicioConsultaCnpj.current = Date.now();

    if (Date.now() - inicioConsultaCnpj.current >= 120_000) {
      limparTemporizadorConsultaCnpj();
      setEstadoConsultaCnpj("adiado");
      setEstimativaCnpj(0);
      setMensagemCnpj("Vamos finalizar essa conferência depois. Você pode continuar.");
      return;
    }

    consultaCnpjEmAndamento.current = true;
    limparTemporizadorConsultaCnpj();
    setEstadoConsultaCnpj("consultando");
    setMensagemCnpj("Conferindo dados cadastrais da empresa...");

    try {
      const csrf = await obterCsrf();
      const corpoSeguro = await criptografarPayloadNetCat({
        documento: somenteDigitos(dados.documento)
      }, {
        csrf,
        fluxo: "abertura-conta",
        rota: "/abertura/cnpj/consulta"
      });
      const resposta = await buscarApiNetCat("/abertura/cnpj/consulta", {
        method: "POST",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "abertura-conta",
          rota: "/abertura/cnpj/consulta"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro),
        cache: "no-store",
        credentials: "include"
      });
      const conteudo = (await resposta.json().catch(() => null)) as RespostaConsultaCnpj | null;

      if (resposta.status === 202 && conteudo?.estado === "pendente") {
        const segundos = Math.max(3, Math.min(Number(conteudo.estimativaSegundos ?? 8), 120));
        const decorrido = Date.now() - (inicioConsultaCnpj.current ?? Date.now());
        if (decorrido >= 120_000) {
          setEstadoConsultaCnpj("adiado");
          setEstimativaCnpj(0);
          setMensagemCnpj("Vamos finalizar essa conferência depois. Você pode continuar.");
          return;
        }

        setEstadoConsultaCnpj("pendente");
        setEstimativaCnpj(segundos);
        setMensagemCnpj("Estamos preparando a conferência cadastral.");
        temporizadorCnpj.current = window.setTimeout(
          () => void consultarDadosCnpj(),
          Math.max(4_000, Math.min(segundos * 1000, 10_000))
        );
        return;
      }

      if (resposta.ok && conteudo?.estado === "ok" && conteudo.cnpj) {
        limparTemporizadorConsultaCnpj();
        setDadosCnpj(conteudo.cnpj);
        setEstadoConsultaCnpj("ok");
        setEstimativaCnpj(0);
        setMensagemCnpj("");
        inicioConsultaCnpj.current = null;
        return;
      }

      if (resposta.ok && conteudo?.estado === "adiado") {
        limparTemporizadorConsultaCnpj();
        setEstadoConsultaCnpj("adiado");
        setEstimativaCnpj(0);
        setMensagemCnpj("Vamos finalizar essa conferência depois. Você pode continuar.");
        inicioConsultaCnpj.current = null;
        return;
      }

      limparTemporizadorConsultaCnpj();
      setEstadoConsultaCnpj("erro");
      setMensagemCnpj(conteudo?.mensagem ?? "Não foi possível conferir os dados agora.");
    } catch {
      limparTemporizadorConsultaCnpj();
      setEstadoConsultaCnpj("erro");
      setMensagemCnpj("Não foi possível conferir os dados agora.");
    } finally {
      consultaCnpjEmAndamento.current = false;
    }
  };

  const cancelarAberturaEReiniciar = async () => {
    setProcessandoApi(true);

    try {
      const csrf = await obterCsrf();
      const corpoSeguro = await criptografarPayloadNetCat({}, {
        csrf,
        fluxo: "abertura-conta",
        rota: "/abertura/cancelar"
      });
      await buscarApiNetCat("/abertura/cancelar", {
        method: "POST",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "abertura-conta",
          rota: "/abertura/cancelar"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro),
        cache: "no-store",
        credentials: "include"
      });
    } finally {
      window.location.assign(window.location.pathname || "/");
    }
  };

  useEffect(() => {
    if (etapa !== "dados-cnpj" || dados.tipoDocumento !== "cnpj") {
      inicioConsultaCnpj.current = null;
      consultaCnpjEmAndamento.current = false;
      limparTemporizadorConsultaCnpj();
      return;
    }

    if (estadoConsultaCnpj === "vazio") {
      inicioConsultaCnpj.current = Date.now();
      void consultarDadosCnpj();
      return;
    }

    if (estadoConsultaCnpj !== "pendente") return;

    const intervalo = window.setInterval(() => {
      setEstimativaCnpj((valorAtual) => Math.max(0, valorAtual - 1));
    }, 1000);
    temporizadorCnpj.current = window.setTimeout(() => {
      void consultarDadosCnpj();
    }, Math.max(4_000, Math.min(estimativaCnpj * 1000, 10_000)));

    return () => {
      window.clearInterval(intervalo);
    };
  }, [dados.tipoDocumento, estadoConsultaCnpj, etapa]);

  const concluirComplementoApi = async () => {
    setProcessandoApi(true);
    setMensagemConsulta("Concluindo sua abertura com segurança...");

    try {
      const csrf = await obterCsrf();
      const corpoSeguro = await criptografarPayloadNetCat({
        dataNascimento: dados.dataNascimento,
        senha: dados.senha,
        senhaConfirmacao: dados.senhaConfirmacao
      }, {
        csrf,
        fluxo: "abertura-conta",
        rota: "/abertura/complemento"
      });
      const resposta = await buscarApiNetCat("/abertura/complemento", {
        method: "POST",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "abertura-conta",
          rota: "/abertura/complemento"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro),
        cache: "no-store",
        credentials: "include"
      });
      const conteudo = (await resposta.json().catch(() => null)) as RespostaApi | null;

      if (!resposta.ok || conteudo?.estado !== "ok") {
        setErros([conteudo?.mensagem ?? "Não foi possível concluir a abertura agora."]);
        setMensagemConsulta("");
        return false;
      }

      setMensagemConsulta("");
      return true;
    } catch {
      setErros(["Não foi possível concluir a abertura neste momento."]);
      setMensagemConsulta("");
      return false;
    } finally {
      setProcessandoApi(false);
    }
  };

  const errosDaEtapa = () => {
    if (etapa === "nome" && !validarNomeCompleto()) {
      return ["Digite seu nome completo com pelo menos nome e sobrenome."];
    }
    if (etapa === "documento" && !documentoValido) {
      return [`Informe um ${dados.tipoDocumento === "cpf" ? "CPF" : "CNPJ"} válido.`];
    }
    if (etapa === "email" && !emailValido) {
      return ["Informe um e-mail válido."];
    }
    if (etapa === "confirmar-email" && dados.emailConfirmacao !== dados.email) {
      return ["A confirmação precisa ser igual ao e-mail informado."];
    }
    if (
      etapa === "termos" &&
      (!dados.aceitouSistema || !dados.aceitouDados || !dados.aceitouPrivacidade)
    ) {
      return ["Aceite os termos do sistema, tratamento de dados e política de privacidade."];
    }
    if (etapa === "produto" && !dados.produto) {
      return ["Escolha uma opção para preparar seu acesso."];
    }
    if (
      etapa === "dados-cnpj" &&
      estadoConsultaCnpj !== "ok" &&
      estadoConsultaCnpj !== "adiado"
    ) {
      return [
        estadoConsultaCnpj === "erro"
          ? "Não foi possível conferir os dados da empresa agora."
          : "Aguarde a conferência dos dados da empresa."
      ];
    }
    if (etapa === "nascimento" && !validarDataNascimento(dados.dataNascimento)) {
      return ["Informe uma data de nascimento válida para continuar."];
    }
    if (etapa === "senha" && !validarSenhaNumerica(dados.senha, dados.dataNascimento)) {
      return ["Use 6 números sem sequência, repetição, pares previsíveis ou data de nascimento."];
    }
    if (etapa === "confirmar-senha" && dados.senhaConfirmacao !== dados.senha) {
      return ["A confirmação precisa ser igual à senha escolhida."];
    }
    return [];
  };

  const avancar = async () => {
    const limite = registrarTentativa("avanco-fluxo", 40);
    if (!limite.liberado) {
      setErros([]);
      iniciarBloqueioTemporario("fluxo", limite.segundos);
      setTentouAvancar(true);
      return;
    }

    const errosAtuais = errosDaEtapa();
    setTentouAvancar(true);
    setErros(errosAtuais);
    if (errosAtuais.length > 0) return;

    if (etapa === "documento" && !(await consultarDisponibilidade("documento"))) return;
    if (etapa === "email" && !(await consultarDisponibilidade("email"))) return;

    if (etapa === "produto") {
      if (!(await iniciarAberturaApi())) return;
      setTransicaoComplemento(true);
      temporizadorTransicao.current = window.setTimeout(() => {
        setTransicaoComplemento(false);
        setEtapa(dados.tipoDocumento === "cnpj" ? "dados-cnpj" : "nascimento");
      }, 10_500);
      return;
    }

    if (etapa === "confirmar-senha") {
      if (!(await concluirComplementoApi())) return;
      setEtapa("boas-vindas");
      window.setTimeout(() => window.location.assign(urlPainel), 1900);
      return;
    }

    if (etapa === "boas-vindas") {
      window.location.assign(urlPainel);
      return;
    }

    const proximaEtapa = etapasGrupo[indiceEtapaGrupo + 1];
    if (proximaEtapa) setEtapa(proximaEtapa);
  };

  const voltar = () => {
    if (indiceEtapaGrupo === 0) return;
    const etapaAnterior = etapasGrupo[indiceEtapaGrupo - 1];
    if (etapaAnterior) setEtapa(etapaAnterior);
  };

  const selecionarProduto = (produto: ProdutoAtivo) => {
    if (!dados.produto || dados.produto === produto) {
      atualizar("produto", produto);
      setTentouAvancar(false);
      setErros([]);
      return;
    }

    setProdutoPendente(produto);
  };

  const confirmarTrocaProduto = () => {
    if (produtoPendente) {
      atualizar("produto", produtoPendente);
      setTentouAvancar(false);
      setErros([]);
    }
    setProdutoPendente("");
  };

  const abrirCalendarioNascimento = () => {
    const dataSelecionada = dataIsoParaDate(dados.dataNascimento);
    const dataBase = dataSelecionada ?? dataMaximaNascimento();
    dataBase.setDate(1);
    setMesCalendario(dataBase);
    setModoCalendario("dias");
    setCalendarioAberto((valorAtual) => !valorAtual);
  };

  const atualizarDataNascimentoDigitada = (valor: string) => {
    const dataFormatada = formatarDataDigitada(valor);
    const dataIso = dataDigitadaParaIso(dataFormatada);
    setTextoDataNascimento(dataFormatada);
    atualizar("dataNascimento", dataIso);

    const dataSelecionada = dataIsoParaDate(dataIso);
    if (dataSelecionada) {
      dataSelecionada.setDate(1);
      setMesCalendario(dataSelecionada);
    }
  };

  const moverMesCalendario = (direcao: -1 | 1) => {
    setMesCalendario((dataAtual) => new Date(dataAtual.getFullYear(), dataAtual.getMonth() + direcao, 1));
  };

  const selecionarMesNascimento = (mes: number) => {
    setMesCalendario((dataAtual) => new Date(dataAtual.getFullYear(), mes, 1));
    setModoCalendario("dias");
  };

  const selecionarAnoNascimento = (ano: number) => {
    setMesCalendario((dataAtual) => new Date(ano, dataAtual.getMonth(), 1));
    setModoCalendario("meses");
  };

  const selecionarDataNascimento = (data: Date) => {
    const dataIso = formatarDataIso(data);
    atualizar("dataNascimento", dataIso);
    setTextoDataNascimento(formatarDataApresentacao(dataIso));
    setCalendarioAberto(false);
  };

  const dataSelecionadaNascimento = dataIsoParaDate(dados.dataNascimento);

  const etapaComConsulta = etapa === "documento" || etapa === "email";
  const statusConsulta: EstadoConsulta =
    etapa === "documento" ? consultaDocumento : etapa === "email" ? consultaEmail : "vazio";
  const estaConsultando = etapaComConsulta && statusConsulta === "consultando";
  const mensagemConsultaVisivel = etapaComConsulta
    ? bloqueioTemporario?.tipo === "documento" || bloqueioTemporario?.tipo === "email"
      ? `Muitas verificações em sequência. Aguarde ${segundosBloqueio}s para tentar novamente.`
      : mensagemConsulta
    : "";
  const errosVisiveis =
    bloqueioTemporario?.tipo === "fluxo"
      ? [`Muitas tentativas no fluxo. Aguarde ${segundosBloqueio}s para continuar.`]
      : erros;
  const errosProduto = etapa === "produto" ? errosVisiveis : [];
  const temErroProduto = tentouAvancar && errosProduto.length > 0;
  const errosGlobais = etapa === "produto" ? [] : errosVisiveis;
  const cnpjEmEspera =
    etapa === "dados-cnpj" &&
    (estadoConsultaCnpj === "consultando" || estadoConsultaCnpj === "pendente" || estadoConsultaCnpj === "vazio");

  return (
    <main
      className={`abertura ${fluxoIndicacao ? "abertura--indicacao" : ""} ${
        introConcluida ? (transicaoComplemento ? "abertura--pausa" : `abertura--${etapa}`) : "abertura--intro"
      }`}
      data-tela-segura="abertura-conta"
    >
      <section className="abertura__painel" aria-label="Abertura guiada de conta NetCat Bank">
        {(!introConcluida || transicaoComplemento) && (
          <div className="abertura__intro" aria-live="polite">
            <span>Murphy</span>
            {!introConcluida && <strong>{saudacao}</strong>}
            <p>{textoMurphy}</p>
            {transicaoComplemento && (
              <div className="abertura__intro-barra" aria-hidden="true">
                <i />
              </div>
            )}
          </div>
        )}

        {introConcluida && !transicaoComplemento && (
          <>
        <div className="abertura__conteudo">
          <div className="abertura__marca">
            <img src={`${caminhoMarca}/logo-netcatbank.webp`} alt="NetCat Bank" />
            <div>
              <span>NC Bank</span>
              <strong>Conta digital</strong>
            </div>
          </div>

          <div className="abertura__assistente" aria-live="polite">
            <span className="abertura__avatar">Murphy</span>
            <p>{textoMurphy}</p>
          </div>

          <div className="abertura__andamento" aria-label="Andamento da abertura">
            <span>
              {indiceEtapaGrupo + 1}
              <small>/ {etapasGrupo.length}</small>
            </span>
            <div>
              <small className="abertura__fase">{faseRotulo}</small>
              <strong>{etapaRotulo[etapa]}</strong>
              <div className="abertura__barra">
                <i style={{ width: `${((indiceEtapaGrupo + 1) / etapasGrupo.length) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="abertura__cartao" key={etapa}>
            {etapa === "nome" && (
              <label className="abertura__campo">
                <span>Nome completo</span>
                <input
                  autoCapitalize="words"
                  autoComplete="name"
                  autoCorrect="off"
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  data-ncbank-sensivel="true"
                  inputMode="text"
                  maxLength={limiteNomeCompleto}
                  onBeforeInput={bloquearNomeInvalido}
                  onChange={(evento) => atualizar("nomeCompleto", normalizarNomeCompleto(evento.target.value))}
                  placeholder="Digite nome e sobrenome"
                  ref={campoAtual}
                  value={dados.nomeCompleto}
                />
              </label>
            )}

            {etapa === "documento" && (
              <>
                <div className="abertura__alternancia" aria-label="Tipo de documento">
                  <button
                    aria-pressed={dados.tipoDocumento === "cpf"}
                    onClick={() => trocarTipoDocumento("cpf")}
                    type="button"
                  >
                    CPF
                  </button>
                  <button
                    aria-pressed={dados.tipoDocumento === "cnpj"}
                    onClick={() => trocarTipoDocumento("cnpj")}
                    type="button"
                  >
                    CNPJ
                  </button>
                </div>

                <label className="abertura__campo">
                  <span className="abertura__rotulo-ajuda">
                    {dados.tipoDocumento === "cpf" ? "CPF" : "CNPJ"}
                    <span className="abertura__ajuda" tabIndex={0}>
                      <CircleHelp size={18} />
                      <span>
                        {dados.tipoDocumento === "cpf"
                          ? "Use um CPF válido. Em avaliações autorizadas, prefira dados fictícios gerados para essa finalidade e evite informações reais de terceiros."
                          : "Use um CNPJ válido. Em avaliações autorizadas, prefira dados fictícios gerados para essa finalidade e evite informações reais de terceiros."}
                      </span>
                    </span>
                  </span>
                  <input
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    data-1p-ignore="true"
                    data-form-type="other"
                    data-lpignore="true"
                    data-ncbank-sensivel="true"
                    inputMode="numeric"
                    maxLength={dados.tipoDocumento === "cpf" ? 14 : 18}
                    onBeforeInput={bloquearDigitoInvalido}
                    onChange={(evento) => {
                      atualizar("documento", formatarDocumento(dados.tipoDocumento, evento.target.value));
                      setConsultaDocumento("vazio");
                      setMensagemConsulta("");
                    }}
                    placeholder={dados.tipoDocumento === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                    ref={campoAtual}
                    value={dados.documento}
                  />
                </label>
              </>
            )}

            {etapa === "email" && (
              <label className="abertura__campo">
                <span>E-mail</span>
                <input
                  autoCapitalize="off"
                  autoComplete="email"
                  autoCorrect="off"
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  data-ncbank-sensivel="true"
                  inputMode="email"
                  onChange={(evento) => {
                    atualizar("email", limparEmail(evento.target.value));
                    atualizar("emailConfirmacao", "");
                    setConsultaEmail("vazio");
                    setMensagemConsulta("");
                  }}
                  placeholder="voce@email.com"
                  ref={campoAtual}
                  type="email"
                  value={dados.email}
                />
              </label>
            )}

            {etapa === "confirmar-email" && (
              <label className="abertura__campo">
                <span>Confirmar e-mail</span>
                <input
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  data-ncbank-sensivel="true"
                  inputMode="email"
                  onChange={(evento) => atualizar("emailConfirmacao", limparEmail(evento.target.value))}
                  placeholder="repita o e-mail"
                  ref={campoAtual}
                  type="email"
                  value={dados.emailConfirmacao}
                />
              </label>
            )}

            {etapa === "termos" && (
              <div className="abertura__termos">
                <label>
                  <input
                    checked={dados.aceitouSistema}
                    onChange={(evento) => atualizar("aceitouSistema", evento.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Termos do sistema</strong>
                    Entendo as regras de uso, autenticação, limites operacionais e responsabilidades da conta.
                  </span>
                </label>
                <label>
                  <input
                    checked={dados.aceitouDados}
                    onChange={(evento) => atualizar("aceitouDados", evento.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Tratamento de dados</strong>
                    Autorizo a validação cadastral e o uso das informações para abertura e segurança da conta.
                  </span>
                </label>
                <label>
                  <input
                    checked={dados.aceitouPrivacidade}
                    onChange={(evento) => atualizar("aceitouPrivacidade", evento.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>Política de privacidade</strong>
                    Li e aceito a política de privacidade aplicada aos dados informados no NC Bank.
                  </span>
                </label>
              </div>
            )}

            {etapa === "produto" && (
              <div className="abertura__produto">
                <div>
                  <p className="rotulo">Bem-vindo</p>
                  <h1>Bem-vindo ao NC Bank, {primeiroNome}.</h1>
                </div>
                <div className="abertura__opcoes" aria-label="Opções de abertura">
                  <button
                    aria-pressed={dados.produto === "credito-conta"}
                    className={dados.produto === "credito-conta" ? "abertura__opcao abertura__opcao--ativa" : "abertura__opcao"}
                    onClick={() => selecionarProduto("credito-conta")}
                    type="button"
                  >
                    <CreditCard size={24} />
                    <strong>Cartão de crédito + conta</strong>
                    <span>Conta completa, cartão por análise e limite evolutivo.</span>
                  </button>

                  <button
                    aria-pressed={dados.produto === "somente-conta"}
                    className={dados.produto === "somente-conta" ? "abertura__opcao abertura__opcao--ativa" : "abertura__opcao"}
                    onClick={() => selecionarProduto("somente-conta")}
                    type="button"
                  >
                    <Landmark size={24} />
                    <strong>Somente a conta</strong>
                    <span>Comece com saldo, Nex, pagamentos e investimentos.</span>
                  </button>
                </div>
                {temErroProduto && (
                  <div className="abertura__produto-retorno">
                    <div className="abertura__produto-alerta" role="alert">
                      <LockKeyhole size={17} />
                      {errosProduto.map((erro) => (
                        <span key={erro}>{erro}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {etapa === "dados-cnpj" && (
              <div className="abertura__cnpj">
                <div>
                  <p className="rotulo">Dados da empresa</p>
                  <h1>Confirme se estes dados pertencem ao seu CNPJ.</h1>
                </div>

                {(estadoConsultaCnpj === "consultando" || estadoConsultaCnpj === "pendente") && (
                  <div className="abertura__cnpj-carregando" role="status">
                    <Clock3 size={26} />
                    <strong>Consultando informações cadastrais</strong>
                    <span>
                      {estimativaCnpj > 0
                        ? `Tempo estimado: ${estimativaCnpj}s`
                        : "Isso pode levar alguns instantes."}
                    </span>
                    <i />
                  </div>
                )}

                {estadoConsultaCnpj === "ok" && dadosCnpj && (
                  <div className="abertura__cnpj-dados">
                    <div className="abertura__cnpj-principal">
                      <span>CNPJ</span>
                      <strong>{dadosCnpj.cnpj}</strong>
                    </div>
                    <div className="abertura__cnpj-principal">
                      <span>Razão social</span>
                      <strong>{dadosCnpj.razaoSocial}</strong>
                    </div>
                    {dadosCnpj.nomeFantasia && (
                      <div>
                        <span>Nome fantasia</span>
                        <strong>{dadosCnpj.nomeFantasia}</strong>
                      </div>
                    )}
                    <div>
                      <span>Situação</span>
                      <strong>{dadosCnpj.situacao}</strong>
                    </div>
                    <div>
                      <span>Abertura</span>
                      <strong>{dadosCnpj.dataAbertura || "Não informado"}</strong>
                    </div>
                    <div>
                      <span>Porte</span>
                      <strong>{dadosCnpj.porte || "Não informado"}</strong>
                    </div>
                    <div>
                      <span>Natureza jurídica</span>
                      <strong>{dadosCnpj.naturezaJuridica || "Não informado"}</strong>
                    </div>
                    <div>
                      <span>Município</span>
                      <strong>
                        {[dadosCnpj.cidade, dadosCnpj.uf].filter(Boolean).join(" / ") || "Não informado"}
                      </strong>
                    </div>
                    {dadosCnpj.endereco && (
                      <div className="abertura__cnpj-largo">
                        <span>Endereço</span>
                        <strong>{dadosCnpj.endereco}</strong>
                      </div>
                    )}
                    {dadosCnpj.atividadePrincipal && (
                      <div className="abertura__cnpj-largo">
                        <span>Atividade principal</span>
                        <strong>{dadosCnpj.atividadePrincipal}</strong>
                      </div>
                    )}
                  </div>
                )}

                {estadoConsultaCnpj === "adiado" && (
                  <div className="abertura__cnpj-aviso" role="status">
                    <ShieldCheck size={22} />
                    <span>{mensagemCnpj || "Vamos concluir essa conferência depois. Você pode continuar."}</span>
                  </div>
                )}

                {estadoConsultaCnpj === "erro" && (
                  <div className="abertura__cnpj-aviso abertura__cnpj-aviso--erro" role="alert">
                    <LockKeyhole size={22} />
                    <span>{mensagemCnpj || "Não foi possível conferir os dados agora."}</span>
                    <button onClick={() => void consultarDadosCnpj()} type="button">
                      Tentar novamente
                    </button>
                  </div>
                )}

              </div>
            )}

            {etapa === "nascimento" && (
              <div className="abertura__campo abertura__campo--data">
                <span>Data de nascimento</span>
                <div className="abertura__data-linha">
                  <input
                    autoComplete="bday"
                    inputMode="numeric"
                    maxLength={10}
                    onBeforeInput={bloquearDigitoInvalido}
                    onChange={(evento) => atualizarDataNascimentoDigitada(evento.target.value)}
                    placeholder="DD/MM/AAAA"
                    ref={campoAtual}
                    type="text"
                    value={textoDataNascimento || formatarDataApresentacao(dados.dataNascimento)}
                  />
                  <button
                    aria-expanded={calendarioAberto}
                    aria-label="Selecionar data"
                    className="abertura__data-gatilho"
                    onClick={abrirCalendarioNascimento}
                    type="button"
                  >
                    <CalendarDays size={20} />
                  </button>
                </div>

                {calendarioAberto && (
                  <div className="abertura__calendario" role="dialog" aria-label="Selecionar data de nascimento">
                    <div className="abertura__calendario-topo">
                      <button
                        aria-label="Mês anterior"
                        disabled={modoCalendario !== "dias"}
                        onClick={() => moverMesCalendario(-1)}
                        type="button"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="abertura__calendario-titulo">
                        <button
                          aria-label="Escolher mês"
                          aria-pressed={modoCalendario === "meses"}
                          onClick={() => setModoCalendario((modoAtual) => (modoAtual === "meses" ? "dias" : "meses"))}
                          type="button"
                        >
                          {mesesCalendario[mesCalendario.getMonth()]}
                        </button>
                        <button
                          aria-label="Escolher ano"
                          aria-pressed={modoCalendario === "anos"}
                          onClick={() => setModoCalendario((modoAtual) => (modoAtual === "anos" ? "dias" : "anos"))}
                          type="button"
                        >
                          {mesCalendario.getFullYear()}
                        </button>
                      </div>
                      <button
                        aria-label="Próximo mês"
                        disabled={modoCalendario !== "dias"}
                        onClick={() => moverMesCalendario(1)}
                        type="button"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>

                    {modoCalendario === "dias" && (
                      <>
                        <div className="abertura__calendario-semana" aria-hidden="true">
                          {diasSemanaCalendario.map((dia, indice) => (
                            <span key={`${dia}-${indice}`}>{dia}</span>
                          ))}
                        </div>
                        <div className="abertura__calendario-grade">
                          {diasCalendario.map((dia, indice) => {
                            if (!dia) return <span key={`vazio-${indice}`} />;

                            const iso = formatarDataIso(dia);
                            const bloqueado = dia < minimoNascimento || dia > maximoNascimento;
                            const ativo = dataSelecionadaNascimento
                              ? formatarDataIso(dataSelecionadaNascimento) === iso
                              : false;

                            return (
                              <button
                                aria-pressed={ativo}
                                disabled={bloqueado}
                                key={iso}
                                onClick={() => selecionarDataNascimento(dia)}
                                type="button"
                              >
                                {dia.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {modoCalendario === "meses" && (
                      <div className="abertura__calendario-grade abertura__calendario-grade--meses">
                        {mesesCalendario.map((mes, indice) => {
                          const inicioMes = new Date(mesCalendario.getFullYear(), indice, 1);
                          const fimMes = new Date(mesCalendario.getFullYear(), indice + 1, 0);
                          const bloqueado = fimMes < minimoNascimento || inicioMes > maximoNascimento;

                          return (
                            <button
                              aria-pressed={indice === mesCalendario.getMonth()}
                              disabled={bloqueado}
                              key={mes}
                              onClick={() => selecionarMesNascimento(indice)}
                              type="button"
                            >
                              {mes.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {modoCalendario === "anos" && (
                      <div className="abertura__calendario-grade abertura__calendario-grade--anos">
                        {anosCalendario.map((ano) => (
                          <button
                            aria-pressed={ano === mesCalendario.getFullYear()}
                            key={ano}
                            onClick={() => selecionarAnoNascimento(ano)}
                            type="button"
                          >
                            {ano}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {etapa === "senha" && (
              <label className="abertura__campo">
                <span>Senha de 6 números</span>
                <input
                  autoCapitalize="off"
                  autoComplete="new-password"
                  autoCorrect="off"
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  data-ncbank-sensivel="true"
                  inputMode="numeric"
                  maxLength={6}
                  onBeforeInput={bloquearDigitoInvalido}
                  onChange={(evento) => atualizar("senha", somenteDigitos(evento.target.value).slice(0, 6))}
                  placeholder="******"
                  ref={campoAtual}
                  type="password"
                  value={dados.senha}
                />
              </label>
            )}

            {etapa === "confirmar-senha" && (
              <label className="abertura__campo">
                <span>Repetir senha</span>
                <input
                  autoCapitalize="off"
                  autoComplete="new-password"
                  autoCorrect="off"
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  data-ncbank-sensivel="true"
                  inputMode="numeric"
                  maxLength={6}
                  onBeforeInput={bloquearDigitoInvalido}
                  onChange={(evento) =>
                    atualizar("senhaConfirmacao", somenteDigitos(evento.target.value).slice(0, 6))
                  }
                  placeholder="******"
                  ref={campoAtual}
                  type="password"
                  value={dados.senhaConfirmacao}
                />
              </label>
            )}

            {etapa === "boas-vindas" && (
              <div className="abertura__boas-vindas">
                <CheckCircle2 size={36} />
                <p className="rotulo">Tudo pronto</p>
                <h1>Bem-vindo, {primeiroNome}.</h1>
                <span>
                  {referenciaAbertura
                    ? `Sua abertura ${referenciaAbertura} foi concluída.`
                    : "Sua abertura foi concluída."}
                </span>
              </div>
            )}
          </div>

          {etapaComConsulta && mensagemConsultaVisivel && (
            <div className={`abertura__status abertura__status--${statusConsulta}`} role="status">
              {statusConsulta === "consultando" && <Clock3 size={18} />}
              {statusConsulta === "disponivel" && <CheckCircle2 size={18} />}
              {statusConsulta === "indisponivel" && <FileCheck2 size={18} />}
              {statusConsulta === "bloqueado" && <ShieldCheck size={18} />}
              {statusConsulta === "erro" && <LockKeyhole size={18} />}
              <span>{mensagemConsultaVisivel}</span>
            </div>
          )}

          {tentouAvancar && errosGlobais.length > 0 && (
            <div className="abertura__erros" role="alert">
              {errosGlobais.map((erro) => (
                <span key={erro}>{erro}</span>
              ))}
            </div>
          )}

          <div className="abertura__acoes">
            {etapa === "dados-cnpj" && estadoConsultaCnpj === "ok" ? (
              <button
                className="botao botao--cliente"
                disabled={processandoApi}
                onClick={() => void cancelarAberturaEReiniciar()}
                type="button"
              >
                <ArrowLeft size={19} />
                <span>Não são esses dados</span>
              </button>
            ) : indiceEtapaGrupo > 0 && etapa !== "boas-vindas" ? (
              <button
                className="botao botao--cliente"
                disabled={estaConsultando || cnpjEmEspera || processandoApi || Boolean(bloqueioTemporario)}
                onClick={voltar}
                type="button"
              >
                <ArrowLeft size={19} />
                <span>Voltar</span>
              </button>
            ) : null}
            <button
              className="botao botao--primario"
              disabled={estaConsultando || cnpjEmEspera || processandoApi || Boolean(bloqueioTemporario)}
              onClick={() => void avancar()}
              type="button"
            >
              <span>
                {processandoApi
                  ? "Validando..."
                  : etapa === "produto"
                    ? "Reservar abertura"
                    : etapa === "confirmar-senha"
                      ? "Concluir abertura"
                      : etapa === "boas-vindas"
                        ? "Abrir painel"
                        : "Continuar"}
              </span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>

        <aside className="abertura__visual" aria-label="Visual da etapa atual">
          <picture key={visual.arquivo} className="abertura__visual-imagem">
            <source srcSet={`${caminhoMarca}/${visual.arquivo}.avif`} type="image/avif" />
            <source srcSet={`${caminhoMarca}/${visual.arquivo}.webp`} type="image/webp" />
            <img src={`${caminhoMarca}/${visual.arquivo}.png`} alt={visual.alt} />
          </picture>
          <div className="abertura__visual-gradiente" />
          <div className="abertura__protecao">
            <BadgeCheck size={18} />
            Protocolo {protocolo || "ativo"}
          </div>
        </aside>
          </>
        )}
      </section>

      {produtoPendente && (
        <div className="abertura__modal-fundo" role="presentation">
          <section className="abertura__modal" role="dialog" aria-modal="true" aria-label="Confirmar troca de produto">
            <span>Confirmar alteração</span>
            <h2>Deseja mudar sua escolha?</h2>
            <p>
              Sua opção atual é {produtoRotulo[dados.produto as ProdutoAtivo]}. Se confirmar, vamos trocar para{" "}
              {produtoRotulo[produtoPendente]}.
            </p>
            <div className="abertura__modal-acoes">
              <button className="botao botao--cliente" onClick={() => setProdutoPendente("")} type="button">
                <span>Manter escolha</span>
              </button>
              <button className="botao botao--primario" onClick={confirmarTrocaProduto} type="button">
                <span>Mudar escolha</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

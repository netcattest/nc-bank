export type TipoDocumento = "cpf" | "cnpj";
export type ProdutoConta = "credito-conta" | "somente-conta";

export const somenteDigitos = (valor: string) => valor.replace(/\D/g, "");

export const normalizarEmail = (valor: string) =>
  valor
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .slice(0, 120);

export const normalizarNomeCompleto = (valor: string) =>
  valor
    .replace(/[^\p{L}\s'-]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 70)
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s'-])(\p{L})/gu, (_, prefixo: string, letra: string) =>
      `${prefixo}${letra.toLocaleUpperCase("pt-BR")}`
    );

export const obterPrimeiroNome = (nomeCompleto: string) =>
  normalizarNomeCompleto(nomeCompleto).split(" ").filter(Boolean)[0] ?? "Cliente";

const normalizarTermoNome = (valor: string) =>
  valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/['-]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const termosBloqueadosNome = new Set(
  [
    "admin",
    "administrador",
    "atendimento",
    "banco",
    "netcat",
    "netcatbank",
    "ncbank",
    "root",
    "sistema",
    "suporte",
    "arrombada",
    "arrombado",
    "babaca",
    "bosta",
    "burra",
    "burro",
    "cacete",
    "canalha",
    "caralho",
    "corna",
    "corno",
    "cretina",
    "cretino",
    "cu",
    "desgraca",
    "desgracada",
    "desgracado",
    "escrota",
    "escroto",
    "foda",
    "fodida",
    "fodido",
    "idiota",
    "imbecil",
    "lixo",
    "maldita",
    "maldito",
    "merda",
    "nojenta",
    "nojento",
    "otaria",
    "otario",
    "palhaca",
    "palhaco",
    "porra",
    "puta",
    "putaria",
    "puto",
    "retardada",
    "retardado",
    "trouxa",
    "vadia",
    "vadio",
    "vagabunda",
    "vagabundo",
    "verme",
    "hitler",
    "nazi",
    "nazista",
    "terrorista"
  ].map(normalizarTermoNome)
);

const expressoesBloqueadasNome = [
  "filha da puta",
  "filho da puta",
  "foda se",
  "nc bank",
  "netcat bank",
  "netcat test",
  "se foder",
  "tomar no cu",
  "vai se foder",
  "vai tomar no cu"
].map(normalizarTermoNome);

const compactosBloqueadosNome = [
  "fdp",
  "filhadaputa",
  "filhodaputa",
  "fodase",
  "ncbank",
  "netcatbank",
  "pnc",
  "pqp",
  "tomarnocu",
  "vaitomarnocu",
  "vaisefoder",
  "vsf"
];

export const nomeContemTermoBloqueado = (valor: string) => {
  const nomeNormalizado = normalizarTermoNome(normalizarNomeCompleto(valor));
  if (!nomeNormalizado) return false;

  const partes = nomeNormalizado.split(" ").filter(Boolean);
  if (partes.some((parte) => termosBloqueadosNome.has(parte))) return true;

  const nomeCercado = ` ${nomeNormalizado} `;
  if (expressoesBloqueadasNome.some((expressao) => nomeCercado.includes(` ${expressao} `))) {
    return true;
  }

  const nomeCompacto = partes.join("");
  return compactosBloqueadosNome.some((termo) => nomeCompacto.includes(termo));
};

const todosIguais = (valor: string) => /^(\d)\1+$/.test(valor);

export const validarCpf = (valor: string) => {
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

export const validarCnpj = (valor: string) => {
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

export const validarDocumento = (tipo: TipoDocumento, valor: string) =>
  tipo === "cpf" ? validarCpf(valor) : validarCnpj(valor);

export const validarEmail = (valor: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor) && valor.length <= 120;

export const validarNomeCompleto = (valor: string) => {
  const nomeNormalizado = normalizarNomeCompleto(valor);
  const possuiNomeSobrenome =
    nomeNormalizado
      .split(" ")
      .filter((parte) => parte.length >= 2).length >= 2;

  return possuiNomeSobrenome && !nomeContemTermoBloqueado(nomeNormalizado);
};

export const validarProduto = (valor: string): valor is ProdutoConta =>
  valor === "credito-conta" || valor === "somente-conta";

export const validarDataNascimento = (valor: string) => {
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

const sequencias = new Set([
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

const senhaUsaDataNascimento = (senha: string, dataNascimento?: string) => {
  if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) return false;

  const [ano = "", mes = "", dia = ""] = dataNascimento.split("-");
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

export const validarSenhaNumerica = (valor: string, dataNascimento?: string) => {
  const senha = somenteDigitos(valor);
  if (!/^\d{6}$/.test(senha)) return false;
  if (/^(\d)\1{5}$/.test(senha)) return false;
  if (sequencias.has(senha)) return false;
  if (/^(\d{2})\1{2}$/.test(senha)) return false;
  if (/^(\d{3})\1$/.test(senha)) return false;
  if (possuiSequenciaAritmetica(senha)) return false;
  if (possuiParesPrevisiveis(senha)) return false;
  if (senhaUsaDataNascimento(senha, dataNascimento)) return false;
  return true;
};

"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  FileText,
  LockKeyhole,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { urlAbrirConta, urlPainel } from "../configuracao/publica";
import {
  buscarApiNetCat,
  cabecalhosEnvelopeNetCat,
  cabecalhosNetCat,
  criptografarPayloadNetCat
} from "../seguranca/transporte";

type TipoDocumento = "cpf" | "cnpj";
type EtapaLogin = "credenciais" | "totp";
type EstadoMensagem = "vazio" | "erro" | "ok" | "bloqueado";

type RespostaCsrf = {
  controle?: {
    csrf?: string;
  };
};

type RespostaApi = {
  estado?: string;
  mensagem?: string;
  verificacao?: {
    metodo?: string;
    expiraEmSegundos?: number;
  };
};

const caminhoMarca = "/marca";
const chaveLocal = "netcatbank_nc_area_cliente_l8q2";
const chaveRateLimit = "netcatbank_nc_rate_cliente_l8q2";
const nomeCookie = "ncbank_netcatbank_cliente_acesso_l8q2";

const somenteDigitos = (valor: string) => valor.replace(/\D/g, "");

const formatarCodigoAutenticador = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 6);
  return digitos.replace(/^(\d{3})(\d+)/, "$1 $2");
};

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

const detectarTipoDocumento = (valor: string): TipoDocumento =>
  somenteDigitos(valor).length > 11 ? "cnpj" : "cpf";

const formatarDocumentoUnico = (valor: string) => {
  const digitos = somenteDigitos(valor).slice(0, 14);
  return digitos.length > 11 ? formatarCnpj(digitos) : formatarCpf(digitos);
};

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

const validarDocumento = (valor: string) => {
  const digitos = somenteDigitos(valor);
  return digitos.length > 11 ? validarCnpj(digitos) : validarCpf(digitos);
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

const gerarSinalSessao = () => {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const obterCsrf = async () => {
  const resposta = await buscarApiNetCat("/seguranca/csrf", {
    cache: "no-store",
    credentials: "include",
    headers: await cabecalhosNetCat("csrf-publico")
  });
  const conteudo = (await resposta.json().catch(() => null)) as RespostaCsrf | null;
  if (!resposta.ok || !conteudo?.controle?.csrf) {
    throw new Error("csrf");
  }
  return conteudo.controle.csrf;
};

const mensagemFalhaLogin = (resposta: Response, mensagemApi: string | undefined, fallback: string) => {
  if (resposta.status === 502 || resposta.status === 503 || resposta.status === 504) {
    return "Serviço temporariamente indisponível. Aguarde alguns segundos e tente novamente.";
  }

  return mensagemApi ?? fallback;
};

export function AcessoCliente() {
  const [etapaLogin, setEtapaLogin] = useState<EtapaLogin>("credenciais");
  const [documento, setDocumento] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo2fa, setCodigo2fa] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [estadoMensagem, setEstadoMensagem] = useState<EstadoMensagem>("vazio");
  const [mensagem, setMensagem] = useState("");
  const [bloqueio, setBloqueio] = useState<{ terminaEm: number; contexto: "login" } | null>(null);
  const [segundosBloqueio, setSegundosBloqueio] = useState(0);

  const tipoDocumento = useMemo(() => detectarTipoDocumento(documento), [documento]);
  const acessoBloqueado = Boolean(bloqueio);

  useEffect(() => {
    const sinal = gerarSinalSessao();
    localStorage.setItem(
      chaveLocal,
      JSON.stringify({
        contexto: "area-cliente",
        iniciadoEm: new Date().toISOString(),
        sinal
      })
    );
    document.cookie = `${nomeCookie}=sessao_${sinal}; Path=/; SameSite=Strict; Secure; Max-Age=1800`;
  }, []);

  useEffect(() => {
    if (!bloqueio) return;

    const atualizar = () => {
      const restante = Math.max(0, Math.ceil((bloqueio.terminaEm - Date.now()) / 1000));
      setSegundosBloqueio(restante);

      if (restante <= 0) {
        setBloqueio(null);
        setEstadoMensagem("vazio");
        setMensagem("");
      }
    };

    atualizar();
    const temporizador = window.setInterval(atualizar, 250);
    return () => window.clearInterval(temporizador);
  }, [bloqueio]);

  const iniciarBloqueio = (contexto: "login", segundos: number) => {
    const duracao = Math.max(1, Math.min(segundos, 5));
    setSegundosBloqueio(duracao);
    setBloqueio({ contexto, terminaEm: Date.now() + duracao * 1000 });
  };

  const validarTentativa = (contexto: "login") => {
    const limite = registrarTentativa(contexto, 8);
    if (limite.liberado) return true;

    iniciarBloqueio(contexto, limite.segundos);
    return false;
  };

  const atualizarDocumento = (valor: string) => {
    setDocumento(formatarDocumentoUnico(valor));
    setEtapaLogin("credenciais");
    setCodigo2fa("");
    setEstadoMensagem("vazio");
    setMensagem("");
  };

  const finalizarLogin = async () => {
    if (!validarTentativa("login")) return;

    const codigo = somenteDigitos(codigo2fa).slice(0, 6);

    if (!/^\d{6}$/.test(codigo)) {
      setEstadoMensagem("erro");
      setMensagem("Informe o código de 6 números.");
      return;
    }

    try {
      const csrf = await obterCsrf();
      const corpoSeguro = await criptografarPayloadNetCat({
        codigo
      }, {
        csrf,
        fluxo: "area-cliente",
        rota: "/auth/login/2fa"
      });
      const resposta = await buscarApiNetCat("/auth/login/2fa", {
        method: "POST",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "area-cliente",
          rota: "/auth/login/2fa"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro),
        cache: "no-store",
        credentials: "include"
      });
      const conteudo = (await resposta.json().catch(() => null)) as RespostaApi | null;

      if (!resposta.ok || conteudo?.estado !== "ok") {
        setEstadoMensagem("erro");
        setMensagem(mensagemFalhaLogin(resposta, conteudo?.mensagem, "Não foi possível validar o código agora."));
        return;
      }

      localStorage.setItem(
        chaveLocal,
        JSON.stringify({
          contexto: "login-2fa-validado-api",
          atualizadoEm: new Date().toISOString()
        })
      );
      setEstadoMensagem("ok");
      setMensagem("Verificação concluída.");
      window.setTimeout(() => window.location.assign(urlPainel), 1600);
    } catch {
      setEstadoMensagem("erro");
      setMensagem("Não foi possível validar a verificação agora. Tente novamente em instantes.");
    }
  };

  const acessar = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (etapaLogin === "totp") {
      await finalizarLogin();
      return;
    }

    if (!validarTentativa("login")) return;

    if (!validarDocumento(documento)) {
      setEstadoMensagem("erro");
      setMensagem(`Informe um ${tipoDocumento === "cpf" ? "CPF" : "CNPJ"} válido para continuar.`);
      return;
    }

    if (!/^\d{6}$/.test(senha)) {
      setEstadoMensagem("erro");
      setMensagem("Informe sua senha com 6 números.");
      return;
    }

    try {
      const csrf = await obterCsrf();
      const corpoSeguro = await criptografarPayloadNetCat({
        documento: somenteDigitos(documento).slice(0, 14),
        senha
      }, {
        csrf,
        fluxo: "area-cliente",
        rota: "/auth/login"
      });
      const resposta = await buscarApiNetCat("/auth/login", {
        method: "POST",
        headers: await cabecalhosEnvelopeNetCat({
          csrf,
          envelopeHash: corpoSeguro.envelopeHash,
          fluxo: "area-cliente",
          rota: "/auth/login"
        }, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(corpoSeguro),
        cache: "no-store",
        credentials: "include"
      });
      const conteudo = (await resposta.json().catch(() => null)) as RespostaApi | null;

      if (resposta.ok && conteudo?.estado === "verificacao_2fa") {
        setEtapaLogin("totp");
        setSenha("");
        setCodigo2fa("");
        setEstadoMensagem("vazio");
        setMensagem("");
        return;
      }

      if (!resposta.ok || conteudo?.estado !== "ok") {
        setEstadoMensagem("erro");
        setMensagem(mensagemFalhaLogin(resposta, conteudo?.mensagem, "Não foi possível acessar com estes dados."));
        return;
      }

      localStorage.setItem(
        chaveLocal,
        JSON.stringify({
          contexto: "login-validado-api",
          atualizadoEm: new Date().toISOString()
        })
      );
      setEstadoMensagem("ok");
      setMensagem("Acesso autorizado.");
      window.setTimeout(() => window.location.assign(urlPainel), 450);
    } catch {
      setEstadoMensagem("erro");
      setMensagem("Não foi possível validar a sessão agora. Tente novamente em instantes.");
    }
  };

  const voltarCredenciais = () => {
    setEtapaLogin("credenciais");
    setCodigo2fa("");
    setSenha("");
    setEstadoMensagem("vazio");
    setMensagem("");
  };

  const mensagemBloqueio = `Muitas tentativas de acesso em sequência. Aguarde ${segundosBloqueio}s para tentar novamente.`;

  return (
    <main className="acesso-cliente" data-tela-segura="area-cliente">
      <section className="acesso-cliente__visual" aria-label="NetCat Bank em acesso protegido">
        <picture className="acesso-cliente__imagem">
          <source srcSet={`${caminhoMarca}/area-cliente-netcatbank.avif`} type="image/avif" />
          <source srcSet={`${caminhoMarca}/area-cliente-netcatbank.webp`} type="image/webp" />
          <img src={`${caminhoMarca}/area-cliente-netcatbank.png`} alt="" />
        </picture>
        <div className="acesso-cliente__visual-filtro" />
        <div className="acesso-cliente__visual-conteudo">
          <Image
            src="/marca/logo-netcatbank-branca.webp"
            alt="NetCat Bank"
            width={170}
            height={138}
            priority
            unoptimized
          />
          <h1>Acesso seguro ao NC Bank.</h1>
        </div>
      </section>

      <section className="acesso-cliente__formulario" aria-label="Acessar conta NetCat Bank">
        <div className="acesso-cliente__topo">
          <Image
            src="/marca/logo-netcatbank.webp"
            alt="NetCat Bank"
            width={104}
            height={80}
            priority
            unoptimized
          />
        </div>

        <div className="acesso-cliente__cabecalho">
          <p className="rotulo">Cliente NC Bank</p>
          <h2>{etapaLogin === "totp" ? "Verifique sua conta" : "Acesse sua conta"}</h2>
        </div>

        <form className="acesso-cliente__campos" onSubmit={acessar}>
          {etapaLogin === "credenciais" ? (
            <>
              <label className="acesso-cliente__campo">
                <span>
                  <FileText size={18} />
                  CPF ou CNPJ
                </span>
                <input
                  autoCapitalize="off"
                  autoComplete="username"
                  autoCorrect="off"
                  data-1p-ignore="true"
                  data-form-type="other"
                  data-lpignore="true"
                  data-ncbank-sensivel="true"
                  inputMode="numeric"
                  maxLength={18}
                  onBeforeInput={bloquearDigitoInvalido}
                  onChange={(evento) => atualizarDocumento(evento.target.value)}
                  placeholder={tipoDocumento === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                  value={documento}
                />
              </label>

              <label className="acesso-cliente__campo">
                <span>
                  <LockKeyhole size={18} />
                  Senha
                </span>
                <div className="acesso-cliente__senha">
                  <input
                    autoCapitalize="off"
                    autoComplete="current-password"
                    autoCorrect="off"
                    data-1p-ignore="true"
                    data-form-type="other"
                    data-lpignore="true"
                    data-ncbank-sensivel="true"
                    inputMode="numeric"
                    maxLength={6}
                    onBeforeInput={bloquearDigitoInvalido}
                    onChange={(evento) => {
                      setSenha(somenteDigitos(evento.target.value).slice(0, 6));
                      setEstadoMensagem("vazio");
                      setMensagem("");
                    }}
                    pattern="[0-9]{6}"
                    placeholder="******"
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                  />
                  <button
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setMostrarSenha((valorAtual) => !valorAtual)}
                    type="button"
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </label>
            </>
          ) : (
            <label className="acesso-cliente__campo acesso-cliente__campo--codigo">
              <span>
                <LockKeyhole size={18} />
                Código do autenticador
              </span>
              <input
                data-1p-ignore="true"
                data-form-type="other"
                data-lpignore="true"
                data-ncbank-sensivel="true"
                autoCapitalize="off"
                autoComplete="one-time-code"
                autoCorrect="off"
                inputMode="numeric"
                maxLength={7}
                onBeforeInput={bloquearDigitoInvalido}
                onChange={(evento) => {
                  setCodigo2fa(somenteDigitos(evento.target.value).slice(0, 6));
                  setEstadoMensagem("vazio");
                  setMensagem("");
                }}
                pattern="[0-9 ]{7}"
                placeholder="000 000"
                spellCheck={false}
                value={formatarCodigoAutenticador(codigo2fa)}
              />
            </label>
          )}

          {(mensagem || bloqueio) && (
            <div
              className={`acesso-cliente__mensagem acesso-cliente__mensagem--${
                bloqueio ? "bloqueado" : estadoMensagem
              }`}
              role={estadoMensagem === "erro" || bloqueio ? "alert" : "status"}
            >
              {bloqueio ? mensagemBloqueio : mensagem}
            </div>
          )}

          <button className="botao botao--primario acesso-cliente__entrar" disabled={acessoBloqueado} type="submit">
            <span>{etapaLogin === "totp" ? "Verificar conta" : "Acessar conta"}</span>
            <ArrowRight size={20} />
          </button>
          {etapaLogin === "totp" && (
            <button className="acesso-cliente__voltar-login" onClick={voltarCredenciais} type="button">
              <ArrowLeft size={17} />
              Voltar para senha
            </button>
          )}
        </form>

        {etapaLogin === "credenciais" && (
          <div className="acesso-cliente__links">
            <a href={urlAbrirConta}>
              <UserRound size={18} />
              Criar conta
            </a>
          </div>
        )}
      </section>
    </main>
  );
}

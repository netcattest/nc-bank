"use client";

import { ArrowDown, Gift, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent, type WheelEvent } from "react";
import { urlAbrirConta } from "../configuracao/publica";
import {
  buscarApiNetCat,
  cabecalhosEnvelopeNetCat,
  cabecalhosNetCat,
  criptografarPayloadNetCat
} from "../seguranca/transporte";
import { FluxoAberturaConta } from "./fluxo-abertura-conta";

type EstadoConvite = "carregando" | "valido" | "indisponivel";

type RespostaCsrf = {
  controle?: {
    csrf?: string;
  };
};

type RespostaConvite = {
  estado?: string;
  convite?: {
    primeiroNome?: string;
    recompensaAmigo?: string;
    recompensaIndicador?: string;
    validoAte?: string;
  };
};

type BeneficioIndicacao = {
  icone: LucideIcon;
  texto?: string;
  titulo: string;
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

const extrairCodigo = (convite: string) => {
  const partes = convite.toLowerCase().split("-").filter(Boolean);
  const codigo = partes[partes.length - 1] ?? "";
  return /^[a-z0-9]{8,96}$/.test(codigo) ? codigo : "";
};

const nomeDoSlug = (convite: string) => {
  const partes = convite.split("-").filter(Boolean);
  if (partes.length <= 1) return "Um cliente";
  const nome = partes.slice(0, -1).join(" ");
  return nome
    .split(" ")
    .filter(Boolean)
    .map((parte) => `${parte.charAt(0).toUpperCase()}${parte.slice(1).toLowerCase()}`)
    .join(" ");
};

export function LandingIndicacao({ convite }: { convite?: string }) {
  const codigo = useMemo(() => extrairCodigo(convite ?? ""), [convite]);
  const nomeInicial = useMemo(() => nomeDoSlug(convite ?? ""), [convite]);
  const [estado, setEstado] = useState<EstadoConvite>(codigo ? "carregando" : "indisponivel");
  const [primeiroNome, setPrimeiroNome] = useState(nomeInicial);
  const [cadastroIniciado, setCadastroIniciado] = useState(false);
  const [capaLiberada, setCapaLiberada] = useState(false);
  const toqueInicial = useRef<number | null>(null);
  const conviteValido = estado === "valido";
  const conviteCarregando = estado === "carregando";
  const conviteIndisponivel = estado === "indisponivel";
  const tituloConvite = conviteValido ? `${primeiroNome} convidou você para o NC Bank.` : "Convite NC Bank";
  const textoConvite = conviteValido
    ? "Abra sua conta gratuitamente. Ao concluir pelo convite, você recebe R$10 de boas-vindas."
    : conviteCarregando
      ? "Validando seu convite NC Bank."
      : "Não conseguimos validar este convite agora. Você ainda pode abrir sua conta pelo canal oficial do NC Bank.";
  const beneficios: BeneficioIndicacao[] = conviteValido
    ? [
        {
          icone: Gift,
          texto: "Creditado após sua primeira entrada.",
          titulo: "R$10 para você"
        },
        {
          icone: UsersRound,
          texto: "Liberado somente quando você criar a conta.",
          titulo: "R$25 para quem indicou"
        },
        {
          icone: ShieldCheck,
          texto: "Abertura conduzida pelo banco.",
          titulo: "Conta protegida NC Bank"
        }
      ]
    : [
        {
          icone: Gift,
          titulo: "Abertura gratuita"
        },
        {
          icone: UsersRound,
          titulo: "Conta digital NC Bank"
        },
        {
          icone: ShieldCheck,
          titulo: "Canal oficial seguro"
        }
      ];

  useEffect(() => {
    if (!codigo) return;
    let ativo = true;

    const validar = async () => {
      try {
        const csrf = await obterCsrf();
        const corpoSeguro = await criptografarPayloadNetCat({ codigo }, {
          csrf,
          fluxo: "indicacao",
          rota: "/indicacoes/convite"
        });
        const resposta = await buscarApiNetCat("/indicacoes/convite", {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: await cabecalhosEnvelopeNetCat({
            csrf,
            envelopeHash: corpoSeguro.envelopeHash,
            fluxo: "indicacao",
            rota: "/indicacoes/convite"
          }, {
            "Content-Type": "application/json"
          }),
          body: JSON.stringify(corpoSeguro)
        });
        const conteudo = (await resposta.json().catch(() => null)) as RespostaConvite | null;

        if (!ativo) return;
        if (!resposta.ok || conteudo?.estado !== "ok") {
          setEstado("indisponivel");
          return;
        }

        setPrimeiroNome(conteudo.convite?.primeiroNome || nomeInicial);
        setEstado("valido");
      } catch {
        if (!ativo) return;
        setEstado("indisponivel");
      }
    };

    void validar();
    return () => {
      ativo = false;
    };
  }, [codigo, nomeInicial]);

  useEffect(() => {
    if (!conviteValido || cadastroIniciado) {
      setCapaLiberada(false);
      return;
    }

    const temporizador = window.setTimeout(() => setCapaLiberada(true), 1900);
    return () => window.clearTimeout(temporizador);
  }, [cadastroIniciado, conviteValido]);

  const iniciarCadastro = useCallback(() => {
    if (conviteValido && capaLiberada) {
      setCadastroIniciado(true);
    }
  }, [capaLiberada, conviteValido]);

  const detectarScrollCadastro = useCallback(
    (evento: WheelEvent<HTMLElement>) => {
      if (!conviteValido || !capaLiberada || cadastroIniciado || evento.deltaY < 18) return;
      evento.preventDefault();
      iniciarCadastro();
    },
    [cadastroIniciado, capaLiberada, conviteValido, iniciarCadastro]
  );

  const marcarToqueInicial = useCallback((evento: TouchEvent<HTMLElement>) => {
    toqueInicial.current = evento.touches[0]?.clientY ?? null;
  }, []);

  const detectarGestoCadastro = useCallback(
    (evento: TouchEvent<HTMLElement>) => {
      if (!conviteValido || !capaLiberada || cadastroIniciado || toqueInicial.current === null) return;
      const toqueAtual = evento.touches[0]?.clientY ?? toqueInicial.current;
      if (toqueInicial.current - toqueAtual > 42) {
        iniciarCadastro();
        toqueInicial.current = null;
      }
    },
    [cadastroIniciado, capaLiberada, conviteValido, iniciarCadastro]
  );

  const classeIndicacao = [
    "indicacao",
    `indicacao--${estado}`,
    conviteValido && !cadastroIniciado ? "indicacao--capa" : "",
    conviteValido && !cadastroIniciado && !capaLiberada ? "indicacao--travada" : "",
    cadastroIniciado ? "indicacao--cadastro" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classeIndicacao}
      data-tela-segura="indicacao"
      onContextMenu={(evento) => evento.preventDefault()}
    >
      <section
        className="indicacao__hero"
        onTouchMove={detectarGestoCadastro}
        onTouchStart={marcarToqueInicial}
        onWheel={detectarScrollCadastro}
      >
        <picture className="indicacao__imagem">
          <source srcSet="/marca/indicacao-landing-netcatbank.avif" type="image/avif" />
          <source srcSet="/marca/indicacao-landing-netcatbank.webp" type="image/webp" />
          <img src="/marca/indicacao-landing-netcatbank.png" alt="" />
        </picture>
        <div
          className={
            conviteIndisponivel
              ? "indicacao__conteudo indicacao__conteudo--sem-convite"
              : "indicacao__conteudo"
          }
        >
          <img src="/marca/logo-netcatbank-branca.webp" alt="NC Bank" />
          <h1>{tituloConvite}</h1>
          <p>{textoConvite}</p>
          <div className="indicacao__beneficios" aria-label="Benefícios do convite">
            {beneficios.map((beneficio) => {
              const Icone = beneficio.icone;
              return (
                <article key={beneficio.titulo}>
                  <Icone size={20} />
                  <strong>{beneficio.titulo}</strong>
                  {beneficio.texto && <small>{beneficio.texto}</small>}
                </article>
              );
            })}
          </div>
          <div className="indicacao__acoes">
            {estado === "valido" ? (
              <button className="botao botao--primario" disabled={!capaLiberada} onClick={iniciarCadastro} type="button">
                <span>Começar abertura</span>
                <ArrowDown size={18} />
              </button>
            ) : (
              <a className="botao botao--primario" href={urlAbrirConta}>
                <span>Abrir conta sem convite</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {estado === "valido" && cadastroIniciado && (
        <section id="abrir-conta" className="indicacao__fluxo" aria-label="Abrir conta pelo convite">
          <FluxoAberturaConta variante="indicacao" />
        </section>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import { ArrowRight, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { urlAbrirConta } from "../configuracao/publica";
import { LinkRolagem } from "./link-rolagem";
import type { CSSProperties } from "react";

export type ModoHeroi = "pessoa" | "empresa";

const chaveLocal = "netcatbank_nc_heroi_publico_m5r8";
const nomeCookie = "ncbank_netcatbank_heroi_publico_m5r8";

const conteudos: Record<
  ModoHeroi,
  {
    botao: string;
    titulo: string;
    texto: string;
    imagem: `/${string}`;
  }
> = {
  pessoa: {
    botao: "Para você",
    titulo: "NetCat Bank. Seu dinheiro em modo seguro.",
    texto:
      "Criado e gerenciado pela NetCatTest, o NetCat Bank reúne conta, cartões, Nex, investimentos e controle do dia a dia em uma experiência única.",
    imagem: "/marca/capa-netcatbank.webp"
  },
  empresa: {
    botao: "Para sua empresa",
    titulo: "NetCat Empresas. Caixa, cartões e Nex no mesmo painel.",
    texto:
      "Receba, envie e acompanhe o dinheiro da empresa com conta PJ, cartões para equipe e Nex cobrança dentro do ecossistema NetCat.",
    imagem: "/marca/capa2-netcatbank.webp"
  }
};

type PropriedadesHeroiPrincipal = {
  modoInicial?: ModoHeroi;
};

const lerCookieHeroi = () =>
  document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${nomeCookie}=`))
    ?.split("=")[1];

export function HeroiPrincipal({ modoInicial = "pessoa" }: PropriedadesHeroiPrincipal) {
  const [modo, setModo] = useState<ModoHeroi>(modoInicial);
  const [opacidade, setOpacidade] = useState(1);
  const conteudo = conteudos[modo];

  useEffect(() => {
    const salvoCookie = lerCookieHeroi();
    if (salvoCookie === "empresa" || salvoCookie === "pessoa") {
      localStorage.setItem(chaveLocal, salvoCookie);
      setModo(salvoCookie);
      return;
    }

    const salvo = localStorage.getItem(chaveLocal);
    if (salvo === "empresa" || salvo === "pessoa") {
      setModo(salvo);
      document.cookie = `${nomeCookie}=${salvo}; Path=/; SameSite=Strict; Max-Age=2592000`;
    }
  }, []);

  useEffect(() => {
    let quadro = 0;

    const atualizar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const inicio = 16;
        const fim = Math.min(172, window.innerHeight * 0.22);
        const progresso = Math.min(Math.max((window.scrollY - inicio) / (fim - inicio), 0), 1);
        setOpacidade(Number((1 - progresso).toFixed(3)));
      });
    };

    atualizar();
    window.addEventListener("scroll", atualizar, { passive: true });
    window.addEventListener("resize", atualizar);

    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("scroll", atualizar);
      window.removeEventListener("resize", atualizar);
    };
  }, []);

  const selecionarModo = (novoModo: ModoHeroi) => {
    setModo(novoModo);
    localStorage.setItem(chaveLocal, novoModo);
    document.cookie = `${nomeCookie}=${novoModo}; Path=/; SameSite=Strict; Max-Age=2592000`;
  };

  const estiloConteudo = {
    opacity: opacidade,
    pointerEvents: opacidade < 0.16 ? "none" : "auto",
    transform: `translateY(${-18 * (1 - opacidade)}px)`
  } satisfies CSSProperties;

  return (
    <div className="capa-fixa" id="inicio">
      <section className={`heroi heroi--${modo}`} aria-label="Apresentação NetCat Bank">
        <div className="heroi__moldura" aria-hidden="true">
          <Image
            key={conteudo.imagem}
            src={conteudo.imagem}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized
            className="heroi__imagem"
          />
        </div>
        <div className="heroi__filtro" />
        <div className="container heroi__conteudo" style={estiloConteudo}>
          <div className="segmentado" aria-label="Tipo de conta">
            {(Object.keys(conteudos) as ModoHeroi[]).map((item) => (
              <button
                aria-pressed={modo === item}
                key={item}
                type="button"
                onClick={() => selecionarModo(item)}
              >
                {conteudos[item].botao}
              </button>
            ))}
          </div>
          <h1>{conteudo.titulo}</h1>
          <p>{conteudo.texto}</p>
          <div className="acoes">
            <a className="botao botao--primario" href={urlAbrirConta}>
              <span>Abrir conta</span>
              <ArrowRight aria-hidden="true" size={20} />
            </a>
            <LinkRolagem className="botao botao--vidro" destino="cartao">
              <CreditCard aria-hidden="true" size={20} />
              <span>Ver cartões</span>
            </LinkRolagem>
          </div>
        </div>
      </section>
    </div>
  );
}

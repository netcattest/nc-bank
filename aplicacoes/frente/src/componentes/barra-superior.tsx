"use client";

import Image from "next/image";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { urlAbrirConta, urlAreaCliente } from "../configuracao/publica";
import { LinkRolagem } from "./link-rolagem";

type ItemMenu = {
  titulo: string;
  destino: string;
  destaque: string;
  colunas: Array<{
    titulo: string;
    links: string[];
  }>;
};

const menus: ItemMenu[] = [
  {
    titulo: "NetCat",
    destino: "conta",
    destaque: "Banco digital para movimentar dinheiro, organizar planos e operar com segurança.",
    colunas: [
      { titulo: "Para você", links: ["Conta NetCat", "Cartões por análise", "Nex e boletos"] },
      { titulo: "Planejamento", links: ["Reservas", "Investimentos", "Objetivos"] }
    ]
  },
  {
    titulo: "Conta Digital",
    destino: "conta",
    destaque: "Saldo, pagamentos, Nex e organização do dinheiro em uma conta só.",
    colunas: [
      { titulo: "Use no dia a dia", links: ["Conta completa", "Pagamentos", "Nex interno"] },
      { titulo: "Organize", links: ["Reservas", "Metas", "Alertas inteligentes"] }
    ]
  },
  {
    titulo: "Cartões",
    destino: "cartao",
    destaque: "Ofertas de cartão por análise, do Essencial ao Black.",
    colunas: [
      { titulo: "Cartões", links: ["NetCat Essencial", "NetCat Prime", "NetCat Black"] },
      { titulo: "Controle", links: ["Cartão virtual", "Limites", "Bloqueio rápido"] }
    ]
  },
  {
    titulo: "Empréstimos",
    destino: "conta",
    destaque: "Crédito planejado para simular cenários e organizar compromissos.",
    colunas: [
      { titulo: "Para você", links: ["Crédito pessoal", "Organizar boletos", "Simulação"] },
      { titulo: "Com garantia", links: ["Garantia de veículo", "Consignado", "Antecipação"] }
    ]
  },
  {
    titulo: "Investimentos",
    destino: "empresas",
    destaque: "Reservas, metas e acompanhamento para evoluir seu perfil investidor.",
    colunas: [
      { titulo: "Comece", links: ["Reserva", "Cofres remunerados", "Perfil investidor"] },
      { titulo: "Evolua", links: ["Carteiras", "Relatórios", "Objetivos"] }
    ]
  },
  {
    titulo: "Segurança",
    destino: "seguranca",
    destaque: "Camadas de proteção para acesso, sessão, cartões e Nex.",
    colunas: [
      { titulo: "Proteção", links: ["Criptografia", "Biometria", "Sessão segura"] },
      { titulo: "Controle", links: ["Alertas", "Bloqueios", "Dispositivos confiáveis"] }
    ]
  }
];

export function BarraSuperior() {
  const [buscaAtiva, setBuscaAtiva] = useState(false);
  const campoBusca = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (buscaAtiva) {
      localStorage.setItem("netcatbank_nc_busca_expandida_q7m2", "ativa");
      document.cookie = "ncbank_netcatbank_busca_q7m2=ativa; Path=/; SameSite=Strict; Max-Age=86400";
      campoBusca.current?.focus();
    }
  }, [buscaAtiva]);

  const fecharBusca = () => {
    window.setTimeout(() => {
      if (!document.activeElement?.closest(".busca-global")) {
        setBuscaAtiva(false);
        localStorage.setItem("netcatbank_nc_busca_expandida_q7m2", "fechada");
      }
    }, 120);
  };

  return (
    <header className={`cabecalho ${buscaAtiva ? "cabecalho--busca-ativa" : ""}`}>
      <LinkRolagem ariaLabel="NetCat Bank" className="marca" destino="inicio">
        <span className="marca__bloco">
          <Image
            src="/marca/logo-netcatbank.webp"
            alt=""
            width={76}
            height={56}
            priority
            unoptimized
            className="marca__simbolo"
          />
        </span>
        <span className="marca__texto">NetCat Bank</span>
      </LinkRolagem>

      <nav className="navegacao" aria-label="Navegação principal">
        {menus.map((menu) => (
          <div className="navegacao__item" key={menu.titulo}>
            <LinkRolagem className="navegacao__link" destino={menu.destino}>
              <span>{menu.titulo}</span>
              <ChevronDown aria-hidden="true" size={16} />
            </LinkRolagem>
            <div className="mega-menu">
              <div className="mega-menu__conteudo">
                <aside className="mega-menu__destaque">
                  <span>Para você</span>
                  <h2>{menu.destaque}</h2>
                  <LinkRolagem className="mega-menu__botao" destino={menu.destino}>
                    Saiba mais
                  </LinkRolagem>
                </aside>

                {menu.colunas.map((coluna) => (
                  <div className="mega-menu__coluna" key={coluna.titulo}>
                    <h3>{coluna.titulo}</h3>
                    {coluna.links.map((link) => (
                      <LinkRolagem destino={menu.destino} key={link}>
                        {link}
                      </LinkRolagem>
                    ))}
                  </div>
                ))}

                <div className="mega-menu__imagem" aria-hidden="true">
                  <Image
                    src="/marca/capa-netcatbank.webp"
                    alt=""
                    fill
                    sizes="25vw"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </nav>

      <form
        className="busca-global"
        role="search"
        onBlur={fecharBusca}
        onSubmit={(evento) => evento.preventDefault()}
      >
        <Search aria-hidden="true" size={24} />
        <input
          ref={campoBusca}
          aria-label="Buscar no NetCat Bank"
          placeholder="Busque por cartões, Nex, investimentos..."
          onKeyDown={(evento) => {
            if (evento.key === "Escape") {
              setBuscaAtiva(false);
            }
          }}
        />
        <button type="button" aria-label="Fechar busca" onClick={() => setBuscaAtiva(false)}>
          <X aria-hidden="true" size={22} />
        </button>
      </form>

      <div className="cabecalho__acoes">
        <button className="botao-icone botao-icone--busca" aria-label="Buscar" onClick={() => setBuscaAtiva(true)}>
          <Search aria-hidden="true" size={24} />
        </button>
        <a className="botao botao--cliente" href={urlAreaCliente}>
          Área do Cliente
        </a>
        <a className="botao botao--primario" href={urlAbrirConta}>
          Abrir Conta
        </a>
        <button className="botao-icone botao-icone--mobile" aria-label="Abrir menu">
          <Menu aria-hidden="true" size={24} />
        </button>
      </div>
    </header>
  );
}

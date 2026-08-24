"use client";

import { useEffect } from "react";

const chaveLocal = "netcatbank_nc_guardiao_js_8r4v1";
const nomeCookie = "ncbank_netcatbank_js_ativo_8r4v1";

export function GuardiaoNavegacao() {
  useEffect(() => {
    document.documentElement.classList.add("netcatbank-nc-js-ok-8r4v1");
    localStorage.setItem(chaveLocal, "ativo");
    document.cookie = `${nomeCookie}=ativo; Path=/; SameSite=Strict; Secure; Max-Age=31536000`;

    if (window.location.hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    const seletorMidiaProtegida =
      "img, picture, .marca, .rodape__logo, .abertura__marca, .cartoes-produto__foto, .cartoes-produto__mockup";
    const seletorCampoTexto =
      "input, textarea, [contenteditable='true'], [data-permitir-selecao='true']";
    const seletorTelaProtegida =
      "[data-tela-segura='abertura-conta'], [data-tela-segura='area-cliente'], [data-tela-segura='painel-cliente']";

    const obterAlvo = (evento: Event) => {
      const alvo = evento.target;
      return alvo instanceof Element ? alvo : null;
    };

    const estaEmTelaProtegida = () => Boolean(document.querySelector(seletorTelaProtegida));

    const bloquearBotaoDireito = (evento: Event) => {
      const alvo = obterAlvo(evento);
      if (!alvo) return;

      if (estaEmTelaProtegida() || alvo.closest(seletorMidiaProtegida)) {
        evento.preventDefault();
      }
    };

    const bloquearSelecao = (evento: Event) => {
      const alvo = obterAlvo(evento);
      if (!alvo) return;

      if (alvo.closest(seletorMidiaProtegida)) {
        evento.preventDefault();
        return;
      }

      if (estaEmTelaProtegida() && !alvo.closest(seletorCampoTexto)) {
        evento.preventDefault();
      }
    };

    const bloquearArrasto = (evento: Event) => {
      const alvo = obterAlvo(evento);
      if (!alvo) return;

      if (estaEmTelaProtegida() || alvo.closest(seletorMidiaProtegida)) {
        evento.preventDefault();
      }
    };

    document.addEventListener("contextmenu", bloquearBotaoDireito, { capture: true });
    document.addEventListener("dragstart", bloquearArrasto, { capture: true });
    document.addEventListener("selectstart", bloquearSelecao, { capture: true });

    return () => {
      document.removeEventListener("contextmenu", bloquearBotaoDireito, { capture: true });
      document.removeEventListener("dragstart", bloquearArrasto, { capture: true });
      document.removeEventListener("selectstart", bloquearSelecao, { capture: true });
    };
  }, []);

  return null;
}

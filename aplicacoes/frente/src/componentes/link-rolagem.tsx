"use client";

import type { MouseEvent, ReactNode } from "react";

type PropriedadesLinkRolagem = {
  children: ReactNode;
  className?: string;
  destino?: string;
  ariaLabel?: string;
};

export function LinkRolagem({
  children,
  className,
  destino = "inicio",
  ariaLabel
}: PropriedadesLinkRolagem) {
  const rolar = (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.preventDefault();

    const alvo = document.getElementById(destino);
    if (alvo) {
      alvo.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    window.history.replaceState(null, "", "/");
  };

  return (
    <a aria-label={ariaLabel} className={className} href="/" onClick={rolar}>
      {children}
    </a>
  );
}


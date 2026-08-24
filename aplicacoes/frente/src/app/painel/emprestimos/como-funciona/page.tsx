import type { Metadata } from "next";
import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "Como funciona a análise | NetCat Bank"
};

export default function PaginaEmprestimosComoFunciona() {
  return <PainelCliente telaInicial="emprestimos-como-funciona" />;
}

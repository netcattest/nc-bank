import type { Metadata } from "next";
import { PainelCliente } from "../../../componentes/painel-cliente";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "Empréstimos | NetCat Bank"
};

export default function PaginaEmprestimos() {
  return <PainelCliente telaInicial="emprestimos" />;
}

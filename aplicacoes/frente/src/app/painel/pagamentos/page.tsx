import type { Metadata } from "next";
import { PainelCliente } from "../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Pagamentos | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaPagamentos() {
  return <PainelCliente telaInicial="pagamentos" />;
}

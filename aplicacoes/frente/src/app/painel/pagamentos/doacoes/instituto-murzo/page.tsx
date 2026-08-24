import type { Metadata } from "next";
import { PainelCliente } from "../../../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Instituto Murzo | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaInstitutoMurzo() {
  return <PainelCliente telaInicial="doacao-instituto" />;
}

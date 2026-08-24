import type { Metadata } from "next";
import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "Recarga de celular | NetCat Bank"
};

export default function PaginaRecargaCelular() {
  return <PainelCliente telaInicial="recarga-celular" />;
}

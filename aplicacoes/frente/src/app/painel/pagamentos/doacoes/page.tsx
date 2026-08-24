import type { Metadata } from "next";
import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Doações | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaDoacoes() {
  return <PainelCliente telaInicial="doacoes" />;
}

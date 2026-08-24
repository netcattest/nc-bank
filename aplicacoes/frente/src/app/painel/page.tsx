import type { Metadata } from "next";
import { PainelCliente } from "../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Painel | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaPainel() {
  return <PainelCliente />;
}

import type { Metadata } from "next";
import { PainelCliente } from "../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Saldo | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaSaldo() {
  return <PainelCliente telaInicial="saldo" />;
}

import type { Metadata } from "next";
import { PainelCliente } from "../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Extrato | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaExtrato() {
  return <PainelCliente telaInicial="extrato" />;
}

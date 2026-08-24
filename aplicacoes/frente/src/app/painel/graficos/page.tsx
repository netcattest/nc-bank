import type { Metadata } from "next";
import { PainelCliente } from "../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Gráficos | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaGraficos() {
  return <PainelCliente telaInicial="graficos" />;
}

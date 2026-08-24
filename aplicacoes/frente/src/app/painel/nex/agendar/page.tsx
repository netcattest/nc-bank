import type { Metadata } from "next";
import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Agendar Nex | NC Bank",
  description: "Agende transferências Nex no painel seguro NC Bank."
};

export default function PaginaAgendarNex() {
  return <PainelCliente telaInicial="nex-agendar" />;
}

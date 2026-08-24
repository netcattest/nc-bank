import type { Metadata } from "next";
import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Receber Nex | NC Bank",
  description: "Receba transferências Nex com QR Code seguro no painel NC Bank."
};

export default function PaginaReceberNex() {
  return <PainelCliente telaInicial="nex-receber" />;
}

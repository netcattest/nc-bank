import type { Metadata } from "next";
import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Escanear Nex | NC Bank",
  description: "Escaneie QR Codes Nex no painel seguro NC Bank."
};

export default function PaginaEscanearNex() {
  return <PainelCliente telaInicial="nex-escanear" />;
}

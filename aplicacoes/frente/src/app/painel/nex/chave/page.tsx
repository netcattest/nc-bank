import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata = {
  title: "Chave Nex | NC Bank",
  description: "Crie ou gerencie sua chave Nex no painel seguro do NC Bank."
};

export default function PainelNexChavePage() {
  return <PainelCliente telaInicial="nex-chave" />;
}

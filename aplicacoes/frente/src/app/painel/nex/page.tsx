import { PainelCliente } from "../../../componentes/painel-cliente";

export const metadata = {
  title: "Nex | NC Bank",
  description: "Envie, receba e gerencie suas chaves Nex no painel seguro do NC Bank."
};

export default function PainelNexPage() {
  return <PainelCliente telaInicial="nex" />;
}

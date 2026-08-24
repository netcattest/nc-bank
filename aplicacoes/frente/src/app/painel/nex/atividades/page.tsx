import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata = {
  title: "Atividades Nex | NC Bank",
  description: "Consulte suas atividades Nex no painel seguro NC Bank."
};

export default function PaginaAtividadesNex() {
  return <PainelCliente telaInicial="nex-atividades" />;
}

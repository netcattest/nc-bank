import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata = {
  title: "Enviar Nex | NC Bank",
  description: "Envie dinheiro com segurança pelo Nex no painel NC Bank."
};

export default function PaginaEnviarNex() {
  return <PainelCliente telaInicial="nex-enviar" />;
}

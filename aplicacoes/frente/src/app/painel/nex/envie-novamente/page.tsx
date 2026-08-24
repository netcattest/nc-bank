import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata = {
  title: "Envie novamente | NC Bank",
  description: "Acesse contatos recentes para enviar novamente pelo Nex."
};

export default function PaginaEnvieNovamenteNex() {
  return <PainelCliente telaInicial="nex-recorrentes" />;
}

import { FluxoAberturaConta } from "../../componentes/fluxo-abertura-conta";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Abrir Conta",
  description:
    "Abertura de conta guiada do NetCat Bank com validação de identidade, e-mail e escolha de produto."
};

export default function PaginaAbrirConta() {
  return <FluxoAberturaConta />;
}

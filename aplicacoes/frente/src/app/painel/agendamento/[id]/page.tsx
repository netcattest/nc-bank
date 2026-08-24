import type { Metadata } from "next";
import { PainelCliente } from "../../../../componentes/painel-cliente";

type Parametros = {
  params: Promise<{
    id: string;
  }>;
};

export const metadata: Metadata = {
  title: "Agendamento | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default async function PaginaAgendamento({ params }: Parametros) {
  const { id } = await params;
  return <PainelCliente telaInicial="agendamento" agendamentoId={id} />;
}

import type { Metadata } from "next";
import { PainelCliente } from "../../../../componentes/painel-cliente";

type Parametros = {
  params: Promise<{
    id: string;
  }>;
};

export const metadata: Metadata = {
  title: "Transação | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default async function PaginaTransacao({ params }: Parametros) {
  const { id } = await params;
  return <PainelCliente telaInicial="transacao" transacaoId={id} />;
}

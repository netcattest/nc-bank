import type { Metadata } from "next";
import { PainelCliente } from "../../../../componentes/painel-cliente";

export const metadata: Metadata = {
  title: "Pagar boleto | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaPagamentoBoleto() {
  return <PainelCliente telaInicial="pagamento-boleto" />;
}

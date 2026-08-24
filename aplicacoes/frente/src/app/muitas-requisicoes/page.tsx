import { TelaErro } from "../../componentes/tela-erro";

export const metadata = {
  title: "Muitas Requisições | NetCat Bank",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaMuitasRequisicoes() {
  return (
    <TelaErro
      codigo="429"
      titulo="Muitas verificações em sequência."
      texto="A proteção de acesso identificou várias tentativas em pouco tempo. Aguarde alguns segundos antes de tentar novamente."
      detalhe="netcatbank.com · controle de requisições"
    />
  );
}

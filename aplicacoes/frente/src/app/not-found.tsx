import { TelaErro } from "../componentes/tela-erro";

export default function PaginaNaoEncontrada() {
  return (
    <TelaErro
      codigo="404"
      titulo="Endereço não encontrado."
      texto="A rota solicitada não existe ou ainda não foi liberada no NetCat Bank. Confira a URL ou volte para a página inicial."
      detalhe="netcatbank.com"
    />
  );
}

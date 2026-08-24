"use client";

import { TelaErro } from "../componentes/tela-erro";

type PropriedadesErro = {
  reset: () => void;
};

export default function PaginaErro({ reset }: PropriedadesErro) {
  return (
    <TelaErro
      codigo="500"
      titulo="Serviço indisponível."
      texto="Houve uma falha temporária ao carregar esta área. A navegação continua protegida e você pode tentar novamente."
      detalhe="netcatbank.com · monitoramento de indisponibilidade"
      acaoSecundaria={{
        texto: "Tentar novamente",
        aoClicar: reset
      }}
    />
  );
}

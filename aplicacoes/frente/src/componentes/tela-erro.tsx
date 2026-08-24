"use client";

import Image from "next/image";

type PropriedadesTelaErro = {
  codigo: "404" | "429" | "500";
  titulo: string;
  texto: string;
  detalhe: string;
  acaoSecundaria?: {
    texto: string;
    aoClicar: () => void;
  };
};

export function TelaErro({ codigo, titulo, texto, detalhe, acaoSecundaria }: PropriedadesTelaErro) {
  return (
    <main className={`pagina-erro-app pagina-erro-app--${codigo}`}>
      <Image
        src="/marca/erro-404-netcatbank.webp"
        alt=""
        fill
        sizes="100vw"
        priority
        unoptimized
        className="pagina-erro-app__imagem"
      />
      <div className="pagina-erro-app__filtro" />

      <section className="pagina-erro-app__conteudo" aria-label={`Erro ${codigo}`}>
        <a className="pagina-erro-app__marca" href="/">
          <Image
            src="/marca/logo-netcatbank-branca.webp"
            alt="NetCat Bank"
            width={180}
            height={145}
            unoptimized
          />
          <span>Acesso protegido</span>
        </a>
        <span className="pagina-erro-app__status">Erro {codigo}</span>
        <h1>{titulo}</h1>
        <p>{texto}</p>
        <div className="pagina-erro-app__acoes">
          <a className="botao botao--primario" href="/">
            Voltar ao início
          </a>
          {acaoSecundaria ? (
            <button className="botao botao--vidro" type="button" onClick={acaoSecundaria.aoClicar}>
              {acaoSecundaria.texto}
            </button>
          ) : (
            <a className="botao botao--vidro" href="mailto:contato@netcatbank.com">
              Falar com suporte
            </a>
          )}
        </div>
        <p className="pagina-erro-app__detalhe">{detalhe}</p>
      </section>
    </main>
  );
}

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { urlIndicacoes } from "../../configuracao/publica";
import { LandingIndicacao } from "../../componentes/landing-indicacao";

type Parametros = {
  params: Promise<{
    convite: string;
  }>;
};

const hostIndicacao = (host: string | null) =>
  (host ?? "").split(":")[0]?.toLowerCase().startsWith("indique.") === true;

const nomeDoConvite = (convite: string) => {
  const partes = convite.split("-").filter(Boolean);
  const nome = partes.length > 1 ? partes.slice(0, -1).join(" ") : "";
  if (!nome) return "Um cliente";
  return nome
    .split(" ")
    .filter(Boolean)
    .map((parte) => `${parte.charAt(0).toUpperCase()}${parte.slice(1).toLowerCase()}`)
    .join(" ");
};

export const generateMetadata = async ({ params }: Parametros): Promise<Metadata> => {
  const cabecalhos = await headers();
  if (!hostIndicacao(cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host"))) {
    return {
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const { convite } = await params;
  const primeiroNome = nomeDoConvite(convite);
  const imagem = new URL("/marca/indicacao-landing-netcatbank.png", urlIndicacoes).toString();
  const url = new URL(`/${convite}`, urlIndicacoes).toString();

  return {
    title: `${primeiroNome} convidou você para o NC Bank`,
    description: "Abra sua conta gratuitamente. Você pode ganhar R$ 10 de boas-vindas e seu amigo pode ganhar R$ 25.",
    openGraph: {
      description: "Abra sua conta pelo convite NC Bank e participe da campanha de indicação.",
      images: [
        {
          alt: "Convite NC Bank",
          height: 900,
          url: imagem,
          width: 1600
        }
      ],
      title: `${primeiroNome} convidou você para o NC Bank`,
      type: "website",
      url
    },
    robots: {
      index: false,
      follow: false
    },
    twitter: {
      card: "summary_large_image",
      description: "Abra sua conta pelo convite NC Bank e receba um bônus de boas-vindas.",
      images: [imagem],
      title: `${primeiroNome} convidou você para o NC Bank`
    }
  };
};

export default async function PaginaIndicacaoDireta({ params }: Parametros) {
  const cabecalhos = await headers();
  if (!hostIndicacao(cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host"))) {
    notFound();
  }

  const { convite } = await params;
  return <LandingIndicacao convite={convite} />;
}

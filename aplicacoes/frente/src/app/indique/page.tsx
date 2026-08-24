import type { Metadata } from "next";
import { LandingIndicacao } from "../../componentes/landing-indicacao";

export const metadata: Metadata = {
  title: "Convite NC Bank",
  description: "Abra sua conta pelo convite NC Bank e receba um bônus de boas-vindas.",
  robots: {
    index: false,
    follow: false
  }
};

export default function PaginaIndicacao() {
  return <LandingIndicacao />;
}

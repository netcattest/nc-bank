import "./globals.css";
import { GuardiaoNavegacao } from "../componentes/guardiao-navegacao";
import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";

const urlEstaticos =
  process.env.NEXT_PUBLIC_ESTATICOS_URL ?? "https://estaticos.netcatbank.com";

export const metadata: Metadata = {
  metadataBase: new URL("https://netcatbank.com"),
  title: {
    default: "NetCat Bank",
    template: "%s | NetCat Bank"
  },
  description:
    "NetCat Bank: conta, Nex, cartões por análise e investimentos em uma experiência financeira segura.",
  applicationName: "NetCat Bank",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: `${urlEstaticos}/marca/favicon-16x16.png`, sizes: "16x16", type: "image/png" },
      { url: `${urlEstaticos}/marca/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      { url: `${urlEstaticos}/marca/favicon.png`, sizes: "48x48", type: "image/png" }
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: `${urlEstaticos}/marca/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }
    ]
  },
  openGraph: {
    title: "NetCat Bank",
    description:
      "Conta, Nex, cartões por análise e investimentos em uma experiência financeira segura.",
    url: "https://netcatbank.com",
    siteName: "NetCat Bank",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: `${urlEstaticos}/marca/og-netcatbank.png`,
        width: 1200,
        height: 630,
        alt: "NetCat Bank"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "NetCat Bank",
    description: "Conta, Nex, cartões por análise e investimentos no NetCat Bank.",
    images: [`${urlEstaticos}/marca/og-netcatbank.png`]
  }
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#07090d"
};

type PropriedadesLayout = {
  children: ReactNode;
};

export default function LayoutRaiz({ children }: PropriedadesLayout) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('netcatbank-nc-js-ok-8r4v1')"
          }}
        />
        <GuardiaoNavegacao />
        <div className="bloqueio-js" aria-live="assertive">
          <img src="/marca/logo-netcatbank-branca.webp" alt="NetCat Bank" />
          <h1>Acesso bloqueado</h1>
          <p>
            Ative o JavaScript para acessar o NetCat Bank com segurança.
          </p>
        </div>
        {children}
      </body>
    </html>
  );
}

import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));
const estaticosPublicos = process.env.NEXT_PUBLIC_ESTATICOS_URL ?? "https://estaticos.netcatbank.com";
const desenvolvimento = process.env.NODE_ENV !== "production";
const politicaConteudo = [
  "default-src 'self'",
  `connect-src 'self'${desenvolvimento ? " ws: wss:" : ""}`,
  `img-src 'self' data: blob: ${estaticosPublicos}`,
  `font-src 'self' ${estaticosPublicos}`,
  "media-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  `script-src 'self' 'unsafe-inline'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "trusted-types netcatbank nextjs webpack default",
  ...(desenvolvimento
    ? []
    : [
        "require-trusted-types-for 'script'"
      ]),
  "upgrade-insecure-requests"
].join("; ");

const configuracaoNext: NextConfig = {
  allowedDevOrigins: [
    "localtest.me",
    "*.localtest.me",
    "netcatbank.localtest.me",
    "abrir-conta.localtest.me",
    "abrir-conta.netcatbank.localtest.me",
    "cliente.localtest.me",
    "cliente.netcatbank.localtest.me",
    "area-cliente.localtest.me",
    "area-cliente.netcatbank.localtest.me",
    "painel.localtest.me",
    "painel.netcatbank.localtest.me",
    "dashboard.localtest.me",
    "dashboard.netcatbank.localtest.me",
    "indique.localtest.me",
    "indique.netcatbank.localtest.me",
    "indique.localme",
    "indique.netcatbank.localme"
  ],
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "estaticos.netcatbank.com"
      },
      {
        protocol: "https",
        hostname: "estaticos.localhost",
        port: "8443"
      },
      {
        protocol: "https",
        hostname: "static.localhost",
        port: "8443"
      },
      {
        protocol: "https",
        hostname: "estaticos.netcatbank.localhost",
        port: "8443"
      },
      {
        protocol: "https",
        hostname: "estaticos.localtest.me",
        port: "8443"
      },
      {
        protocol: "https",
        hostname: "static.localtest.me",
        port: "8443"
      },
      {
        protocol: "https",
        hostname: "estaticos.netcatbank.localtest.me",
        port: "8443"
      }
    ]
  },
  output: "standalone",
  outputFileTracingRoot: path.join(diretorioAtual, "../.."),
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Download-Options", value: "noopen" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Content-Security-Policy", value: politicaConteudo },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "Origin-Agent-Cluster", value: "?1" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()"
          }
        ]
      }
    ];
  }
};

export default configuracaoNext;

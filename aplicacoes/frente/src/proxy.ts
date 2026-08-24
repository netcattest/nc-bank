import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const prefixoAbertura = "abrir-conta.";
const prefixosAreaCliente = ["cliente.", "area-cliente."];
const prefixosPainel = ["painel.", "dashboard."];
const prefixoIndicacoes = "indique.";
const urlAbertura =
  process.env.NEXT_PUBLIC_ABRIR_CONTA_URL ?? "https://abrir-conta.netcatbank.com";
const urlAreaCliente =
  process.env.NEXT_PUBLIC_AREA_CLIENTE_URL ?? "https://cliente.netcatbank.com";
const urlPainel =
  process.env.NEXT_PUBLIC_PAINEL_URL ?? "https://painel.netcatbank.com";
const urlIndicacoes =
  process.env.NEXT_PUBLIC_INDICACOES_URL ?? "https://indique.netcatbank.com";

const obterDominio = (host: string | null) => host?.split(":")[0]?.toLowerCase() ?? "";
const obterPorta = (host: string | null) => {
  const porta = host?.split(":")[1] ?? "";
  return /^\d{2,5}$/.test(porta) ? porta : "";
};

const criarUrlCanonica = (requisicao: NextRequest, hostCanonico: string) => {
  const hostOriginal =
    requisicao.headers.get("x-forwarded-host") ??
    requisicao.headers.get("host") ??
    "";
  const porta =
    obterPorta(hostOriginal) ||
    obterPorta(requisicao.headers.get("host")) ||
    requisicao.headers.get("x-forwarded-port") ||
    "";
  const protocolo = requisicao.headers.get("x-forwarded-proto") ?? requisicao.nextUrl.protocol.replace(":", "");
  const portaPublica = porta && !["80", "443"].includes(porta) ? `:${porta}` : "";

  return new URL(
    `${protocolo}://${hostCanonico}${portaPublica}${requisicao.nextUrl.pathname}${requisicao.nextUrl.search}`
  );
};

const hostsCanonicosDesenvolvimento = new Map([
  ["abrir-conta.localtest.me", "abrir-conta.netcatbank.localtest.me"],
  ["cliente.localtest.me", "cliente.netcatbank.localtest.me"],
  ["area-cliente.localtest.me", "area-cliente.netcatbank.localtest.me"],
  ["painel.localtest.me", "painel.netcatbank.localtest.me"],
  ["dashboard.localtest.me", "dashboard.netcatbank.localtest.me"],
  ["indique.localtest.me", "indique.netcatbank.localtest.me"],
  ["abrir-conta.localhost", "abrir-conta.netcatbank.localhost"],
  ["cliente.localhost", "cliente.netcatbank.localhost"],
  ["area-cliente.localhost", "area-cliente.netcatbank.localhost"],
  ["painel.localhost", "painel.netcatbank.localhost"],
  ["dashboard.localhost", "dashboard.netcatbank.localhost"],
  ["indique.localhost", "indique.netcatbank.localhost"],
  ["abrir-conta.localme", "abrir-conta.netcatbank.localme"],
  ["cliente.localme", "cliente.netcatbank.localme"],
  ["area-cliente.localme", "area-cliente.netcatbank.localme"],
  ["painel.localme", "painel.netcatbank.localme"],
  ["dashboard.localme", "dashboard.netcatbank.localme"],
  ["indique.localme", "indique.netcatbank.localme"]
]);

const eSubdominioAbertura = (host: string | null) => {
  const dominio = obterDominio(host);
  return dominio.startsWith(prefixoAbertura);
};

const eSubdominioAreaCliente = (host: string | null) => {
  const dominio = host?.split(":")[0]?.toLowerCase() ?? "";
  return prefixosAreaCliente.some((prefixo) => dominio.startsWith(prefixo));
};

const eSubdominioPainel = (host: string | null) => {
  const dominio = host?.split(":")[0]?.toLowerCase() ?? "";
  return prefixosPainel.some((prefixo) => dominio.startsWith(prefixo));
};

const eSubdominioIndicacoes = (host: string | null) => {
  const dominio = obterDominio(host);
  return dominio.startsWith(prefixoIndicacoes);
};

export function proxy(requisicao: NextRequest) {
  const { nextUrl } = requisicao;
  const hostCanonico = hostsCanonicosDesenvolvimento.get(obterDominio(requisicao.headers.get("host")));

  if (hostCanonico) {
    return NextResponse.redirect(criarUrlCanonica(requisicao, hostCanonico));
  }

  const estaNoSubdominioAbertura = eSubdominioAbertura(requisicao.headers.get("host"));
  const estaNoSubdominioAreaCliente = eSubdominioAreaCliente(requisicao.headers.get("host"));
  const estaNoSubdominioPainel = eSubdominioPainel(requisicao.headers.get("host"));
  const estaNoSubdominioIndicacoes = eSubdominioIndicacoes(requisicao.headers.get("host"));

  const caminhoProtegido =
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.startsWith("/marca") ||
    nextUrl.pathname.startsWith("/canal-seguro-api") ||
    /\.[a-z0-9]{2,8}$/i.test(nextUrl.pathname);

  if (estaNoSubdominioIndicacoes && !caminhoProtegido && nextUrl.pathname === "/" && nextUrl.search.length > 1) {
    const conviteNaBusca = nextUrl.search.slice(1).replace(/=$/, "");
    if (/^[a-z0-9-]{8,140}$/i.test(conviteNaBusca)) {
      const destino = nextUrl.clone();
      destino.pathname = `/${conviteNaBusca}`;
      destino.search = "";
      return NextResponse.redirect(destino);
    }
  }

  if (estaNoSubdominioIndicacoes && !caminhoProtegido && nextUrl.pathname === "/") {
    const destino = nextUrl.clone();
    destino.pathname = "/indique";
    return NextResponse.rewrite(destino);
  }

  if (estaNoSubdominioIndicacoes && !caminhoProtegido && nextUrl.pathname === "/indique") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (estaNoSubdominioIndicacoes && !caminhoProtegido && nextUrl.pathname.startsWith("/indique/")) {
    const destino = nextUrl.clone();
    destino.pathname = nextUrl.pathname.replace(/^\/indique/, "") || "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  if (!estaNoSubdominioIndicacoes && nextUrl.pathname === "/indique") {
    return NextResponse.redirect(urlIndicacoes);
  }

  if (estaNoSubdominioAbertura && nextUrl.pathname === "/") {
    const destino = nextUrl.clone();
    destino.pathname = "/abrir-conta";
    return NextResponse.rewrite(destino);
  }

  if (estaNoSubdominioAbertura && nextUrl.pathname === "/abrir-conta") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (!estaNoSubdominioAbertura && nextUrl.pathname === "/abrir-conta") {
    return NextResponse.redirect(urlAbertura);
  }

  if (estaNoSubdominioAreaCliente && nextUrl.pathname === "/") {
    const destino = nextUrl.clone();
    destino.pathname = "/area-cliente";
    return NextResponse.rewrite(destino);
  }

  if (estaNoSubdominioAreaCliente && nextUrl.pathname === "/area-cliente") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (!estaNoSubdominioAreaCliente && nextUrl.pathname === "/area-cliente") {
    return NextResponse.redirect(urlAreaCliente);
  }

  if (estaNoSubdominioPainel && nextUrl.pathname === "/") {
    const destino = nextUrl.clone();
    destino.pathname = "/painel";
    return NextResponse.rewrite(destino);
  }

  if (estaNoSubdominioPainel && nextUrl.pathname === "/painel") {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (!estaNoSubdominioPainel && nextUrl.pathname === "/painel") {
    return NextResponse.redirect(urlPainel);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"]
};

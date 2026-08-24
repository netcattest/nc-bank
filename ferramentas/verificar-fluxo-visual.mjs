#!/usr/bin/env node
import { createHmac } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const urlAbertura =
  process.env.NCBANK_TESTE_ABERTURA_URL ?? "https://abrir-conta.netcatbank.localtest.me:8443/";
const urlPainel =
  process.env.NCBANK_TESTE_PAINEL_URL ?? "https://painel.netcatbank.localtest.me:8443/";
const diretorioResultados = process.env.NCBANK_TESTE_VISUAL_DIR ?? "test-results";
const senhaTeste = "829173";
const alfabetoBase32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const chavesLocaisSensiveis = [
  "netcatbank_nc_abertura_conta_v9t3",
  "netcatbank_nc_area_cliente_l8q2",
  "netcatbank_nc_primeiro_acesso_w4p9",
  "netcatbank_nc_apresentacao_local_m7q2"
];

const criarCpfValido = () => {
  const calcular = (numeros) => {
    const soma = numeros.reduce((total, numero, indice) => total + numero * (numeros.length + 1 - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  base.push(calcular(base));
  base.push(calcular(base));
  return base.join("");
};

const decodificarBase32 = (valor) => {
  const limpo = valor.replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  let bits = "";

  for (const caractere of limpo) {
    const indice = alfabetoBase32.indexOf(caractere);
    if (indice === -1) throw new Error("segredo_2fa_invalido");
    bits += indice.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let indice = 0; indice + 8 <= bits.length; indice += 8) {
    bytes.push(Number.parseInt(bits.slice(indice, indice + 8), 2));
  }

  return Buffer.from(bytes);
};

const gerarTotpVisual = (segredo) => {
  const chave = decodificarBase32(segredo);
  const contador = Math.floor(Date.now() / 30_000);
  const contadorBuffer = Buffer.alloc(8);
  contadorBuffer.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac("sha1", chave).update(contadorBuffer).digest();
  const deslocamento = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const codigo =
    (((hmac[deslocamento] ?? 0) & 0x7f) << 24) |
    (((hmac[deslocamento + 1] ?? 0) & 0xff) << 16) |
    (((hmac[deslocamento + 2] ?? 0) & 0xff) << 8) |
    ((hmac[deslocamento + 3] ?? 0) & 0xff);

  return String(codigo % 1_000_000).padStart(6, "0");
};

const clicarBotao = async (pagina, nome) => {
  await pagina.getByRole("button", { name: nome }).click({ timeout: 20_000 });
};

const abrirFluxoAbertura = async (pagina) => {
  const campoNome = pagina.getByPlaceholder("Digite nome e sobrenome");

  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    await pagina.goto(urlAbertura, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await pagina.waitForLoadState("networkidle", { timeout: 18_000 }).catch(() => {});
    await pagina.waitForTimeout(4_500);

    const abriu = await campoNome
      .waitFor({ timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (abriu) return;
  }

  await pagina.screenshot({
    path: `${diretorioResultados}/abrir-conta-campo-nome-falha.png`,
    fullPage: false
  });
  throw new Error("campo_nome_indisponivel");
};

const falhar = (mensagem) => {
  console.error(`falhou  ${mensagem}`);
  process.exitCode = 1;
};

const executar = async () => {
  await mkdir(diretorioResultados, { recursive: true });

  const cpf = criarCpfValido();
  const email = `visual.${Date.now()}${Math.floor(Math.random() * 1_000_000)}@netcatbank.test`;
  let chaveManual2fa = "";
  const navegador = await chromium.launch({ headless: true });

  try {
    const contexto = await navegador.newContext({
      ignoreHTTPSErrors: true,
      viewport: {
        width: 1440,
        height: 920
      }
    });
    const pagina = await contexto.newPage();
    const errosConsole = [];
    const falhasRede = [];
    const respostasHttpErro = [];

    pagina.on("console", (mensagem) => {
      if (mensagem.type() === "error") {
        const local = mensagem.location();
        errosConsole.push(`${mensagem.text()} ${local.url ?? ""}`);
      }
    });
    pagina.on("response", (resposta) => {
      if (resposta.status() >= 400) {
        respostasHttpErro.push(`${resposta.status()} ${resposta.url()}`);
      }
    });
    pagina.on("requestfailed", (requisicao) => {
      falhasRede.push(`${requisicao.method()} ${requisicao.url()} ${requisicao.failure()?.errorText ?? ""}`);
    });

    await abrirFluxoAbertura(pagina);
    await pagina.getByPlaceholder("Digite nome e sobrenome").fill("Daniel Auditor");
    await clicarBotao(pagina, "Continuar");

    await pagina.getByPlaceholder("000.000.000-00").fill(cpf);
    await clicarBotao(pagina, "Continuar");
    await pagina.getByPlaceholder("voce@email.com").waitFor({ timeout: 20_000 });

    await pagina.getByPlaceholder("voce@email.com").fill(email);
    await clicarBotao(pagina, "Continuar");

    await pagina.getByPlaceholder("repita o e-mail").fill(email);
    await clicarBotao(pagina, "Continuar");

    for (const checkbox of await pagina.locator("input[type='checkbox']").all()) {
      await checkbox.check({ force: true });
    }
    await clicarBotao(pagina, "Continuar");

    await pagina.getByRole("button", { name: /Somente a conta/ }).click();
    await clicarBotao(pagina, "Reservar abertura");
    await pagina.screenshot({
      path: `${diretorioResultados}/fluxo-visual-produto.png`,
      fullPage: false
    });

    await pagina.waitForTimeout(11_200);
    await pagina.getByRole("button", { name: /Selecionar data/ }).click();
    await pagina.locator(".abertura__calendario-grade button:not(:disabled)").first().click();
    await clicarBotao(pagina, "Continuar");

    await pagina.getByPlaceholder("******").fill(senhaTeste);
    await clicarBotao(pagina, "Continuar");

    await pagina.getByPlaceholder("******").fill(senhaTeste);
    await clicarBotao(pagina, "Concluir abertura");

    await pagina.waitForURL(/painel\./, { timeout: 25_000 });
    await pagina.waitForLoadState("networkidle");
    await pagina.waitForTimeout(1_500);
    const popup2fa = pagina.getByRole("dialog", { name: /verificação em duas etapas/i });
    const popup2faVisivel = await popup2fa.isVisible().catch(() => false);
    if (popup2faVisivel) {
      await pagina.screenshot({
        path: `${diretorioResultados}/fluxo-visual-painel-2fa-popup.png`,
        fullPage: false
      });
      const textoPopup2fa = ((await popup2fa.textContent()) ?? "").replace(/\s+/g, " ");
      if (
        !textoPopup2fa.includes("Reforce a segurança da sua conta") ||
        !textoPopup2fa.includes("Ativar 2FA")
      ) {
        falhar("popup de ativacao 2FA nao exibiu orientacao esperada");
      }
      await pagina.getByRole("button", { name: /Ativar 2FA/ }).click();
      await popup2fa.getByText(/Escaneie o QR/i).waitFor({ timeout: 10_000 });
      await pagina.screenshot({
        path: `${diretorioResultados}/fluxo-visual-painel-2fa-qr.png`,
        fullPage: false
      });
      const textoQr2fa = ((await popup2fa.textContent()) ?? "").replace(/\s+/g, " ");
      if (!textoQr2fa.includes("Chave manual") || !textoQr2fa.includes("Confirmar ativação")) {
        falhar("etapa de QR do 2FA nao exibiu chave manual e confirmacao");
      }
      const chaveManualTexto = await popup2fa.locator(".painel-2fa__qr-bloco small").innerText();
      chaveManual2fa = chaveManualTexto.replace(/^Chave manual:\s*/i, "").replace(/[^A-Z2-7]/g, "");
      await popup2fa.getByPlaceholder("000 000").fill(gerarTotpVisual(chaveManual2fa));
      await popup2fa.getByRole("button", { name: /Confirmar ativação/ }).click();
      await popup2fa.getByText(/Verificação em duas etapas ativada/i).waitFor({ timeout: 10_000 });
      await popup2fa.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
      await pagina.waitForTimeout(400);
    } else {
      falhar("painel nao exibiu popup comercial de ativacao 2FA");
    }
    await pagina.screenshot({
      path: `${diretorioResultados}/fluxo-visual-painel.png`,
      fullPage: false
    });

    const botaoRecolherLateral = pagina.getByRole("button", { name: "Recolher barra lateral" });
    if ((await botaoRecolherLateral.count()) > 0) {
      await botaoRecolherLateral.click();
      await pagina.waitForTimeout(450);
      await pagina.screenshot({
        path: `${diretorioResultados}/fluxo-visual-painel-lateral-recolhida.png`,
        fullPage: false
      });
      await pagina.getByRole("button", { name: "Expandir barra lateral" }).click();
      await pagina.waitForTimeout(250);
    }

    const textoPainel = (await pagina.locator("body").innerText()).replace(/\s+/g, " ");
    const textoPainelCompleto = ((await pagina.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.waitForTimeout(600);
    const navMobileVisivel = await pagina
      .getByLabel("Navegação móvel do painel")
      .isVisible()
      .catch(() => false);
    await pagina.screenshot({
      path: `${diretorioResultados}/fluxo-visual-painel-mobile.png`,
      fullPage: false
    });
    const cookiesPainel = await contexto.cookies(pagina.url());
    const temSessao = cookiesPainel.some((cookie) => cookie.name === "ncbank_netcatbank_sessao_z5m9");
    const temSinalCompartilhado = cookiesPainel.some(
      (cookie) =>
        cookie.name === "ncbank_netcatbank_cliente_sinal_r9v3" &&
        (cookie.domain.includes("netcatbank.localtest.me") || cookie.domain === ".localtest.me")
    );

    if (
      !textoPainel.includes("Olá, Daniel A.") ||
      textoPainel.includes("Olá, Daniel A..") ||
      textoPainel.includes("Olá, Daniel Auditor.")
    ) {
      falhar("painel autenticado nao exibiu o nome abreviado no cumprimento");
    }
    if (
      textoPainel.includes("Área segura NC Bank") ||
      textoPainel.includes("Sessão verificada") ||
      textoPainel.includes("Seu painel está pronto") ||
      textoPainel.includes("Conta ativa para operações internas")
    ) {
      falhar("painel autenticado exibiu textos removidos do cabecalho/saldo");
    }
    if (!textoPainel.includes("Saldo disponível") || !textoPainel.includes("R$ 0,00")) {
      falhar("painel autenticado nao exibiu saldo");
    }
    if (
      textoPainel.includes("Buscar no NC Bank") ||
      textoPainel.includes("Notificações") ||
      textoPainel.includes("Inatividade: 20 min")
    ) {
      falhar("painel exibiu conteudo removido da dashboard");
    }
    if (
      !textoPainel.includes("Ações rápidas") ||
      !textoPainel.includes("Últimas transações") ||
      !textoPainel.includes("Proteção") ||
      !textoPainel.includes("Conta") ||
      !textoPainel.includes("Nex") ||
      !textoPainel.includes("Cartões") ||
      !textoPainel.includes("Investimentos") ||
      !textoPainel.includes("Pagamentos") ||
      !textoPainel.includes("Empréstimos")
    ) {
      falhar("painel nao exibiu a dashboard bancaria completa");
    }
    if (!navMobileVisivel) {
      falhar("painel mobile nao exibiu navegacao inferior");
    }
    if (!temSessao) falhar("cookie de sessao nao ficou disponivel para o painel");
    if (!temSinalCompartilhado) falhar("sinal do cliente nao ficou compartilhado entre subdominios");

    const segundaPagina = await contexto.newPage();
    segundaPagina.on("console", (mensagem) => {
      if (mensagem.type() === "error") {
        const local = mensagem.location();
        errosConsole.push(`${mensagem.text()} ${local.url ?? ""}`);
      }
    });
    segundaPagina.on("response", (resposta) => {
      if (resposta.status() >= 400) {
        respostasHttpErro.push(`${resposta.status()} ${resposta.url()}`);
      }
    });
    segundaPagina.on("requestfailed", (requisicao) => {
      falhasRede.push(`${requisicao.method()} ${requisicao.url()} ${requisicao.failure()?.errorText ?? ""}`);
    });
    await segundaPagina.goto(urlPainel, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await segundaPagina.getByText("Painel já aberto").waitFor({ timeout: 10_000 });
    const textoSegundaJanela = ((await segundaPagina.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
    await segundaPagina.screenshot({
      path: `${diretorioResultados}/fluxo-visual-painel-janela-bloqueada.png`,
      fullPage: false
    });
    await segundaPagina.close();

    if (!textoSegundaJanela.includes("apenas uma janela do painel")) {
      falhar("segunda janela do painel nao exibiu bloqueio de janela unica");
    }

    const textoPrimeiraAposBloqueio = ((await pagina.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
    if (!textoPrimeiraAposBloqueio.includes("Olá, Daniel A.")) {
      falhar("primeira janela do painel perdeu autorizacao apos abrir segunda janela");
    }
    if (falhasRede.length > 0) falhar(`falhas de rede no fluxo visual: ${falhasRede.join(" | ")}`);
    if (respostasHttpErro.length > 0) falhar(`respostas HTTP inesperadas: ${respostasHttpErro.join(" | ")}`);

    await pagina.setViewportSize({ width: 1440, height: 920 });
    await pagina.locator(".painel-dashboard__saldo").scrollIntoViewIfNeeded({ timeout: 10_000 });
    await pagina.waitForTimeout(300);
    await pagina.screenshot({
      path: `${diretorioResultados}/fluxo-visual-painel-modulos.png`,
      fullPage: false
    });

    await pagina.evaluate((chaves) => {
      for (const chave of chaves) {
        localStorage.setItem(chave, "valor-sensivel-de-teste");
        sessionStorage.setItem(chave, "valor-sensivel-de-teste");
      }
    }, chavesLocaisSensiveis);
    await pagina.getByRole("button", { name: "Sair" }).click();
    await pagina.waitForURL(/cliente\./, { timeout: 20_000 });
    const textoClienteAposLogout = ((await pagina.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
    if (textoClienteAposLogout.includes("Primeiro acesso")) {
      falhar("area do cliente ainda exibiu opcao de primeiro acesso");
    }
    const estadoLocalAposLogout = await pagina.evaluate((chaves) =>
      chaves.map((chave) => ({
        chave,
        local: localStorage.getItem(chave),
        sessao: sessionStorage.getItem(chave)
      })),
      chavesLocaisSensiveis
    );

    if (estadoLocalAposLogout.some((item) => item.local !== null || item.sessao !== null)) {
      falhar("logout nao limpou estado sensivel local do navegador");
    }

    await pagina.getByPlaceholder("000.000.000-00").fill(cpf);
    await pagina.getByPlaceholder("******").fill(senhaTeste);
    await pagina.getByRole("button", { name: "Acessar conta" }).click();
    await pagina.getByText("Verifique sua conta").waitFor({ timeout: 15_000 });
    const campoLogin2fa = pagina.getByPlaceholder("000 000");
    await campoLogin2fa.waitFor({ timeout: 10_000 });
    await pagina.screenshot({
      path: `${diretorioResultados}/fluxo-visual-area-cliente-2fa.png`,
      fullPage: false
    });
    const textoLogin2fa = ((await pagina.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
    if (!textoLogin2fa.includes("Código do autenticador") || !textoLogin2fa.includes("Verificar conta")) {
      falhar("login com 2FA ativo nao exibiu etapa de autenticador");
    }
    if (textoLogin2fa.includes("Criar conta") || textoLogin2fa.includes("Primeiro acesso")) {
      falhar("login com 2FA ativo exibiu atalhos indevidos de abertura/primeiro acesso");
    }

    await campoLogin2fa.fill(gerarTotpVisual(chaveManual2fa));
    await pagina.getByRole("button", { name: "Verificar conta" }).click();
    await pagina.waitForURL(/painel\./, { timeout: 20_000 });
    await pagina.getByText("Olá, Daniel A.").waitFor({ timeout: 15_000 });
    const textoPainelApos2fa = ((await pagina.locator("body").textContent()) ?? "").replace(/\s+/g, " ");
    if (!textoPainelApos2fa.includes("Olá, Daniel A.")) {
      falhar("login com codigo 2FA nao abriu o painel autenticado");
    }

    const errosReais = errosConsole.filter(
      (erro) =>
        !erro.includes("Failed to load resource: the server responded with a status of 401") &&
        !erro.includes("React DevTools")
    );
    if (errosReais.length > 0) falhar(`console com erro: ${errosReais.join(" | ")}`);

    if (!process.exitCode) {
      console.log("ok     fluxo visual de abertura e painel autenticado");
      console.log(`ok     cpf ${cpf} email ${email}`);
      console.log(
        `ok     screenshots em ${diretorioResultados}/fluxo-visual-produto.png, fluxo-visual-painel-2fa-popup.png, fluxo-visual-painel-2fa-qr.png, fluxo-visual-painel.png, fluxo-visual-painel-mobile.png, fluxo-visual-painel-janela-bloqueada.png, fluxo-visual-painel-modulos.png e fluxo-visual-area-cliente-2fa.png`
      );
    }
  } finally {
    await navegador.close();
  }
};

executar().catch((erro) => {
  console.error("falhou  verificacao visual interrompida", erro);
  process.exit(1);
});

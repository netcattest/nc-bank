import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const diretorioAtual = path.dirname(fileURLToPath(import.meta.url));
const raizProjeto = path.resolve(diretorioAtual, "..");
const origemLogo = path.join(raizProjeto, "logo.png");
const origemCapa = path.join(raizProjeto, "capa.png");
const origemCapa2 = path.join(raizProjeto, "capa2.png");
const origemCartaoBolso = path.join(raizProjeto, "cartao-bolso.png");
const origemErro404 = path.join(raizProjeto, "404.png");
const destinoPublico = path.join(raizProjeto, "aplicacoes/frente/public");
const destinoMarca = path.join(destinoPublico, "marca");

const vermelhoDaMarca = ({ r, g, b, a }) =>
  a > 16 && r > 130 && r > g * 1.35 && r > b * 1.35;

const limitar = (valor, minimo, maximo) => Math.min(Math.max(valor, minimo), maximo);

const encontrarAreaDaMarca = async () => {
  const { data, info } = await sharp(origemLogo)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  let pixelsEncontrados = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const indice = (y * info.width + x) * 4;
      const pixel = {
        r: data[indice],
        g: data[indice + 1],
        b: data[indice + 2],
        a: data[indice + 3]
      };

      if (!vermelhoDaMarca(pixel)) {
        continue;
      }

      pixelsEncontrados += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (pixelsEncontrados === 0) {
    return {
      horizontal: { left: 0, top: 0, width: info.width, height: info.height },
      quadrada: {
        left: Math.floor((info.width - info.height) / 2),
        top: 0,
        width: info.height,
        height: info.height
      }
    };
  }

  const margemHorizontal = 96;
  const margemVertical = 92;
  const esquerda = limitar(minX - margemHorizontal, 0, info.width - 1);
  const topo = limitar(minY - margemVertical, 0, info.height - 1);
  const direita = limitar(maxX + margemHorizontal, esquerda + 1, info.width);
  const base = limitar(maxY + margemVertical, topo + 1, info.height);
  const largura = direita - esquerda;
  const altura = base - topo;

  const centroX = Math.floor((minX + maxX) / 2);
  const centroY = Math.floor((minY + maxY) / 2);
  const lado = Math.min(
    Math.max(maxX - minX, maxY - minY) + 220,
    Math.min(info.width, info.height)
  );
  const quadradoEsquerda = limitar(Math.floor(centroX - lado / 2), 0, info.width - lado);
  const quadradoTopo = limitar(Math.floor(centroY - lado / 2), 0, info.height - lado);

  return {
    horizontal: { left: esquerda, top: topo, width: largura, height: altura },
    quadrada: { left: quadradoEsquerda, top: quadradoTopo, width: lado, height: lado }
  };
};

const salvarLogoLimpaNaRaiz = async () => {
  const temporario = path.join(raizProjeto, "logo.limpa.png");
  await sharp(origemLogo).rotate().png({ compressionLevel: 9, palette: false }).toFile(temporario);
  await fs.rename(temporario, origemLogo);
};

const criarLogoTransparente = async (area, corSubstituta) => {
  const { data, info } = await sharp(origemLogo)
    .rotate()
    .extract(area)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let indice = 0; indice < data.length; indice += 4) {
    const pixel = {
      r: data[indice],
      g: data[indice + 1],
      b: data[indice + 2],
      a: data[indice + 3]
    };

    if (vermelhoDaMarca(pixel)) {
      if (corSubstituta) {
        data[indice] = corSubstituta.r;
        data[indice + 1] = corSubstituta.g;
        data[indice + 2] = corSubstituta.b;
      }
      continue;
    }

    data[indice + 3] = 0;
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  });
};

const gerarLogoBranca = async (area) => {
  const logoBranca = (await criarLogoTransparente(area.horizontal, { r: 255, g: 255, b: 255 }))
    .resize({ width: 960, withoutEnlargement: true });

  await logoBranca
    .clone()
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(destinoMarca, "logo-netcatbank-branca.png"));

  await logoBranca
    .clone()
    .webp({ effort: 6, quality: 92 })
    .toFile(path.join(destinoMarca, "logo-netcatbank-branca.webp"));
};

const prepararImagemDeCapa = async (origem, nomeArquivo) => {
  try {
    await fs.access(origem);
  } catch {
    return;
  }

  const temporario = path.join(
    raizProjeto,
    `${path.basename(origem, path.extname(origem))}.limpa.png`
  );
  const base = sharp(origem).rotate();

  await base.clone().png({ compressionLevel: 9, palette: false }).toFile(temporario);
  await fs.rename(temporario, origem);

  await sharp(origem)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(destinoMarca, `${nomeArquivo}.png`));

  await sharp(origem)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .webp({ effort: 6, quality: 88 })
    .toFile(path.join(destinoMarca, `${nomeArquivo}.webp`));

  await sharp(origem)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .avif({ effort: 7, quality: 58 })
    .toFile(path.join(destinoMarca, `${nomeArquivo}.avif`));
};

const prepararCapa = async () => {
  await prepararImagemDeCapa(origemCapa, "capa-netcatbank");
  await prepararImagemDeCapa(origemCapa2, "capa2-netcatbank");
};

const prepararImagemCartaoBolso = async () => {
  await prepararImagemDeCapa(origemCartaoBolso, "cartao-bolso-netcatbank");
};

const gerarMockupCartoes = async () => {
  const cartoes = [
    {
      nome: "NetCat Essencial",
      etiqueta: "Conta aprovada",
      fundo: ["#f7f8fb", "#dfe6ef", "#b9c4d2"],
      texto: "#07111f",
      itens: ["Nex interno", "Cartão virtual", "Controle no app"]
    },
    {
      nome: "NetCat Livre",
      etiqueta: "Limite sob análise",
      fundo: ["#202832", "#12161d", "#ff263d"],
      texto: "#ffffff",
      itens: ["Compras online", "Alertas em tempo real", "Limite ajustavel"]
    },
    {
      nome: "NetCat Prime",
      etiqueta: "Benefícios ampliados",
      fundo: ["#15231b", "#0b130f", "#2fb46b"],
      texto: "#ffffff",
      itens: ["Metas e viagens", "Atendimento priorizado", "Mais controle"]
    },
    {
      nome: "NetCat Black",
      etiqueta: "Convite por análise",
      fundo: ["#151515", "#050609", "#d8b875"],
      texto: "#ffffff",
      itens: ["Experiencia premium", "Limite evolutivo", "Perfil selecionado"]
    }
  ];

  const cartaoSvg = ({ nome, etiqueta, fundo, texto, itens }, indice) => {
    const x = 84 + indice * 370;
    const y = 190;
    const painel = `
      <rect x="${x}" y="${y}" width="312" height="520" rx="22" fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.22)"/>
      <text x="${x + 28}" y="${y + 50}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="26" font-weight="850" fill="#ffffff">${nome}</text>
      <text x="${x + 28}" y="${y + 84}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="17" font-weight="750" fill="#aab4c2">${etiqueta}</text>
      <g transform="translate(${x + 28} ${y + 122})">
        <rect width="256" height="164" rx="18" fill="url(#cartao-${indice})" stroke="rgba(255,255,255,0.18)"/>
        <path d="M0 126 C66 98 112 148 178 116 C214 99 232 72 256 84 L256 164 L0 164 Z" fill="rgba(255,255,255,0.08)"/>
        <text x="22" y="46" font-family="Inter, Arial, Helvetica, sans-serif" font-size="30" font-weight="950" fill="${indice === 0 ? "#ff263d" : "#ffffff"}">NB</text>
        <path d="M211 36 q18 0 18 18 q0 18 -18 18 q-18 0 -18 -18 q0 -18 18 -18Z" fill="${indice === 0 ? "#ff263d" : fundo[2]}" opacity="0.92"/>
        <rect x="24" y="78" width="38" height="30" rx="6" fill="${indice === 0 ? "#d8b875" : "rgba(216,184,117,0.88)"}"/>
        <path d="M32 78 v30 M54 78 v30 M24 92 h38" stroke="rgba(7,17,31,0.34)" stroke-width="1.5"/>
        <text x="22" y="136" font-family="Inter, Arial, Helvetica, sans-serif" font-size="15" font-weight="800" fill="${texto}">NetCat Bank</text>
      </g>
      ${itens
        .map(
          (item, itemIndice) => `
            <circle cx="${x + 34}" cy="${y + 340 + itemIndice * 42}" r="5" fill="#ff263d"/>
            <text x="${x + 52}" y="${y + 348 + itemIndice * 42}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="19" font-weight="720" fill="#e9eef5">${item}</text>
          `
        )
        .join("")}
      <rect x="${x + 28}" y="${y + 458}" width="132" height="38" rx="19" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
      <text x="${x + 48}" y="${y + 483}" font-family="Inter, Arial, Helvetica, sans-serif" font-size="15" font-weight="850" fill="#ffffff">por análise</text>
    `;

    return { painel, fundo };
  };

  const gradientes = cartoes
    .map(
      (cartao, indice) => `
        <linearGradient id="cartao-${indice}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${cartao.fundo[0]}"/>
          <stop offset="0.62" stop-color="${cartao.fundo[1]}"/>
          <stop offset="1" stop-color="${cartao.fundo[2]}"/>
        </linearGradient>
      `
    )
    .join("");

  const paineis = cartoes.map(cartaoSvg).map(({ painel }) => painel).join("");

  const svg = `
    <svg width="1600" height="850" viewBox="0 0 1600 850" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#141414"/>
          <stop offset="0.56" stop-color="#07090d"/>
          <stop offset="1" stop-color="#180509"/>
        </linearGradient>
        <radialGradient id="luz" cx="0.78" cy="0.06" r="0.8">
          <stop offset="0" stop-color="rgba(255,38,61,0.28)"/>
          <stop offset="1" stop-color="rgba(255,38,61,0)"/>
        </radialGradient>
        ${gradientes}
      </defs>
      <rect width="1600" height="850" fill="url(#fundo)"/>
      <rect width="1600" height="850" fill="url(#luz)"/>
      <path d="M76 118 H1524" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
      <text x="84" y="76" font-family="Inter, Arial, Helvetica, sans-serif" font-size="24" font-weight="850" fill="#ff8d9a">Para você</text>
      <text x="84" y="138" font-family="Inter, Arial, Helvetica, sans-serif" font-size="58" font-weight="950" fill="#ffffff">Um cartão NetCat para cada perfil</text>
      <text x="1120" y="96" font-family="Inter, Arial, Helvetica, sans-serif" font-size="24" font-weight="760" fill="#d8dde5">Cada oferta depende da análise da conta.</text>
      ${paineis}
    </svg>
  `;

  const imagem = sharp(Buffer.from(svg)).resize({ width: 1600, withoutEnlargement: true });

  await imagem
    .clone()
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(destinoMarca, "cartoes-netcatbank.png"));

  await imagem
    .clone()
    .webp({ effort: 6, quality: 92 })
    .toFile(path.join(destinoMarca, "cartoes-netcatbank.webp"));

  await imagem
    .clone()
    .avif({ effort: 7, quality: 62 })
    .toFile(path.join(destinoMarca, "cartoes-netcatbank.avif"));
};

const prepararErro404 = async () => {
  try {
    await fs.access(origemErro404);
  } catch {
    return;
  }

  const temporario = path.join(raizProjeto, "404.limpa.png");
  const base = sharp(origemErro404).rotate();

  await base.clone().png({ compressionLevel: 9, palette: false }).toFile(temporario);
  await fs.rename(temporario, origemErro404);

  await sharp(origemErro404)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: false })
    .toFile(path.join(destinoMarca, "erro-404-netcatbank.png"));

  await sharp(origemErro404)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .webp({ effort: 6, quality: 88 })
    .toFile(path.join(destinoMarca, "erro-404-netcatbank.webp"));

  await sharp(origemErro404)
    .rotate()
    .resize({ width: 2200, withoutEnlargement: true })
    .avif({ effort: 7, quality: 58 })
    .toFile(path.join(destinoMarca, "erro-404-netcatbank.avif"));
};

const gerarImagemOpenGraph = async (logoBuffer) => {
  const svg = `
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#07090d"/>
          <stop offset="0.56" stop-color="#121821"/>
          <stop offset="1" stop-color="#4b0a12"/>
        </linearGradient>
        <linearGradient id="linha" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ff263d"/>
          <stop offset="1" stop-color="#d8b875"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#fundo)"/>
      <path d="M0 490 C260 420 365 562 620 485 C835 420 940 310 1200 350 L1200 630 L0 630 Z" fill="#ff263d" opacity="0.12"/>
      <path d="M72 98 H1128" stroke="url(#linha)" stroke-width="2" opacity="0.75"/>
      <text x="72" y="334" font-family="Arial, Helvetica, sans-serif" font-size="88" font-weight="800" fill="#f7f8fb">NetCat Bank</text>
      <text x="76" y="404" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#cfd6df">Conta, Nex, cartões por análise e segurança em primeiro plano.</text>
      <text x="76" y="500" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#d8b875">netcatbank.com</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .composite([{ input: logoBuffer, left: 770, top: 132 }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(destinoMarca, "og-netcatbank.png"));
};

const prepararMarca = async () => {
  await fs.mkdir(destinoMarca, { recursive: true });

  const area = await encontrarAreaDaMarca();
  const baseHorizontal = await criarLogoTransparente(area.horizontal);
  const baseQuadrada = sharp(origemLogo).rotate().extract(area.quadrada);

  await baseHorizontal.clone().resize({ width: 960, withoutEnlargement: true }).png({
    compressionLevel: 9,
    palette: false
  }).toFile(path.join(destinoMarca, "logo-netcatbank.png"));

  await baseHorizontal.clone().resize({ width: 960, withoutEnlargement: true }).webp({
    effort: 6,
    quality: 90
  }).toFile(path.join(destinoMarca, "logo-netcatbank.webp"));

  await baseHorizontal.clone().resize({ width: 960, withoutEnlargement: true }).avif({
    effort: 7,
    quality: 62
  }).toFile(path.join(destinoMarca, "logo-netcatbank.avif"));

  await gerarLogoBranca(area);

  const logoOg = await baseHorizontal
    .clone()
    .resize({ width: 320, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await gerarImagemOpenGraph(logoOg);

  const tamanhos = [
    ["favicon-16x16.png", 16],
    ["favicon-32x32.png", 32],
    ["favicon.png", 48],
    ["apple-touch-icon.png", 180],
    ["icone-192.png", 192],
    ["icone-512.png", 512]
  ];

  await Promise.all(
    tamanhos.map(([arquivo, tamanho]) =>
      baseQuadrada
        .clone()
        .resize(tamanho, tamanho, { fit: "cover", position: "centre" })
        .png({ compressionLevel: 9, palette: false })
        .toFile(path.join(destinoMarca, arquivo))
    )
  );

  await baseQuadrada
    .clone()
    .resize(512, 512, { fit: "cover", position: "centre" })
    .webp({ effort: 6, quality: 92 })
    .toFile(path.join(destinoMarca, "icone-512.webp"));

  await salvarLogoLimpaNaRaiz();
  await prepararCapa();
  await prepararImagemCartaoBolso();
  await gerarMockupCartoes();
  await prepararErro404();

  console.log("Marca, capas, cartoes e erros preparados em aplicacoes/frente/public/marca.");
};

await prepararMarca();

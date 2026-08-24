import QRCode from "qrcode";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const alfabetoBase32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const emissorTotp = "NC Bank";

const codificarBase32 = (buffer: Buffer) => {
  let bits = "";
  let resultado = "";

  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let indice = 0; indice < bits.length; indice += 5) {
    const bloco = bits.slice(indice, indice + 5).padEnd(5, "0");
    resultado += alfabetoBase32[Number.parseInt(bloco, 2)] ?? "";
  }

  return resultado;
};

const decodificarBase32 = (valor: string) => {
  const limpo = valor.replace(/=+$/g, "").replace(/\s/g, "").toUpperCase();
  let bits = "";

  for (const caractere of limpo) {
    const indice = alfabetoBase32.indexOf(caractere);
    if (indice === -1) return null;
    bits += indice.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let indice = 0; indice + 8 <= bits.length; indice += 8) {
    bytes.push(Number.parseInt(bits.slice(indice, indice + 8), 2));
  }

  return Buffer.from(bytes);
};

const hotp = (segredo: Buffer, contador: number) => {
  const contadorBuffer = Buffer.alloc(8);
  contadorBuffer.writeBigUInt64BE(BigInt(contador));

  const hmac = createHmac("sha1", segredo).update(contadorBuffer).digest();
  const deslocamento = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const b0 = hmac[deslocamento] ?? 0;
  const b1 = hmac[deslocamento + 1] ?? 0;
  const b2 = hmac[deslocamento + 2] ?? 0;
  const b3 = hmac[deslocamento + 3] ?? 0;
  const codigo =
    ((b0 & 0x7f) << 24) |
    ((b1 & 0xff) << 16) |
    ((b2 & 0xff) << 8) |
    (b3 & 0xff);

  return String(codigo % 1_000_000).padStart(6, "0");
};

const compararCodigo = (a: string, b: string) => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
};

export const gerarSegredoTotp = () => codificarBase32(randomBytes(20));

export const criarUriTotp = ({ segredo, identificador }: { segredo: string; identificador: string }) => {
  const conta = encodeURIComponent(`${emissorTotp}:${identificador}`);
  const parametros = new URLSearchParams({
    secret: segredo,
    issuer: emissorTotp,
    algorithm: "SHA1",
    digits: "6",
    period: "30"
  });

  return `otpauth://totp/${conta}?${parametros.toString()}`;
};

export const criarQrTotpSvg = async (uri: string) =>
  QRCode.toString(uri, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: {
      dark: "#050609",
      light: "#ffffff"
    }
  });

export const validarCodigoTotp = ({
  segredo,
  codigo,
  ultimoContador
}: {
  segredo: string;
  codigo: string;
  ultimoContador?: number | null;
}) => {
  if (!/^\d{6}$/.test(codigo)) return { valido: false, contador: null };

  const segredoBuffer = decodificarBase32(segredo);
  if (!segredoBuffer || segredoBuffer.length < 16) return { valido: false, contador: null };

  const contadorAtual = Math.floor(Date.now() / 30_000);
  for (const deslocamento of [-1, 0, 1]) {
    const contador = contadorAtual + deslocamento;
    if (ultimoContador !== null && ultimoContador !== undefined && contador <= ultimoContador) {
      continue;
    }

    if (compararCodigo(hotp(segredoBuffer, contador), codigo)) {
      return { valido: true, contador };
    }
  }

  return { valido: false, contador: null };
};

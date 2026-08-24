#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "segredos", "mtls");
const forcar = process.argv.includes("--forcar") || process.argv.includes("--force");
const diasCa = "3650";
const diasServico = "825";

const executar = (argumentos) => {
  execFileSync("openssl", argumentos, {
    cwd: destino,
    stdio: "inherit"
  });
};

const escrever = (arquivo, conteudo) => {
  writeFileSync(path.join(destino, arquivo), conteudo, { mode: 0o600 });
};

const existe = (arquivo) => existsSync(path.join(destino, arquivo));

const limparTemporarios = () => {
  for (const arquivo of [
    "api.csr",
    "bff.csr",
    "monitor.csr",
    "api.ext",
    "bff.ext",
    "monitor.ext",
    "ca.srl"
  ]) {
    rmSync(path.join(destino, arquivo), { force: true });
  }
};

const validarSaida = () => {
  const esperados = [
    "ca.crt",
    "ca.key",
    "api.crt",
    "api.key",
    "bff.crt",
    "bff.key",
    "monitor.crt",
    "monitor.key"
  ];

  for (const arquivo of esperados) {
    if (!existe(arquivo)) {
      throw new Error(`Falha ao gerar ${arquivo}`);
    }
  }
};

mkdirSync(destino, { recursive: true, mode: 0o700 });

if (!forcar && existe("ca.crt")) {
  console.log("mTLS interno já existe em segredos/mtls. Use --forcar para recriar.");
  process.exit(0);
}

if (forcar) {
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true, mode: 0o700 });
}

limparTemporarios();

executar([
  "genpkey",
  "-algorithm",
  "EC",
  "-pkeyopt",
  "ec_paramgen_curve:P-384",
  "-out",
  "ca.key"
]);
executar([
  "req",
  "-x509",
  "-new",
  "-key",
  "ca.key",
  "-sha384",
  "-days",
  diasCa,
  "-subj",
  "/C=BR/O=NetCat Bank/OU=Autoridade Interna/CN=NetCat Bank CA Interna",
  "-out",
  "ca.crt"
]);

const gerarCertificado = ({ nome, cn, uso, san }) => {
  escrever(
    `${nome}.ext`,
    [
      "basicConstraints=CA:FALSE",
      "keyUsage=digitalSignature,keyAgreement",
      `extendedKeyUsage=${uso}`,
      `subjectAltName=${san}`,
      "subjectKeyIdentifier=hash",
      "authorityKeyIdentifier=keyid,issuer"
    ].join("\n")
  );

  executar([
    "genpkey",
    "-algorithm",
    "EC",
    "-pkeyopt",
    "ec_paramgen_curve:P-384",
    "-out",
    `${nome}.key`
  ]);
  executar([
    "req",
    "-new",
    "-key",
    `${nome}.key`,
    "-sha384",
    "-subj",
    `/C=BR/O=NetCat Bank/OU=Canal Interno/CN=${cn}`,
    "-out",
    `${nome}.csr`
  ]);
  executar([
    "x509",
    "-req",
    "-in",
    `${nome}.csr`,
    "-CA",
    "ca.crt",
    "-CAkey",
    "ca.key",
    "-CAcreateserial",
    "-out",
    `${nome}.crt`,
    "-days",
    diasServico,
    "-sha384",
    "-extfile",
    `${nome}.ext`
  ]);
};

gerarCertificado({
  nome: "api",
  cn: "api.netcatbank.interno",
  uso: "serverAuth",
  san: "DNS:api,DNS:api.netcatbank.interno,IP:127.0.0.1"
});
gerarCertificado({
  nome: "bff",
  cn: "bff.netcatbank.interno",
  uso: "clientAuth",
  san: "DNS:bff.netcatbank.interno"
});
gerarCertificado({
  nome: "monitor",
  cn: "monitor.netcatbank.interno",
  uso: "clientAuth",
  san: "DNS:monitor.netcatbank.interno"
});

limparTemporarios();
validarSaida();

for (const arquivo of ["ca.key", "api.key", "bff.key", "monitor.key"]) {
  chmodSync(path.join(destino, arquivo), 0o600);
}

for (const arquivo of ["ca.crt", "api.crt", "bff.crt", "monitor.crt"]) {
  chmodSync(path.join(destino, arquivo), 0o644);
}

console.log("mTLS interno gerado em segredos/mtls.");
console.log("CA: segredos/mtls/ca.crt");
console.log("API: segredos/mtls/api.crt + api.key");
console.log("BFF: segredos/mtls/bff.crt + bff.key");

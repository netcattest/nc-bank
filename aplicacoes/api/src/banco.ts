import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { ProdutoConta, TipoDocumento } from "./validacao.js";

const databaseUrl = process.env.DATABASE_URL;

export const banco = new Pool({
  connectionString: databaseUrl,
  max: 8,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 5_000
});

export type ContaBanco = {
  id: string;
  referencia_publica: string;
  status: "pendente_complemento" | "ativa" | "bloqueada";
  nome_cifrado: string;
  primeiro_nome_cifrado: string;
  tipo_documento: TipoDocumento;
  documento_indice: string;
  documento_cifrado: string;
  email_indice: string;
  email_cifrado: string;
  produto: ProdutoConta;
  senha_hash: string | null;
  dois_fatores_ativo: boolean;
  dois_fatores_segredo_cifrado: string | null;
  dois_fatores_ultimo_contador: string | null;
};

export type SaldoContaBanco = {
  conta_id: string;
  saldo_disponivel_centavos: string;
  saldo_total_centavos: string;
  saldo_contabil_centavos: string;
  moeda: "BRL";
  versao: string;
  integridade_hash: string;
  atualizado_em: Date;
};

export type TipoLancamentoSaldo =
  | "abertura"
  | "credito_autorizado"
  | "credito_liquidado"
  | "debito_reservado"
  | "debito_liquidado"
  | "debito_cancelado"
  | "ajuste_sistema";

export type FaseLancamentoSaldo = "autorizacao" | "liquidacao" | "cancelamento" | "ajuste";
export type EstadoLancamentoSaldo = "registrado" | "liquidado" | "cancelado";

export type LancamentoSaldoBanco = {
  id: string;
  conta_id: string;
  idempotencia_chave: string;
  tipo: TipoLancamentoSaldo;
  fase: FaseLancamentoSaldo;
  estado: EstadoLancamentoSaldo;
  delta_disponivel_centavos: string;
  delta_contabil_centavos: string;
  moeda: "BRL";
  versao_saldo: string;
  referencia_origem: string;
  metadados_cifrados: string;
  hash_anterior: string;
  merkle_raiz: string;
  hash_encadeado: string;
  criado_em: Date;
};

type ContaContabilSaldo =
  | "liquidacao_banco"
  | "passivo_clientes"
  | "disponivel_clientes"
  | "reservas_operacionais";

type NaturezaPartida = "debito" | "credito";

type PartidaDobradaSaldo = {
  ordem: number;
  contaContabil: ContaContabilSaldo;
  natureza: NaturezaPartida;
  valorCentavos: number;
};

export type PartidaDobradaSaldoBanco = {
  id: string;
  lancamento_id: string;
  conta_id: string;
  ordem: string;
  conta_contabil: ContaContabilSaldo;
  natureza: NaturezaPartida;
  valor_centavos: string;
  moeda: "BRL";
  hash_partida: string;
  criado_em: Date;
};

export type DirecaoMovimentoFinanceiro = "entrada" | "saida";
export type TipoMovimentoFinanceiro =
  | "nex"
  | "pagamento"
  | "recarga"
  | "doacao"
  | "transferencia"
  | "deposito"
  | "cobranca"
  | "cartao"
  | "investimento"
  | "bonus"
  | "sistema";

export type CategoriaMovimentoFinanceiro =
  | "geral"
  | "moradia"
  | "alimentacao"
  | "transporte"
  | "lazer"
  | "servicos"
  | "pagamentos"
  | "doacoes"
  | "investimentos"
  | "bonus"
  | "cartoes";

export type OrdenacaoMovimentoFinanceiro = "recentes" | "antigas" | "valor_maior" | "valor_menor";

export type MovimentoFinanceiroBanco = {
  id: string;
  conta_id: string;
  ledger_id: string | null;
  direcao: DirecaoMovimentoFinanceiro;
  tipo: TipoMovimentoFinanceiro;
  categoria: CategoriaMovimentoFinanceiro;
  descricao: string;
  contraparte: string | null;
  valor_centavos: string;
  moeda: "BRL";
  efetivado_em: Date;
  status: "liquidado" | "cancelado" | "falhou";
  total_registros?: string;
};

export type EstadoElegibilidadeCredito = "disponivel" | "analise";

export type ElegibilidadeCreditoBanco = {
  conta_id: string;
  modelo: string;
  estado: EstadoElegibilidadeCredito;
  limite_centavos: string;
  taxa_mensal_bps: string;
  faixa: "em_analise" | "inicial" | "moderada" | "forte";
  motivo: string;
  metricas_hash: string;
  metricas_cifradas: string;
  calculado_em: Date;
  expira_em: Date;
  criado_em: Date;
  atualizado_em: Date;
};

export type ElegibilidadeCreditoConta = {
  estado: EstadoElegibilidadeCredito;
  faixa: ElegibilidadeCreditoBanco["faixa"];
  limiteCentavos: number;
  modelo: string;
  motivo: string;
  taxaMensalBps: number;
  calculadoEm: Date;
  expiraEm: Date;
};

export type AgendamentoFinanceiroBanco = {
  id: string;
  conta_id: string;
  direcao: DirecaoMovimentoFinanceiro;
  tipo: TipoMovimentoFinanceiro;
  categoria: CategoriaMovimentoFinanceiro;
  descricao: string;
  contraparte: string | null;
  valor_centavos: string;
  moeda: "BRL";
  agendado_para: Date;
  status: "agendado" | "processando" | "processado" | "cancelado" | "falhou";
  idempotencia_chave?: string;
  referencia_publica?: string | null;
  chave_destino_indice_hmac?: string | null;
  destino_conta_id?: string | null;
  falha_motivo?: string | null;
  processado_em?: Date | null;
};

export type ComprovanteTransacaoBanco = {
  id: string;
  conta_id: string;
  movimento_id: string;
  snapshot_hash: string;
  snapshot_cifrado: string;
  assinatura: string;
  chave_id: string;
  hash_anterior: string;
  hash_encadeado: string;
  criado_em: Date;
};

export type PagamentoBoletoLiquidadoBanco = {
  codigo_barras_hash: string;
  conta_id: string;
  movimento_id: string;
  referencia_publica: string;
  liquidado_em: Date;
};

export type CampanhaIndicacaoBanco = {
  conta_id: string;
  inicio_em: Date;
  expira_em: Date;
  status: "ativa" | "expirada" | "bloqueada";
  criado_em: Date;
  atualizado_em: Date;
};

export type LinkIndicacaoBanco = {
  id: string;
  conta_id: string;
  codigo_hash: string;
  slug: string;
  campanha_expira_em: Date;
  criado_em: Date;
};

export type IndicacaoBanco = {
  id: string;
  token_hash: string;
  codigo_hash: string;
  indicador_conta_id: string;
  indicado_conta_id: string | null;
  contexto_hash: string;
  indicado_documento_indice: string | null;
  indicado_email_indice: string | null;
  status: "convite" | "abertura" | "conta_ativada" | "bonus_liquidado" | "expirada" | "bloqueada";
  bonus_indicador_idempotencia: string | null;
  bonus_indicado_idempotencia: string | null;
  boas_vindas_visto_em: Date | null;
  expira_em: Date;
  criado_em: Date;
  atualizado_em: Date;
};

export type ConsultaCnpjBanco = {
  cnpj_indice: string;
  cnpj_cifrado: string;
  dados_cifrados: string;
  consultado_em: Date;
};

export type TipoChaveNexBanco = "aleatoria" | "email" | "telefone" | "documento";
export type EstadoChaveNexBanco = "ativa" | "pendente_verificacao" | "removida";

export type ChaveNexBanco = {
  id: string;
  conta_id: string;
  tipo: TipoChaveNexBanco;
  valor_indice_hmac: string;
  valor_cifrado: string;
  valor_exibicao: string;
  estado: EstadoChaveNexBanco;
  idempotencia_chave: string;
  versao: string;
  cooldown_ate: Date | null;
  criada_em: Date;
  atualizada_em: Date;
  removida_em: Date | null;
};

export type EstadoTransferenciaNexBanco = "preparada" | "confirmada" | "liquidada" | "cancelada" | "falha";

export type TransferenciaNexBanco = {
  id: string;
  referencia_publica: string;
  conta_origem_id: string;
  conta_destino_id: string;
  chave_destino_indice_hmac: string;
  valor_centavos: string;
  descricao: string;
  estado: EstadoTransferenciaNexBanco;
  idempotencia_preparo: string;
  idempotencia_confirmacao: string | null;
  ledger_origem_reserva_id: string | null;
  ledger_origem_liquidacao_id: string | null;
  ledger_destino_liquidacao_id: string | null;
  expira_em: Date;
  criado_em: Date;
  atualizado_em: Date;
  liquidado_em: Date | null;
};

export type TransferenciaNexComMovimentoBanco = TransferenciaNexBanco & {
  movimento_origem_id?: string | null;
};

export type DestinatarioNexBanco = {
  chave: ChaveNexBanco;
  conta: Pick<ContaBanco, "id" | "nome_cifrado" | "primeiro_nome_cifrado" | "tipo_documento" | "documento_cifrado">;
};

export type ParticipantesTransferenciaNexBanco = {
  chave_destino_valor_exibicao: string | null;
  chave_origem_valor_exibicao: string | null;
  destino_documento_cifrado: string;
  destino_nome_cifrado: string;
  destino_primeiro_nome_cifrado: string;
  destino_tipo_documento: TipoDocumento;
  origem_documento_cifrado: string;
  origem_nome_cifrado: string;
  origem_primeiro_nome_cifrado: string;
  origem_tipo_documento: TipoDocumento;
  referencia_publica: string;
};

export type ContatoNexBanco = {
  chave_sugestao: string | null;
  conta_contato_id: string;
  direcao_ultima: DirecaoMovimentoFinanceiro;
  nome_cifrado: string;
  primeiro_nome_cifrado: string;
  total_transferencias: string;
  ultima_em: Date;
  valor_centavos: string;
};

export type FiltrosMovimentosFinanceiros = {
  categoria: CategoriaMovimentoFinanceiro | null;
  fim: string;
  inicio: string;
  limite: number;
  ordenar: OrdenacaoMovimentoFinanceiro;
  pagina: number;
  pesquisa: string | null;
  tipo: DirecaoMovimentoFinanceiro | "todos";
};

export const prepararBanco = async () => {
  await banco.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await banco.query(`
    CREATE TABLE IF NOT EXISTS contas_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      referencia_publica text UNIQUE NOT NULL,
      status text NOT NULL CHECK (status IN ('pendente_complemento', 'ativa', 'bloqueada')),
      nome_cifrado text NOT NULL,
      primeiro_nome_cifrado text NOT NULL,
      tipo_documento text NOT NULL CHECK (tipo_documento IN ('cpf', 'cnpj')),
      documento_indice text UNIQUE NOT NULL,
      documento_cifrado text NOT NULL,
      email_indice text UNIQUE NOT NULL,
      email_cifrado text NOT NULL,
      produto text NOT NULL CHECK (produto IN ('credito-conta', 'somente-conta')),
      data_nascimento_cifrada text,
      senha_hash text,
      dois_fatores_ativo boolean NOT NULL DEFAULT false,
      dois_fatores_segredo_cifrado text,
      dois_fatores_pendente_em timestamptz,
      dois_fatores_ativado_em timestamptz,
      dois_fatores_ultimo_contador bigint,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await banco.query("ALTER TABLE contas_netcatbank ADD COLUMN IF NOT EXISTS dois_fatores_ativo boolean NOT NULL DEFAULT false");
  await banco.query("ALTER TABLE contas_netcatbank ADD COLUMN IF NOT EXISTS dois_fatores_segredo_cifrado text");
  await banco.query("ALTER TABLE contas_netcatbank ADD COLUMN IF NOT EXISTS dois_fatores_pendente_em timestamptz");
  await banco.query("ALTER TABLE contas_netcatbank ADD COLUMN IF NOT EXISTS dois_fatores_ativado_em timestamptz");
  await banco.query("ALTER TABLE contas_netcatbank ADD COLUMN IF NOT EXISTS dois_fatores_ultimo_contador bigint");
  await banco.query("ALTER TABLE contas_netcatbank ADD COLUMN IF NOT EXISTS apagado_em timestamptz");
  await banco.query("ALTER TABLE contas_netcatbank ADD COLUMN IF NOT EXISTS apagado_motivo text");
  await banco.query(`
    CREATE TABLE IF NOT EXISTS saldos_conta_netcatbank (
      conta_id uuid PRIMARY KEY REFERENCES contas_netcatbank(id) ON DELETE CASCADE,
      saldo_disponivel_centavos bigint NOT NULL DEFAULT 0 CHECK (saldo_disponivel_centavos >= 0),
      saldo_total_centavos bigint NOT NULL DEFAULT 0 CHECK (saldo_total_centavos >= 0),
      saldo_contabil_centavos bigint NOT NULL DEFAULT 0 CHECK (saldo_contabil_centavos >= 0),
      moeda text NOT NULL DEFAULT 'BRL' CHECK (moeda = 'BRL'),
      versao bigint NOT NULL DEFAULT 1,
      integridade_hash text NOT NULL,
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await banco.query(
    "ALTER TABLE saldos_conta_netcatbank ADD COLUMN IF NOT EXISTS saldo_contabil_centavos bigint NOT NULL DEFAULT 0 CHECK (saldo_contabil_centavos >= 0)"
  );
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_saldos_netcatbank_integridade_hash'
      ) THEN
        ALTER TABLE saldos_conta_netcatbank
          ADD CONSTRAINT chk_saldos_netcatbank_integridade_hash
          CHECK (integridade_hash ~ '^[a-f0-9]{64}$');
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_saldos_netcatbank_total_contabil'
      ) THEN
        ALTER TABLE saldos_conta_netcatbank
          ADD CONSTRAINT chk_saldos_netcatbank_total_contabil
          CHECK (saldo_total_centavos = saldo_contabil_centavos);
      END IF;
    END $$;
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS ledger_saldos_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE CASCADE,
      idempotencia_chave text NOT NULL,
      tipo text NOT NULL CHECK (
        tipo IN (
          'abertura',
          'credito_autorizado',
          'credito_liquidado',
          'debito_reservado',
          'debito_liquidado',
          'debito_cancelado',
          'ajuste_sistema'
        )
      ),
      fase text NOT NULL CHECK (fase IN ('autorizacao', 'liquidacao', 'cancelamento', 'ajuste')),
      estado text NOT NULL CHECK (estado IN ('registrado', 'liquidado', 'cancelado')),
      delta_disponivel_centavos bigint NOT NULL,
      delta_contabil_centavos bigint NOT NULL,
      moeda text NOT NULL DEFAULT 'BRL' CHECK (moeda = 'BRL'),
      versao_saldo bigint NOT NULL CHECK (versao_saldo > 0),
      referencia_origem text NOT NULL,
      metadados_cifrados text NOT NULL DEFAULT '',
      hash_anterior text NOT NULL,
      merkle_raiz text NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
      hash_encadeado text NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now(),
      UNIQUE (conta_id, idempotencia_chave),
      UNIQUE (conta_id, versao_saldo),
      CHECK (idempotencia_chave ~ '^[a-z0-9:_-]{8,120}$'),
      CHECK (char_length(referencia_origem) BETWEEN 8 AND 140),
      CHECK (hash_anterior = 'GENESIS' OR hash_anterior ~ '^[a-f0-9]{64}$'),
      CHECK (merkle_raiz ~ '^[a-f0-9]{64}$'),
      CHECK (hash_encadeado ~ '^[a-f0-9]{64}$')
    )
  `);
  await banco.query(
    "ALTER TABLE ledger_saldos_netcatbank ADD COLUMN IF NOT EXISTS merkle_raiz text"
  );
  await banco.query(
    "UPDATE ledger_saldos_netcatbank SET merkle_raiz = hash_encadeado WHERE merkle_raiz IS NULL"
  );
  await banco.query(
    "ALTER TABLE ledger_saldos_netcatbank ALTER COLUMN merkle_raiz SET NOT NULL"
  );
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_ledger_saldos_merkle_raiz'
      ) THEN
        ALTER TABLE ledger_saldos_netcatbank
          ADD CONSTRAINT chk_ledger_saldos_merkle_raiz
          CHECK (merkle_raiz ~ '^[a-f0-9]{64}$');
      END IF;
    END $$;
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS partidas_dobradas_saldo_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      lancamento_id uuid NOT NULL REFERENCES ledger_saldos_netcatbank(id) ON DELETE RESTRICT,
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      ordem smallint NOT NULL CHECK (ordem > 0),
      conta_contabil text NOT NULL CHECK (
        conta_contabil IN (
          'liquidacao_banco',
          'passivo_clientes',
          'disponivel_clientes',
          'reservas_operacionais'
        )
      ),
      natureza text NOT NULL CHECK (natureza IN ('debito', 'credito')),
      valor_centavos bigint NOT NULL CHECK (valor_centavos >= 0),
      moeda text NOT NULL DEFAULT 'BRL' CHECK (moeda = 'BRL'),
      hash_partida text NOT NULL CHECK (hash_partida ~ '^[a-f0-9]{64}$'),
      criado_em timestamptz NOT NULL DEFAULT now(),
      UNIQUE (lancamento_id, ordem)
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS journal_financeiro_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id uuid REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      idempotencia_chave text NOT NULL,
      etapa text NOT NULL CHECK (etapa IN ('recebido', 'validado', 'gravado', 'rejeitado')),
      payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
      resultado_hash text CHECK (resultado_hash IS NULL OR resultado_hash ~ '^[a-f0-9]{64}$'),
      criado_em timestamptz NOT NULL DEFAULT now(),
      UNIQUE (idempotencia_chave, etapa)
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS movimentos_financeiros_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      ledger_id uuid REFERENCES ledger_saldos_netcatbank(id) ON DELETE RESTRICT,
      direcao text NOT NULL CHECK (direcao IN ('entrada', 'saida')),
      tipo text NOT NULL CHECK (
        tipo IN ('nex', 'pagamento', 'recarga', 'doacao', 'transferencia', 'deposito', 'cobranca', 'cartao', 'investimento', 'bonus', 'sistema')
      ),
      categoria text NOT NULL CHECK (
        categoria IN ('geral', 'moradia', 'alimentacao', 'transporte', 'lazer', 'servicos', 'pagamentos', 'doacoes', 'investimentos', 'bonus', 'cartoes')
      ),
      descricao text NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 120),
      contraparte text CHECK (contraparte IS NULL OR char_length(contraparte) BETWEEN 1 AND 120),
      valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
      moeda text NOT NULL DEFAULT 'BRL' CHECK (moeda = 'BRL'),
      efetivado_em timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'liquidado' CHECK (status IN ('liquidado', 'cancelado', 'falhou')),
      criado_em timestamptz NOT NULL DEFAULT now(),
      UNIQUE (ledger_id)
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS elegibilidades_credito_netcatbank (
      conta_id uuid PRIMARY KEY REFERENCES contas_netcatbank(id) ON DELETE CASCADE,
      modelo text NOT NULL CHECK (char_length(modelo) BETWEEN 8 AND 80),
      estado text NOT NULL CHECK (estado IN ('disponivel', 'analise')),
      limite_centavos integer NOT NULL CHECK (limite_centavos >= 0 AND limite_centavos <= 100000),
      taxa_mensal_bps integer NOT NULL CHECK (taxa_mensal_bps >= 0 AND taxa_mensal_bps <= 500),
      faixa text NOT NULL CHECK (faixa IN ('em_analise', 'inicial', 'moderada', 'forte')),
      motivo text NOT NULL CHECK (char_length(motivo) BETWEEN 12 AND 180),
      metricas_hash text NOT NULL CHECK (metricas_hash ~ '^[a-f0-9]{64}$'),
      metricas_cifradas text NOT NULL CHECK (char_length(metricas_cifradas) BETWEEN 24 AND 4000),
      calculado_em timestamptz NOT NULL DEFAULT now(),
      expira_em timestamptz NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      CHECK (expira_em > calculado_em)
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS agendamentos_financeiros_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      direcao text NOT NULL CHECK (direcao IN ('entrada', 'saida')),
      tipo text NOT NULL CHECK (
        tipo IN ('nex', 'pagamento', 'recarga', 'doacao', 'transferencia', 'deposito', 'cobranca', 'cartao', 'investimento', 'bonus', 'sistema')
      ),
      categoria text NOT NULL CHECK (
        categoria IN ('geral', 'moradia', 'alimentacao', 'transporte', 'lazer', 'servicos', 'pagamentos', 'doacoes', 'investimentos', 'bonus', 'cartoes')
      ),
      descricao text NOT NULL CHECK (char_length(descricao) BETWEEN 1 AND 120),
      contraparte text CHECK (contraparte IS NULL OR char_length(contraparte) BETWEEN 1 AND 120),
      valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
      moeda text NOT NULL DEFAULT 'BRL' CHECK (moeda = 'BRL'),
      agendado_para timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'processando', 'processado', 'cancelado', 'falhou')),
      idempotencia_chave text NOT NULL CHECK (idempotencia_chave ~ '^[a-zA-Z0-9:_-]{8,120}$'),
      referencia_publica text CHECK (referencia_publica IS NULL OR referencia_publica ~ '^NX-[A-Z0-9]{16,32}$'),
      chave_destino_indice_hmac text CHECK (chave_destino_indice_hmac IS NULL OR chave_destino_indice_hmac ~ '^[a-f0-9]{64}$'),
      destino_conta_id uuid REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      falha_motivo text CHECK (falha_motivo IS NULL OR char_length(falha_motivo) BETWEEN 3 AND 80),
      processado_em timestamptz,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      UNIQUE (conta_id, idempotencia_chave)
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS comprovantes_transacao_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      movimento_id uuid NOT NULL REFERENCES movimentos_financeiros_netcatbank(id) ON DELETE RESTRICT,
      snapshot_hash text NOT NULL,
      snapshot_cifrado text NOT NULL,
      assinatura text NOT NULL,
      chave_id text NOT NULL,
      hash_anterior text NOT NULL,
      hash_encadeado text NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now(),
      UNIQUE (movimento_id),
      CHECK (snapshot_hash ~ '^[A-Za-z0-9_-]{32,96}$'),
      CHECK (char_length(snapshot_cifrado) BETWEEN 24 AND 8000),
      CHECK (assinatura ~ '^[A-Za-z0-9_-]{64,140}$'),
      CHECK (chave_id ~ '^[a-zA-Z0-9:_-]{8,80}$'),
      CHECK (hash_anterior = 'GENESIS' OR hash_anterior ~ '^[a-f0-9]{64}$'),
      CHECK (hash_encadeado ~ '^[a-f0-9]{64}$')
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS pagamentos_boletos_liquidados_netcatbank (
      codigo_barras_hash text PRIMARY KEY CHECK (codigo_barras_hash ~ '^[a-f0-9]{64}$'),
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      movimento_id uuid NOT NULL UNIQUE REFERENCES movimentos_financeiros_netcatbank(id) ON DELETE RESTRICT,
      referencia_publica text NOT NULL CHECK (referencia_publica ~ '^PB-[A-F0-9]{32}$'),
      liquidado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await banco.query("ALTER TABLE pagamentos_boletos_liquidados_netcatbank DROP COLUMN IF EXISTS banco_codigo");
  await banco.query("ALTER TABLE pagamentos_boletos_liquidados_netcatbank DROP COLUMN IF EXISTS banco_nome");
  await banco.query("ALTER TABLE pagamentos_boletos_liquidados_netcatbank DROP COLUMN IF EXISTS valor_centavos");
  await banco.query("ALTER TABLE movimentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS movimentos_financeiros_netcatbank_tipo_check");
  await banco.query("ALTER TABLE movimentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS movimentos_financeiros_netcatbank_categoria_check");
  await banco.query("ALTER TABLE movimentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS movimentos_financeiros_netcatbank_status_check");
  await banco.query("ALTER TABLE movimentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_movimentos_financeiros_tipo");
  await banco.query("ALTER TABLE movimentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_movimentos_financeiros_categoria");
  await banco.query("ALTER TABLE movimentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_movimentos_financeiros_status");
  await banco.query(`
    ALTER TABLE movimentos_financeiros_netcatbank
      ADD CONSTRAINT chk_movimentos_financeiros_tipo
      CHECK (tipo IN ('nex', 'pagamento', 'recarga', 'doacao', 'transferencia', 'deposito', 'cobranca', 'cartao', 'investimento', 'bonus', 'sistema'))
  `);
  await banco.query(`
    ALTER TABLE movimentos_financeiros_netcatbank
      ADD CONSTRAINT chk_movimentos_financeiros_categoria
      CHECK (categoria IN ('geral', 'moradia', 'alimentacao', 'transporte', 'lazer', 'servicos', 'pagamentos', 'doacoes', 'investimentos', 'bonus', 'cartoes'))
  `);
  await banco.query(`
    ALTER TABLE movimentos_financeiros_netcatbank
      ADD CONSTRAINT chk_movimentos_financeiros_status
      CHECK (status IN ('liquidado', 'cancelado', 'falhou'))
  `);
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS agendamentos_financeiros_netcatbank_tipo_check");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS agendamentos_financeiros_netcatbank_categoria_check");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS agendamentos_financeiros_netcatbank_status_check");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS agendamentos_financeiros_netcatbank_idempotencia_chave_check");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_agendamentos_financeiros_tipo");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_agendamentos_financeiros_categoria");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_agendamentos_financeiros_status");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_agendamentos_financeiros_idempotencia");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_agendamentos_financeiros_referencia_nex");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_agendamentos_financeiros_chave_destino");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank DROP CONSTRAINT IF EXISTS chk_agendamentos_financeiros_falha_motivo");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank ADD COLUMN IF NOT EXISTS referencia_publica text");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank ADD COLUMN IF NOT EXISTS chave_destino_indice_hmac text");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank ADD COLUMN IF NOT EXISTS destino_conta_id uuid REFERENCES contas_netcatbank(id) ON DELETE RESTRICT");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank ADD COLUMN IF NOT EXISTS falha_motivo text");
  await banco.query("ALTER TABLE agendamentos_financeiros_netcatbank ADD COLUMN IF NOT EXISTS processado_em timestamptz");
  await banco.query(`
    ALTER TABLE agendamentos_financeiros_netcatbank
      ADD CONSTRAINT chk_agendamentos_financeiros_tipo
      CHECK (tipo IN ('nex', 'pagamento', 'recarga', 'doacao', 'transferencia', 'deposito', 'cobranca', 'cartao', 'investimento', 'bonus', 'sistema'))
  `);
  await banco.query(`
    ALTER TABLE agendamentos_financeiros_netcatbank
      ADD CONSTRAINT chk_agendamentos_financeiros_categoria
      CHECK (categoria IN ('geral', 'moradia', 'alimentacao', 'transporte', 'lazer', 'servicos', 'pagamentos', 'doacoes', 'investimentos', 'bonus', 'cartoes'))
  `);
  await banco.query(`
    ALTER TABLE agendamentos_financeiros_netcatbank
      ADD CONSTRAINT chk_agendamentos_financeiros_status
      CHECK (status IN ('agendado', 'processando', 'processado', 'cancelado', 'falhou'))
  `);
  await banco.query(`
    ALTER TABLE agendamentos_financeiros_netcatbank
      ADD CONSTRAINT chk_agendamentos_financeiros_idempotencia
      CHECK (idempotencia_chave ~ '^[a-zA-Z0-9:_-]{8,120}$')
  `);
  await banco.query(`
    ALTER TABLE agendamentos_financeiros_netcatbank
      ADD CONSTRAINT chk_agendamentos_financeiros_referencia_nex
      CHECK (referencia_publica IS NULL OR referencia_publica ~ '^NX-[A-Z0-9]{16,32}$')
  `);
  await banco.query(`
    ALTER TABLE agendamentos_financeiros_netcatbank
      ADD CONSTRAINT chk_agendamentos_financeiros_chave_destino
      CHECK (chave_destino_indice_hmac IS NULL OR chave_destino_indice_hmac ~ '^[a-f0-9]{64}$')
  `);
  await banco.query(`
    ALTER TABLE agendamentos_financeiros_netcatbank
      ADD CONSTRAINT chk_agendamentos_financeiros_falha_motivo
      CHECK (falha_motivo IS NULL OR char_length(falha_motivo) BETWEEN 3 AND 80)
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS consultas_cnpj_netcatbank (
      cnpj_indice text PRIMARY KEY,
      cnpj_cifrado text NOT NULL,
      dados_cifrados text NOT NULL,
      consultado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      CHECK (cnpj_indice ~ '^[a-f0-9]{64}$')
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS campanhas_indicacao_netcatbank (
      conta_id uuid PRIMARY KEY REFERENCES contas_netcatbank(id) ON DELETE CASCADE,
      inicio_em timestamptz NOT NULL DEFAULT now(),
      expira_em timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'expirada', 'bloqueada')),
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      CHECK (expira_em > inicio_em)
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS links_indicacao_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE CASCADE,
      codigo_hash text UNIQUE NOT NULL,
      slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
      campanha_expira_em timestamptz NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now(),
      CHECK (codigo_hash ~ '^[a-f0-9]{64}$')
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS indicacoes_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token_hash text UNIQUE NOT NULL,
      codigo_hash text NOT NULL REFERENCES links_indicacao_netcatbank(codigo_hash) ON DELETE RESTRICT,
      indicador_conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      indicado_conta_id uuid UNIQUE REFERENCES contas_netcatbank(id) ON DELETE SET NULL,
      contexto_hash text NOT NULL,
      indicado_documento_indice text,
      indicado_email_indice text,
      status text NOT NULL DEFAULT 'convite' CHECK (
        status IN ('convite', 'abertura', 'conta_ativada', 'bonus_liquidado', 'expirada', 'bloqueada')
      ),
      bonus_indicador_idempotencia text,
      bonus_indicado_idempotencia text,
      boas_vindas_visto_em timestamptz,
      expira_em timestamptz NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      CHECK (token_hash ~ '^[a-f0-9]{64}$'),
      CHECK (codigo_hash ~ '^[a-f0-9]{64}$'),
      CHECK (indicado_documento_indice IS NULL OR indicado_documento_indice ~ '^[a-f0-9]{64}$'),
      CHECK (indicado_email_indice IS NULL OR indicado_email_indice ~ '^[a-f0-9]{64}$'),
      CHECK (bonus_indicador_idempotencia IS NULL OR bonus_indicador_idempotencia ~ '^[a-z0-9:_-]{8,120}$'),
      CHECK (bonus_indicado_idempotencia IS NULL OR bonus_indicado_idempotencia ~ '^[a-z0-9:_-]{8,120}$')
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS chaves_nex_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE CASCADE,
      tipo text NOT NULL CHECK (tipo IN ('aleatoria', 'email', 'telefone', 'documento')),
      valor_indice_hmac text NOT NULL CHECK (valor_indice_hmac ~ '^[a-f0-9]{64}$'),
      valor_cifrado text NOT NULL CHECK (char_length(valor_cifrado) BETWEEN 24 AND 2000),
      valor_exibicao text NOT NULL CHECK (char_length(valor_exibicao) BETWEEN 3 AND 160),
      estado text NOT NULL CHECK (estado IN ('ativa', 'pendente_verificacao', 'removida')),
      idempotencia_chave text NOT NULL CHECK (idempotencia_chave ~ '^[a-zA-Z0-9:_-]{8,120}$'),
      versao bigint NOT NULL DEFAULT 1 CHECK (versao > 0),
      cooldown_ate timestamptz,
      criada_em timestamptz NOT NULL DEFAULT now(),
      atualizada_em timestamptz NOT NULL DEFAULT now(),
      removida_em timestamptz,
      UNIQUE (conta_id, idempotencia_chave),
      CHECK ((estado = 'removida' AND removida_em IS NOT NULL) OR (estado <> 'removida' AND removida_em IS NULL))
    )
  `);
  await banco.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chaves_nex_valor_ativo
    ON chaves_nex_netcatbank(valor_indice_hmac)
    WHERE estado IN ('ativa', 'pendente_verificacao')
  `);
  await banco.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_chaves_nex_conta_tipo_ativo
    ON chaves_nex_netcatbank(conta_id, tipo)
    WHERE estado IN ('ativa', 'pendente_verificacao')
      AND tipo <> 'aleatoria'
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS auditoria_chaves_nex_netcatbank (
      id bigserial PRIMARY KEY,
      conta_id uuid REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      chave_id uuid REFERENCES chaves_nex_netcatbank(id) ON DELETE RESTRICT,
      evento text NOT NULL CHECK (
        evento IN (
          'criada',
          'removida',
          'bloqueada',
          'conflito',
          'cooldown',
          'limite',
          'replay',
          'agendamento_criado',
          'agendamento_processado',
          'agendamento_falhou',
          'transferencia_preparada',
          'transferencia_liquidada',
          'transferencia_recusada'
        )
      ),
      idempotencia_chave text CHECK (idempotencia_chave IS NULL OR idempotencia_chave ~ '^[a-zA-Z0-9:_-]{8,120}$'),
      contexto_hash text,
      payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
      hash_anterior text NOT NULL,
      hash_encadeado text NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now(),
      CHECK (hash_anterior = 'GENESIS' OR hash_anterior ~ '^[a-f0-9]{64}$'),
      CHECK (hash_encadeado ~ '^[a-f0-9]{64}$')
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS transferencias_nex_netcatbank (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      referencia_publica text UNIQUE NOT NULL CHECK (referencia_publica ~ '^NX-[A-Z0-9]{16,32}$'),
      conta_origem_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      conta_destino_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE RESTRICT,
      chave_destino_indice_hmac text NOT NULL CHECK (chave_destino_indice_hmac ~ '^[a-f0-9]{64}$'),
      valor_centavos bigint NOT NULL CHECK (valor_centavos > 0 AND valor_centavos <= 100000000),
      descricao text NOT NULL DEFAULT 'Transferência Nex' CHECK (char_length(descricao) BETWEEN 1 AND 120),
      estado text NOT NULL DEFAULT 'preparada' CHECK (estado IN ('preparada', 'confirmada', 'liquidada', 'cancelada', 'falha')),
      idempotencia_preparo text NOT NULL CHECK (idempotencia_preparo ~ '^[a-zA-Z0-9:_-]{8,120}$'),
      idempotencia_confirmacao text CHECK (idempotencia_confirmacao IS NULL OR idempotencia_confirmacao ~ '^[a-zA-Z0-9:_-]{8,120}$'),
      ledger_origem_reserva_id uuid REFERENCES ledger_saldos_netcatbank(id) ON DELETE RESTRICT,
      ledger_origem_liquidacao_id uuid REFERENCES ledger_saldos_netcatbank(id) ON DELETE RESTRICT,
      ledger_destino_liquidacao_id uuid REFERENCES ledger_saldos_netcatbank(id) ON DELETE RESTRICT,
      expira_em timestamptz NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now(),
      liquidado_em timestamptz,
      UNIQUE (conta_origem_id, idempotencia_preparo),
      UNIQUE (conta_origem_id, idempotencia_confirmacao),
      CHECK (conta_origem_id <> conta_destino_id)
    )
  `);
  await banco.query("ALTER TABLE auditoria_chaves_nex_netcatbank DROP CONSTRAINT IF EXISTS auditoria_chaves_nex_netcatbank_evento_check");
  await banco.query("ALTER TABLE auditoria_chaves_nex_netcatbank DROP CONSTRAINT IF EXISTS chk_auditoria_chaves_nex_evento");
  await banco.query(`
    ALTER TABLE auditoria_chaves_nex_netcatbank
      ADD CONSTRAINT chk_auditoria_chaves_nex_evento
      CHECK (
        evento IN (
          'criada',
          'removida',
          'bloqueada',
          'conflito',
          'cooldown',
          'limite',
          'replay',
          'agendamento_criado',
          'agendamento_processado',
          'agendamento_falhou',
          'transferencia_preparada',
          'transferencia_liquidada',
          'transferencia_recusada'
        )
      )
  `);
  await banco.query(`
    CREATE OR REPLACE FUNCTION bloquear_mutacao_ledger_saldos_netcatbank()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'ledger_saldos_netcatbank_eh_imutavel';
    END;
    $$ LANGUAGE plpgsql;
  `);
  await banco.query("DROP TRIGGER IF EXISTS trg_ledger_saldos_netcatbank_imutavel ON ledger_saldos_netcatbank");
  await banco.query(`
    CREATE TRIGGER trg_ledger_saldos_netcatbank_imutavel
    BEFORE UPDATE OR DELETE ON ledger_saldos_netcatbank
    FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_ledger_saldos_netcatbank()
  `);
  await banco.query("DROP TRIGGER IF EXISTS trg_partidas_dobradas_saldo_imutavel ON partidas_dobradas_saldo_netcatbank");
  await banco.query(`
    CREATE TRIGGER trg_partidas_dobradas_saldo_imutavel
    BEFORE UPDATE OR DELETE ON partidas_dobradas_saldo_netcatbank
    FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_ledger_saldos_netcatbank()
  `);
  await banco.query("DROP TRIGGER IF EXISTS trg_journal_financeiro_imutavel ON journal_financeiro_netcatbank");
  await banco.query(`
    CREATE TRIGGER trg_journal_financeiro_imutavel
    BEFORE UPDATE OR DELETE ON journal_financeiro_netcatbank
    FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_ledger_saldos_netcatbank()
  `);
  await banco.query("DROP TRIGGER IF EXISTS trg_comprovantes_transacao_imutavel ON comprovantes_transacao_netcatbank");
  await banco.query(`
    CREATE TRIGGER trg_comprovantes_transacao_imutavel
    BEFORE UPDATE OR DELETE ON comprovantes_transacao_netcatbank
    FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_ledger_saldos_netcatbank()
  `);
  await banco.query("DROP TRIGGER IF EXISTS trg_pagamentos_boletos_liquidados_imutavel ON pagamentos_boletos_liquidados_netcatbank");
  await banco.query(`
    CREATE TRIGGER trg_pagamentos_boletos_liquidados_imutavel
    BEFORE UPDATE OR DELETE ON pagamentos_boletos_liquidados_netcatbank
    FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_ledger_saldos_netcatbank()
  `);
  await banco.query("DROP TRIGGER IF EXISTS trg_auditoria_chaves_nex_imutavel ON auditoria_chaves_nex_netcatbank");
  await banco.query(`
    CREATE TRIGGER trg_auditoria_chaves_nex_imutavel
    BEFORE UPDATE OR DELETE ON auditoria_chaves_nex_netcatbank
    FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_ledger_saldos_netcatbank()
  `);
  await banco.query(`
    ALTER TABLE saldos_conta_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ledger_saldos_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE partidas_dobradas_saldo_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE journal_financeiro_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE movimentos_financeiros_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE elegibilidades_credito_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE agendamentos_financeiros_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE comprovantes_transacao_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE pagamentos_boletos_liquidados_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE consultas_cnpj_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE campanhas_indicacao_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE links_indicacao_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE indicacoes_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE chaves_nex_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE auditoria_chaves_nex_netcatbank ENABLE ROW LEVEL SECURITY;
    ALTER TABLE transferencias_nex_netcatbank ENABLE ROW LEVEL SECURITY;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'campanhas_indicacao_netcatbank'
          AND policyname = 'politica_campanhas_indicacao_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_campanhas_indicacao_servico_ou_conta
        ON campanhas_indicacao_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'elegibilidades_credito_netcatbank'
          AND policyname = 'politica_elegibilidade_credito_leitura_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_elegibilidade_credito_leitura_servico_ou_conta
        ON elegibilidades_credito_netcatbank
        FOR SELECT
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'elegibilidades_credito_netcatbank'
          AND policyname = 'politica_elegibilidade_credito_escrita_servico'
      ) THEN
        CREATE POLICY politica_elegibilidade_credito_escrita_servico
        ON elegibilidades_credito_netcatbank
        FOR ALL
        USING (current_setting('app.netcatbank_servico', true) = 'api-netcatbank')
        WITH CHECK (current_setting('app.netcatbank_servico', true) = 'api-netcatbank');
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'pagamentos_boletos_liquidados_netcatbank'
          AND policyname = 'politica_pagamentos_boletos_liquidados_servico'
      ) THEN
        CREATE POLICY politica_pagamentos_boletos_liquidados_servico
        ON pagamentos_boletos_liquidados_netcatbank
        USING (current_setting('app.netcatbank_servico', true) = 'api-netcatbank')
        WITH CHECK (current_setting('app.netcatbank_servico', true) = 'api-netcatbank');
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'comprovantes_transacao_netcatbank'
          AND policyname = 'politica_comprovantes_transacao_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_comprovantes_transacao_servico_ou_conta
        ON comprovantes_transacao_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(
    "ALTER TABLE indicacoes_netcatbank DROP CONSTRAINT IF EXISTS indicacoes_netcatbank_indicado_documento_indice_key"
  );
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'links_indicacao_netcatbank'
          AND policyname = 'politica_links_indicacao_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_links_indicacao_servico_ou_conta
        ON links_indicacao_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'indicacoes_netcatbank'
          AND policyname = 'politica_indicacoes_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_indicacoes_servico_ou_conta
        ON indicacoes_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = indicador_conta_id::text
          OR current_setting('app.netcatbank_conta_id', true) = indicado_conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = indicador_conta_id::text
          OR current_setting('app.netcatbank_conta_id', true) = indicado_conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'consultas_cnpj_netcatbank'
          AND policyname = 'politica_consultas_cnpj_servico'
      ) THEN
        CREATE POLICY politica_consultas_cnpj_servico
        ON consultas_cnpj_netcatbank
        USING (current_setting('app.netcatbank_servico', true) = 'api-netcatbank')
        WITH CHECK (current_setting('app.netcatbank_servico', true) = 'api-netcatbank');
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'saldos_conta_netcatbank'
          AND policyname = 'politica_saldos_conta_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_saldos_conta_servico_ou_conta
        ON saldos_conta_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'movimentos_financeiros_netcatbank'
          AND policyname = 'politica_movimentos_financeiros_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_movimentos_financeiros_servico_ou_conta
        ON movimentos_financeiros_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'agendamentos_financeiros_netcatbank'
          AND policyname = 'politica_agendamentos_financeiros_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_agendamentos_financeiros_servico_ou_conta
        ON agendamentos_financeiros_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'ledger_saldos_netcatbank'
          AND policyname = 'politica_ledger_saldos_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_ledger_saldos_servico_ou_conta
        ON ledger_saldos_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'partidas_dobradas_saldo_netcatbank'
          AND policyname = 'politica_partidas_saldo_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_partidas_saldo_servico_ou_conta
        ON partidas_dobradas_saldo_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'journal_financeiro_netcatbank'
          AND policyname = 'politica_journal_financeiro_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_journal_financeiro_servico_ou_conta
        ON journal_financeiro_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'chaves_nex_netcatbank'
          AND policyname = 'politica_chaves_nex_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_chaves_nex_servico_ou_conta
        ON chaves_nex_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'auditoria_chaves_nex_netcatbank'
          AND policyname = 'politica_auditoria_chaves_nex_servico'
      ) THEN
        CREATE POLICY politica_auditoria_chaves_nex_servico
        ON auditoria_chaves_nex_netcatbank
        USING (current_setting('app.netcatbank_servico', true) = 'api-netcatbank')
        WITH CHECK (current_setting('app.netcatbank_servico', true) = 'api-netcatbank');
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'transferencias_nex_netcatbank'
          AND policyname = 'politica_transferencias_nex_servico_ou_conta'
      ) THEN
        CREATE POLICY politica_transferencias_nex_servico_ou_conta
        ON transferencias_nex_netcatbank
        USING (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_origem_id::text
          OR current_setting('app.netcatbank_conta_id', true) = conta_destino_id::text
        )
        WITH CHECK (
          current_setting('app.netcatbank_servico', true) = 'api-netcatbank'
          OR current_setting('app.netcatbank_conta_id', true) = conta_origem_id::text
          OR current_setting('app.netcatbank_conta_id', true) = conta_destino_id::text
        );
      END IF;
    END $$;
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS sessoes_abertura_netcatbank (
      token_hash text PRIMARY KEY,
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE CASCADE,
      contexto_hash text NOT NULL,
      expiracao timestamptz NOT NULL,
      usado_em timestamptz,
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS sessoes_cliente_netcatbank (
      token_hash text PRIMARY KEY,
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE CASCADE,
      contexto_hash text NOT NULL,
      contexto_rede_hash text,
      agente_hash text,
      sinal_cliente_hash text,
      expiracao timestamptz NOT NULL,
      ultimo_uso_em timestamptz NOT NULL DEFAULT now(),
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS desafios_login_2fa_netcatbank (
      token_hash text PRIMARY KEY,
      conta_id uuid NOT NULL REFERENCES contas_netcatbank(id) ON DELETE CASCADE,
      contexto_hash text NOT NULL,
      contexto_rede_hash text NOT NULL,
      agente_hash text NOT NULL,
      sinal_cliente_hash text NOT NULL,
      expiracao timestamptz NOT NULL,
      usado_em timestamptz,
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await banco.query(
    "ALTER TABLE sessoes_cliente_netcatbank ADD COLUMN IF NOT EXISTS contexto_rede_hash text"
  );
  await banco.query(
    "ALTER TABLE sessoes_cliente_netcatbank ADD COLUMN IF NOT EXISTS agente_hash text"
  );
  await banco.query(
    "ALTER TABLE sessoes_cliente_netcatbank ADD COLUMN IF NOT EXISTS sinal_cliente_hash text"
  );
  await banco.query(`
    CREATE TABLE IF NOT EXISTS eventos_seguranca_netcatbank (
      id bigserial PRIMARY KEY,
      evento text NOT NULL,
      referencia text,
      contexto_hash text,
      request_id text,
      conta_id uuid,
      ip_hash text,
      user_agent_hash text,
      detalhes_cifrados text,
      hash_anterior text,
      hash_encadeado text,
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await banco.query("ALTER TABLE eventos_seguranca_netcatbank ADD COLUMN IF NOT EXISTS request_id text");
  await banco.query("ALTER TABLE eventos_seguranca_netcatbank ADD COLUMN IF NOT EXISTS conta_id uuid");
  await banco.query("ALTER TABLE eventos_seguranca_netcatbank ADD COLUMN IF NOT EXISTS ip_hash text");
  await banco.query("ALTER TABLE eventos_seguranca_netcatbank ADD COLUMN IF NOT EXISTS user_agent_hash text");
  await banco.query("ALTER TABLE eventos_seguranca_netcatbank ADD COLUMN IF NOT EXISTS detalhes_cifrados text");
  await banco.query("ALTER TABLE eventos_seguranca_netcatbank ADD COLUMN IF NOT EXISTS hash_anterior text");
  await banco.query("ALTER TABLE eventos_seguranca_netcatbank ADD COLUMN IF NOT EXISTS hash_encadeado text");
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_eventos_seguranca_hash_anterior'
      ) THEN
        ALTER TABLE eventos_seguranca_netcatbank
          ADD CONSTRAINT chk_eventos_seguranca_hash_anterior
          CHECK (hash_anterior IS NULL OR hash_anterior = 'GENESIS' OR hash_anterior ~ '^[a-f0-9]{64}$');
      END IF;
    END $$;
  `);
  await banco.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_eventos_seguranca_hash_encadeado'
      ) THEN
        ALTER TABLE eventos_seguranca_netcatbank
          ADD CONSTRAINT chk_eventos_seguranca_hash_encadeado
          CHECK (hash_encadeado IS NULL OR hash_encadeado ~ '^[a-f0-9]{64}$');
      END IF;
    END $$;
  `);
  await banco.query("DROP TRIGGER IF EXISTS trg_eventos_seguranca_imutavel ON eventos_seguranca_netcatbank");
  await banco.query(`
    CREATE TRIGGER trg_eventos_seguranca_imutavel
    BEFORE UPDATE OR DELETE ON eventos_seguranca_netcatbank
    FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_ledger_saldos_netcatbank()
  `);
  await banco.query(`
    CREATE TABLE IF NOT EXISTS envelopes_netcatbank (
      nonce_hash text PRIMARY KEY,
      contexto_hash text NOT NULL,
      fluxo text NOT NULL,
      rota text NOT NULL,
      expiracao timestamptz NOT NULL,
      criado_em timestamptz NOT NULL DEFAULT now()
    )
  `);
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_sessoes_cliente_conta ON sessoes_cliente_netcatbank(conta_id)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_saldos_conta_atualizado ON saldos_conta_netcatbank(atualizado_em)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_ledger_saldos_conta_versao ON ledger_saldos_netcatbank(conta_id, versao_saldo)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_ledger_saldos_idempotencia ON ledger_saldos_netcatbank(idempotencia_chave)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_partidas_dobradas_saldo_lancamento ON partidas_dobradas_saldo_netcatbank(lancamento_id, ordem)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_partidas_dobradas_saldo_conta ON partidas_dobradas_saldo_netcatbank(conta_id, criado_em)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_journal_financeiro_conta ON journal_financeiro_netcatbank(conta_id, criado_em)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_movimentos_financeiros_conta_data ON movimentos_financeiros_netcatbank(conta_id, efetivado_em DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_movimentos_financeiros_filtros ON movimentos_financeiros_netcatbank(conta_id, categoria, direcao, status, efetivado_em DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_elegibilidades_credito_expira ON elegibilidades_credito_netcatbank(expira_em)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_agendamentos_financeiros_conta_data ON agendamentos_financeiros_netcatbank(conta_id, agendado_para ASC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_agendamentos_nex_vencidos ON agendamentos_financeiros_netcatbank(conta_id, status, agendado_para ASC) WHERE tipo = 'nex'"
  );
  await banco.query(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_nex_referencia ON agendamentos_financeiros_netcatbank(referencia_publica) WHERE referencia_publica IS NOT NULL"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_comprovantes_transacao_conta ON comprovantes_transacao_netcatbank(conta_id, criado_em DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_pagamentos_boletos_liquidados_conta ON pagamentos_boletos_liquidados_netcatbank(conta_id, liquidado_em DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_consultas_cnpj_atualizado ON consultas_cnpj_netcatbank(atualizado_em)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_desafios_login_2fa_conta ON desafios_login_2fa_netcatbank(conta_id)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_links_indicacao_conta ON links_indicacao_netcatbank(conta_id, criado_em DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_indicacoes_indicador_status ON indicacoes_netcatbank(indicador_conta_id, status, atualizado_em DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_indicacoes_indicado_status ON indicacoes_netcatbank(indicado_conta_id, status, atualizado_em DESC)"
  );
  await banco.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_indicacoes_documento_ativo
    ON indicacoes_netcatbank(indicado_documento_indice)
    WHERE indicado_documento_indice IS NOT NULL
      AND status IN ('convite', 'abertura', 'conta_ativada', 'bonus_liquidado')
  `);
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_indicacoes_expira ON indicacoes_netcatbank(expira_em)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_eventos_seguranca_criado ON eventos_seguranca_netcatbank(criado_em)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_eventos_seguranca_referencia ON eventos_seguranca_netcatbank(referencia, criado_em)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_envelopes_expiracao ON envelopes_netcatbank(expiracao)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_chaves_nex_conta_estado ON chaves_nex_netcatbank(conta_id, estado, criada_em DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_chaves_nex_cooldown ON chaves_nex_netcatbank(conta_id, cooldown_ate DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_auditoria_chaves_nex_conta ON auditoria_chaves_nex_netcatbank(conta_id, criado_em DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_transferencias_nex_origem_estado ON transferencias_nex_netcatbank(conta_origem_id, estado, criado_em DESC)"
  );
  await banco.query(
    "CREATE INDEX IF NOT EXISTS idx_transferencias_nex_destino_estado ON transferencias_nex_netcatbank(conta_destino_id, estado, criado_em DESC)"
  );
};

export const buscarConsultaCnpj = async (cnpjIndice: string) => {
  const resultado = await banco.query<ConsultaCnpjBanco>(
    `
      SELECT cnpj_indice, cnpj_cifrado, dados_cifrados, consultado_em
      FROM consultas_cnpj_netcatbank
      WHERE cnpj_indice = $1
      LIMIT 1
    `,
    [cnpjIndice]
  );
  return resultado.rows[0] ?? null;
};

export const salvarConsultaCnpj = async (entrada: {
  cnpjCifrado: string;
  cnpjIndice: string;
  dadosCifrados: string;
}) => {
  await banco.query(
    `
      INSERT INTO consultas_cnpj_netcatbank (
        cnpj_indice,
        cnpj_cifrado,
        dados_cifrados,
        consultado_em,
        atualizado_em
      )
      VALUES ($1, $2, $3, now(), now())
      ON CONFLICT (cnpj_indice) DO UPDATE
      SET dados_cifrados = EXCLUDED.dados_cifrados,
          consultado_em = now(),
          atualizado_em = now()
    `,
    [entrada.cnpjIndice, entrada.cnpjCifrado, entrada.dadosCifrados]
  );
};

export const registrarEventoSeguranca = async (
  evento: string,
  referencia: string | null,
  contextoHash: string | null,
  detalhes: {
    contaId?: string | null;
    detalhesCifrados?: string | null;
    ipHash?: string | null;
    requestId?: string | null;
    userAgentHash?: string | null;
  } = {}
) => {
  const eventoSeguro = evento.slice(0, 90);
  const referenciaSegura = referencia?.slice(0, 140) ?? null;
  const requestId = detalhes.requestId?.slice(0, 90) ?? null;
  const contaId = detalhes.contaId ?? null;
  const ipHash = detalhes.ipHash?.slice(0, 140) ?? null;
  const userAgentHash = detalhes.userAgentHash?.slice(0, 140) ?? null;
  const detalhesCifrados = detalhes.detalhesCifrados?.slice(0, 2_000) ?? null;
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("LOCK TABLE eventos_seguranca_netcatbank IN SHARE ROW EXCLUSIVE MODE");
    const anteriorResultado = await cliente.query<{ hash_encadeado: string }>(
      `
        SELECT hash_encadeado
        FROM eventos_seguranca_netcatbank
        WHERE hash_encadeado IS NOT NULL
        ORDER BY id DESC
        LIMIT 1
      `
    );
    const hashAnterior = anteriorResultado.rows[0]?.hash_encadeado ?? "GENESIS";
    const hashEncadeado = hashJsonInterno({
      contaId,
      contextoHash,
      detalhesCifrados,
      evento: eventoSeguro,
      hashAnterior,
      ipHash,
      referencia: referenciaSegura,
      requestId,
      userAgentHash
    });

    await cliente.query(
      `
        INSERT INTO eventos_seguranca_netcatbank (
          evento,
          referencia,
          contexto_hash,
          request_id,
          conta_id,
          ip_hash,
          user_agent_hash,
          detalhes_cifrados,
          hash_anterior,
          hash_encadeado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        eventoSeguro,
        referenciaSegura,
        contextoHash,
        requestId,
        contaId,
        ipHash,
        userAgentHash,
        detalhesCifrados,
        hashAnterior,
        hashEncadeado
      ]
    );
    await cliente.query("COMMIT");
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const contarEventosSegurancaRecentes = async (
  eventos: string[],
  contextoHash: string | null,
  janela = "5 minutes"
) => {
  if (!contextoHash || eventos.length === 0) return 0;
  const resultado = await banco.query<{ total: string }>(
    `
      SELECT count(*)::text AS total
      FROM eventos_seguranca_netcatbank
      WHERE contexto_hash = $1
        AND evento = ANY($2::text[])
        AND criado_em > now() - $3::interval
    `,
    [contextoHash, eventos, janela]
  );
  return Number(resultado.rows[0]?.total ?? 0);
};

export const contarEventosSegurancaPorReferencia = async (
  eventos: string[],
  referencia: string | null,
  janela = "10 minutes"
) => {
  if (!referencia || eventos.length === 0) return 0;
  const resultado = await banco.query<{ total: string }>(
    `
      SELECT count(*)::text AS total
      FROM eventos_seguranca_netcatbank
      WHERE referencia = $1
        AND evento = ANY($2::text[])
        AND criado_em > now() - $3::interval
    `,
    [referencia.slice(0, 140), eventos, janela]
  );
  return Number(resultado.rows[0]?.total ?? 0);
};

export const registrarEnvelopeUnico = async (entrada: {
  nonceHash: string;
  contextoHash: string;
  fluxo: string;
  rota: string;
}) => {
  await banco.query("DELETE FROM envelopes_netcatbank WHERE expiracao < now()");
  const resultado = await banco.query<{ nonce_hash: string }>(
    `
      INSERT INTO envelopes_netcatbank (nonce_hash, contexto_hash, fluxo, rota, expiracao)
      VALUES ($1, $2, $3, $4, now() + interval '10 minutes')
      ON CONFLICT (nonce_hash) DO NOTHING
      RETURNING nonce_hash
    `,
    [
      entrada.nonceHash,
      entrada.contextoHash,
      entrada.fluxo.slice(0, 60),
      entrada.rota.slice(0, 120)
    ]
  );
  return resultado.rowCount === 1;
};

export const buscarContaPorDocumento = async (documentoIndice: string) => {
  const resultado = await banco.query<ContaBanco>(
    "SELECT * FROM contas_netcatbank WHERE documento_indice = $1 AND apagado_em IS NULL LIMIT 1",
    [documentoIndice]
  );
  return resultado.rows[0] ?? null;
};

export const buscarContaPorId = async (contaId: string) => {
  const resultado = await banco.query<ContaBanco>(
    "SELECT * FROM contas_netcatbank WHERE id = $1 AND apagado_em IS NULL LIMIT 1",
    [contaId]
  );
  return resultado.rows[0] ?? null;
};

type EventoAuditoriaChaveNex =
  | "criada"
  | "removida"
  | "bloqueada"
  | "conflito"
  | "cooldown"
  | "limite"
  | "replay"
  | "agendamento_criado"
  | "agendamento_processado"
  | "agendamento_falhou"
  | "transferencia_preparada"
  | "transferencia_liquidada"
  | "transferencia_recusada";

const registrarAuditoriaChaveNexComCliente = async (
  cliente: PoolClient,
  entrada: {
    chaveId?: string | null;
    contaId?: string | null;
    contextoHash?: string | null;
    evento: EventoAuditoriaChaveNex;
    idempotenciaChave?: string | null;
    payload: unknown;
  }
) => {
  const payloadHash = hashJsonInterno(entrada.payload);
  await cliente.query("LOCK TABLE auditoria_chaves_nex_netcatbank IN SHARE ROW EXCLUSIVE MODE");
  const anteriorResultado = await cliente.query<{ hash_encadeado: string }>(
    `
      SELECT hash_encadeado
      FROM auditoria_chaves_nex_netcatbank
      ORDER BY id DESC
      LIMIT 1
    `
  );
  const hashAnterior = anteriorResultado.rows[0]?.hash_encadeado ?? "GENESIS";
  const hashEncadeado = hashJsonInterno({
    chaveId: entrada.chaveId ?? null,
    contaId: entrada.contaId ?? null,
    contextoHash: entrada.contextoHash ?? null,
    evento: entrada.evento,
    hashAnterior,
    idempotenciaChave: entrada.idempotenciaChave ?? null,
    payloadHash
  });

  await cliente.query(
    `
      INSERT INTO auditoria_chaves_nex_netcatbank (
        conta_id,
        chave_id,
        evento,
        idempotencia_chave,
        contexto_hash,
        payload_hash,
        hash_anterior,
        hash_encadeado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      entrada.contaId ?? null,
      entrada.chaveId ?? null,
      entrada.evento,
      entrada.idempotenciaChave ?? null,
      entrada.contextoHash ?? null,
      payloadHash,
      hashAnterior,
      hashEncadeado
    ]
  );
};

export const buscarChavesNexConta = async (contaId: string) => {
  validarTextoInterno(contaId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);
    const resultado = await cliente.query<ChaveNexBanco>(
      `
        SELECT *
        FROM chaves_nex_netcatbank
        WHERE conta_id = $1
          AND estado IN ('ativa', 'pendente_verificacao')
        ORDER BY criada_em ASC, id ASC
      `,
      [contaId]
    );
    await cliente.query("COMMIT");
    return resultado.rows;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const criarChaveNexConta = async (entrada: {
  contaId: string;
  contextoHash: string | null;
  estado: EstadoChaveNexBanco;
  idempotenciaChave: string;
  tipo: TipoChaveNexBanco;
  valorCifrado: string;
  valorExibicao: string;
  valorIndiceHmac: string;
}) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(entrada.valorIndiceHmac, /^[a-f0-9]{64}$/i, "indice_nex_invalido");
  validarTextoInterno(entrada.idempotenciaChave, /^[a-zA-Z0-9:_-]{8,120}$/, "idempotencia_nex_invalida");
  if (!["aleatoria", "email", "telefone", "documento"].includes(entrada.tipo)) throw new Error("tipo_nex_invalido");
  if (!["ativa", "pendente_verificacao"].includes(entrada.estado)) throw new Error("estado_nex_invalido");
  if (entrada.valorCifrado.length < 24 || entrada.valorCifrado.length > 2_000) throw new Error("valor_nex_invalido");
  if (entrada.valorExibicao.length < 3 || entrada.valorExibicao.length > 160) throw new Error("exibicao_nex_invalida");

  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaId]);

    const conta = await cliente.query<{ status: ContaBanco["status"] }>(
      "SELECT status FROM contas_netcatbank WHERE id = $1 AND apagado_em IS NULL FOR UPDATE",
      [entrada.contaId]
    );
    if (conta.rows[0]?.status !== "ativa") throw new Error("conta_nex_indisponivel");

    const idempotente = await cliente.query<ChaveNexBanco>(
      `
        SELECT *
        FROM chaves_nex_netcatbank
        WHERE conta_id = $1
          AND idempotencia_chave = $2
        LIMIT 1
      `,
      [entrada.contaId, entrada.idempotenciaChave]
    );
    if (idempotente.rows[0]) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        chaveId: idempotente.rows[0].id,
        contaId: entrada.contaId,
        contextoHash: entrada.contextoHash,
        evento: "replay",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: { tipo: entrada.tipo }
      });
      await cliente.query("COMMIT");
      return idempotente.rows[0];
    }

    const cooldown = await cliente.query<{ cooldown_ate: Date | null }>(
      `
        SELECT cooldown_ate
        FROM chaves_nex_netcatbank
        WHERE conta_id = $1
        ORDER BY atualizada_em DESC
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.contaId]
    );
    const cooldownAte = cooldown.rows[0]?.cooldown_ate ?? null;
    if (cooldownAte && cooldownAte.getTime() > Date.now()) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaId,
        contextoHash: entrada.contextoHash,
        evento: "cooldown",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: { cooldownAte: cooldownAte.toISOString(), tipo: entrada.tipo }
      });
      throw new Error("chave_nex_cooldown");
    }

    if (entrada.tipo === "aleatoria") {
      const aleatorias = await cliente.query<{ total: string }>(
        `
          SELECT count(*)::text AS total
          FROM chaves_nex_netcatbank
          WHERE conta_id = $1
            AND tipo = 'aleatoria'
            AND estado = 'ativa'
        `,
        [entrada.contaId]
      );
      if (Number(aleatorias.rows[0]?.total ?? 0) >= 3) {
        await registrarAuditoriaChaveNexComCliente(cliente, {
          contaId: entrada.contaId,
          contextoHash: entrada.contextoHash,
          evento: "limite",
          idempotenciaChave: entrada.idempotenciaChave,
          payload: { tipo: entrada.tipo }
        });
        throw new Error("chave_nex_limite");
      }
    } else {
      const tipoExistente = await cliente.query<{ id: string }>(
        `
          SELECT id
          FROM chaves_nex_netcatbank
          WHERE conta_id = $1
            AND tipo = $2
            AND estado IN ('ativa', 'pendente_verificacao')
          LIMIT 1
          FOR UPDATE
        `,
        [entrada.contaId, entrada.tipo]
      );
      if (tipoExistente.rows[0]) {
        await registrarAuditoriaChaveNexComCliente(cliente, {
          chaveId: tipoExistente.rows[0].id,
          contaId: entrada.contaId,
          contextoHash: entrada.contextoHash,
          evento: "conflito",
          idempotenciaChave: entrada.idempotenciaChave,
          payload: { tipo: entrada.tipo }
        });
        throw new Error("chave_nex_tipo_existente");
      }
    }

    const valorExistente = await cliente.query<ChaveNexBanco>(
      `
        SELECT *
        FROM chaves_nex_netcatbank
        WHERE valor_indice_hmac = $1
          AND (
            estado IN ('ativa', 'pendente_verificacao')
            OR (estado = 'removida' AND removida_em > now() - interval '24 hours')
          )
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.valorIndiceHmac]
    );
    if (valorExistente.rows[0]) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        chaveId: valorExistente.rows[0].id,
        contaId: entrada.contaId,
        contextoHash: entrada.contextoHash,
        evento: "conflito",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: { tipo: entrada.tipo }
      });
      throw new Error("chave_nex_indisponivel");
    }

    const resultado = await cliente.query<ChaveNexBanco>(
      `
        INSERT INTO chaves_nex_netcatbank (
          conta_id,
          tipo,
          valor_indice_hmac,
          valor_cifrado,
          valor_exibicao,
          estado,
          idempotencia_chave,
          cooldown_ate
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval '45 seconds')
        RETURNING *
      `,
      [
        entrada.contaId,
        entrada.tipo,
        entrada.valorIndiceHmac,
        entrada.valorCifrado,
        entrada.valorExibicao,
        entrada.estado,
        entrada.idempotenciaChave
      ]
    );
    const chave = resultado.rows[0];
    if (!chave) throw new Error("chave_nex_indisponivel");

    await registrarAuditoriaChaveNexComCliente(cliente, {
      chaveId: chave.id,
      contaId: entrada.contaId,
      contextoHash: entrada.contextoHash,
      evento: "criada",
      idempotenciaChave: entrada.idempotenciaChave,
      payload: {
        estado: chave.estado,
        tipo: chave.tipo,
        valorIndiceHmac: chave.valor_indice_hmac
      }
    });
    await cliente.query("COMMIT");
    return chave;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const removerChaveNexConta = async (entrada: {
  chaveId: string;
  contaId: string;
  contextoHash: string | null;
  idempotenciaChave: string;
}) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(entrada.chaveId, /^[0-9a-f-]{36}$/i, "chave_nex_invalida");
  validarTextoInterno(entrada.idempotenciaChave, /^[a-zA-Z0-9:_-]{8,120}$/, "idempotencia_nex_invalida");
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaId]);
    await cliente.query("SELECT id FROM contas_netcatbank WHERE id = $1 AND status = 'ativa' AND apagado_em IS NULL FOR UPDATE", [
      entrada.contaId
    ]);

    const cooldown = await cliente.query<{ cooldown_ate: Date | null }>(
      `
        SELECT cooldown_ate
        FROM chaves_nex_netcatbank
        WHERE conta_id = $1
        ORDER BY atualizada_em DESC
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.contaId]
    );
    const cooldownAte = cooldown.rows[0]?.cooldown_ate ?? null;
    if (cooldownAte && cooldownAte.getTime() > Date.now()) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaId,
        contextoHash: entrada.contextoHash,
        evento: "cooldown",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: { cooldownAte: cooldownAte.toISOString(), tipo: "remocao" }
      });
      throw new Error("chave_nex_cooldown");
    }

    const chaveAtual = await cliente.query<ChaveNexBanco>(
      `
        SELECT *
        FROM chaves_nex_netcatbank
        WHERE id = $1
          AND conta_id = $2
          AND estado IN ('ativa', 'pendente_verificacao')
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.chaveId, entrada.contaId]
    );

    const chave = chaveAtual.rows[0] ?? null;
    if (!chave) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaId,
        contextoHash: entrada.contextoHash,
        evento: "bloqueada",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: { motivo: "nao_encontrada" }
      });
      await cliente.query("COMMIT");
      return null;
    }

    const removida = await cliente.query<ChaveNexBanco>(
      `
        UPDATE chaves_nex_netcatbank
        SET estado = 'removida',
            removida_em = now(),
            atualizada_em = now(),
            cooldown_ate = now() + interval '45 seconds',
            versao = versao + 1
        WHERE id = $1
          AND conta_id = $2
          AND estado IN ('ativa', 'pendente_verificacao')
        RETURNING *
      `,
      [entrada.chaveId, entrada.contaId]
    );
    const chaveRemovida = removida.rows[0] ?? null;
    if (chaveRemovida) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        chaveId: chaveRemovida.id,
        contaId: entrada.contaId,
        contextoHash: entrada.contextoHash,
        evento: "removida",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: {
          tipo: chaveRemovida.tipo,
          valorIndiceHmac: chaveRemovida.valor_indice_hmac
        }
      });
    }

    await cliente.query("COMMIT");
    return chaveRemovida;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const resolverDestinoChaveNex = async (entrada: {
  chaveDestinoIndiceHmac: string;
  contaOrigemId: string;
}) => {
  validarTextoInterno(entrada.contaOrigemId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(entrada.chaveDestinoIndiceHmac, /^[a-f0-9]{64}$/i, "chave_destino_nex_invalida");
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaOrigemId]);
    const resultado = await cliente.query<
      ChaveNexBanco & Pick<ContaBanco, "nome_cifrado" | "primeiro_nome_cifrado" | "tipo_documento" | "documento_cifrado">
    >(
      `
        SELECT
          chave.*,
          conta.nome_cifrado,
          conta.primeiro_nome_cifrado,
          conta.tipo_documento,
          conta.documento_cifrado
        FROM chaves_nex_netcatbank chave
        INNER JOIN contas_netcatbank conta
          ON conta.id = chave.conta_id
         AND conta.status = 'ativa'
         AND conta.apagado_em IS NULL
        WHERE chave.valor_indice_hmac = $1
          AND chave.estado = 'ativa'
          AND chave.conta_id <> $2
        LIMIT 1
      `,
      [entrada.chaveDestinoIndiceHmac, entrada.contaOrigemId]
    );
    const linha = resultado.rows[0] ?? null;
    await cliente.query("COMMIT");
    if (!linha) return null;

    const {
      nome_cifrado,
      primeiro_nome_cifrado,
      tipo_documento,
      documento_cifrado,
      ...chave
    } = linha;

    return {
      chave,
      conta: {
        documento_cifrado,
        id: chave.conta_id,
        nome_cifrado,
        primeiro_nome_cifrado,
        tipo_documento
      }
    } satisfies DestinatarioNexBanco;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const buscarTransferenciaNexConta = async (entrada: {
  contaOrigemId: string;
  transferenciaId: string;
}) => {
  validarTextoInterno(entrada.contaOrigemId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(entrada.transferenciaId, /^[0-9a-f-]{36}$/i, "transferencia_nex_invalida");
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaOrigemId]);
    const resultado = await cliente.query<TransferenciaNexBanco>(
      `
        SELECT *
        FROM transferencias_nex_netcatbank
        WHERE id = $1
          AND conta_origem_id = $2
        LIMIT 1
      `,
      [entrada.transferenciaId, entrada.contaOrigemId]
    );
    await cliente.query("COMMIT");
    return resultado.rows[0] ?? null;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const buscarAtividadesNexConta = async (
  contaId: string,
  filtros: {
    limite: number;
    pagina: number;
    pesquisa?: string;
  }
) => {
  validarTextoInterno(contaId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  const cliente = await banco.connect();
  const termoPesquisa = filtros.pesquisa ? `%${filtros.pesquisa.toLocaleLowerCase("pt-BR")}%` : null;
  const limite = Math.max(1, Math.min(filtros.limite, 50));
  const pagina = Math.max(1, filtros.pagina);
  const offset = (pagina - 1) * limite;

  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);

    const movimentos = await cliente.query<MovimentoFinanceiroBanco>(
      `
        SELECT
          id,
          conta_id,
          ledger_id,
          direcao,
          tipo,
          categoria,
          descricao,
          contraparte,
          valor_centavos,
          moeda,
          efetivado_em,
          status,
          count(*) OVER()::text AS total_registros
        FROM movimentos_financeiros_netcatbank
        WHERE conta_id = $1
          AND status = 'liquidado'
          AND tipo = 'nex'
          AND (
            $2::text IS NULL
            OR lower(descricao || ' ' || coalesce(contraparte, '')) LIKE $2
          )
        ORDER BY efetivado_em DESC, id DESC
        LIMIT $3 OFFSET $4
      `,
      [contaId, termoPesquisa, limite, offset]
    );

    const contatos = await cliente.query<ContatoNexBanco>(
      `
        WITH base AS (
          SELECT
            CASE WHEN transferencia.conta_origem_id = $1 THEN transferencia.conta_destino_id ELSE transferencia.conta_origem_id END AS conta_contato_id,
            CASE WHEN transferencia.conta_origem_id = $1 THEN destino.nome_cifrado ELSE origem.nome_cifrado END AS nome_cifrado,
            CASE WHEN transferencia.conta_origem_id = $1 THEN destino.primeiro_nome_cifrado ELSE origem.primeiro_nome_cifrado END AS primeiro_nome_cifrado,
            CASE WHEN transferencia.conta_origem_id = $1 THEN 'saida' ELSE 'entrada' END AS direcao_ultima,
            transferencia.valor_centavos::text AS valor_centavos,
            COALESCE(transferencia.liquidado_em, transferencia.atualizado_em) AS ultima_em,
            COALESCE(
              CASE WHEN chave_destino.tipo = 'aleatoria' THEN chave_destino.valor_exibicao END,
              CASE WHEN chave_origem.tipo = 'aleatoria' THEN chave_origem.valor_exibicao END
            ) AS chave_sugestao,
            transferencia.id
          FROM transferencias_nex_netcatbank transferencia
          INNER JOIN contas_netcatbank origem
            ON origem.id = transferencia.conta_origem_id
           AND origem.status = 'ativa'
           AND origem.apagado_em IS NULL
          INNER JOIN contas_netcatbank destino
            ON destino.id = transferencia.conta_destino_id
           AND destino.status = 'ativa'
           AND destino.apagado_em IS NULL
          LEFT JOIN chaves_nex_netcatbank chave_destino
            ON chave_destino.valor_indice_hmac = transferencia.chave_destino_indice_hmac
           AND chave_destino.conta_id = transferencia.conta_destino_id
           AND chave_destino.estado = 'ativa'
          LEFT JOIN LATERAL (
            SELECT tipo, valor_exibicao
            FROM chaves_nex_netcatbank chave
            WHERE chave.conta_id = transferencia.conta_origem_id
              AND chave.estado = 'ativa'
            ORDER BY
              CASE chave.tipo
                WHEN 'aleatoria' THEN 1
                WHEN 'email' THEN 2
                WHEN 'documento' THEN 3
                ELSE 4
              END,
              chave.criada_em DESC
            LIMIT 1
          ) chave_origem ON transferencia.conta_destino_id = $1
          WHERE transferencia.estado = 'liquidada'
            AND (transferencia.conta_origem_id = $1 OR transferencia.conta_destino_id = $1)
        ),
        ranqueada AS (
          SELECT
            *,
            count(*) OVER(PARTITION BY conta_contato_id)::text AS total_transferencias,
            row_number() OVER(PARTITION BY conta_contato_id ORDER BY ultima_em DESC, id DESC) AS posicao
          FROM base
        )
        SELECT
          chave_sugestao,
          conta_contato_id,
          direcao_ultima,
          nome_cifrado,
          primeiro_nome_cifrado,
          total_transferencias,
          ultima_em,
          valor_centavos
        FROM ranqueada
        WHERE posicao = 1
        ORDER BY ultima_em DESC
        LIMIT 24
      `,
      [contaId]
    );

    await cliente.query("COMMIT");
    return {
      contatos: contatos.rows.filter((contato) => {
        if (!termoPesquisa) return true;
        return contato.nome_cifrado.toLocaleLowerCase("pt-BR").includes(termoPesquisa.replace(/%/g, ""));
      }),
      itens: movimentos.rows,
      total: Number(movimentos.rows[0]?.total_registros ?? 0)
    };
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const emailExiste = async (emailIndice: string) => {
  const resultado = await banco.query<{ existe: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM contas_netcatbank WHERE email_indice = $1) AS existe",
    [emailIndice]
  );
  return resultado.rows[0]?.existe === true;
};

export const documentoExiste = async (documentoIndice: string) => {
  const resultado = await banco.query<{ existe: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM contas_netcatbank WHERE documento_indice = $1) AS existe",
    [documentoIndice]
  );
  return resultado.rows[0]?.existe === true;
};

export const buscarOuCriarCampanhaIndicacao = async (contaId: string) => {
  const resultado = await banco.query<CampanhaIndicacaoBanco>(
    `
      INSERT INTO campanhas_indicacao_netcatbank (conta_id, inicio_em, expira_em)
      VALUES ($1, now(), now() + interval '30 days')
      ON CONFLICT (conta_id) DO UPDATE
      SET status = CASE
            WHEN campanhas_indicacao_netcatbank.expira_em <= now()
              AND campanhas_indicacao_netcatbank.status = 'ativa'
              THEN 'expirada'
            ELSE campanhas_indicacao_netcatbank.status
          END,
          atualizado_em = now()
      RETURNING *
    `,
    [contaId]
  );
  return resultado.rows[0] ?? null;
};

export const buscarCampanhaIndicacao = async (contaId: string) => {
  const resultado = await banco.query<CampanhaIndicacaoBanco>(
    `
      UPDATE campanhas_indicacao_netcatbank
      SET status = CASE
            WHEN expira_em <= now() AND status = 'ativa' THEN 'expirada'
            ELSE status
          END,
          atualizado_em = now()
      WHERE conta_id = $1
      RETURNING *
    `,
    [contaId]
  );
  return resultado.rows[0] ?? null;
};

export const criarLinkIndicacao = async (entrada: {
  campanhaExpiraEm: Date;
  codigoHash: string;
  contaId: string;
  slug: string;
}) => {
  const resultado = await banco.query<LinkIndicacaoBanco>(
    `
      INSERT INTO links_indicacao_netcatbank (
        conta_id,
        codigo_hash,
        slug,
        campanha_expira_em
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [entrada.contaId, entrada.codigoHash, entrada.slug, entrada.campanhaExpiraEm]
  );
  return resultado.rows[0] ?? null;
};

export const buscarLinkIndicacaoPorCodigo = async (codigoHash: string) => {
  const resultado = await banco.query<LinkIndicacaoBanco & ContaBanco & { indicador_id: string }>(
    `
      SELECT
        l.*,
        c.id AS indicador_id,
        c.referencia_publica,
        c.status,
        c.nome_cifrado,
        c.primeiro_nome_cifrado,
        c.tipo_documento,
        c.documento_indice,
        c.email_indice,
        c.produto,
        c.senha_hash,
        c.dois_fatores_ativo,
        c.dois_fatores_segredo_cifrado,
        c.dois_fatores_ultimo_contador
      FROM links_indicacao_netcatbank l
      JOIN contas_netcatbank c ON c.id = l.conta_id
      JOIN campanhas_indicacao_netcatbank camp ON camp.conta_id = l.conta_id
      WHERE l.codigo_hash = $1
        AND l.campanha_expira_em > now()
        AND camp.status = 'ativa'
        AND camp.expira_em > now()
        AND c.status = 'ativa'
        AND c.apagado_em IS NULL
      LIMIT 1
    `,
    [codigoHash]
  );
  return resultado.rows[0] ?? null;
};

export const criarConviteIndicacao = async (entrada: {
  codigoHash: string;
  contextoHash: string;
  indicadorContaId: string;
  tokenHash: string;
}) => {
  const resultado = await banco.query<IndicacaoBanco>(
    `
      INSERT INTO indicacoes_netcatbank (
        token_hash,
        codigo_hash,
        indicador_conta_id,
        contexto_hash,
        expira_em
      )
      VALUES ($1, $2, $3, $4, now() + interval '45 minutes')
      RETURNING *
    `,
    [entrada.tokenHash, entrada.codigoHash, entrada.indicadorContaId, entrada.contextoHash]
  );
  return resultado.rows[0] ?? null;
};

export const buscarConviteIndicacao = async (tokenHash: string, contextoHash: string) => {
  const resultado = await banco.query<IndicacaoBanco>(
    `
      SELECT *
      FROM indicacoes_netcatbank
      WHERE token_hash = $1
        AND contexto_hash = $2
        AND status IN ('convite', 'abertura')
        AND expira_em > now()
      ORDER BY criado_em DESC
      LIMIT 1
    `,
    [tokenHash, contextoHash]
  );
  return resultado.rows[0] ?? null;
};

export const vincularConviteIndicacaoAConta = async (entrada: {
  contextoHash: string;
  documentoIndice: string;
  emailIndice: string;
  indicadoContaId: string;
  tokenHash: string;
}) => {
  const resultado = await banco.query<IndicacaoBanco>(
    `
      UPDATE indicacoes_netcatbank
      SET indicado_conta_id = $3,
          indicado_documento_indice = $4,
          indicado_email_indice = $5,
          status = 'abertura',
          atualizado_em = now()
      WHERE token_hash = $1
        AND contexto_hash = $2
        AND indicado_conta_id IS NULL
        AND status = 'convite'
        AND expira_em > now()
      RETURNING *
    `,
    [
      entrada.tokenHash,
      entrada.contextoHash,
      entrada.indicadoContaId,
      entrada.documentoIndice,
      entrada.emailIndice
    ]
  );
  return resultado.rows[0] ?? null;
};

export const marcarIndicacaoContaAtivada = async (contaId: string) => {
  await banco.query(
    `
      UPDATE indicacoes_netcatbank
      SET status = 'conta_ativada',
          atualizado_em = now()
      WHERE indicado_conta_id = $1
        AND status = 'abertura'
    `,
    [contaId]
  );
};

export const bloquearIndicacao = async (indicacaoId: string) => {
  await banco.query(
    `
      UPDATE indicacoes_netcatbank
      SET status = 'bloqueada',
          atualizado_em = now()
      WHERE id = $1
        AND status <> 'bonus_liquidado'
    `,
    [indicacaoId]
  );
};

export const buscarIndicacaoPendenteBonus = async (indicadoContaId: string) => {
  const resultado = await banco.query<IndicacaoBanco & { indicador_documento_indice: string }>(
    `
      SELECT i.*, c.documento_indice AS indicador_documento_indice
      FROM indicacoes_netcatbank i
      JOIN contas_netcatbank c ON c.id = i.indicador_conta_id
      JOIN campanhas_indicacao_netcatbank camp ON camp.conta_id = i.indicador_conta_id
      WHERE i.indicado_conta_id = $1
        AND i.status = 'conta_ativada'
        AND i.expira_em > now()
        AND c.status = 'ativa'
        AND c.apagado_em IS NULL
        AND camp.status = 'ativa'
        AND camp.expira_em > now()
      LIMIT 1
    `,
    [indicadoContaId]
  );
  return resultado.rows[0] ?? null;
};

export const buscarIndicacaoRecebida = async (indicadoContaId: string) => {
  const resultado = await banco.query<IndicacaoBanco>(
    `
      SELECT *
      FROM indicacoes_netcatbank
      WHERE indicado_conta_id = $1
        AND status IN ('abertura', 'conta_ativada', 'bonus_liquidado')
      ORDER BY atualizado_em DESC
      LIMIT 1
    `,
    [indicadoContaId]
  );
  return resultado.rows[0] ?? null;
};

export const buscarLancamentoSaldoPorIdempotencia = async (contaId: string, idempotenciaChave: string) => {
  const resultado = await banco.query<LancamentoSaldoBanco>(
    `
      SELECT *
      FROM ledger_saldos_netcatbank
      WHERE conta_id = $1
        AND idempotencia_chave = $2
      LIMIT 1
    `,
    [contaId, idempotenciaChave]
  );
  return resultado.rows[0] ?? null;
};

export const registrarMovimentoFinanceiroLedger = async (entrada: {
  categoria: CategoriaMovimentoFinanceiro;
  contaId: string;
  contraparte: string | null;
  descricao: string;
  direcao: DirecaoMovimentoFinanceiro;
  ledgerId: string;
  tipo: TipoMovimentoFinanceiro;
  valorCentavos: number;
}) => {
  if (!Number.isSafeInteger(entrada.valorCentavos) || entrada.valorCentavos <= 0) {
    throw new Error("movimento_valor_invalido");
  }

  let movimento: MovimentoFinanceiroBanco | null = null;
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    const inserido = await cliente.query<MovimentoFinanceiroBanco>(
      `
        INSERT INTO movimentos_financeiros_netcatbank (
          conta_id,
          ledger_id,
          direcao,
          tipo,
          categoria,
          descricao,
          contraparte,
          valor_centavos,
          moeda,
          efetivado_em,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BRL', now(), 'liquidado')
        ON CONFLICT (ledger_id) DO NOTHING
        RETURNING *
      `,
      [
        entrada.contaId,
        entrada.ledgerId,
        entrada.direcao,
        entrada.tipo,
        entrada.categoria,
        entrada.descricao.slice(0, 120),
        entrada.contraparte?.slice(0, 120) ?? null,
        entrada.valorCentavos
      ]
    );

    movimento = inserido.rows[0] ?? null;
    if (!movimento) {
      const existente = await cliente.query<MovimentoFinanceiroBanco>(
        `
          SELECT *
          FROM movimentos_financeiros_netcatbank
          WHERE conta_id = $1
            AND ledger_id = $2
          LIMIT 1
        `,
        [entrada.contaId, entrada.ledgerId]
      );
      movimento = existente.rows[0] ?? null;
    }

    if (!movimento) throw new Error("movimento_ledger_indisponivel");
    await cliente.query("COMMIT");
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }

  return movimento;
};

export const contarIndicacoesLiquidadas = async (
  indicadorContaId: string,
  janela: "7 days" | "30 days"
) => {
  const resultado = await banco.query<{ total: string }>(
    `
      SELECT count(*)::text AS total
      FROM indicacoes_netcatbank
      WHERE indicador_conta_id = $1
        AND status = 'bonus_liquidado'
        AND atualizado_em > now() - $2::interval
    `,
    [indicadorContaId, janela]
  );
  return Number(resultado.rows[0]?.total ?? 0);
};

export const contarIndicacoesLiquidadasCampanha = async (
  indicadorContaId: string,
  inicioEm: Date,
  expiraEm: Date
) => {
  const resultado = await banco.query<{ total: string }>(
    `
      SELECT count(*)::text AS total
      FROM indicacoes_netcatbank
      WHERE indicador_conta_id = $1
        AND status = 'bonus_liquidado'
        AND atualizado_em >= $2
        AND atualizado_em <= $3
    `,
    [indicadorContaId, inicioEm, expiraEm]
  );
  return Number(resultado.rows[0]?.total ?? 0);
};

export const marcarIndicacaoBonusLiquidado = async (entrada: {
  bonusIndicadorIdempotencia: string;
  bonusIndicadoIdempotencia: string;
  indicacaoId: string;
}) => {
  await banco.query(
    `
      UPDATE indicacoes_netcatbank
      SET status = 'bonus_liquidado',
          bonus_indicador_idempotencia = $2,
          bonus_indicado_idempotencia = $3,
          atualizado_em = now()
      WHERE id = $1
        AND status = 'conta_ativada'
    `,
    [entrada.indicacaoId, entrada.bonusIndicadorIdempotencia, entrada.bonusIndicadoIdempotencia]
  );
};

export const buscarBoasVindasIndicacaoPendente = async (indicadoContaId: string) => {
  const resultado = await banco.query<IndicacaoBanco & { indicador_primeiro_nome_cifrado: string }>(
    `
      SELECT i.*, c.primeiro_nome_cifrado AS indicador_primeiro_nome_cifrado
      FROM indicacoes_netcatbank i
      JOIN contas_netcatbank c ON c.id = i.indicador_conta_id
      WHERE i.indicado_conta_id = $1
        AND i.status = 'bonus_liquidado'
        AND i.boas_vindas_visto_em IS NULL
      LIMIT 1
    `,
    [indicadoContaId]
  );
  return resultado.rows[0] ?? null;
};

export const marcarBoasVindasIndicacaoVista = async (indicadoContaId: string) => {
  await banco.query(
    `
      UPDATE indicacoes_netcatbank
      SET boas_vindas_visto_em = now(),
          atualizado_em = now()
      WHERE indicado_conta_id = $1
        AND status = 'bonus_liquidado'
        AND boas_vindas_visto_em IS NULL
    `,
    [indicadoContaId]
  );
};

export const buscarSaldoConta = async (contaId: string) => {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    const resultado = await cliente.query<SaldoContaBanco>(
      "SELECT * FROM saldos_conta_netcatbank WHERE conta_id = $1 LIMIT 1",
      [contaId]
    );
    await cliente.query("COMMIT");
    return resultado.rows[0] ?? null;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

const modeloElegibilidadeCredito = "NCB-CREDITO-COMPORTAMENTAL-v1";
const cacheElegibilidadeCreditoMs = 2 * 60 * 60 * 1000;
const limitesPilotoCreditoCentavos = [20_000, 40_000, 50_000, 70_000, 100_000];
const limiteMinimoPilotoCreditoCentavos = 20_000;

const inteiroMetricaCredito = (valor: unknown) => {
  const numero = typeof valor === "number" ? valor : Number.parseInt(String(valor ?? "0"), 10);
  return Number.isSafeInteger(numero) ? Math.max(0, numero) : 0;
};

const limitarNumeroCredito = (valor: number, minimo: number, maximo: number) =>
  Math.max(minimo, Math.min(maximo, valor));

const sementeElegibilidadeCredito = (contaId: string) =>
  Number.parseInt(createHash("sha256").update(`credito-netcatbank:${contaId}`).digest("hex").slice(0, 8), 16) % 100;

const escolherLimitePilotoCredito = (valorBaseCentavos: number) => {
  const valorSeguro = limitarNumeroCredito(valorBaseCentavos, limiteMinimoPilotoCreditoCentavos, 100_000);
  return [...limitesPilotoCreditoCentavos].reverse().find((limite) => valorSeguro >= limite) ?? limiteMinimoPilotoCreditoCentavos;
};

const mapearElegibilidadeCredito = (registro: ElegibilidadeCreditoBanco): ElegibilidadeCreditoConta => ({
  calculadoEm: registro.calculado_em,
  estado: registro.estado,
  expiraEm: registro.expira_em,
  faixa: registro.faixa,
  limiteCentavos: inteiroMetricaCredito(registro.limite_centavos),
  modelo: registro.modelo,
  motivo: registro.motivo,
  taxaMensalBps: inteiroMetricaCredito(registro.taxa_mensal_bps)
});

export const obterElegibilidadeCreditoConta = async (entrada: {
  contaId: string;
  criptografar: (valor: string) => string;
}) => {
  validarTextoInterno(
    entrada.contaId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "conta_credito_invalida"
  );

  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaId]);

    const vigente = await cliente.query<ElegibilidadeCreditoBanco>(
      `
        SELECT *
        FROM elegibilidades_credito_netcatbank
        WHERE conta_id = $1
          AND expira_em > now()
        LIMIT 1
      `,
      [entrada.contaId]
    );

    if (vigente.rows[0]) {
      await cliente.query("COMMIT");
      return mapearElegibilidadeCredito(vigente.rows[0]);
    }

    const metricasResultado = await cliente.query<{
      conta_criada_em: Date;
      saldo_disponivel_centavos: string | null;
      transacoes_90: string;
      transacoes_180: string;
      entradas_90: string;
      saidas_90: string;
      entradas_180: string;
      saidas_180: string;
      pagamentos_servicos_90: string;
      nex_90: string;
      tipos_distintos_90: string;
      dias_ativos_90: string;
      maior_entrada_90: string;
    }>(
      `
        SELECT
          conta.criado_em AS conta_criada_em,
          saldo.saldo_disponivel_centavos::text AS saldo_disponivel_centavos,
          COUNT(movimento.id) FILTER (
            WHERE movimento.efetivado_em >= now() - interval '90 days'
          )::text AS transacoes_90,
          COUNT(movimento.id)::text AS transacoes_180,
          COALESCE(SUM(CASE
            WHEN movimento.direcao = 'entrada'
             AND movimento.efetivado_em >= now() - interval '90 days'
            THEN movimento.valor_centavos ELSE 0 END), 0)::text AS entradas_90,
          COALESCE(SUM(CASE
            WHEN movimento.direcao = 'saida'
             AND movimento.efetivado_em >= now() - interval '90 days'
            THEN movimento.valor_centavos ELSE 0 END), 0)::text AS saidas_90,
          COALESCE(SUM(CASE WHEN movimento.direcao = 'entrada' THEN movimento.valor_centavos ELSE 0 END), 0)::text AS entradas_180,
          COALESCE(SUM(CASE WHEN movimento.direcao = 'saida' THEN movimento.valor_centavos ELSE 0 END), 0)::text AS saidas_180,
          COUNT(movimento.id) FILTER (
            WHERE movimento.tipo IN ('pagamento', 'recarga', 'doacao')
              AND movimento.efetivado_em >= now() - interval '90 days'
          )::text AS pagamentos_servicos_90,
          COUNT(movimento.id) FILTER (
            WHERE movimento.tipo = 'nex'
              AND movimento.efetivado_em >= now() - interval '90 days'
          )::text AS nex_90,
          COUNT(DISTINCT CASE
            WHEN movimento.efetivado_em >= now() - interval '90 days'
            THEN movimento.tipo END
          )::text AS tipos_distintos_90,
          COUNT(DISTINCT CASE
            WHEN movimento.efetivado_em >= now() - interval '90 days'
            THEN date_trunc('day', movimento.efetivado_em) END
          )::text AS dias_ativos_90,
          COALESCE(MAX(CASE
            WHEN movimento.direcao = 'entrada'
             AND movimento.efetivado_em >= now() - interval '90 days'
            THEN movimento.valor_centavos ELSE 0 END), 0)::text AS maior_entrada_90
        FROM contas_netcatbank conta
        LEFT JOIN saldos_conta_netcatbank saldo
          ON saldo.conta_id = conta.id
        LEFT JOIN movimentos_financeiros_netcatbank movimento
          ON movimento.conta_id = conta.id
         AND movimento.status = 'liquidado'
         AND movimento.efetivado_em >= now() - interval '180 days'
        WHERE conta.id = $1
          AND conta.status = 'ativa'
          AND conta.apagado_em IS NULL
        GROUP BY conta.id, saldo.saldo_disponivel_centavos
        LIMIT 1
      `,
      [entrada.contaId]
    );

    const metricas = metricasResultado.rows[0];
    if (!metricas) throw new Error("conta_credito_indisponivel");

    const agora = new Date();
    const idadeContaDias = Math.max(
      0,
      Math.floor((agora.getTime() - metricas.conta_criada_em.getTime()) / 86_400_000)
    );
    const saldoDisponivelCentavos = inteiroMetricaCredito(metricas.saldo_disponivel_centavos);
    const transacoes90 = inteiroMetricaCredito(metricas.transacoes_90);
    const transacoes180 = inteiroMetricaCredito(metricas.transacoes_180);
    const entradas90 = inteiroMetricaCredito(metricas.entradas_90);
    const saidas90 = inteiroMetricaCredito(metricas.saidas_90);
    const entradas180 = inteiroMetricaCredito(metricas.entradas_180);
    const saidas180 = inteiroMetricaCredito(metricas.saidas_180);
    const pagamentosServicos90 = inteiroMetricaCredito(metricas.pagamentos_servicos_90);
    const nex90 = inteiroMetricaCredito(metricas.nex_90);
    const tiposDistintos90 = inteiroMetricaCredito(metricas.tipos_distintos_90);
    const diasAtivos90 = inteiroMetricaCredito(metricas.dias_ativos_90);
    const maiorEntrada90 = inteiroMetricaCredito(metricas.maior_entrada_90);
    const semente = sementeElegibilidadeCredito(entrada.contaId);
    const volume90 = entradas90 + saidas90;

    const scoreAtividade = Math.min(34, transacoes90 * 2 + diasAtivos90 * 2);
    const scoreVolume = Math.min(28, Math.floor(volume90 / 15_000));
    const scoreDiversidade = Math.min(16, tiposDistintos90 * 4 + pagamentosServicos90 * 2 + nex90);
    const scoreRelacionamento = Math.min(12, Math.floor(idadeContaDias / 14));
    const scoreSaldo = Math.min(8, Math.floor(saldoDisponivelCentavos / 12_500));
    const score = limitarNumeroCredito(
      scoreAtividade + scoreVolume + scoreDiversidade + scoreRelacionamento + scoreSaldo + (semente % 8),
      0,
      100
    );

    const atividadeMinima =
      transacoes90 >= 2 ||
      entradas90 >= 30_000 ||
      saidas90 >= 30_000 ||
      saldoDisponivelCentavos >= 20_000;
    const revisaoPiloto = score < 26 || (transacoes90 < 4 && semente % 7 === 0);

    let estado: EstadoElegibilidadeCredito = "analise";
    let faixa: ElegibilidadeCreditoBanco["faixa"] = "em_analise";
    let limiteCentavos = 0;
    let taxaMensalBps = 0;
    let motivo = "Ainda estamos analisando sua conta. Movimente sua conta para aumentar suas chances.";

    if (atividadeMinima && !revisaoPiloto) {
      const baseComportamental =
        saldoDisponivelCentavos * 0.22 +
        entradas90 * 0.08 +
        saidas90 * 0.045 +
        maiorEntrada90 * 0.06 +
        score * 900;
      limiteCentavos = escolherLimitePilotoCredito(Math.floor(baseComportamental / 10_000) * 10_000);

      if (score < 45) {
        limiteCentavos = [20_000, 40_000, 50_000][semente % 3] ?? limiteMinimoPilotoCreditoCentavos;
      } else if (transacoes90 < 6) {
        limiteCentavos = Math.min(limiteCentavos, 50_000);
      }

      estado = "disponivel";
      faixa = score >= 72 ? "forte" : score >= 48 ? "moderada" : "inicial";
      taxaMensalBps = score >= 72 ? 129 : score >= 48 ? 159 : 199;
      motivo = "Oferta inicial calculada a partir do uso recente da conta e sujeita à revisão na simulação.";
    }

    const metricasParaAuditoria = {
      entradas90,
      entradas180,
      estado,
      faixa,
      idadeContaDias,
      limiteCentavos,
      modelo: modeloElegibilidadeCredito,
      pagamentosServicos90,
      scoreFaixa: faixa,
      saidas90,
      saidas180,
      saldoDisponivelCentavos,
      transacoes90,
      transacoes180
    };
    const metricasHash = hashJsonInterno(metricasParaAuditoria);
    const metricasCifradas = entrada.criptografar(JSON.stringify(metricasParaAuditoria));
    const expiraEm = new Date(agora.getTime() + cacheElegibilidadeCreditoMs);

    const salvo = await cliente.query<ElegibilidadeCreditoBanco>(
      `
        INSERT INTO elegibilidades_credito_netcatbank (
          conta_id,
          modelo,
          estado,
          limite_centavos,
          taxa_mensal_bps,
          faixa,
          motivo,
          metricas_hash,
          metricas_cifradas,
          calculado_em,
          expira_em,
          atualizado_em
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
        ON CONFLICT (conta_id) DO UPDATE
        SET modelo = EXCLUDED.modelo,
            estado = EXCLUDED.estado,
            limite_centavos = EXCLUDED.limite_centavos,
            taxa_mensal_bps = EXCLUDED.taxa_mensal_bps,
            faixa = EXCLUDED.faixa,
            motivo = EXCLUDED.motivo,
            metricas_hash = EXCLUDED.metricas_hash,
            metricas_cifradas = EXCLUDED.metricas_cifradas,
            calculado_em = EXCLUDED.calculado_em,
            expira_em = EXCLUDED.expira_em,
            atualizado_em = now()
        RETURNING *
      `,
      [
        entrada.contaId,
        modeloElegibilidadeCredito,
        estado,
        limiteCentavos,
        taxaMensalBps,
        faixa,
        motivo,
        metricasHash,
        metricasCifradas,
        agora,
        expiraEm
      ]
    );

    const registroSalvo = salvo.rows[0];
    if (!registroSalvo) throw new Error("elegibilidade_credito_indisponivel");
    await cliente.query("COMMIT");
    return mapearElegibilidadeCredito(registroSalvo);
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

const normalizarInteiroFinanceiro = (valor: string | number) => {
  const numero = typeof valor === "number" ? valor : Number.parseInt(valor, 10);
  if (!Number.isSafeInteger(numero)) throw new Error("valor_financeiro_invalido");
  return numero;
};

const validarTextoInterno = (valor: string, expressao: RegExp, mensagem: string) => {
  if (!expressao.test(valor)) throw new Error(mensagem);
};

const validarTransicaoLancamentoSaldo = (entrada: {
  tipo: TipoLancamentoSaldo;
  fase: FaseLancamentoSaldo;
  estado: EstadoLancamentoSaldo;
  deltaDisponivelCentavos: number;
  deltaContabilCentavos: number;
}) => {
  const { tipo, fase, estado, deltaDisponivelCentavos, deltaContabilCentavos } = entrada;
  const deltasValidos =
    Number.isSafeInteger(deltaDisponivelCentavos) && Number.isSafeInteger(deltaContabilCentavos);

  if (!deltasValidos) throw new Error("lancamento_saldo_valor_invalido");

  const regraOk =
    (tipo === "abertura" &&
      fase === "liquidacao" &&
      estado === "liquidado" &&
      deltaDisponivelCentavos === 0 &&
      deltaContabilCentavos === 0) ||
    (tipo === "credito_autorizado" &&
      fase === "autorizacao" &&
      estado === "registrado" &&
      deltaDisponivelCentavos >= 0 &&
      deltaContabilCentavos === 0) ||
    (tipo === "credito_liquidado" &&
      fase === "liquidacao" &&
      estado === "liquidado" &&
      deltaDisponivelCentavos >= 0 &&
      deltaContabilCentavos >= 0) ||
    (tipo === "debito_reservado" &&
      fase === "autorizacao" &&
      estado === "registrado" &&
      deltaDisponivelCentavos <= 0 &&
      deltaContabilCentavos === 0) ||
    (tipo === "debito_liquidado" &&
      fase === "liquidacao" &&
      estado === "liquidado" &&
      deltaDisponivelCentavos === 0 &&
      deltaContabilCentavos <= 0) ||
    (tipo === "debito_cancelado" &&
      fase === "cancelamento" &&
      estado === "cancelado" &&
      deltaDisponivelCentavos >= 0 &&
      deltaContabilCentavos === 0) ||
    (tipo === "ajuste_sistema" && fase === "ajuste" && estado === "registrado");

  if (!regraOk) throw new Error("transicao_saldo_recusada");
};

const hashJsonInterno = (valor: unknown) =>
  createHash("sha256").update(JSON.stringify(valor)).digest("hex");

const prepararPartidasDobradasSaldo = (entrada: {
  deltaDisponivelCentavos: number;
  deltaContabilCentavos: number;
}) => {
  const partidas: PartidaDobradaSaldo[] = [];
  const adicionar = (
    contaContabil: ContaContabilSaldo,
    natureza: NaturezaPartida,
    valorCentavos: number
  ) => {
    if (valorCentavos === 0) return;
    partidas.push({
      ordem: partidas.length + 1,
      contaContabil,
      natureza,
      valorCentavos
    });
  };

  if (entrada.deltaContabilCentavos > 0) {
    adicionar("liquidacao_banco", "debito", entrada.deltaContabilCentavos);
    adicionar("passivo_clientes", "credito", entrada.deltaContabilCentavos);
  }

  if (entrada.deltaContabilCentavos < 0) {
    const valor = Math.abs(entrada.deltaContabilCentavos);
    adicionar("passivo_clientes", "debito", valor);
    adicionar("liquidacao_banco", "credito", valor);
  }

  if (entrada.deltaDisponivelCentavos > 0) {
    adicionar("disponivel_clientes", "debito", entrada.deltaDisponivelCentavos);
    adicionar("reservas_operacionais", "credito", entrada.deltaDisponivelCentavos);
  }

  if (entrada.deltaDisponivelCentavos < 0) {
    const valor = Math.abs(entrada.deltaDisponivelCentavos);
    adicionar("reservas_operacionais", "debito", valor);
    adicionar("disponivel_clientes", "credito", valor);
  }

  const totalDebito = partidas
    .filter((partida) => partida.natureza === "debito")
    .reduce((total, partida) => total + partida.valorCentavos, 0);
  const totalCredito = partidas
    .filter((partida) => partida.natureza === "credito")
    .reduce((total, partida) => total + partida.valorCentavos, 0);

  if (totalDebito !== totalCredito) throw new Error("partidas_saldo_desbalanceadas");
  return partidas;
};

const buscarSaldoContaComCliente = async (
  cliente: PoolClient,
  contaId: string,
  bloquear = false
) => {
  const resultado = await cliente.query<SaldoContaBanco>(
    `SELECT * FROM saldos_conta_netcatbank WHERE conta_id = $1 LIMIT 1${bloquear ? " FOR UPDATE" : ""}`,
    [contaId]
  );
  return resultado.rows[0] ?? null;
};

export const buscarLancamentosSaldoConta = async (contaId: string) => {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    const resultado = await cliente.query<LancamentoSaldoBanco>(
      `
        SELECT *
        FROM ledger_saldos_netcatbank
        WHERE conta_id = $1
        ORDER BY versao_saldo ASC
      `,
      [contaId]
    );
    await cliente.query("COMMIT");
    return resultado.rows;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const buscarPartidasDobradasSaldoLancamento = async (lancamentoId: string) => {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    const resultado = await cliente.query<PartidaDobradaSaldoBanco>(
      `
        SELECT *
        FROM partidas_dobradas_saldo_netcatbank
        WHERE lancamento_id = $1
        ORDER BY ordem ASC
      `,
      [lancamentoId]
    );
    await cliente.query("COMMIT");
    return resultado.rows;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

const ordenarMovimentosSql = (ordenar: OrdenacaoMovimentoFinanceiro) => {
  if (ordenar === "antigas") return "efetivado_em ASC, criado_em ASC, id ASC";
  if (ordenar === "valor_maior") return "valor_centavos DESC, efetivado_em DESC, id DESC";
  if (ordenar === "valor_menor") return "valor_centavos ASC, efetivado_em DESC, id DESC";
  return "efetivado_em DESC, criado_em DESC, id DESC";
};

export const buscarMovimentosFinanceirosConta = async (
  contaId: string,
  filtros: FiltrosMovimentosFinanceiros
) => {
  const cliente = await banco.connect();
  const termoPesquisa = filtros.pesquisa ? `%${filtros.pesquisa}%` : null;
  const limite = Math.max(1, Math.min(filtros.limite, 5_000));
  const pagina = Math.max(1, filtros.pagina);
  const offset = (pagina - 1) * limite;
  const ordenar = ordenarMovimentosSql(filtros.ordenar);

  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);
    const resultado = await cliente.query<MovimentoFinanceiroBanco>(
      `
        SELECT
          id,
          conta_id,
          ledger_id,
          direcao,
          tipo,
          categoria,
          descricao,
          contraparte,
          valor_centavos,
          moeda,
          efetivado_em,
          status,
          count(*) OVER()::text AS total_registros
        FROM movimentos_financeiros_netcatbank
        WHERE conta_id = $1
          AND status IN ('liquidado', 'falhou')
          AND efetivado_em >= $2::date
          AND efetivado_em < ($3::date + interval '1 day')
          AND ($4::text IS NULL OR categoria = $4)
          AND ($5::text = 'todos' OR direcao = $5)
          AND (
            $6::text IS NULL
            OR lower(descricao || ' ' || coalesce(contraparte, '')) LIKE $6
          )
        ORDER BY ${ordenar}
        LIMIT $7 OFFSET $8
      `,
      [
        contaId,
        filtros.inicio,
        filtros.fim,
        filtros.categoria,
        filtros.tipo,
        termoPesquisa,
        limite,
        offset
      ]
    );
    await cliente.query("COMMIT");
    return {
      itens: resultado.rows,
      total: Number(resultado.rows[0]?.total_registros ?? 0)
    };
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const buscarMovimentoFinanceiroContaPorId = async (contaId: string, movimentoId: string) => {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);
    const resultado = await cliente.query<MovimentoFinanceiroBanco>(
      `
        SELECT
          id,
          conta_id,
          ledger_id,
          direcao,
          tipo,
          categoria,
          descricao,
          contraparte,
          valor_centavos,
          moeda,
          efetivado_em,
          status
        FROM movimentos_financeiros_netcatbank
        WHERE conta_id = $1
          AND id = $2
          AND status IN ('liquidado', 'falhou')
        LIMIT 1
      `,
      [contaId, movimentoId]
    );
    await cliente.query("COMMIT");
    return resultado.rows[0] ?? null;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const boletoBancarioJaLiquidado = async (codigoBarrasHash: string) => {
  validarTextoInterno(codigoBarrasHash, /^[a-f0-9]{64}$/, "hash_boleto_invalido");
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    const resultado = await cliente.query<Pick<PagamentoBoletoLiquidadoBanco, "codigo_barras_hash">>(
      `
        SELECT codigo_barras_hash
        FROM pagamentos_boletos_liquidados_netcatbank
        WHERE codigo_barras_hash = $1
        LIMIT 1
      `,
      [codigoBarrasHash]
    );
    await cliente.query("COMMIT");
    return Boolean(resultado.rows[0]);
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

const registrarBoletoLiquidadoComCliente = async (
  cliente: PoolClient,
  entrada: {
    codigoBarrasHash: string;
    contaId: string;
    movimentoId: string;
    referenciaPublica: string;
  }
) => {
  const resultado = await cliente.query<PagamentoBoletoLiquidadoBanco>(
    `
      INSERT INTO pagamentos_boletos_liquidados_netcatbank (
        codigo_barras_hash,
        conta_id,
        movimento_id,
        referencia_publica,
        liquidado_em
      )
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (codigo_barras_hash) DO NOTHING
      RETURNING *
    `,
    [
      entrada.codigoBarrasHash,
      entrada.contaId,
      entrada.movimentoId,
      entrada.referenciaPublica
    ]
  );

  return resultado.rows[0] ?? null;
};

export const buscarParticipantesTransferenciaNexMovimento = async (
  contaId: string,
  movimento: Pick<MovimentoFinanceiroBanco, "ledger_id" | "tipo">
) => {
  if (movimento.tipo !== "nex" || !movimento.ledger_id) return null;
  validarTextoInterno(contaId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(movimento.ledger_id, /^[0-9a-f-]{36}$/i, "ledger_nex_invalido");

  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);

    const resultado = await cliente.query<ParticipantesTransferenciaNexBanco>(
      `
        SELECT
          transferencia.referencia_publica,
          origem.nome_cifrado AS origem_nome_cifrado,
          origem.primeiro_nome_cifrado AS origem_primeiro_nome_cifrado,
          origem.tipo_documento AS origem_tipo_documento,
          origem.documento_cifrado AS origem_documento_cifrado,
          destino.nome_cifrado AS destino_nome_cifrado,
          destino.primeiro_nome_cifrado AS destino_primeiro_nome_cifrado,
          destino.tipo_documento AS destino_tipo_documento,
          destino.documento_cifrado AS destino_documento_cifrado,
          chave_destino.valor_exibicao AS chave_destino_valor_exibicao,
          chave_origem.valor_exibicao AS chave_origem_valor_exibicao
        FROM transferencias_nex_netcatbank transferencia
        INNER JOIN contas_netcatbank origem
          ON origem.id = transferencia.conta_origem_id
         AND origem.status = 'ativa'
         AND origem.apagado_em IS NULL
        INNER JOIN contas_netcatbank destino
          ON destino.id = transferencia.conta_destino_id
         AND destino.status = 'ativa'
         AND destino.apagado_em IS NULL
        LEFT JOIN chaves_nex_netcatbank chave_destino
          ON chave_destino.valor_indice_hmac = transferencia.chave_destino_indice_hmac
         AND chave_destino.conta_id = transferencia.conta_destino_id
        LEFT JOIN LATERAL (
          SELECT valor_exibicao
          FROM chaves_nex_netcatbank chave
          WHERE chave.conta_id = transferencia.conta_origem_id
            AND chave.estado = 'ativa'
          ORDER BY
            CASE chave.tipo
              WHEN 'aleatoria' THEN 1
              WHEN 'email' THEN 2
              WHEN 'documento' THEN 3
              ELSE 4
            END,
            chave.criada_em DESC
          LIMIT 1
        ) chave_origem ON true
        WHERE transferencia.estado = 'liquidada'
          AND (transferencia.conta_origem_id = $1 OR transferencia.conta_destino_id = $1)
          AND (
            transferencia.ledger_origem_liquidacao_id = $2
            OR transferencia.ledger_destino_liquidacao_id = $2
          )
        LIMIT 1
      `,
      [contaId, movimento.ledger_id]
    );

    await cliente.query("COMMIT");
    return resultado.rows[0] ?? null;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const buscarComprovanteTransacao = async (contaId: string, movimentoId: string) => {
  validarTextoInterno(contaId, /^[0-9a-f-]{36}$/i, "conta_comprovante_invalida");
  validarTextoInterno(movimentoId, /^[0-9a-f-]{36}$/i, "movimento_comprovante_invalido");
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);
    const resultado = await cliente.query<ComprovanteTransacaoBanco>(
      `
        SELECT *
        FROM comprovantes_transacao_netcatbank
        WHERE conta_id = $1
          AND movimento_id = $2
        LIMIT 1
      `,
      [contaId, movimentoId]
    );
    await cliente.query("COMMIT");
    return resultado.rows[0] ?? null;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const registrarComprovanteTransacao = async (entrada: {
  assinatura: string;
  chaveId: string;
  contaId: string;
  movimentoId: string;
  snapshotCifrado: string;
  snapshotHash: string;
}) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_comprovante_invalida");
  validarTextoInterno(entrada.movimentoId, /^[0-9a-f-]{36}$/i, "movimento_comprovante_invalido");
  validarTextoInterno(entrada.snapshotHash, /^[A-Za-z0-9_-]{32,96}$/, "hash_comprovante_invalido");
  validarTextoInterno(entrada.assinatura, /^[A-Za-z0-9_-]{64,140}$/, "assinatura_comprovante_invalida");
  validarTextoInterno(entrada.chaveId, /^[a-zA-Z0-9:_-]{8,80}$/, "chave_comprovante_invalida");
  if (entrada.snapshotCifrado.length < 24 || entrada.snapshotCifrado.length > 8_000) {
    throw new Error("snapshot_comprovante_invalido");
  }

  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaId]);
    await cliente.query("LOCK TABLE comprovantes_transacao_netcatbank IN SHARE ROW EXCLUSIVE MODE");

    const existente = await cliente.query<ComprovanteTransacaoBanco>(
      `
        SELECT *
        FROM comprovantes_transacao_netcatbank
        WHERE conta_id = $1
          AND movimento_id = $2
        LIMIT 1
      `,
      [entrada.contaId, entrada.movimentoId]
    );

    if (existente.rows[0]) {
      await cliente.query("COMMIT");
      return existente.rows[0];
    }

    const anteriorResultado = await cliente.query<{ hash_encadeado: string }>(
      `
        SELECT hash_encadeado
        FROM comprovantes_transacao_netcatbank
        ORDER BY criado_em DESC, id DESC
        LIMIT 1
      `
    );
    const hashAnterior = anteriorResultado.rows[0]?.hash_encadeado ?? "GENESIS";
    const hashEncadeado = hashJsonInterno({
      assinatura: entrada.assinatura,
      chaveId: entrada.chaveId,
      contaId: entrada.contaId,
      hashAnterior,
      movimentoId: entrada.movimentoId,
      snapshotHash: entrada.snapshotHash
    });

    const registrado = await cliente.query<ComprovanteTransacaoBanco>(
      `
        INSERT INTO comprovantes_transacao_netcatbank (
          conta_id,
          movimento_id,
          snapshot_hash,
          snapshot_cifrado,
          assinatura,
          chave_id,
          hash_anterior,
          hash_encadeado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (movimento_id) DO NOTHING
        RETURNING *
      `,
      [
        entrada.contaId,
        entrada.movimentoId,
        entrada.snapshotHash,
        entrada.snapshotCifrado,
        entrada.assinatura,
        entrada.chaveId,
        hashAnterior,
        hashEncadeado
      ]
    );

    if (registrado.rows[0]) {
      await cliente.query("COMMIT");
      return registrado.rows[0];
    }

    const idempotente = await cliente.query<ComprovanteTransacaoBanco>(
      `
        SELECT *
        FROM comprovantes_transacao_netcatbank
        WHERE movimento_id = $1
        LIMIT 1
      `,
      [entrada.movimentoId]
    );
    await cliente.query("COMMIT");
    if (!idempotente.rows[0]) throw new Error("comprovante_idempotencia_indisponivel");
    return idempotente.rows[0];
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const buscarAgendamentosFinanceirosConta = async (contaId: string) => {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);
    const resultado = await cliente.query<AgendamentoFinanceiroBanco>(
      `
        SELECT
          id,
          conta_id,
          direcao,
          tipo,
          categoria,
          descricao,
          contraparte,
          valor_centavos,
          moeda,
          agendado_para,
          status
        FROM agendamentos_financeiros_netcatbank
        WHERE conta_id = $1
          AND status = 'agendado'
          AND agendado_para >= now()
        ORDER BY agendado_para ASC, criado_em ASC, id ASC
        LIMIT 80
      `,
      [contaId]
    );
    await cliente.query("COMMIT");
    return resultado.rows;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const criarAgendamentoNexConta = async (entrada: {
  agendadoPara: Date;
  chaveDestinoIndiceHmac: string;
  contaOrigemId: string;
  contextoHash: string | null;
  contraparte: string;
  descricao: string;
  idempotenciaChave: string;
  referenciaPublica: string;
  valorCentavos: number;
}) => {
  validarTextoInterno(entrada.contaOrigemId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(entrada.chaveDestinoIndiceHmac, /^[a-f0-9]{64}$/i, "chave_destino_nex_invalida");
  validarTextoInterno(entrada.idempotenciaChave, /^[a-zA-Z0-9:_-]{8,120}$/, "idempotencia_nex_invalida");
  validarTextoInterno(entrada.referenciaPublica, /^NX-[A-Z0-9]{16,32}$/, "referencia_nex_invalida");
  if (!Number.isSafeInteger(entrada.valorCentavos) || entrada.valorCentavos <= 0 || entrada.valorCentavos > 100_000_000) {
    throw new Error("valor_nex_invalido");
  }
  if (!(entrada.agendadoPara instanceof Date) || !Number.isFinite(entrada.agendadoPara.getTime())) {
    throw new Error("agendamento_nex_data_invalida");
  }

  const descricao = entrada.descricao.trim().replace(/\s{2,}/g, " ").slice(0, 120) || "Transferência Nex agendada";
  const contraparte = entrada.contraparte.trim().replace(/\s{2,}/g, " ").slice(0, 120) || "Cliente NC Bank";
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaOrigemId]);

    const idempotente = await cliente.query<AgendamentoFinanceiroBanco>(
      `
        SELECT *
        FROM agendamentos_financeiros_netcatbank
        WHERE conta_id = $1
          AND idempotencia_chave = $2
        LIMIT 1
      `,
      [entrada.contaOrigemId, entrada.idempotenciaChave]
    );
    if (idempotente.rows[0]) {
      await cliente.query("COMMIT");
      return idempotente.rows[0];
    }

    const origem = await cliente.query<{ id: string; status: ContaBanco["status"] }>(
      "SELECT id, status FROM contas_netcatbank WHERE id = $1 AND apagado_em IS NULL FOR UPDATE",
      [entrada.contaOrigemId]
    );
    if (origem.rows[0]?.status !== "ativa") throw new Error("agendamento_nex_indisponivel");

    const chaveOrigem = await cliente.query<{ id: string }>(
      `
        SELECT id
        FROM chaves_nex_netcatbank
        WHERE conta_id = $1
          AND estado = 'ativa'
        ORDER BY criada_em ASC
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.contaOrigemId]
    );
    if (!chaveOrigem.rows[0]) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaOrigemId,
        contextoHash: entrada.contextoHash,
        evento: "agendamento_falhou",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: { motivo: "origem_sem_chave", valorCentavos: entrada.valorCentavos }
      });
      throw new Error("agendamento_nex_origem_sem_chave");
    }

    const chaveDestino = await cliente.query<ChaveNexBanco>(
      `
        SELECT *
        FROM chaves_nex_netcatbank
        WHERE valor_indice_hmac = $1
          AND estado = 'ativa'
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.chaveDestinoIndiceHmac]
    );
    const destino = chaveDestino.rows[0] ?? null;
    if (!destino || destino.conta_id === entrada.contaOrigemId) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaOrigemId,
        contextoHash: entrada.contextoHash,
        evento: "agendamento_falhou",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: { motivo: "destino_indisponivel", valorCentavos: entrada.valorCentavos }
      });
      throw new Error("agendamento_nex_indisponivel");
    }

    const contaDestino = await cliente.query<{ id: string; status: ContaBanco["status"] }>(
      "SELECT id, status FROM contas_netcatbank WHERE id = $1 AND apagado_em IS NULL FOR UPDATE",
      [destino.conta_id]
    );
    if (contaDestino.rows[0]?.status !== "ativa") throw new Error("agendamento_nex_indisponivel");

    const resultado = await cliente.query<AgendamentoFinanceiroBanco>(
      `
        INSERT INTO agendamentos_financeiros_netcatbank (
          conta_id,
          direcao,
          tipo,
          categoria,
          descricao,
          contraparte,
          valor_centavos,
          moeda,
          agendado_para,
          status,
          idempotencia_chave,
          referencia_publica,
          chave_destino_indice_hmac,
          destino_conta_id
        )
        VALUES ($1, 'saida', 'nex', 'geral', $2, $3, $4, 'BRL', $5, 'agendado', $6, $7, $8, $9)
        RETURNING *
      `,
      [
        entrada.contaOrigemId,
        descricao,
        contraparte,
        entrada.valorCentavos,
        entrada.agendadoPara,
        entrada.idempotenciaChave,
        entrada.referenciaPublica,
        entrada.chaveDestinoIndiceHmac,
        destino.conta_id
      ]
    );
    const agendamento = resultado.rows[0];
    if (!agendamento) throw new Error("agendamento_nex_indisponivel");

    await registrarAuditoriaChaveNexComCliente(cliente, {
      chaveId: destino.id,
      contaId: entrada.contaOrigemId,
      contextoHash: entrada.contextoHash,
      evento: "agendamento_criado",
      idempotenciaChave: entrada.idempotenciaChave,
      payload: {
        agendamentoId: agendamento.id,
        destino: destino.conta_id,
        referencia: entrada.referenciaPublica,
        valorCentavos: entrada.valorCentavos
      }
    });
    await cliente.query("COMMIT");
    return agendamento;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const buscarAgendamentosNexVencidosConta = async (contaId: string, limite = 8) => {
  validarTextoInterno(contaId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);
    const resultado = await cliente.query<AgendamentoFinanceiroBanco>(
      `
        SELECT *
        FROM agendamentos_financeiros_netcatbank
        WHERE conta_id = $1
          AND tipo = 'nex'
          AND agendado_para <= now()
          AND (
            status = 'agendado'
            OR (status = 'processando' AND atualizado_em < now() - interval '5 minutes')
          )
        ORDER BY agendado_para ASC, criado_em ASC, id ASC
        LIMIT $2
      `,
      [contaId, Math.max(1, Math.min(limite, 20))]
    );
    await cliente.query("COMMIT");
    return resultado.rows;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const marcarAgendamentoNexProcessando = async (contaId: string, agendamentoId: string) => {
  validarTextoInterno(contaId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(agendamentoId, /^[0-9a-f-]{36}$/i, "agendamento_nex_invalido");
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);
    const resultado = await cliente.query<AgendamentoFinanceiroBanco>(
      `
        UPDATE agendamentos_financeiros_netcatbank
        SET status = 'processando',
            atualizado_em = now()
        WHERE id = $1
          AND conta_id = $2
          AND tipo = 'nex'
          AND agendado_para <= now()
          AND (
            status = 'agendado'
            OR (status = 'processando' AND atualizado_em < now() - interval '5 minutes')
          )
        RETURNING *
      `,
      [agendamentoId, contaId]
    );
    await cliente.query("COMMIT");
    return resultado.rows[0] ?? null;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const marcarAgendamentoNexProcessado = async (entrada: {
  agendamentoId: string;
  contaId: string;
  contextoHash: string | null;
  idempotenciaChave: string;
}) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(entrada.agendamentoId, /^[0-9a-f-]{36}$/i, "agendamento_nex_invalido");
  validarTextoInterno(entrada.idempotenciaChave, /^[a-zA-Z0-9:_-]{8,120}$/, "idempotencia_nex_invalida");
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaId]);
    const resultado = await cliente.query<AgendamentoFinanceiroBanco>(
      `
        UPDATE agendamentos_financeiros_netcatbank
        SET status = 'processado',
            processado_em = now(),
            atualizado_em = now()
        WHERE id = $1
          AND conta_id = $2
          AND status = 'processando'
        RETURNING *
      `,
      [entrada.agendamentoId, entrada.contaId]
    );
    const agendamento = resultado.rows[0] ?? null;
    if (agendamento) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaId,
        contextoHash: entrada.contextoHash,
        evento: "agendamento_processado",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: {
          agendamentoId: agendamento.id,
          referencia: agendamento.referencia_publica,
          valorCentavos: agendamento.valor_centavos
        }
      });
    }
    await cliente.query("COMMIT");
    return agendamento;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const falharAgendamentoNexConta = async (entrada: {
  agendamentoId: string;
  contaId: string;
  contextoHash: string | null;
  idempotenciaChave: string;
  motivo: "saldo_insuficiente" | "destino_indisponivel" | "falha_liquidacao";
}) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(entrada.agendamentoId, /^[0-9a-f-]{36}$/i, "agendamento_nex_invalido");
  validarTextoInterno(entrada.idempotenciaChave, /^[a-zA-Z0-9:_-]{8,120}$/, "idempotencia_nex_invalida");
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaId]);
    const agendamentoResultado = await cliente.query<AgendamentoFinanceiroBanco>(
      `
        SELECT *
        FROM agendamentos_financeiros_netcatbank
        WHERE id = $1
          AND conta_id = $2
          AND status = 'processando'
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.agendamentoId, entrada.contaId]
    );
    const agendamento = agendamentoResultado.rows[0] ?? null;
    if (!agendamento) {
      await cliente.query("COMMIT");
      return null;
    }

    const descricao =
      entrada.motivo === "saldo_insuficiente"
        ? "Agendamento Nex não enviado: saldo insuficiente"
        : "Agendamento Nex não enviado";
    const movimento = await cliente.query<MovimentoFinanceiroBanco>(
      `
        INSERT INTO movimentos_financeiros_netcatbank (
          conta_id,
          ledger_id,
          direcao,
          tipo,
          categoria,
          descricao,
          contraparte,
          valor_centavos,
          moeda,
          efetivado_em,
          status
        )
        VALUES ($1, NULL, 'saida', 'nex', 'geral', $2, $3, $4, 'BRL', now(), 'falhou')
        RETURNING *
      `,
      [
        entrada.contaId,
        descricao,
        agendamento.contraparte,
        normalizarInteiroFinanceiro(agendamento.valor_centavos)
      ]
    );

    await cliente.query(
      `
        UPDATE agendamentos_financeiros_netcatbank
        SET status = 'falhou',
            falha_motivo = $3,
            processado_em = now(),
            atualizado_em = now()
        WHERE id = $1
          AND conta_id = $2
      `,
      [entrada.agendamentoId, entrada.contaId, entrada.motivo]
    );

    await registrarAuditoriaChaveNexComCliente(cliente, {
      contaId: entrada.contaId,
      contextoHash: entrada.contextoHash,
      evento: "agendamento_falhou",
      idempotenciaChave: entrada.idempotenciaChave,
      payload: {
        agendamentoId: agendamento.id,
        motivo: entrada.motivo,
        movimentoId: movimento.rows[0]?.id ?? null,
        referencia: agendamento.referencia_publica,
        valorCentavos: agendamento.valor_centavos
      }
    });

    await cliente.query("COMMIT");
    return movimento.rows[0] ?? null;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const buscarGraficoFinanceiroConta = async (contaId: string, mes: string) => {
  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [contaId]);
    const resultado = await cliente.query<{
      entradas_centavos: string;
      saidas_centavos: string;
      categoria: CategoriaMovimentoFinanceiro | null;
      categoria_direcao: DirecaoMovimentoFinanceiro | null;
      categoria_valor_centavos: string | null;
    }>(
      `
        WITH movimentos_mes AS (
          SELECT *
          FROM movimentos_financeiros_netcatbank
          WHERE conta_id = $1
            AND status = 'liquidado'
            AND efetivado_em >= ($2 || '-01')::date
            AND efetivado_em < (($2 || '-01')::date + interval '1 month')
        ),
        totais AS (
          SELECT
            coalesce(sum(valor_centavos) FILTER (WHERE direcao = 'entrada'), 0)::text AS entradas_centavos,
            coalesce(sum(valor_centavos) FILTER (WHERE direcao = 'saida'), 0)::text AS saidas_centavos
          FROM movimentos_mes
        ),
        categorias AS (
          SELECT
            direcao AS categoria_direcao,
            categoria,
            sum(valor_centavos)::text AS categoria_valor_centavos
          FROM movimentos_mes
          GROUP BY direcao, categoria
          ORDER BY direcao ASC, sum(valor_centavos) DESC, categoria ASC
          LIMIT 8
        )
        SELECT
          totais.entradas_centavos,
          totais.saidas_centavos,
          categorias.categoria_direcao,
          categorias.categoria,
          categorias.categoria_valor_centavos
        FROM totais
        LEFT JOIN categorias ON true
      `,
      [contaId, mes]
    );
    await cliente.query("COMMIT");
    const primeira = resultado.rows[0];
    return {
      entradasCentavos: Number(primeira?.entradas_centavos ?? 0),
      saidasCentavos: Number(primeira?.saidas_centavos ?? 0),
      categorias: resultado.rows
        .filter((linha) => linha.categoria && linha.categoria_valor_centavos)
        .map((linha) => ({
          categoria: linha.categoria as CategoriaMovimentoFinanceiro,
          direcao: linha.categoria_direcao as DirecaoMovimentoFinanceiro,
          valorCentavos: Number(linha.categoria_valor_centavos ?? 0)
        }))
    };
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const aplicarLancamentoLedgerSaldo = async (entrada: {
  contaId: string;
  idempotenciaChave: string;
  tipo: TipoLancamentoSaldo;
  fase: FaseLancamentoSaldo;
  estado: EstadoLancamentoSaldo;
  deltaDisponivelCentavos: number;
  deltaContabilCentavos: number;
  moeda: "BRL";
  referenciaOrigem: string;
  metadadosCifrados: string;
  assinarLancamento: (dados: {
    contaId: string;
    idempotenciaChave: string;
    tipo: string;
    fase: string;
    estado: string;
    deltaDisponivelCentavos: number;
    deltaContabilCentavos: number;
    moeda: string;
    versaoSaldo: number;
    hashAnterior: string;
    merkleRaiz: string;
    referenciaOrigem: string;
    metadadosCifrados: string;
  }) => string;
  assinarPartida: (dados: {
    contaId: string;
    idempotenciaChave: string;
    ordem: number;
    contaContabil: string;
    natureza: "debito" | "credito";
    valorCentavos: number;
    moeda: string;
  }) => string;
  calcularMerkleRaiz: (folhas: string[]) => string;
  assinarSaldo: (dados: {
    contaId: string;
    saldoDisponivelCentavos: number;
    saldoTotalCentavos: number;
    saldoContabilCentavos: number;
    moeda: string;
    versao: number;
  }) => string;
}) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_saldo_invalida");
  validarTextoInterno(entrada.idempotenciaChave, /^[a-z0-9:_-]{8,120}$/, "idempotencia_saldo_invalida");
  validarTextoInterno(entrada.referenciaOrigem, /^[a-zA-Z0-9:._-]{8,140}$/, "referencia_saldo_invalida");
  if (entrada.moeda !== "BRL") throw new Error("moeda_saldo_invalida");
  if (entrada.metadadosCifrados.length > 2_000) throw new Error("metadados_saldo_invalido");
  validarTransicaoLancamentoSaldo(entrada);
  const payloadHash = hashJsonInterno({
    contaId: entrada.contaId,
    idempotenciaChave: entrada.idempotenciaChave,
    tipo: entrada.tipo,
    fase: entrada.fase,
    estado: entrada.estado,
    deltaDisponivelCentavos: entrada.deltaDisponivelCentavos,
    deltaContabilCentavos: entrada.deltaContabilCentavos,
    moeda: entrada.moeda,
    referenciaOrigem: entrada.referenciaOrigem,
    metadadosCifrados: entrada.metadadosCifrados
  });

  const cliente = await banco.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    const lancamentoResultado = await cliente.query<{ id: string }>(
      `
        INSERT INTO journal_financeiro_netcatbank (
          conta_id,
          idempotencia_chave,
          etapa,
          payload_hash
        )
        VALUES ($1, $2, 'recebido', $3)
        ON CONFLICT (idempotencia_chave, etapa) DO NOTHING
      `,
      [entrada.contaId, entrada.idempotenciaChave, payloadHash]
    );

    const contaResultado = await cliente.query<{ status: ContaBanco["status"] }>(
      "SELECT status FROM contas_netcatbank WHERE id = $1 AND apagado_em IS NULL FOR UPDATE",
      [entrada.contaId]
    );
    const conta = contaResultado.rows[0];
    if (!conta || conta.status !== "ativa") throw new Error("conta_saldo_indisponivel");

    const saldoAtual = await buscarSaldoContaComCliente(cliente, entrada.contaId, true);
    const lancamentoExistente = await cliente.query<LancamentoSaldoBanco>(
      `
        SELECT *
        FROM ledger_saldos_netcatbank
        WHERE conta_id = $1
          AND idempotencia_chave = $2
        LIMIT 1
      `,
      [entrada.contaId, entrada.idempotenciaChave]
    );

    if (lancamentoExistente.rows[0]) {
      const saldoIdempotente = saldoAtual ?? (await buscarSaldoContaComCliente(cliente, entrada.contaId));
      await cliente.query("COMMIT");
      return saldoIdempotente;
    }

    const lancamentoAnteriorResultado = await cliente.query<{ hash_encadeado: string }>(
      `
        SELECT hash_encadeado
        FROM ledger_saldos_netcatbank
        WHERE conta_id = $1
        ORDER BY versao_saldo DESC
        LIMIT 1
      `,
      [entrada.contaId]
    );
    const lancamentoAnterior = lancamentoAnteriorResultado.rows[0] ?? null;

    const saldoDisponivelAtual = saldoAtual
      ? normalizarInteiroFinanceiro(saldoAtual.saldo_disponivel_centavos)
      : 0;
    const saldoContabilAtual = saldoAtual
      ? normalizarInteiroFinanceiro(saldoAtual.saldo_contabil_centavos)
      : 0;
    const versaoAtual = saldoAtual ? normalizarInteiroFinanceiro(saldoAtual.versao) : 0;
    const novaVersao = lancamentoAnterior ? versaoAtual + 1 : 1;
    const novoSaldoDisponivel = saldoDisponivelAtual + entrada.deltaDisponivelCentavos;
    const novoSaldoContabil = saldoContabilAtual + entrada.deltaContabilCentavos;

    if (novoSaldoDisponivel < 0 || novoSaldoContabil < 0) throw new Error("saldo_insuficiente");

    const hashAnterior = lancamentoAnterior?.hash_encadeado ?? "GENESIS";
    const partidas = prepararPartidasDobradasSaldo({
      deltaDisponivelCentavos: entrada.deltaDisponivelCentavos,
      deltaContabilCentavos: entrada.deltaContabilCentavos
    });
    const partidasComHash = partidas.map((partida) => ({
      ...partida,
      hashPartida: entrada.assinarPartida({
        contaId: entrada.contaId,
        idempotenciaChave: entrada.idempotenciaChave,
        ordem: partida.ordem,
        contaContabil: partida.contaContabil,
        natureza: partida.natureza,
        valorCentavos: partida.valorCentavos,
        moeda: entrada.moeda
      })
    }));
    const merkleRaiz = entrada.calcularMerkleRaiz(partidasComHash.map((partida) => partida.hashPartida));
    const hashEncadeado = entrada.assinarLancamento({
      contaId: entrada.contaId,
      idempotenciaChave: entrada.idempotenciaChave,
      tipo: entrada.tipo,
      fase: entrada.fase,
      estado: entrada.estado,
      deltaDisponivelCentavos: entrada.deltaDisponivelCentavos,
      deltaContabilCentavos: entrada.deltaContabilCentavos,
      moeda: entrada.moeda,
      versaoSaldo: novaVersao,
      hashAnterior,
      merkleRaiz,
      referenciaOrigem: entrada.referenciaOrigem,
      metadadosCifrados: entrada.metadadosCifrados
    });

    const integridadeHash = entrada.assinarSaldo({
      contaId: entrada.contaId,
      saldoDisponivelCentavos: novoSaldoDisponivel,
      saldoTotalCentavos: novoSaldoContabil,
      saldoContabilCentavos: novoSaldoContabil,
      moeda: entrada.moeda,
      versao: novaVersao
    });

    const lancamentoId = randomUUID();
    await cliente.query(
      `
        INSERT INTO ledger_saldos_netcatbank (
          id,
          conta_id,
          idempotencia_chave,
          tipo,
          fase,
          estado,
          delta_disponivel_centavos,
          delta_contabil_centavos,
          moeda,
          versao_saldo,
          referencia_origem,
          metadados_cifrados,
          hash_anterior,
          merkle_raiz,
          hash_encadeado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `,
      [
        lancamentoId,
        entrada.contaId,
        entrada.idempotenciaChave,
        entrada.tipo,
        entrada.fase,
        entrada.estado,
        entrada.deltaDisponivelCentavos,
        entrada.deltaContabilCentavos,
        entrada.moeda,
        novaVersao,
        entrada.referenciaOrigem,
        entrada.metadadosCifrados,
        hashAnterior,
        merkleRaiz,
        hashEncadeado
      ]
    );

    for (const partida of partidasComHash) {
      await cliente.query(
        `
          INSERT INTO partidas_dobradas_saldo_netcatbank (
            lancamento_id,
            conta_id,
            ordem,
            conta_contabil,
            natureza,
            valor_centavos,
            moeda,
            hash_partida
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          lancamentoId,
          entrada.contaId,
          partida.ordem,
          partida.contaContabil,
          partida.natureza,
          partida.valorCentavos,
          entrada.moeda,
          partida.hashPartida
        ]
      );
    }

    await cliente.query(
      `
        INSERT INTO journal_financeiro_netcatbank (
          conta_id,
          idempotencia_chave,
          etapa,
          payload_hash,
          resultado_hash
        )
        VALUES ($1, $2, 'validado', $3, $4)
        ON CONFLICT (idempotencia_chave, etapa) DO NOTHING
      `,
      [entrada.contaId, entrada.idempotenciaChave, payloadHash, merkleRaiz]
    );

    const saldoResultado = saldoAtual
      ? await cliente.query<SaldoContaBanco>(
          `
            UPDATE saldos_conta_netcatbank
            SET saldo_disponivel_centavos = $2,
                saldo_total_centavos = $3,
                saldo_contabil_centavos = $4,
                moeda = $5,
                versao = $6,
                integridade_hash = $7,
                atualizado_em = now()
            WHERE conta_id = $1
              AND versao = $8
            RETURNING *
          `,
          [
            entrada.contaId,
            novoSaldoDisponivel,
            novoSaldoContabil,
            novoSaldoContabil,
            entrada.moeda,
            novaVersao,
            integridadeHash,
            versaoAtual
          ]
        )
      : await cliente.query<SaldoContaBanco>(
          `
            INSERT INTO saldos_conta_netcatbank (
              conta_id,
              saldo_disponivel_centavos,
              saldo_total_centavos,
              saldo_contabil_centavos,
              moeda,
              versao,
              integridade_hash
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (conta_id) DO NOTHING
            RETURNING *
          `,
          [
            entrada.contaId,
            novoSaldoDisponivel,
            novoSaldoContabil,
            novoSaldoContabil,
            entrada.moeda,
            novaVersao,
            integridadeHash
          ]
        );

    const saldoProjetado = saldoResultado.rows[0] ?? null;
    if (!saldoProjetado) throw new Error("saldo_projecao_concorrente");

    await cliente.query(
      `
        INSERT INTO journal_financeiro_netcatbank (
          conta_id,
          idempotencia_chave,
          etapa,
          payload_hash,
          resultado_hash
        )
        VALUES ($1, $2, 'gravado', $3, $4)
        ON CONFLICT (idempotencia_chave, etapa) DO NOTHING
      `,
      [entrada.contaId, entrada.idempotenciaChave, payloadHash, hashEncadeado]
    );

    await cliente.query("COMMIT");
    return saldoProjetado;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    await banco
      .query(
        `
          INSERT INTO journal_financeiro_netcatbank (
            conta_id,
            idempotencia_chave,
            etapa,
            payload_hash
          )
          VALUES ($1, $2, 'rejeitado', $3)
          ON CONFLICT (idempotencia_chave, etapa) DO NOTHING
        `,
        [entrada.contaId, entrada.idempotenciaChave, payloadHash]
      )
      .catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

const aplicarLancamentoLedgerSaldoComCliente = async (
  cliente: PoolClient,
  entrada: {
    contaId: string;
    idempotenciaChave: string;
    tipo: TipoLancamentoSaldo;
    fase: FaseLancamentoSaldo;
    estado: EstadoLancamentoSaldo;
    deltaDisponivelCentavos: number;
    deltaContabilCentavos: number;
    moeda: "BRL";
    referenciaOrigem: string;
    metadadosCifrados: string;
    assinarLancamento: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarLancamento"];
    assinarPartida: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarPartida"];
    calcularMerkleRaiz: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["calcularMerkleRaiz"];
    assinarSaldo: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarSaldo"];
  }
) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_saldo_invalida");
  validarTextoInterno(entrada.idempotenciaChave, /^[a-z0-9:_-]{8,120}$/, "idempotencia_saldo_invalida");
  validarTextoInterno(entrada.referenciaOrigem, /^[a-zA-Z0-9:._-]{8,140}$/, "referencia_saldo_invalida");
  if (entrada.moeda !== "BRL") throw new Error("moeda_saldo_invalida");
  if (entrada.metadadosCifrados.length > 2_000) throw new Error("metadados_saldo_invalido");
  validarTransicaoLancamentoSaldo(entrada);

  const payloadHash = hashJsonInterno({
    contaId: entrada.contaId,
    deltaContabilCentavos: entrada.deltaContabilCentavos,
    deltaDisponivelCentavos: entrada.deltaDisponivelCentavos,
    estado: entrada.estado,
    fase: entrada.fase,
    idempotenciaChave: entrada.idempotenciaChave,
    metadadosCifrados: entrada.metadadosCifrados,
    moeda: entrada.moeda,
    referenciaOrigem: entrada.referenciaOrigem,
    tipo: entrada.tipo
  });

  await cliente.query(
    `
      INSERT INTO journal_financeiro_netcatbank (
        conta_id,
        idempotencia_chave,
        etapa,
        payload_hash
      )
      VALUES ($1, $2, 'recebido', $3)
      ON CONFLICT (idempotencia_chave, etapa) DO NOTHING
    `,
    [entrada.contaId, entrada.idempotenciaChave, payloadHash]
  );

  const contaResultado = await cliente.query<{ status: ContaBanco["status"] }>(
    "SELECT status FROM contas_netcatbank WHERE id = $1 AND apagado_em IS NULL FOR UPDATE",
    [entrada.contaId]
  );
  const conta = contaResultado.rows[0];
  if (!conta || conta.status !== "ativa") throw new Error("conta_saldo_indisponivel");

  const saldoAtual = await buscarSaldoContaComCliente(cliente, entrada.contaId, true);
  const lancamentoExistente = await cliente.query<LancamentoSaldoBanco>(
    `
      SELECT *
      FROM ledger_saldos_netcatbank
      WHERE conta_id = $1
        AND idempotencia_chave = $2
      LIMIT 1
    `,
    [entrada.contaId, entrada.idempotenciaChave]
  );
  const existente = lancamentoExistente.rows[0] ?? null;
  if (existente) {
    const saldoIdempotente = saldoAtual ?? (await buscarSaldoContaComCliente(cliente, entrada.contaId));
    if (!saldoIdempotente) throw new Error("saldo_projecao_indisponivel");
    return {
      lancamentoId: existente.id,
      saldo: saldoIdempotente
    };
  }

  const lancamentoAnteriorResultado = await cliente.query<{ hash_encadeado: string }>(
    `
      SELECT hash_encadeado
      FROM ledger_saldos_netcatbank
      WHERE conta_id = $1
      ORDER BY versao_saldo DESC
      LIMIT 1
    `,
    [entrada.contaId]
  );
  const lancamentoAnterior = lancamentoAnteriorResultado.rows[0] ?? null;
  const saldoDisponivelAtual = saldoAtual
    ? normalizarInteiroFinanceiro(saldoAtual.saldo_disponivel_centavos)
    : 0;
  const saldoContabilAtual = saldoAtual
    ? normalizarInteiroFinanceiro(saldoAtual.saldo_contabil_centavos)
    : 0;
  const versaoAtual = saldoAtual ? normalizarInteiroFinanceiro(saldoAtual.versao) : 0;
  const novaVersao = lancamentoAnterior ? versaoAtual + 1 : 1;
  const novoSaldoDisponivel = saldoDisponivelAtual + entrada.deltaDisponivelCentavos;
  const novoSaldoContabil = saldoContabilAtual + entrada.deltaContabilCentavos;

  if (novoSaldoDisponivel < 0 || novoSaldoContabil < 0) throw new Error("saldo_insuficiente");

  const partidas = prepararPartidasDobradasSaldo({
    deltaContabilCentavos: entrada.deltaContabilCentavos,
    deltaDisponivelCentavos: entrada.deltaDisponivelCentavos
  });
  const partidasComHash = partidas.map((partida) => ({
    ...partida,
    hashPartida: entrada.assinarPartida({
      contaContabil: partida.contaContabil,
      contaId: entrada.contaId,
      idempotenciaChave: entrada.idempotenciaChave,
      moeda: entrada.moeda,
      natureza: partida.natureza,
      ordem: partida.ordem,
      valorCentavos: partida.valorCentavos
    })
  }));
  const merkleRaiz = entrada.calcularMerkleRaiz(partidasComHash.map((partida) => partida.hashPartida));
  const hashAnterior = lancamentoAnterior?.hash_encadeado ?? "GENESIS";
  const hashEncadeado = entrada.assinarLancamento({
    contaId: entrada.contaId,
    deltaContabilCentavos: entrada.deltaContabilCentavos,
    deltaDisponivelCentavos: entrada.deltaDisponivelCentavos,
    estado: entrada.estado,
    fase: entrada.fase,
    hashAnterior,
    idempotenciaChave: entrada.idempotenciaChave,
    merkleRaiz,
    metadadosCifrados: entrada.metadadosCifrados,
    moeda: entrada.moeda,
    referenciaOrigem: entrada.referenciaOrigem,
    tipo: entrada.tipo,
    versaoSaldo: novaVersao
  });
  const integridadeHash = entrada.assinarSaldo({
    contaId: entrada.contaId,
    moeda: entrada.moeda,
    saldoContabilCentavos: novoSaldoContabil,
    saldoDisponivelCentavos: novoSaldoDisponivel,
    saldoTotalCentavos: novoSaldoContabil,
    versao: novaVersao
  });
  const lancamentoId = randomUUID();

  await cliente.query(
    `
      INSERT INTO ledger_saldos_netcatbank (
        id,
        conta_id,
        idempotencia_chave,
        tipo,
        fase,
        estado,
        delta_disponivel_centavos,
        delta_contabil_centavos,
        moeda,
        versao_saldo,
        referencia_origem,
        metadados_cifrados,
        hash_anterior,
        merkle_raiz,
        hash_encadeado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `,
    [
      lancamentoId,
      entrada.contaId,
      entrada.idempotenciaChave,
      entrada.tipo,
      entrada.fase,
      entrada.estado,
      entrada.deltaDisponivelCentavos,
      entrada.deltaContabilCentavos,
      entrada.moeda,
      novaVersao,
      entrada.referenciaOrigem,
      entrada.metadadosCifrados,
      hashAnterior,
      merkleRaiz,
      hashEncadeado
    ]
  );

  for (const partida of partidasComHash) {
    await cliente.query(
      `
        INSERT INTO partidas_dobradas_saldo_netcatbank (
          lancamento_id,
          conta_id,
          ordem,
          conta_contabil,
          natureza,
          valor_centavos,
          moeda,
          hash_partida
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        lancamentoId,
        entrada.contaId,
        partida.ordem,
        partida.contaContabil,
        partida.natureza,
        partida.valorCentavos,
        entrada.moeda,
        partida.hashPartida
      ]
    );
  }

  await cliente.query(
    `
      INSERT INTO journal_financeiro_netcatbank (
        conta_id,
        idempotencia_chave,
        etapa,
        payload_hash,
        resultado_hash
      )
      VALUES ($1, $2, 'validado', $3, $4)
      ON CONFLICT (idempotencia_chave, etapa) DO NOTHING
    `,
    [entrada.contaId, entrada.idempotenciaChave, payloadHash, merkleRaiz]
  );

  const saldoResultado = saldoAtual
    ? await cliente.query<SaldoContaBanco>(
        `
          UPDATE saldos_conta_netcatbank
          SET saldo_disponivel_centavos = $2,
              saldo_total_centavos = $3,
              saldo_contabil_centavos = $4,
              moeda = $5,
              versao = $6,
              integridade_hash = $7,
              atualizado_em = now()
          WHERE conta_id = $1
            AND versao = $8
          RETURNING *
        `,
        [
          entrada.contaId,
          novoSaldoDisponivel,
          novoSaldoContabil,
          novoSaldoContabil,
          entrada.moeda,
          novaVersao,
          integridadeHash,
          versaoAtual
        ]
      )
    : await cliente.query<SaldoContaBanco>(
        `
          INSERT INTO saldos_conta_netcatbank (
            conta_id,
            saldo_disponivel_centavos,
            saldo_total_centavos,
            saldo_contabil_centavos,
            moeda,
            versao,
            integridade_hash
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (conta_id) DO NOTHING
          RETURNING *
        `,
        [
          entrada.contaId,
          novoSaldoDisponivel,
          novoSaldoContabil,
          novoSaldoContabil,
          entrada.moeda,
          novaVersao,
          integridadeHash
        ]
      );

  const saldoProjetado = saldoResultado.rows[0] ?? null;
  if (!saldoProjetado) throw new Error("saldo_projecao_concorrente");

  await cliente.query(
    `
      INSERT INTO journal_financeiro_netcatbank (
        conta_id,
        idempotencia_chave,
        etapa,
        payload_hash,
        resultado_hash
      )
      VALUES ($1, $2, 'gravado', $3, $4)
      ON CONFLICT (idempotencia_chave, etapa) DO NOTHING
    `,
    [entrada.contaId, entrada.idempotenciaChave, payloadHash, hashEncadeado]
  );

  return {
    lancamentoId,
    saldo: saldoProjetado
  };
};

export const prepararTransferenciaNex = async (entrada: {
  chaveDestinoIndiceHmac: string;
  contaOrigemId: string;
  contextoHash: string | null;
  descricao: string;
  idempotenciaChave: string;
  referenciaPublica: string;
  valorCentavos: number;
}) => {
  validarTextoInterno(entrada.contaOrigemId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(entrada.chaveDestinoIndiceHmac, /^[a-f0-9]{64}$/i, "chave_destino_nex_invalida");
  validarTextoInterno(entrada.idempotenciaChave, /^[a-zA-Z0-9:_-]{8,120}$/, "idempotencia_nex_invalida");
  validarTextoInterno(entrada.referenciaPublica, /^NX-[A-Z0-9]{16,32}$/, "referencia_nex_invalida");
  if (!Number.isSafeInteger(entrada.valorCentavos) || entrada.valorCentavos <= 0 || entrada.valorCentavos > 100_000_000) {
    throw new Error("valor_nex_invalido");
  }
  const descricao = entrada.descricao.trim().replace(/\s{2,}/g, " ").slice(0, 120) || "Transferência Nex";
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaOrigemId]);

    const idempotente = await cliente.query<TransferenciaNexBanco>(
      `
        SELECT *
        FROM transferencias_nex_netcatbank
        WHERE conta_origem_id = $1
          AND idempotencia_preparo = $2
        LIMIT 1
      `,
      [entrada.contaOrigemId, entrada.idempotenciaChave]
    );
    if (idempotente.rows[0]) {
      await cliente.query("COMMIT");
      return idempotente.rows[0];
    }

    const origem = await cliente.query<{ id: string; status: ContaBanco["status"] }>(
      "SELECT id, status FROM contas_netcatbank WHERE id = $1 AND apagado_em IS NULL FOR UPDATE",
      [entrada.contaOrigemId]
    );
    if (origem.rows[0]?.status !== "ativa") throw new Error("transferencia_nex_indisponivel");

    const chaveOrigem = await cliente.query<{ id: string }>(
      `
        SELECT id
        FROM chaves_nex_netcatbank
        WHERE conta_id = $1
          AND estado = 'ativa'
        ORDER BY criada_em ASC
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.contaOrigemId]
    );
    if (!chaveOrigem.rows[0]) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaOrigemId,
        contextoHash: entrada.contextoHash,
        evento: "transferencia_recusada",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: {
          motivo: "origem_sem_chave",
          valorCentavos: entrada.valorCentavos
        }
      });
      throw new Error("transferencia_nex_origem_sem_chave");
    }

    const chaveDestino = await cliente.query<ChaveNexBanco>(
      `
        SELECT *
        FROM chaves_nex_netcatbank
        WHERE valor_indice_hmac = $1
          AND estado = 'ativa'
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.chaveDestinoIndiceHmac]
    );
    const destino = chaveDestino.rows[0] ?? null;
    if (!destino || destino.conta_id === entrada.contaOrigemId) {
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaOrigemId,
        contextoHash: entrada.contextoHash,
        evento: "transferencia_recusada",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: {
          motivo: "destino_indisponivel",
          valorCentavos: entrada.valorCentavos
        }
      });
      throw new Error("transferencia_nex_indisponivel");
    }

    const transferencia = await cliente.query<TransferenciaNexBanco>(
      `
        INSERT INTO transferencias_nex_netcatbank (
          referencia_publica,
          conta_origem_id,
          conta_destino_id,
          chave_destino_indice_hmac,
          valor_centavos,
          descricao,
          estado,
          idempotencia_preparo,
          expira_em
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'preparada', $7, now() + interval '5 minutes')
        RETURNING *
      `,
      [
        entrada.referenciaPublica,
        entrada.contaOrigemId,
        destino.conta_id,
        entrada.chaveDestinoIndiceHmac,
        entrada.valorCentavos,
        descricao,
        entrada.idempotenciaChave
      ]
    );
    const criada = transferencia.rows[0];
    if (!criada) throw new Error("transferencia_nex_indisponivel");

    await registrarAuditoriaChaveNexComCliente(cliente, {
      chaveId: destino.id,
      contaId: entrada.contaOrigemId,
      contextoHash: entrada.contextoHash,
      evento: "transferencia_preparada",
      idempotenciaChave: entrada.idempotenciaChave,
      payload: {
        destino: destino.conta_id,
        referencia: criada.referencia_publica,
        valorCentavos: entrada.valorCentavos
      }
    });
    await cliente.query("COMMIT");
    return criada;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const confirmarTransferenciaNex = async (entrada: {
  assinarLancamento: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarLancamento"];
  assinarPartida: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarPartida"];
  assinarSaldo: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarSaldo"];
  calcularMerkleRaiz: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["calcularMerkleRaiz"];
  contaOrigemId: string;
  contextoHash: string | null;
  idempotenciaChave: string;
  nomeDestino: string;
  nomeOrigem: string;
  transferenciaId: string;
}): Promise<TransferenciaNexComMovimentoBanco> => {
  validarTextoInterno(entrada.contaOrigemId, /^[0-9a-f-]{36}$/i, "conta_nex_invalida");
  validarTextoInterno(entrada.transferenciaId, /^[0-9a-f-]{36}$/i, "transferencia_nex_invalida");
  validarTextoInterno(entrada.idempotenciaChave, /^[a-zA-Z0-9:_-]{8,120}$/, "idempotencia_nex_invalida");
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaOrigemId]);

    const transferenciaResultado = await cliente.query<TransferenciaNexBanco>(
      `
        SELECT *
        FROM transferencias_nex_netcatbank
        WHERE id = $1
          AND conta_origem_id = $2
        LIMIT 1
        FOR UPDATE
      `,
      [entrada.transferenciaId, entrada.contaOrigemId]
    );
    const transferencia = transferenciaResultado.rows[0] ?? null;
    if (!transferencia) throw new Error("transferencia_nex_indisponivel");

    if (transferencia.estado === "liquidada") {
      if (transferencia.idempotencia_confirmacao && transferencia.idempotencia_confirmacao !== entrada.idempotenciaChave) {
        throw new Error("transferencia_nex_ja_liquidada");
      }
      const movimento = transferencia.ledger_origem_liquidacao_id
        ? await cliente.query<{ id: string }>(
            `
              SELECT id
              FROM movimentos_financeiros_netcatbank
              WHERE conta_id = $1
                AND ledger_id = $2
                AND tipo = 'nex'
                AND direcao = 'saida'
              LIMIT 1
            `,
            [transferencia.conta_origem_id, transferencia.ledger_origem_liquidacao_id]
          )
        : null;
      await cliente.query("COMMIT");
      return {
        ...transferencia,
        movimento_origem_id: movimento?.rows[0]?.id ?? null
      };
    }

    if (transferencia.estado !== "preparada" || transferencia.expira_em.getTime() <= Date.now()) {
      await cliente.query(
        `
          UPDATE transferencias_nex_netcatbank
          SET estado = CASE WHEN estado = 'preparada' THEN 'falha' ELSE estado END,
              atualizado_em = now()
          WHERE id = $1
        `,
        [transferencia.id]
      );
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaOrigemId,
        contextoHash: entrada.contextoHash,
        evento: "transferencia_recusada",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: {
          estado: transferencia.estado,
          referencia: transferencia.referencia_publica
        }
      });
      throw new Error("transferencia_nex_indisponivel");
    }

    const contasOrdenadas = [transferencia.conta_origem_id, transferencia.conta_destino_id].sort();
    const contas = await cliente.query<{ id: string; status: ContaBanco["status"] }>(
      `
        SELECT id, status
        FROM contas_netcatbank
        WHERE id = ANY($1::uuid[])
          AND apagado_em IS NULL
        ORDER BY id ASC
        FOR UPDATE
      `,
      [contasOrdenadas]
    );
    if (contas.rows.length !== 2 || contas.rows.some((conta) => conta.status !== "ativa")) {
      throw new Error("transferencia_nex_indisponivel");
    }

    const chavesAtivas = await cliente.query<{ conta_id: string; id: string }>(
      `
        SELECT conta_id, id
        FROM chaves_nex_netcatbank
        WHERE estado = 'ativa'
          AND (
            conta_id = $1
            OR (
              conta_id = $2
              AND valor_indice_hmac = $3
            )
          )
        ORDER BY conta_id ASC, id ASC
        FOR UPDATE
      `,
      [
        transferencia.conta_origem_id,
        transferencia.conta_destino_id,
        transferencia.chave_destino_indice_hmac
      ]
    );
    const origemComChaveAtiva = chavesAtivas.rows.some(
      (chave) => chave.conta_id === transferencia.conta_origem_id
    );
    const destinoComChavePreparadaAtiva = chavesAtivas.rows.some(
      (chave) => chave.conta_id === transferencia.conta_destino_id
    );
    if (!origemComChaveAtiva || !destinoComChavePreparadaAtiva) {
      await cliente.query(
        `
          UPDATE transferencias_nex_netcatbank
          SET estado = 'falha',
              atualizado_em = now()
          WHERE id = $1
            AND estado = 'preparada'
        `,
        [transferencia.id]
      );
      await registrarAuditoriaChaveNexComCliente(cliente, {
        contaId: entrada.contaOrigemId,
        contextoHash: entrada.contextoHash,
        evento: "transferencia_recusada",
        idempotenciaChave: entrada.idempotenciaChave,
        payload: {
          motivo: origemComChaveAtiva ? "destino_chave_inativa" : "origem_sem_chave_ativa",
          referencia: transferencia.referencia_publica
        }
      });
      throw new Error("transferencia_nex_indisponivel");
    }

    await cliente.query(
      `
        UPDATE transferencias_nex_netcatbank
        SET estado = 'confirmada',
            idempotencia_confirmacao = $2,
            atualizado_em = now()
        WHERE id = $1
          AND estado = 'preparada'
      `,
      [transferencia.id, entrada.idempotenciaChave]
    );

    const valorCentavos = normalizarInteiroFinanceiro(transferencia.valor_centavos);
    const metadados = hashJsonInterno({
      referencia: transferencia.referencia_publica,
      transferenciaId: transferencia.id
    });
    const metadadosCifrados = metadados;
    const descricaoDestino = entrada.idempotenciaChave.startsWith("nex_agenda:")
      ? "Transferência Nex recebida"
      : transferencia.descricao;
    const parametrosAssinatura = {
      assinarLancamento: entrada.assinarLancamento,
      assinarPartida: entrada.assinarPartida,
      assinarSaldo: entrada.assinarSaldo,
      calcularMerkleRaiz: entrada.calcularMerkleRaiz
    };

    const origemReserva = await aplicarLancamentoLedgerSaldoComCliente(cliente, {
      ...parametrosAssinatura,
      contaId: transferencia.conta_origem_id,
      deltaContabilCentavos: 0,
      deltaDisponivelCentavos: -valorCentavos,
      estado: "registrado",
      fase: "autorizacao",
      idempotenciaChave: `nex:${transferencia.id}:origem-reserva`,
      metadadosCifrados,
      moeda: "BRL",
      referenciaOrigem: `nex:${transferencia.referencia_publica.toLowerCase()}:reserva`,
      tipo: "debito_reservado"
    });
    const origemLiquidacao = await aplicarLancamentoLedgerSaldoComCliente(cliente, {
      ...parametrosAssinatura,
      contaId: transferencia.conta_origem_id,
      deltaContabilCentavos: -valorCentavos,
      deltaDisponivelCentavos: 0,
      estado: "liquidado",
      fase: "liquidacao",
      idempotenciaChave: `nex:${transferencia.id}:origem-liquidacao`,
      metadadosCifrados,
      moeda: "BRL",
      referenciaOrigem: `nex:${transferencia.referencia_publica.toLowerCase()}:debito`,
      tipo: "debito_liquidado"
    });
    const destinoLiquidacao = await aplicarLancamentoLedgerSaldoComCliente(cliente, {
      ...parametrosAssinatura,
      contaId: transferencia.conta_destino_id,
      deltaContabilCentavos: valorCentavos,
      deltaDisponivelCentavos: valorCentavos,
      estado: "liquidado",
      fase: "liquidacao",
      idempotenciaChave: `nex:${transferencia.id}:destino-liquidacao`,
      metadadosCifrados,
      moeda: "BRL",
      referenciaOrigem: `nex:${transferencia.referencia_publica.toLowerCase()}:credito`,
      tipo: "credito_liquidado"
    });

    const movimentos = await cliente.query<{ conta_id: string; id: string }>(
      `
        INSERT INTO movimentos_financeiros_netcatbank (
          conta_id,
          ledger_id,
          direcao,
          tipo,
          categoria,
          descricao,
          contraparte,
          valor_centavos,
          moeda,
          efetivado_em,
          status
        )
        VALUES
          ($1, $2, 'saida', 'nex', 'geral', $3, $4, $5, 'BRL', now(), 'liquidado'),
          ($6, $7, 'entrada', 'nex', 'geral', $9, $8, $5, 'BRL', now(), 'liquidado')
        ON CONFLICT (ledger_id) DO NOTHING
        RETURNING id, conta_id
      `,
      [
        transferencia.conta_origem_id,
        origemLiquidacao.lancamentoId,
        transferencia.descricao,
        entrada.nomeDestino.slice(0, 120) || "Cliente NC Bank",
        valorCentavos,
        transferencia.conta_destino_id,
        destinoLiquidacao.lancamentoId,
        entrada.nomeOrigem.slice(0, 120) || "Cliente NC Bank",
        descricaoDestino
      ]
    );
    let movimentoOrigemId =
      movimentos.rows.find((movimento) => movimento.conta_id === transferencia.conta_origem_id)?.id ?? null;

    if (!movimentoOrigemId) {
      const movimentoExistente = await cliente.query<{ id: string }>(
        `
          SELECT id
          FROM movimentos_financeiros_netcatbank
          WHERE conta_id = $1
            AND ledger_id = $2
            AND tipo = 'nex'
            AND direcao = 'saida'
          LIMIT 1
        `,
        [transferencia.conta_origem_id, origemLiquidacao.lancamentoId]
      );
      movimentoOrigemId = movimentoExistente.rows[0]?.id ?? null;
    }

    const atualizada = await cliente.query<TransferenciaNexBanco>(
      `
        UPDATE transferencias_nex_netcatbank
        SET estado = 'liquidada',
            ledger_origem_reserva_id = $2,
            ledger_origem_liquidacao_id = $3,
            ledger_destino_liquidacao_id = $4,
            atualizado_em = now(),
            liquidado_em = now()
        WHERE id = $1
        RETURNING *
      `,
      [
        transferencia.id,
        origemReserva.lancamentoId,
        origemLiquidacao.lancamentoId,
        destinoLiquidacao.lancamentoId
      ]
    );
    const liquidada = atualizada.rows[0];
    if (!liquidada) throw new Error("transferencia_nex_indisponivel");

    await registrarAuditoriaChaveNexComCliente(cliente, {
      contaId: entrada.contaOrigemId,
      contextoHash: entrada.contextoHash,
      evento: "transferencia_liquidada",
      idempotenciaChave: entrada.idempotenciaChave,
      payload: {
        destino: transferencia.conta_destino_id,
        referencia: transferencia.referencia_publica,
        valorCentavos
      }
    });
    await cliente.query("COMMIT");
    return {
      ...liquidada,
      movimento_origem_id: movimentoOrigemId
    };
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const liquidarDoacaoInstitutoMurzoConta = async (entrada: {
  assinarLancamento: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarLancamento"];
  assinarPartida: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarPartida"];
  assinarSaldo: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarSaldo"];
  calcularMerkleRaiz: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["calcularMerkleRaiz"];
  contaId: string;
  contraparte: string;
  descricao: string;
  idempotenciaBase: string;
  metadadosCifrados: string;
  referenciaPublica: string;
  valorCentavos: number;
}) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_doacao_invalida");
  validarTextoInterno(entrada.idempotenciaBase, /^[a-zA-Z0-9:_-]{8,100}$/, "idempotencia_doacao_invalida");
  validarTextoInterno(entrada.referenciaPublica, /^DM-[A-F0-9]{32}$/, "referencia_doacao_invalida");
  if (!Number.isSafeInteger(entrada.valorCentavos) || entrada.valorCentavos <= 0 || entrada.valorCentavos > 100_000_000) {
    throw new Error("valor_doacao_invalido");
  }

  const idempotenciaReserva = `${entrada.idempotenciaBase}:reserva`;
  const idempotenciaLiquidacao = `${entrada.idempotenciaBase}:liquidacao`;
  const descricao = entrada.descricao.trim().replace(/\s{2,}/g, " ").slice(0, 120) || "Doação Instituto Murzo";
  const contraparte = entrada.contraparte.trim().replace(/\s{2,}/g, " ").slice(0, 120) || "Instituto Murzo";
  const referencia = entrada.referenciaPublica.toLowerCase();
  const parametrosAssinatura = {
    assinarLancamento: entrada.assinarLancamento,
    assinarPartida: entrada.assinarPartida,
    assinarSaldo: entrada.assinarSaldo,
    calcularMerkleRaiz: entrada.calcularMerkleRaiz
  };
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaId]);

    await aplicarLancamentoLedgerSaldoComCliente(cliente, {
      ...parametrosAssinatura,
      contaId: entrada.contaId,
      deltaContabilCentavos: 0,
      deltaDisponivelCentavos: -entrada.valorCentavos,
      estado: "registrado",
      fase: "autorizacao",
      idempotenciaChave: idempotenciaReserva,
      metadadosCifrados: entrada.metadadosCifrados,
      moeda: "BRL",
      referenciaOrigem: `doacao:murzo:${referencia}:reserva`,
      tipo: "debito_reservado"
    });

    const liquidacao = await aplicarLancamentoLedgerSaldoComCliente(cliente, {
      ...parametrosAssinatura,
      contaId: entrada.contaId,
      deltaContabilCentavos: -entrada.valorCentavos,
      deltaDisponivelCentavos: 0,
      estado: "liquidado",
      fase: "liquidacao",
      idempotenciaChave: idempotenciaLiquidacao,
      metadadosCifrados: entrada.metadadosCifrados,
      moeda: "BRL",
      referenciaOrigem: `doacao:murzo:${referencia}:liquidacao`,
      tipo: "debito_liquidado"
    });

    let movimento = (
      await cliente.query<MovimentoFinanceiroBanco>(
        `
          INSERT INTO movimentos_financeiros_netcatbank (
            conta_id,
            ledger_id,
            direcao,
            tipo,
            categoria,
            descricao,
            contraparte,
            valor_centavos,
            moeda,
            efetivado_em,
            status
          )
          VALUES ($1, $2, 'saida', 'doacao', 'doacoes', $3, $4, $5, 'BRL', now(), 'liquidado')
          ON CONFLICT (ledger_id) DO NOTHING
          RETURNING *
        `,
        [
          entrada.contaId,
          liquidacao.lancamentoId,
          descricao,
          contraparte,
          entrada.valorCentavos
        ]
      )
    ).rows[0] ?? null;

    if (!movimento) {
      movimento = (
        await cliente.query<MovimentoFinanceiroBanco>(
          `
            SELECT *
            FROM movimentos_financeiros_netcatbank
            WHERE conta_id = $1
              AND ledger_id = $2
            LIMIT 1
          `,
          [entrada.contaId, liquidacao.lancamentoId]
        )
      ).rows[0] ?? null;
    }

    if (!movimento) throw new Error("movimento_doacao_indisponivel");
    await cliente.query("COMMIT");
    return movimento;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const liquidarPagamentoBoletoConta = async (entrada: {
  assinarLancamento: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarLancamento"];
  assinarPartida: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarPartida"];
  assinarSaldo: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarSaldo"];
  bancoCodigo: string;
  bancoNome: string;
  calcularMerkleRaiz: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["calcularMerkleRaiz"];
  codigoBarrasHash: string;
  contaId: string;
  contraparte: string;
  descricao: string;
  idempotenciaBase: string;
  metadadosCifrados: string;
  referenciaPublica: string;
  valorCentavos: number;
}) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_pagamento_invalida");
  validarTextoInterno(entrada.bancoCodigo, /^\d{3}$/, "banco_pagamento_invalido");
  validarTextoInterno(entrada.codigoBarrasHash, /^[a-f0-9]{64}$/, "hash_boleto_invalido");
  validarTextoInterno(entrada.idempotenciaBase, /^[a-z0-9:_-]{8,100}$/, "idempotencia_pagamento_invalida");
  validarTextoInterno(entrada.referenciaPublica, /^PB-[A-F0-9]{32}$/, "referencia_pagamento_invalida");
  if (entrada.bancoNome.trim().length < 2 || entrada.bancoNome.trim().length > 80) {
    throw new Error("banco_pagamento_invalido");
  }
  if (!Number.isSafeInteger(entrada.valorCentavos) || entrada.valorCentavos <= 0 || entrada.valorCentavos > 100_000_000) {
    throw new Error("valor_pagamento_invalido");
  }

  const idempotenciaReserva = `${entrada.idempotenciaBase}:reserva`;
  const idempotenciaLiquidacao = `${entrada.idempotenciaBase}:liquidacao`;
  const descricao = entrada.descricao.trim().replace(/\s{2,}/g, " ").slice(0, 120) || "Pagamento de boleto";
  const contraparte = entrada.contraparte.trim().replace(/\s{2,}/g, " ").slice(0, 120) || "Boleto bancário";
  const referencia = entrada.referenciaPublica.toLowerCase();
  const parametrosAssinatura = {
    assinarLancamento: entrada.assinarLancamento,
    assinarPartida: entrada.assinarPartida,
    assinarSaldo: entrada.assinarSaldo,
    calcularMerkleRaiz: entrada.calcularMerkleRaiz
  };
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaId]);

    const boletoExistente = await cliente.query<Pick<PagamentoBoletoLiquidadoBanco, "codigo_barras_hash">>(
      `
        SELECT codigo_barras_hash
        FROM pagamentos_boletos_liquidados_netcatbank
        WHERE codigo_barras_hash = $1
        LIMIT 1
      `,
      [entrada.codigoBarrasHash]
    );
    if (boletoExistente.rows[0]) throw new Error("boleto_ja_pago");

    await aplicarLancamentoLedgerSaldoComCliente(cliente, {
      ...parametrosAssinatura,
      contaId: entrada.contaId,
      deltaContabilCentavos: 0,
      deltaDisponivelCentavos: -entrada.valorCentavos,
      estado: "registrado",
      fase: "autorizacao",
      idempotenciaChave: idempotenciaReserva,
      metadadosCifrados: entrada.metadadosCifrados,
      moeda: "BRL",
      referenciaOrigem: `pagamento:boleto:${referencia}:reserva`,
      tipo: "debito_reservado"
    });

    const liquidacao = await aplicarLancamentoLedgerSaldoComCliente(cliente, {
      ...parametrosAssinatura,
      contaId: entrada.contaId,
      deltaContabilCentavos: -entrada.valorCentavos,
      deltaDisponivelCentavos: 0,
      estado: "liquidado",
      fase: "liquidacao",
      idempotenciaChave: idempotenciaLiquidacao,
      metadadosCifrados: entrada.metadadosCifrados,
      moeda: "BRL",
      referenciaOrigem: `pagamento:boleto:${referencia}:liquidacao`,
      tipo: "debito_liquidado"
    });

    let movimento = (
      await cliente.query<MovimentoFinanceiroBanco>(
        `
          INSERT INTO movimentos_financeiros_netcatbank (
            conta_id,
            ledger_id,
            direcao,
            tipo,
            categoria,
            descricao,
            contraparte,
            valor_centavos,
            moeda,
            efetivado_em,
            status
          )
          VALUES ($1, $2, 'saida', 'pagamento', 'pagamentos', $3, $4, $5, 'BRL', now(), 'liquidado')
          ON CONFLICT (ledger_id) DO NOTHING
          RETURNING *
        `,
        [
          entrada.contaId,
          liquidacao.lancamentoId,
          descricao,
          contraparte,
          entrada.valorCentavos
        ]
      )
    ).rows[0] ?? null;

    if (!movimento) {
      movimento = (
        await cliente.query<MovimentoFinanceiroBanco>(
          `
            SELECT *
            FROM movimentos_financeiros_netcatbank
            WHERE conta_id = $1
              AND ledger_id = $2
            LIMIT 1
          `,
          [entrada.contaId, liquidacao.lancamentoId]
        )
      ).rows[0] ?? null;
    }

    if (!movimento) throw new Error("movimento_pagamento_indisponivel");

    const boletoLiquidado = await registrarBoletoLiquidadoComCliente(cliente, {
      codigoBarrasHash: entrada.codigoBarrasHash,
      contaId: entrada.contaId,
      movimentoId: movimento.id,
      referenciaPublica: entrada.referenciaPublica
    });
    if (!boletoLiquidado) throw new Error("boleto_ja_pago");

    await cliente.query("COMMIT");
    return movimento;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const liquidarRecargaCelularConta = async (entrada: {
  assinarLancamento: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarLancamento"];
  assinarPartida: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarPartida"];
  assinarSaldo: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["assinarSaldo"];
  calcularMerkleRaiz: Parameters<typeof aplicarLancamentoLedgerSaldo>[0]["calcularMerkleRaiz"];
  contaId: string;
  descricao: string;
  idempotenciaBase: string;
  metadadosCifrados: string;
  operadora: string;
  referenciaPublica: string;
  telefoneHash: string;
  valorCentavos: number;
}) => {
  validarTextoInterno(entrada.contaId, /^[0-9a-f-]{36}$/i, "conta_recarga_invalida");
  validarTextoInterno(entrada.idempotenciaBase, /^[a-z0-9:_-]{8,100}$/, "idempotencia_recarga_invalida");
  validarTextoInterno(entrada.referenciaPublica, /^RC-[A-F0-9]{32}$/, "referencia_recarga_invalida");
  validarTextoInterno(entrada.telefoneHash, /^[a-f0-9]{64}$/, "hash_recarga_invalido");
  if (entrada.operadora.trim().length < 2 || entrada.operadora.trim().length > 40) {
    throw new Error("operadora_recarga_invalida");
  }
  if (!Number.isSafeInteger(entrada.valorCentavos) || entrada.valorCentavos < 1_500 || entrada.valorCentavos > 100_000) {
    throw new Error("valor_recarga_invalido");
  }

  const idempotenciaReserva = `${entrada.idempotenciaBase}:reserva`;
  const idempotenciaLiquidacao = `${entrada.idempotenciaBase}:liquidacao`;
  const descricao = entrada.descricao.trim().replace(/\s{2,}/g, " ").slice(0, 120) || "Recarga de celular";
  const operadora = entrada.operadora.trim().replace(/\s{2,}/g, " ").slice(0, 40);
  const referencia = entrada.referenciaPublica.toLowerCase();
  const parametrosAssinatura = {
    assinarLancamento: entrada.assinarLancamento,
    assinarPartida: entrada.assinarPartida,
    assinarSaldo: entrada.assinarSaldo,
    calcularMerkleRaiz: entrada.calcularMerkleRaiz
  };
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    await cliente.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await cliente.query("SELECT set_config('app.netcatbank_servico', 'api-netcatbank', true)");
    await cliente.query("SELECT set_config('app.netcatbank_conta_id', $1, true)", [entrada.contaId]);

    await aplicarLancamentoLedgerSaldoComCliente(cliente, {
      ...parametrosAssinatura,
      contaId: entrada.contaId,
      deltaContabilCentavos: 0,
      deltaDisponivelCentavos: -entrada.valorCentavos,
      estado: "registrado",
      fase: "autorizacao",
      idempotenciaChave: idempotenciaReserva,
      metadadosCifrados: entrada.metadadosCifrados,
      moeda: "BRL",
      referenciaOrigem: `pagamento:recarga:${referencia}:reserva`,
      tipo: "debito_reservado"
    });

    const liquidacao = await aplicarLancamentoLedgerSaldoComCliente(cliente, {
      ...parametrosAssinatura,
      contaId: entrada.contaId,
      deltaContabilCentavos: -entrada.valorCentavos,
      deltaDisponivelCentavos: 0,
      estado: "liquidado",
      fase: "liquidacao",
      idempotenciaChave: idempotenciaLiquidacao,
      metadadosCifrados: entrada.metadadosCifrados,
      moeda: "BRL",
      referenciaOrigem: `pagamento:recarga:${referencia}:liquidacao`,
      tipo: "debito_liquidado"
    });

    let movimento = (
      await cliente.query<MovimentoFinanceiroBanco>(
        `
          INSERT INTO movimentos_financeiros_netcatbank (
            conta_id,
            ledger_id,
            direcao,
            tipo,
            categoria,
            descricao,
            contraparte,
            valor_centavos,
            moeda,
            efetivado_em,
            status
          )
          VALUES ($1, $2, 'saida', 'recarga', 'pagamentos', $3, $4, $5, 'BRL', now(), 'liquidado')
          ON CONFLICT (ledger_id) DO NOTHING
          RETURNING *
        `,
        [
          entrada.contaId,
          liquidacao.lancamentoId,
          descricao,
          operadora,
          entrada.valorCentavos
        ]
      )
    ).rows[0] ?? null;

    if (!movimento) {
      movimento = (
        await cliente.query<MovimentoFinanceiroBanco>(
          `
            SELECT *
            FROM movimentos_financeiros_netcatbank
            WHERE conta_id = $1
              AND ledger_id = $2
            LIMIT 1
          `,
          [entrada.contaId, liquidacao.lancamentoId]
        )
      ).rows[0] ?? null;
    }

    if (!movimento) throw new Error("movimento_recarga_indisponivel");
    await cliente.query("COMMIT");
    return movimento;
  } catch (erro) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw erro;
  } finally {
    cliente.release();
  }
};

export const criarContaPendente = async (entrada: {
  referenciaPublica: string;
  nomeCifrado: string;
  primeiroNomeCifrado: string;
  tipoDocumento: TipoDocumento;
  documentoIndice: string;
  documentoCifrado: string;
  emailIndice: string;
  emailCifrado: string;
  produto: ProdutoConta;
}) => {
  const resultado = await banco.query<ContaBanco>(
    `
      INSERT INTO contas_netcatbank (
        referencia_publica,
        status,
        nome_cifrado,
        primeiro_nome_cifrado,
        tipo_documento,
        documento_indice,
        documento_cifrado,
        email_indice,
        email_cifrado,
        produto
      )
      VALUES ($1, 'pendente_complemento', $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    [
      entrada.referenciaPublica,
      entrada.nomeCifrado,
      entrada.primeiroNomeCifrado,
      entrada.tipoDocumento,
      entrada.documentoIndice,
      entrada.documentoCifrado,
      entrada.emailIndice,
      entrada.emailCifrado,
      entrada.produto
    ]
  );
  const conta = resultado.rows[0];
  if (!conta) throw new Error("Conta nao criada.");
  return conta;
};

export const criarSessaoAbertura = async (entrada: {
  tokenHash: string;
  contaId: string;
  contextoHash: string;
}) => {
  await banco.query(
    `
      INSERT INTO sessoes_abertura_netcatbank (token_hash, conta_id, contexto_hash, expiracao)
      VALUES ($1, $2, $3, now() + interval '20 minutes')
      ON CONFLICT (token_hash) DO NOTHING
    `,
    [entrada.tokenHash, entrada.contaId, entrada.contextoHash]
  );
};

export const buscarSessaoAbertura = async (tokenHash: string) => {
  const resultado = await banco.query<ContaBanco & { token_hash: string; contexto_hash: string }>(
    `
      SELECT c.*, s.token_hash, s.contexto_hash
      FROM sessoes_abertura_netcatbank s
      JOIN contas_netcatbank c ON c.id = s.conta_id
      WHERE s.token_hash = $1
        AND s.expiracao > now()
        AND s.usado_em IS NULL
        AND c.status = 'pendente_complemento'
        AND c.apagado_em IS NULL
      LIMIT 1
    `,
    [tokenHash]
  );
  return resultado.rows[0] ?? null;
};

export const consumirSessaoAbertura = async (tokenHash: string, contextoHash: string) => {
  const resultado = await banco.query<ContaBanco & { token_hash: string; contexto_hash: string }>(
    `
      UPDATE sessoes_abertura_netcatbank s
      SET usado_em = now()
      FROM contas_netcatbank c
      WHERE s.conta_id = c.id
        AND s.token_hash = $1
        AND s.contexto_hash = $2
        AND s.expiracao > now()
        AND s.usado_em IS NULL
        AND c.status = 'pendente_complemento'
        AND c.apagado_em IS NULL
      RETURNING c.*, s.token_hash, s.contexto_hash
    `,
    [tokenHash, contextoHash]
  );
  return resultado.rows[0] ?? null;
};

export const cancelarSessaoAbertura = async (tokenHash: string, contextoHash: string) => {
  const cliente = await banco.connect();

  try {
    await cliente.query("BEGIN");
    const resultado = await cliente.query<ContaBanco & { token_hash: string; contexto_hash: string }>(
      `
        UPDATE sessoes_abertura_netcatbank s
        SET usado_em = now()
        FROM contas_netcatbank c
        WHERE s.conta_id = c.id
          AND s.token_hash = $1
          AND s.contexto_hash = $2
          AND s.expiracao > now()
          AND s.usado_em IS NULL
          AND c.status = 'pendente_complemento'
          AND c.apagado_em IS NULL
        RETURNING c.*, s.token_hash, s.contexto_hash
      `,
      [tokenHash, contextoHash]
    );
    const conta = resultado.rows[0] ?? null;

    if (conta) {
      await cliente.query(
        `
          DELETE FROM contas_netcatbank
          WHERE id = $1
            AND status = 'pendente_complemento'
        `,
        [conta.id]
      );
    }

    await cliente.query("COMMIT");
    return conta;
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
};

export const concluirConta = async (entrada: {
  contaId: string;
  dataNascimentoCifrada: string | null;
  senhaHash: string;
}) => {
  await banco.query(
    `
      UPDATE contas_netcatbank
      SET status = 'ativa',
          data_nascimento_cifrada = $2,
          senha_hash = $3,
          atualizado_em = now()
      WHERE id = $1
        AND apagado_em IS NULL
    `,
    [entrada.contaId, entrada.dataNascimentoCifrada, entrada.senhaHash]
  );
};

export const prepararDoisFatoresConta = async (entrada: {
  contaId: string;
  segredoCifrado: string;
}) => {
  const resultado = await banco.query<ContaBanco>(
    `
      UPDATE contas_netcatbank
      SET dois_fatores_segredo_cifrado = $2,
          dois_fatores_pendente_em = now(),
          atualizado_em = now()
      WHERE id = $1
        AND status = 'ativa'
        AND apagado_em IS NULL
      RETURNING *
    `,
    [entrada.contaId, entrada.segredoCifrado]
  );
  return resultado.rows[0] ?? null;
};

export const ativarDoisFatoresConta = async (entrada: {
  contaId: string;
}) => {
  await banco.query(
    `
      UPDATE contas_netcatbank
      SET dois_fatores_ativo = true,
          dois_fatores_ativado_em = now(),
          dois_fatores_pendente_em = null,
          dois_fatores_ultimo_contador = null,
          atualizado_em = now()
      WHERE id = $1
        AND status = 'ativa'
        AND apagado_em IS NULL
    `,
    [entrada.contaId]
  );
};

export const atualizarContadorDoisFatoresConta = async (entrada: {
  contaId: string;
  contador: number;
}) => {
  const resultado = await banco.query<{ atualizado: boolean }>(
    `
      UPDATE contas_netcatbank
      SET dois_fatores_ultimo_contador = $2,
          atualizado_em = now()
      WHERE id = $1
        AND status = 'ativa'
        AND apagado_em IS NULL
        AND (dois_fatores_ultimo_contador IS NULL OR dois_fatores_ultimo_contador < $2)
      RETURNING true AS atualizado
    `,
    [entrada.contaId, entrada.contador]
  );
  return resultado.rowCount === 1;
};

export const marcarSessaoAberturaUsada = async (tokenHash: string) => {
  await banco.query(
    "UPDATE sessoes_abertura_netcatbank SET usado_em = now() WHERE token_hash = $1",
    [tokenHash]
  );
};

export const criarSessaoCliente = async (entrada: {
  tokenHash: string;
  contaId: string;
  contextoHash: string;
  contextoRedeHash: string;
  agenteHash: string;
  sinalClienteHash: string;
}) => {
  await banco.query("DELETE FROM sessoes_cliente_netcatbank WHERE conta_id = $1", [entrada.contaId]);
  await banco.query(
    `
      INSERT INTO sessoes_cliente_netcatbank (
        token_hash,
        conta_id,
        contexto_hash,
        contexto_rede_hash,
        agente_hash,
        sinal_cliente_hash,
        expiracao
      )
      VALUES ($1, $2, $3, $4, $5, $6, now() + interval '2 hours')
    `,
    [
      entrada.tokenHash,
      entrada.contaId,
      entrada.contextoHash,
      entrada.contextoRedeHash,
      entrada.agenteHash,
      entrada.sinalClienteHash
    ]
  );
};

export const criarDesafioLogin2fa = async (entrada: {
  tokenHash: string;
  contaId: string;
  contextoHash: string;
  contextoRedeHash: string;
  agenteHash: string;
  sinalClienteHash: string;
}) => {
  await banco.query("DELETE FROM desafios_login_2fa_netcatbank WHERE conta_id = $1 OR expiracao <= now()", [
    entrada.contaId
  ]);
  await banco.query(
    `
      INSERT INTO desafios_login_2fa_netcatbank (
        token_hash,
        conta_id,
        contexto_hash,
        contexto_rede_hash,
        agente_hash,
        sinal_cliente_hash,
        expiracao
      )
      VALUES ($1, $2, $3, $4, $5, $6, now() + interval '4 minutes')
    `,
    [
      entrada.tokenHash,
      entrada.contaId,
      entrada.contextoHash,
      entrada.contextoRedeHash,
      entrada.agenteHash,
      entrada.sinalClienteHash
    ]
  );
};

export const buscarSessaoCliente = async (tokenHash: string) => {
  await banco.query(
    "DELETE FROM sessoes_cliente_netcatbank WHERE expiracao <= now() OR ultimo_uso_em <= now() - interval '20 minutes'"
  );
  const resultado = await banco.query<
    ContaBanco & {
      token_hash: string;
      contexto_hash: string;
      contexto_rede_hash: string | null;
      agente_hash: string | null;
      sinal_cliente_hash: string | null;
    }
  >(
    `
      SELECT
        c.*,
        s.token_hash,
        s.contexto_hash,
        s.contexto_rede_hash,
        s.agente_hash,
        s.sinal_cliente_hash
      FROM sessoes_cliente_netcatbank s
      JOIN contas_netcatbank c ON c.id = s.conta_id
      WHERE s.token_hash = $1
        AND s.expiracao > now()
        AND s.ultimo_uso_em > now() - interval '20 minutes'
        AND c.status = 'ativa'
        AND c.apagado_em IS NULL
      LIMIT 1
    `,
    [tokenHash]
  );
  return resultado.rows[0] ?? null;
};

export const buscarDesafioLogin2fa = async (tokenHash: string, contextoHash: string) => {
  await banco.query("DELETE FROM desafios_login_2fa_netcatbank WHERE expiracao <= now()");
  const resultado = await banco.query<
    ContaBanco & {
      token_hash: string;
      contexto_hash: string;
      contexto_rede_hash: string;
      agente_hash: string;
      sinal_cliente_hash: string;
    }
  >(
    `
      SELECT
        c.*,
        d.token_hash,
        d.contexto_hash,
        d.contexto_rede_hash,
        d.agente_hash,
        d.sinal_cliente_hash
      FROM desafios_login_2fa_netcatbank d
      JOIN contas_netcatbank c ON c.id = d.conta_id
      WHERE d.token_hash = $1
        AND d.contexto_hash = $2
        AND d.expiracao > now()
        AND d.usado_em IS NULL
        AND c.status = 'ativa'
        AND c.dois_fatores_ativo = true
        AND c.apagado_em IS NULL
      LIMIT 1
    `,
    [tokenHash, contextoHash]
  );
  return resultado.rows[0] ?? null;
};

export const consumirDesafioLogin2fa = async (tokenHash: string, contextoHash: string) => {
  const resultado = await banco.query<{ token_hash: string }>(
    `
      UPDATE desafios_login_2fa_netcatbank
      SET usado_em = now()
      WHERE token_hash = $1
        AND contexto_hash = $2
        AND expiracao > now()
        AND usado_em IS NULL
      RETURNING token_hash
    `,
    [tokenHash, contextoHash]
  );
  return resultado.rowCount === 1;
};

export const tocarSessaoCliente = async (tokenHash: string) => {
  await banco.query(
    "UPDATE sessoes_cliente_netcatbank SET ultimo_uso_em = now() WHERE token_hash = $1",
    [tokenHash]
  );
};

export const atualizarSinalSessaoCliente = async (
  tokenHash: string,
  contextoHash: string,
  sinalClienteHash: string
) => {
  await banco.query(
    `
      UPDATE sessoes_cliente_netcatbank
      SET contexto_hash = $2,
          sinal_cliente_hash = $3,
          ultimo_uso_em = now()
      WHERE token_hash = $1
        AND expiracao > now()
    `,
    [tokenHash, contextoHash, sinalClienteHash]
  );
};

export const encerrarSessaoCliente = async (tokenHash: string) => {
  await banco.query("DELETE FROM sessoes_cliente_netcatbank WHERE token_hash = $1", [tokenHash]);
};

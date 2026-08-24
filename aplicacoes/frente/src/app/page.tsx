import Image from "next/image";
import { cookies } from "next/headers";
import { BarraSuperior } from "../componentes/barra-superior";
import { HeroiPrincipal } from "../componentes/heroi-principal";
import { LinkRolagem } from "../componentes/link-rolagem";
import {
  ArrowRight,
  Building2,
  CreditCard,
  Fingerprint,
  Landmark,
  LockKeyhole,
  PiggyBank,
  ShieldCheck,
  Smartphone,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { urlAbrirConta } from "../configuracao/publica";
import type { ModoHeroi } from "../componentes/heroi-principal";

const nomeCookieHeroi = "ncbank_netcatbank_heroi_publico_m5r8";

type BlocoComIcone = {
  titulo: string;
  texto: string;
  Icone: LucideIcon;
};

const beneficios: BlocoComIcone[] = [
  {
    titulo: "Conta NetCat",
    texto:
      "Abra sua conta para movimentar saldo, pagar boletos, acompanhar entradas e manter o dinheiro organizado.",
    Icone: Landmark
  },
  {
    titulo: "Nex entre amigos",
    texto:
      "Envie dinheiro para outros clientes NetCat Bank em poucos toques, dentro do próprio ecossistema do banco.",
    Icone: Zap
  },
  {
    titulo: "Investimentos guiados",
    texto:
      "Separe reservas, acompanhe objetivos e evolua seu perfil investidor com uma experiência simples.",
    Icone: PiggyBank
  },
  {
    titulo: "Cartão por análise",
    texto:
      "Cada cliente recebe uma oferta conforme uso, relacionamento e análise de perfil, podendo chegar ao Black.",
    Icone: CreditCard
  }
];

const pilaresSeguranca: BlocoComIcone[] = [
  {
    titulo: "Criptografia e sessão",
    texto:
      "Dados sensíveis protegidos em trânsito e em repouso, com sessão curta para operações importantes.",
    Icone: LockKeyhole
  },
  {
    titulo: "Acesso verificado",
    texto:
      "Dispositivos confiáveis, confirmação de identidade e etapas extras para mudanças críticas.",
    Icone: Fingerprint
  },
  {
    titulo: "Análise de risco",
    texto:
      "Monitoramento de comportamento, limites e eventos suspeitos antes que uma transação avance.",
    Icone: Zap
  }
];

const obterModoInicial = async (): Promise<ModoHeroi> => {
  const modo = (await cookies()).get(nomeCookieHeroi)?.value;
  return modo === "empresa" ? "empresa" : "pessoa";
};

export default async function PaginaInicial() {
  const modoInicial = await obterModoInicial();

  return (
    <main className="pagina">
      <BarraSuperior />
      <HeroiPrincipal modoInicial={modoInicial} />

      <div className="conteudo-sobreposto">
        <section className="secao secao--clara secao--principal" id="conta">
          <div className="container secao__cabecalho">
            <p className="rotulo">Conta NetCat</p>
            <h2>Sua vida financeira em uma conta simples de usar e difícil de derrubar.</h2>
            <p>
              O NetCat Bank reúne conta, Nex, cartões, investimentos e atendimento em uma
              experiência única para quem quer controlar o dinheiro sem perder segurança.
            </p>
          </div>

          <div className="container grade-beneficios">
            {beneficios.map(({ titulo, texto, Icone }) => (
              <article className="beneficio" key={titulo}>
                <Icone aria-hidden="true" size={28} />
                <h3>{titulo}</h3>
                <p>{texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="secao secao--cartoes" id="cartao">
          <div className="container cartoes-produto">
            <div className="cartoes-produto__cabecalho">
              <div>
                <p className="rotulo">Cartões NetCat</p>
                <h2>Aproveite mais possibilidades com um cartão feito para o seu perfil.</h2>
              </div>
              <p>
                Do Essencial ao Black, cada oferta nasce da análise de relacionamento, uso da conta
                e segurança do cliente. O cartão certo aparece quando o seu momento financeiro pede.
              </p>
            </div>

            <Image
              src="/marca/cartoes-netcatbank.webp"
              alt="Família de cartões NetCat Bank: Essencial, Livre, Prime e Black."
              width={1600}
              height={850}
              loading="eager"
              unoptimized
              className="cartoes-produto__mockup"
            />

            <div className="cartoes-produto__grade">
              <div className="cartoes-produto__texto">
                <p className="rotulo">Por análise</p>
                <h3>Existe um cartão NetCat que combina com o seu momento.</h3>
                <p>
                  A aprovação considera sua movimentação, histórico dentro do banco e sinais de
                  segurança. Você pode começar com um cartão simples, evoluir o limite e, com
                  relacionamento, receber uma oferta Prime ou Black.
                </p>
                <div className="cartoes-produto__selos" aria-label="Recursos dos cartões">
                  <span>Sem bandeira exposta</span>
                  <span>Cartão virtual</span>
                  <span>Controle no app</span>
                  <span>Black por relacionamento</span>
                </div>
                <a className="botao botao--primario" href={urlAbrirConta}>
                  <span>Abrir conta</span>
                  <ArrowRight aria-hidden="true" size={20} />
                </a>
              </div>

              <div className="cartoes-produto__foto">
                <Image
                  src="/marca/cartao-bolso-netcatbank.webp"
                  alt="Pessoa guardando um cartão black NetCat Bank no bolso."
                  fill
                  sizes="(max-width: 980px) 100vw, 48vw"
                  loading="eager"
                  unoptimized
                />
              </div>
            </div>
          </div>
        </section>

        <section className="secao secao--seguranca" id="seguranca">
          <div className="container seguranca">
            <div className="seguranca__texto">
              <p className="rotulo">Segurança</p>
              <h2>Segurança antes de qualquer transação.</h2>
              <p>
                Do login ao envio por Nex, cada fluxo foi pensado para proteger acesso, sessão e
                movimentações. A experiência registra eventos, reduz abuso e preserva dados
                sensíveis sem deixar o uso pesado.
              </p>
            </div>

            <div className="trilhas-seguranca">
              {pilaresSeguranca.map(({ titulo, texto, Icone }) => (
                <article className="trilha" key={titulo}>
                  <Icone aria-hidden="true" size={26} />
                  <div>
                    <h3>{titulo}</h3>
                    <p>{texto}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="secao secao--app" id="empresas">
          <div className="container app-grid">
            <div className="app-visual" aria-hidden="true">
              <div className="app-visual__tela">
                <div className="app-visual__topo">
                  <span>NetCat Empresas</span>
                  <Building2 size={22} />
                </div>
                <div className="app-visual__saldo">R$ 248.900,00</div>
                <div className="app-visual__linha">
                  <span>Folha protegida</span>
                  <strong>agendada</strong>
                </div>
                <div className="app-visual__linha">
                  <span>Nex cobrança</span>
                  <strong>+18%</strong>
                </div>
                <div className="app-visual__linha">
                  <span>Cartões equipe</span>
                  <strong>12 ativos</strong>
                </div>
              </div>
            </div>

            <div className="app-grid__texto">
              <p className="rotulo">Conta e investimentos</p>
              <h2>Nex, cartões e investimentos no mesmo banco.</h2>
              <p>
                Envie dinheiro para amigos dentro do NetCat Bank, pague cobranças, acompanhe a
                empresa e separe valores para investir. A conta foi pensada para o dia a dia, mas
                com espaço para crescer junto com o seu perfil financeiro.
              </p>
              <div className="chips">
                <span>
                  <Smartphone size={18} />
                  App NetCat
                </span>
                <span>
                  <Zap size={18} />
                  Nex interno
                </span>
                <span>
                  <ShieldCheck size={18} />
                  Segurança ativa
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="convite" id="convite">
          <div className="container convite__conteudo">
            <p className="rotulo">Abra sua conta</p>
            <h2>Comece no NetCat Bank e descubra sua oferta.</h2>
            <p>
              Crie sua conta, movimente dinheiro com Nex, acompanhe seus investimentos e veja qual
              cartão combina com o seu relacionamento.
            </p>
            <a className="botao botao--primario" href={urlAbrirConta}>
              <span>Abrir conta</span>
              <ArrowRight aria-hidden="true" size={20} />
            </a>
          </div>
        </section>

        <footer className="rodape">
          <div className="container rodape__conteudo">
            <div className="rodape__marca">
              <Image
                src="/marca/logo-netcatbank-branca.webp"
                alt="NetCat Bank"
                width={240}
                height={194}
                unoptimized
                className="rodape__logo"
              />
              <p>
                NetCat Bank é criado e gerenciado pela NetCatTest para simular uma experiência
                bancária completa.
              </p>
            </div>

            <div className="rodape__colunas">
              <div>
                <h3>Produtos</h3>
                <LinkRolagem destino="conta">Conta NetCat</LinkRolagem>
                <LinkRolagem destino="conta">Nex interno</LinkRolagem>
                <LinkRolagem destino="cartao">Cartões</LinkRolagem>
                <LinkRolagem destino="empresas">Investimentos</LinkRolagem>
              </div>
              <div>
                <h3>Segurança</h3>
                <LinkRolagem destino="seguranca">Central de segurança</LinkRolagem>
                <LinkRolagem destino="seguranca">Chaves de acesso</LinkRolagem>
                <LinkRolagem destino="seguranca">Dispositivos confiáveis</LinkRolagem>
                <LinkRolagem destino="seguranca">Alertas de risco</LinkRolagem>
              </div>
              <div>
                <h3>Contato</h3>
                <a href="mailto:contato@netcatbank.com">contato@netcatbank.com</a>
                <a href="https://netcatbank.com">netcatbank.com</a>
                <span>Brasil</span>
              </div>
            </div>
          </div>
          <div className="container rodape__aviso-ctf">
            Operações digitais com segurança, privacidade e controle em cada etapa.
          </div>
          <div className="container rodape__base">
            <span>© 2026 NetCat Bank. Todos os direitos reservados.</span>
            <span>netcatbank.com</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

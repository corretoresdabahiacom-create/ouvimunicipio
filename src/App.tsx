import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BarChart3, Bell, FilePlus2, Inbox, LogOut, QrCode, Settings, UserRound } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/useAuth";
import { TelaAuth, TelaConfirmarEmail } from "./components/Auth";
import { NovaMensagem, MeusProtocolos, PainelAvisos, usarNotificacoes } from "./components/Cidadao";
// Telas pesadas só são baixadas quando abertas (o app inicial fica mais leve no celular).
const PainelSecretaria = lazy(() => import("./components/Secretaria").then((m) => ({ default: m.PainelSecretaria })));
const PainelOuvidor = lazy(() => import("./components/Ouvidor").then((m) => ({ default: m.PainelOuvidor })));
const PainelPrefeito = lazy(() => import("./components/Prefeito").then((m) => ({ default: m.PainelPrefeito })));
const PainelAdmin = lazy(() => import("./components/Admin").then((m) => ({ default: m.PainelAdmin })));
const Instalar = lazy(() => import("./components/Instalar").then((m) => ({ default: m.Instalar })));
import { Perfil } from "./components/Perfil";
import { AceiteTermos } from "./components/Legal";
import { VERSAO_TERMOS } from "./lib/types";
import { BotaoLibras, Cabecalho, Carrossel } from "./components/Marca";
import { SiteProvider } from "./lib/useConfig";
import { MunicipioProvider, Raiz0, rotaAtual } from "./lib/municipio";
const PaginaTransparencia = lazy(() => import("./components/Transparencia").then((m) => ({ default: m.PaginaTransparencia })));
const PaginaConsulta = lazy(() => import("./components/Consulta").then((m) => ({ default: m.PaginaConsulta })));
const PainelSuperAdmin = lazy(() => import("./components/SuperAdmin").then((m) => ({ default: m.PainelSuperAdmin })));
import { Aviso, Botao, BotaoVoltar, Carregando, Cartao } from "./components/ui";

type Aba = "nova" | "protocolos" | "avisos" | "painel" | "ouvidoria" | "prefeito" | "admin" | "perfil" | "instalar";

function Shell() {
  const { perfil, sair } = useAuth();
  const ehAdmin = perfil?.papel === "admin";
  const ehServidor = perfil?.papel === "secretario" || perfil?.papel === "assessor";
  const ehOuvidor = perfil?.papel === "ouvidor";
  const ehPrefeito = perfil?.papel === "prefeito";
  const interno = ehAdmin || ehServidor || ehOuvidor || ehPrefeito; // não é cidadão
  const [aba, setAba] = useState<Aba>(ehAdmin ? "admin" : ehServidor ? "painel" : ehOuvidor ? "ouvidoria" : ehPrefeito ? "prefeito" : "nova");
  const [protocoloSel, setProtocoloSel] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<string | null>(null);
  // Histórico das abas: o botão "Voltar" e o voltar do celular retornam à tela anterior em vez de sair do app.
  const anteriores = useRef<Aba[]>([]);
  function ir(nova: Aba) {
    if (nova === aba) return;
    anteriores.current.push(aba);
    if (anteriores.current.length > 30) anteriores.current.shift();
    history.pushState({ ouvidoriaAba: nova }, "");
    setAba(nova);
  }
  useEffect(() => {
    const aoVoltar = () => {
      const anterior = anteriores.current.pop();
      if (anterior) { setAba(anterior); setProtocoloSel(null); setConcluido(null); }
    };
    addEventListener("popstate", aoVoltar);
    return () => removeEventListener("popstate", aoVoltar);
  }, []);
  const { visiveis } = usarNotificacoes();

  const itens: { id: Aba; rotulo: string; Icone: typeof Bell; mostrar: boolean; badge?: number }[] = [
    { id: "nova", rotulo: "Nova", Icone: FilePlus2, mostrar: !interno },
    { id: "protocolos", rotulo: "Protocolos", Icone: Inbox, mostrar: !interno },
    { id: "avisos", rotulo: "Avisos", Icone: Bell, mostrar: !interno, badge: visiveis.length },
    { id: "painel", rotulo: "Mensagens", Icone: Inbox, mostrar: ehServidor },
    { id: "ouvidoria", rotulo: "Ouvidoria", Icone: Inbox, mostrar: ehOuvidor },
    { id: "prefeito", rotulo: "Painel", Icone: BarChart3, mostrar: ehPrefeito },
    { id: "admin", rotulo: "Admin", Icone: Settings, mostrar: ehAdmin },
    { id: "perfil", rotulo: "Perfil", Icone: UserRound, mostrar: true },
    { id: "instalar", rotulo: "Instalar", Icone: QrCode, mostrar: true },
  ];

  function abrirProtocolo(id: string) { setProtocoloSel(id); ir("protocolos"); }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <h1 className="min-w-0"><Cabecalho /></h1>
        <div className="flex items-center gap-2 text-sm">
          <BotaoLibras claro />
          <span className="hidden max-w-40 truncate sm:inline">{perfil?.nome || perfil?.email}</span>
          <button onClick={sair} aria-label="Sair" className="rounded p-2 hover:bg-white/10"><LogOut className="size-5" /></button>
        </div>
      </header>

      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Pular para o conteúdo</a>
      <main id="conteudo" tabIndex={-1} className="flex-1 space-y-4 p-4 pb-24 outline-none">
        {anteriores.current.length > 0 && <div className="-mb-2"><BotaoVoltar onClick={() => history.back()} /></div>}
        {!interno && (aba === "nova" || aba === "protocolos" || aba === "avisos") && !protocoloSel && <Carrossel />}
        <Suspense fallback={<Carregando />}>
        {concluido && aba === "nova" ? (
          <Cartao className="space-y-3 text-center">
            <Aviso tipo="ok">Mensagem enviada! Seu protocolo é <b className="font-mono">{concluido}</b>. A secretaria tem até 30 dias para responder.</Aviso>
            <div className="flex justify-center gap-2">
              <Botao onClick={() => { setProtocoloSel(concluido); setConcluido(null); ir("protocolos"); }}>Ver protocolo</Botao>
              <Botao variante="secundario" onClick={() => setConcluido(null)}>Enviar outra</Botao>
            </div>
          </Cartao>
        ) : aba === "nova" ? <NovaMensagem aoConcluir={setConcluido} />
        : aba === "protocolos" ? <MeusProtocolos abrir={setProtocoloSel} selecionado={protocoloSel} limparSelecao={() => setProtocoloSel(null)} />
        : aba === "avisos" ? <PainelAvisos abrirProtocolo={abrirProtocolo} />
        : aba === "painel" ? <PainelSecretaria />
        : aba === "ouvidoria" ? <PainelOuvidor />
        : aba === "prefeito" ? <PainelPrefeito />
        : aba === "admin" ? <PainelAdmin />
        : aba === "perfil" ? <Perfil />
        : <Instalar />}
        </Suspense>
      </main>

      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-10 border-t bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-3xl justify-around">
          {itens.filter((i) => i.mostrar).map(({ id, rotulo, Icone, badge }) => (
            <li key={id} className="flex-1">
              <button onClick={() => { ir(id); if (id !== "protocolos") setProtocoloSel(null); }} aria-current={aba === id ? "page" : undefined}
                className={`relative flex w-full flex-col items-center gap-0.5 py-2 text-xs font-medium ${aba === id ? "text-brand" : "text-slate-500"}`}>
                <Icone className="size-5" aria-hidden />{rotulo}
                {!!badge && <span className="absolute right-1/4 top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{badge}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Raiz() {
  const { user, perfil, carregando, erroPerfil, sair } = useAuth();
  if (carregando) return <Carregando />;
  if (!user) return <TelaAuth />;
  if (!user.emailVerified) return <TelaConfirmarEmail />;
  if (!perfil) return (
    <main className="mx-auto max-w-md space-y-3 p-4">
      {erroPerfil ? <Aviso>{erroPerfil}</Aviso> : <Carregando />}
      <Botao variante="secundario" onClick={sair}>Sair</Botao>
    </main>
  );
  if (perfil.situacao !== "ativo") return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-4">
      <Cartao className="space-y-3 text-center">
        <h1 className="text-xl font-bold">{perfil.situacao === "bloqueado" ? "Conta bloqueada" : "Conta removida"}</h1>
        <p className="text-slate-600">{perfil.situacao === "bloqueado"
          ? "O acesso desta conta foi suspenso pela prefeitura. Entre em contato com a ouvidoria para mais informações."
          : "Esta conta foi removida pela prefeitura e não pode mais ser usada."}</p>
        <Botao variante="secundario" onClick={sair}>Sair</Botao>
      </Cartao>
    </main>
  );
  if (perfil.aceiteVersao !== VERSAO_TERMOS) return <AceiteTermos />;
  return <Shell key={perfil.uid} />;
}

// /superadmin: dono do SaaS (conta cadastrada no console). Fora de qualquer município.
function RaizSuper() {
  const { user, superadmin, carregando, sair } = useAuth();
  if (carregando) return <Carregando />;
  if (!user) return <TelaAuth />;
  if (!user.emailVerified) return <TelaConfirmarEmail />;
  if (!superadmin) return (
    <main className="mx-auto max-w-md space-y-3 p-4"><Aviso>Esta conta não tem acesso ao painel do SaaS.</Aviso><Botao variante="secundario" onClick={sair}>Sair</Botao></main>
  );
  return <Suspense fallback={<Carregando />}><PainelSuperAdmin /></Suspense>;
}

export default function App() {
  const rota = rotaAtual();
  if (rota.tipo === "raiz") return <Raiz0 />;
  if (rota.tipo === "super") return <AuthProvider><RaizSuper /></AuthProvider>;
  // página pública (sem login): números da Ouvidoria, se o município publicar
  if (rota.sub === "transparencia" || rota.sub === "consulta") return (
    <MunicipioProvider slug={rota.slug}>
      <SiteProvider><Suspense fallback={<Carregando />}>{rota.sub === "consulta" ? <PaginaConsulta /> : <PaginaTransparencia />}</Suspense></SiteProvider>
    </MunicipioProvider>
  );
  return (
    <MunicipioProvider slug={rota.slug}>
      <SiteProvider><AuthProvider><Raiz /></AuthProvider></SiteProvider>
    </MunicipioProvider>
  );
}

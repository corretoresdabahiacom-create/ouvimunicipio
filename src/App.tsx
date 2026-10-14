import { useState } from "react";
import { Bell, FilePlus2, Inbox, LogOut, QrCode, Settings, UserRound } from "lucide-react";
import { AuthProvider, useAuth } from "./lib/useAuth";
import { TelaAuth, TelaConfirmarEmail } from "./components/Auth";
import { NovaMensagem, MeusProtocolos, PainelAvisos, usarNotificacoes } from "./components/Cidadao";
import { PainelSecretaria } from "./components/Secretaria";
import { PainelAdmin } from "./components/Admin";
import { Instalar } from "./components/Instalar";
import { Perfil } from "./components/Perfil";
import { Cabecalho, Carrossel } from "./components/Marca";
import { SiteProvider } from "./lib/useConfig";
import { Aviso, Botao, Carregando, Cartao } from "./components/ui";

type Aba = "nova" | "protocolos" | "avisos" | "painel" | "admin" | "perfil" | "instalar";

function Shell() {
  const { perfil, sair } = useAuth();
  const ehAdmin = perfil?.papel === "admin";
  const ehServidor = perfil?.papel === "secretario" || perfil?.papel === "assessor";
  const [aba, setAba] = useState<Aba>(ehAdmin ? "admin" : ehServidor ? "painel" : "nova");
  const [protocoloSel, setProtocoloSel] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<string | null>(null);
  const { visiveis } = usarNotificacoes();

  const itens: { id: Aba; rotulo: string; Icone: typeof Bell; mostrar: boolean; badge?: number }[] = [
    { id: "nova", rotulo: "Nova", Icone: FilePlus2, mostrar: !ehAdmin && !ehServidor },
    { id: "protocolos", rotulo: "Protocolos", Icone: Inbox, mostrar: !ehAdmin && !ehServidor },
    { id: "avisos", rotulo: "Avisos", Icone: Bell, mostrar: !ehAdmin && !ehServidor, badge: visiveis.length },
    { id: "painel", rotulo: "Mensagens", Icone: Inbox, mostrar: ehServidor },
    { id: "admin", rotulo: "Admin", Icone: Settings, mostrar: ehAdmin },
    { id: "perfil", rotulo: "Perfil", Icone: UserRound, mostrar: true },
    { id: "instalar", rotulo: "Instalar", Icone: QrCode, mostrar: true },
  ];

  function abrirProtocolo(id: string) { setProtocoloSel(id); setAba("protocolos"); }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="flex items-center justify-between bg-brand px-4 py-3 text-white">
        <h1 className="min-w-0"><Cabecalho /></h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden max-w-40 truncate sm:inline">{perfil?.nome || perfil?.email}</span>
          <button onClick={sair} aria-label="Sair" className="rounded p-2 hover:bg-white/10"><LogOut className="size-5" /></button>
        </div>
      </header>

      <main className="flex-1 space-y-4 p-4 pb-24">
        {!ehAdmin && !ehServidor && (aba === "nova" || aba === "protocolos" || aba === "avisos") && !protocoloSel && <Carrossel />}
        {concluido && aba === "nova" ? (
          <Cartao className="space-y-3 text-center">
            <Aviso tipo="ok">Mensagem enviada! Seu protocolo é <b className="font-mono">{concluido}</b>. A secretaria tem até 30 dias para responder.</Aviso>
            <div className="flex justify-center gap-2">
              <Botao onClick={() => { setProtocoloSel(concluido); setConcluido(null); setAba("protocolos"); }}>Ver protocolo</Botao>
              <Botao variante="secundario" onClick={() => setConcluido(null)}>Enviar outra</Botao>
            </div>
          </Cartao>
        ) : aba === "nova" ? <NovaMensagem aoConcluir={setConcluido} />
        : aba === "protocolos" ? <MeusProtocolos abrir={setProtocoloSel} selecionado={protocoloSel} limparSelecao={() => setProtocoloSel(null)} />
        : aba === "avisos" ? <PainelAvisos abrirProtocolo={abrirProtocolo} />
        : aba === "painel" ? <PainelSecretaria />
        : aba === "admin" ? <PainelAdmin />
        : aba === "perfil" ? <Perfil />
        : <Instalar />}
      </main>

      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-10 border-t bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto flex max-w-3xl justify-around">
          {itens.filter((i) => i.mostrar).map(({ id, rotulo, Icone, badge }) => (
            <li key={id} className="flex-1">
              <button onClick={() => { setAba(id); if (id !== "protocolos") setProtocoloSel(null); }} aria-current={aba === id ? "page" : undefined}
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
  return <Shell key={perfil.uid} />;
}

export default function App() {
  return <SiteProvider><AuthProvider><Raiz /></AuthProvider></SiteProvider>;
}

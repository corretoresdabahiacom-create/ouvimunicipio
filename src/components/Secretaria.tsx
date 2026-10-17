import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { TIPOS, type Protocolo } from "../lib/types";
import { Aviso, Carregando, Cartao, Selo, dataBR, diasRestantes } from "./ui";
import { usarProtocolos } from "./Cidadao";
import { ProtocoloDetalhe, useLimpezaConversas } from "./Conversa";

type Aba = "aguardando" | "respondidas" | "concluidas";

// "Aguardando": sem 1ª resposta, ou o cidadão escreveu depois da última resposta.
const aguardando = (p: Protocolo) => p.status === "aberto" || (p.status === "respondido" && p.ultimaMsgPor === "cidadao");

export function PainelSecretaria() {
  const { perfil } = useAuth();
  const { lista, erro } = usarProtocolos("secretariaId", perfil?.secretariaId);
  useLimpezaConversas(lista);
  const [aba, setAba] = useState<Aba>("aguardando");
  const [sel, setSel] = useState<string | null>(null);

  if (!perfil?.secretariaId) return <Aviso>Seu cadastro não está vinculado a uma secretaria. Procure o administrador.</Aviso>;
  if (lista === null) return <Carregando />;

  const atual = sel ? lista.find((p) => p.id === sel) : null;
  if (atual) return <ProtocoloDetalhe p={atual} voltar={() => setSel(null)} eu="servidor" />;

  const porAba: Record<Aba, Protocolo[]> = {
    aguardando: lista.filter(aguardando),
    respondidas: lista.filter((p) => p.status === "respondido" && !aguardando(p)),
    concluidas: lista.filter((p) => p.status === "concluido"),
  };
  const filtrados = [...porAba[aba]].sort((a, b) => aba === "aguardando"
    ? (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0)
    : (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));

  // alerta de prazo: protocolos sem 1ª resposta com 5 dias ou menos
  const urgentes = lista.filter((p) => p.status === "aberto" && (diasRestantes(p) ?? 99) <= 5);
  const vencidos = urgentes.filter((p) => (diasRestantes(p) ?? 0) < 0).length;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Mensagens recebidas</h2>
      {urgentes.length > 0 && (
        <div role="alert" className="flex gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p><b>{urgentes.length}</b> {urgentes.length === 1 ? "protocolo vence" : "protocolos vencem"} em até 5 dias{vencidos > 0 ? ` (${vencidos} já vencido${vencidos > 1 ? "s" : ""})` : ""}. Responda primeiro os mais antigos, na aba Aguardando.</p>
        </div>
      )}
      <div role="tablist" className="flex gap-2 overflow-x-auto">
        {([["aguardando", `Aguardando (${porAba.aguardando.length})`], ["respondidas", "Respondidas"], ["concluidas", "Concluídas"]] as const).map(([a, rotulo]) => (
          <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${aba === a ? "bg-brand text-white" : "border bg-white text-slate-700"}`}>
            {rotulo}
          </button>
        ))}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {filtrados.length === 0 && <Cartao><p className="text-slate-600">Nada por aqui.</p></Cartao>}
      {filtrados.map((p) => {
        const d = diasRestantes(p);
        return (
          <button key={p.id} onClick={() => setSel(p.id)} className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand">
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-600">{p.numero}</span><Selo status={p.status} /></div>
            <p className="mt-1 font-semibold">{TIPOS[p.tipo] ?? p.assunto ?? "Manifestação"}</p>
            <p className="text-sm text-slate-700">Enviado em {dataBR(p.criadoEm)}</p>
            <p className="mt-1 text-xs">
              {p.status === "respondido" && p.ultimaMsgPor === "cidadao" && <span className="font-semibold text-blue-800">O cidadão respondeu · </span>}
              {p.status === "aberto" && d !== null && <span className={d <= 5 ? "font-semibold text-red-800" : "text-slate-700"}>prazo: {d >= 0 ? `${d} dias` : "vencido"}</span>}
            </p>
          </button>
        );
      })}
    </div>
  );
}

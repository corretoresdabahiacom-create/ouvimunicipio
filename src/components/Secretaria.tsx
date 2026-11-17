import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { TIPOS, type Protocolo } from "../lib/types";
import { Aviso, Carregando, Cartao, Selo, dataBR, nivelPrazo, rotuloPrazo } from "./ui";
import { usarProtocolos } from "./Cidadao";
import { ProtocoloDetalhe, useLimpezaConversas } from "./Conversa";
import { VistaMapa } from "./VistaMapa";
import { GerirModelos } from "./Modelos";

type Aba = "aguardando" | "vencidas" | "respondidas" | "concluidas" | "mapa" | "modelos";

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

  const porAba: Record<Exclude<Aba, "mapa" | "modelos">, Protocolo[]> = {
    aguardando: lista.filter(aguardando),
    vencidas: lista.filter((p) => p.status === "aberto" && nivelPrazo(p) === "vencido"),
    respondidas: lista.filter((p) => p.status === "respondido" && !aguardando(p)),
    concluidas: lista.filter((p) => p.status === "concluido"),
  };
  const filtrados = aba === "mapa" || aba === "modelos" ? [] : [...porAba[aba]].sort((a, b) => aba === "aguardando" || aba === "vencidas"
    ? (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0)
    : (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));

  // alertas de prazo (só protocolos sem 1ª resposta): vencido, hoje/2 dias, 5 dias e 10 dias
  const abertos = lista.filter((p) => p.status === "aberto");
  const conta = (...n: string[]) => abertos.filter((p) => n.includes(nivelPrazo(p) ?? "")).length;
  const vencidos = conta("vencido"), criticos = conta("hoje", "dois"), cinco = conta("cinco"), dez = conta("dez");

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Mensagens recebidas</h2>
      {(vencidos + criticos + cinco + dez) > 0 && (
        <div role="alert" className={`flex gap-2 rounded-lg border p-3 text-sm ${vencidos + criticos > 0 ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Atenção aos prazos:{" "}
            {[vencidos && `${vencidos} vencido${vencidos > 1 ? "s" : ""}`, criticos && `${criticos} vence${criticos > 1 ? "m" : ""} em até 2 dias`,
              cinco && `${cinco} em até 5 dias`, dez && `${dez} em até 10 dias`].filter(Boolean).join(" · ")}.
            {" "}Responda primeiro os mais antigos. Se precisar de mais tempo, abra o protocolo e use <b>Prorrogar prazo</b> (uma única vez, com justificativa).
          </p>
        </div>
      )}
      <div role="tablist" className="flex gap-2 overflow-x-auto">
        {([["aguardando", `Aguardando (${porAba.aguardando.length})`], ["vencidas", `Vencidas (${porAba.vencidas.length})`], ["respondidas", "Respondidas"], ["concluidas", "Concluídas"], ["mapa", "Mapa"], ["modelos", "Respostas-modelo"]] as const).map(([a, rotulo]) => (
          <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${aba === a ? "bg-brand text-white" : "border bg-white text-slate-700"}`}>
            {rotulo}
          </button>
        ))}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {aba === "mapa" && <VistaMapa lista={lista} abrir={setSel} />}
      {aba === "modelos" && <GerirModelos secretariaId={perfil.secretariaId} podeEditar={perfil.papel === "secretario"} />}
      {aba !== "mapa" && aba !== "modelos" && filtrados.length === 0 && <Cartao><p className="text-slate-600">Nada por aqui.</p></Cartao>}
      {filtrados.map((p) => {
        const r = p.status === "aberto" ? rotuloPrazo(p) : null;
        return (
          <button key={p.id} onClick={() => setSel(p.id)} className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand">
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-600">{p.numero}</span><Selo status={p.status} /></div>
            <p className="mt-1 font-semibold">{TIPOS[p.tipo] ?? p.assunto ?? "Manifestação"}</p>
            <p className="text-sm text-slate-700">Enviado em {dataBR(p.criadoEm)}</p>
            <p className="mt-1 text-xs">
              {p.status === "respondido" && p.ultimaMsgPor === "cidadao" && <span className="font-semibold text-blue-800">O cidadão respondeu · </span>}
              {p.status === "aberto" && p.cobradoEm && <span className="font-semibold text-red-800">Cobrado pela Ouvidoria · </span>}
              {r && <span className={r.classe}>{r.texto}</span>}
            </p>
          </button>
        );
      })}
    </div>
  );
}

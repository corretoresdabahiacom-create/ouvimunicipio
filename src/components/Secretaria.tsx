import { useState, type FormEvent } from "react";
import { collection, doc, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { mensagemDeErro } from "../lib/erros";
import type { Protocolo } from "../lib/types";
import { Aviso, Botao, Cartao, Carregando, Selo, dataBR, diasRestantes } from "./ui";
import { ProtocoloDetalhe, usarProtocolos } from "./Cidadao";

export function PainelSecretaria() {
  const { perfil } = useAuth();
  const { lista, erro } = usarProtocolos("secretariaId", perfil?.secretariaId);
  const [aba, setAba] = useState<"aberto" | "respondido">("aberto");
  const [sel, setSel] = useState<string | null>(null);

  if (!perfil?.secretariaId) return <Aviso>Seu cadastro não está vinculado a uma secretaria. Procure o administrador.</Aviso>;
  if (lista === null) return <Carregando />;

  const atual = sel ? lista.find((p) => p.id === sel) : null;
  if (atual) return <ProtocoloDetalhe p={atual} voltar={() => setSel(null)}>{atual.status === "aberto" && <FormResposta p={atual} aoResponder={() => setSel(null)} />}</ProtocoloDetalhe>;

  const filtrados = lista.filter((p) => p.status === aba)
    .sort((a, b) => aba === "aberto" ? (a.criadoEm?.toMillis?.() ?? 0) - (b.criadoEm?.toMillis?.() ?? 0) : 0);
  const abertos = lista.filter((p) => p.status === "aberto").length;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Mensagens recebidas</h2>
      <div role="tablist" className="flex gap-2">
        {(["aberto", "respondido"] as const).map((a) => (
          <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${aba === a ? "bg-brand text-white" : "bg-white text-slate-700 border"}`}>
            {a === "aberto" ? `Aguardando (${abertos})` : "Respondidas"}
          </button>
        ))}
      </div>
      {erro && <Aviso>{erro}</Aviso>}
      {filtrados.length === 0 && <Cartao><p className="text-slate-600">Nada por aqui.</p></Cartao>}
      {filtrados.map((p) => {
        const d = diasRestantes(p);
        return (
          <button key={p.id} onClick={() => setSel(p.id)} className="block w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand">
            <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-500">{p.numero}</span><Selo status={p.status} /></div>
            <p className="mt-1 font-semibold">{p.assunto}</p>
            <p className="line-clamp-2 text-sm text-slate-600">{p.mensagem}</p>
            <p className="mt-1 text-xs text-slate-500">{dataBR(p.criadoEm)}{p.status === "aberto" && d !== null && <span className={d <= 5 ? " font-semibold text-red-700" : ""}> · prazo: {d >= 0 ? `${d} dias` : "vencido"}</span>}</p>
          </button>
        );
      })}
    </div>
  );
}

function FormResposta({ p, aoResponder }: { p: Protocolo; aoResponder: () => void }) {
  const { perfil } = useAuth();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function responder(e: FormEvent) {
    e.preventDefault();
    if (!perfil) return;
    if (texto.trim().length < 3) return setErro("Escreva a resposta.");
    setErro(""); setOcupado(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "protocolos", p.id), {
        status: "respondido", resposta: texto.trim(), respondidoPor: perfil.uid, respondidoEm: serverTimestamp(),
      });
      batch.set(doc(collection(db, "notificacoes")), {
        uid: p.autorUid, protocoloId: p.id, tipo: "resposta",
        mensagem: `Seu protocolo ${p.numero} foi respondido. Atenção: este aviso será apagado em 24 horas. A resposta continua disponível no protocolo.`,
        criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 24 * 3600_000),
      });
      await batch.commit();
      aoResponder();
    } catch (err) { setErro(mensagemDeErro(err)); }
    finally { setOcupado(false); }
  }

  return (
    <Cartao>
      <form onSubmit={responder} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Sua resposta ao cidadão</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} maxLength={5000} required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base" />
        </label>
        <Aviso tipo="info">O cidadão será avisado. O aviso some em 24 horas, mas a resposta fica no protocolo. A resposta não pode ser alterada depois.</Aviso>
        {erro && <Aviso>{erro}</Aviso>}
        <Botao type="submit" carregando={ocupado}>Enviar resposta</Botao>
      </form>
    </Cartao>
  );
}

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { docM } from "../lib/municipio";
import { mensagemDeErro } from "../lib/erros";
import { TIPOS, type Estatisticas } from "../lib/types";
import { Aviso, Cartao, Carregando, dataBR } from "./ui";

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <Cartao className="text-center">
      <p className={`text-3xl font-bold ${destaque ? "text-red-700" : "text-brand"}`}>{valor}</p>
      <p className="text-sm text-slate-700">{rotulo}</p>
    </Cartao>
  );
}

function Barras({ titulo, itens }: { titulo: string; itens: [string, number][] }) {
  const max = Math.max(1, ...itens.map(([, v]) => v));
  return (
    <Cartao className="space-y-2">
      <h3 className="font-semibold">{titulo}</h3>
      {itens.length === 0 && <p className="text-sm text-slate-600">Sem dados.</p>}
      <ul className="space-y-2">
        {itens.map(([nome, v]) => (
          <li key={nome} className="text-sm">
            <div className="flex justify-between gap-2"><span className="truncate">{nome}</span><span className="font-semibold tabular-nums">{v}</span></div>
            <div className="h-2 rounded bg-slate-100" role="presentation"><div className="h-2 rounded bg-brand" style={{ width: `${(v / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

// Visão do prefeito: só números agregados. Nenhum dado pessoal, nenhuma conversa.
export function PainelPrefeito() {
  const [e, setE] = useState<Estatisticas | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  useEffect(() => onSnapshot(docM("estatisticas", "atual"),
    (s) => setE(s.exists() ? (s.data() as Estatisticas) : null),
    (err) => { setErro(mensagemDeErro(err)); setE(null); }), []);

  if (e === undefined) return <Carregando />;
  if (!e) return <div className="space-y-3"><h2 className="text-lg font-semibold">Painel do prefeito</h2>{erro && <Aviso>{erro}</Aviso>}
    <Aviso tipo="info">Ainda não há números publicados. A Ouvidoria publica o resumo ao abrir o painel dela.</Aviso></div>;

  const secs = Object.entries(e.porSecretaria).sort((a, b) => b[1].total - a[1].total);
  const meses = Object.entries(e.porMes).sort((a, b) => a[0].localeCompare(b[0]));
  const concl = e.porStatus.concluido ?? 0;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Painel do prefeito</h2>
      <p className="text-sm text-slate-700">Somente números, sem dados pessoais. Atualizado em {dataBR(e.geradoEm)}.</p>
      <div className="grid grid-cols-2 gap-3">
        <Numero rotulo="Manifestações" valor={e.total} />
        <Numero rotulo="Sem resposta e vencidas" valor={e.vencidas} destaque={e.vencidas > 0} />
        <Numero rotulo="Respondidas no prazo" valor={`${e.dentroPrazoPct}%`} />
        <Numero rotulo="Tempo médio de resposta" valor={`${String(e.tempoMedioRespostaDias).replace(".", ",")} dias`} />
        <Numero rotulo="Concluídas" valor={concl} />
        <Numero rotulo={`Satisfação (${e.avaliacoes} nota${e.avaliacoes === 1 ? "" : "s"})`} valor={e.avaliacoes ? `${String(e.notaMedia).replace(".", ",")} / 5` : "—"} />
      </div>
      <Barras titulo="Por tipo" itens={Object.entries(e.porTipo).map(([k, v]) => [TIPOS[k as keyof typeof TIPOS] ?? k, v] as [string, number]).sort((a, b) => b[1] - a[1])} />
      <Barras titulo="Por secretaria" itens={secs.map(([n, c]) => [n, c.total] as [string, number])} />
      <Cartao className="space-y-2">
        <h3 className="font-semibold">Secretarias com prazo vencido</h3>
        {secs.filter(([, c]) => c.vencidas > 0).length === 0 && <p className="text-sm text-slate-600">Nenhuma.</p>}
        <ul className="text-sm">{secs.filter(([, c]) => c.vencidas > 0).sort((a, b) => b[1].vencidas - a[1].vencidas).map(([n, c]) => (
          <li key={n} className="flex justify-between gap-2 border-b py-1 last:border-0"><span className="truncate">{n}</span><span className="font-semibold text-red-700">{c.vencidas}</span></li>))}</ul>
      </Cartao>
      <Barras titulo="Evolução por mês" itens={meses.map(([m, v]) => [`${m.slice(5)}/${m.slice(0, 4)}`, v] as [string, number])} />
    </div>
  );
}

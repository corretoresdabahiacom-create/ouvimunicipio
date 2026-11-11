import { useState } from "react";
import {
  collection, getCountFromServer, getDocs, limit, orderBy, query, startAfter, Timestamp, where, type Query, type QueryDocumentSnapshot, type QuerySnapshot,
} from "firebase/firestore";
import { Download, RefreshCw } from "lucide-react";
import { db } from "../lib/firebase";
import { mensagemDeErro } from "../lib/erros";
import { TIPOS, type Secretaria } from "../lib/types";
import { Aviso, Botao, Cartao, Carregando } from "./ui";

type Auditar = (acao: string, alvo: string, detalhe?: string) => Promise<void>;
const DIA = 86_400_000;

// ---------- download no navegador (nada é salvo em servidor) ----------
function celula(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita fórmulas no Excel
  return `"${s.replace(/"/g, '""')}"`;
}
export function baixarCSV(nome: string, linhas: unknown[][]) {
  const texto = "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
  baixar(nome, new Blob([texto], { type: "text/csv;charset=utf-8" }));
}
function baixar(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const dt = (t: { toDate?: () => Date } | null | undefined) => t?.toDate ? t.toDate().toLocaleString("pt-BR") : "";
const hoje = () => new Date().toISOString().slice(0, 10);

// ======================= INDICADORES =======================
interface Linha { nome: string; total: number; abertos: number; vencendo: number; vencidos: number; tempoMedio: number | null; nota: number | null; notas: number }
interface Resumo { total: number; abertos: number; respondidos: number; concluidos: number; linhas: Linha[]; amostra: number; atualizado: Date }

export function Indicadores({ secretarias }: { secretarias: Secretaria[] }) {
  const [r, setR] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function atualizar() {
    setCarregando(true); setErro("");
    try {
      const col = collection(db, "protocolos");
      const cont = async (...c: ReturnType<typeof where>[]) => (await getCountFromServer(query(col, ...c))).data().count;
      const [total, abertos, respondidos, concluidos, ab, rec] = await Promise.all([
        cont(), cont(where("status", "==", "aberto")), cont(where("status", "==", "respondido")), cont(where("status", "==", "concluido")),
        getDocs(query(col, where("status", "==", "aberto"), limit(1000))),
        getDocs(query(col, orderBy("criadoEm", "desc"), limit(500))),
      ]);

      const agora = Date.now();
      const linhas = new Map<string, Linha & { soma: number; n: number; somaNota: number }>();
      const get = (id: string, nome: string) => {
        if (!linhas.has(id)) linhas.set(id, { nome, total: 0, abertos: 0, vencendo: 0, vencidos: 0, tempoMedio: null, nota: null, notas: 0, soma: 0, n: 0, somaNota: 0 });
        return linhas.get(id)!;
      };
      secretarias.forEach((s) => get(s.id, s.nome));

      ab.forEach((d) => {
        const l = get(d.get("secretariaId"), d.get("secretariaNome") ?? "—");
        l.abertos++;
        const c = d.get("criadoEm")?.toMillis?.() as number | undefined;
        if (c) { const dias = Math.ceil((c + (30 + (d.get("prorrogadoEm") ? 30 : 0)) * DIA - agora) / DIA); if (dias < 0) l.vencidos++; else if (dias <= 5) l.vencendo++; }
      });
      rec.forEach((d) => {
        const l = get(d.get("secretariaId"), d.get("secretariaNome") ?? "—");
        l.total++;
        const c = d.get("criadoEm")?.toMillis?.() as number | undefined;
        const resp = d.get("respondidoEm")?.toMillis?.() as number | undefined;
        if (c && resp) { l.soma += (resp - c) / DIA; l.n++; }
        const nota = d.get("avaliacao") as number | undefined;
        if (nota) { l.somaNota += nota; l.notas++; }
      });
      const saida: Linha[] = [...linhas.values()].map((l) => ({
        nome: l.nome, total: l.total, abertos: l.abertos, vencendo: l.vencendo, vencidos: l.vencidos,
        tempoMedio: l.n ? l.soma / l.n : null, nota: l.notas ? l.somaNota / l.notas : null, notas: l.notas,
      })).sort((a, b) => b.abertos - a.abertos || a.nome.localeCompare(b.nome));
      setR({ total, abertos, respondidos, concluidos, linhas: saida, amostra: rec.size, atualizado: new Date() });
    } catch (e) { setErro(mensagemDeErro(e)); }
    finally { setCarregando(false); }
  }

  const maxTotal = Math.max(1, ...(r?.linhas.map((l) => l.abertos + l.total) ?? [1]));
  return (
    <div className="space-y-3">
      <Cartao className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">Os indicadores usam somente os dados do protocolo (sem textos nem nomes). Cada atualização lê até 1.500 registros da cota gratuita.</p>
        <Botao onClick={atualizar} carregando={carregando}><RefreshCw className="size-4" aria-hidden /> {r ? "Atualizar" : "Calcular indicadores"}</Botao>
      </Cartao>
      {erro && <Aviso>{erro}</Aviso>}
      {carregando && !r && <Carregando />}
      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([["Total", r.total, "text-brand"], ["Em análise", r.abertos, "text-amber-800"], ["Respondidos", r.respondidos, "text-emerald-800"], ["Concluídos", r.concluidos, "text-slate-800"]] as const).map(([t, v, cor]) => (
              <Cartao key={t} className="text-center"><p className={`text-3xl font-bold ${cor}`}>{v}</p><p className="text-sm text-slate-700">{t}</p></Cartao>
            ))}
          </div>
          <Cartao className="overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="p-3 text-left text-xs text-slate-600">Por secretaria. Tempo médio e nota consideram os {r.amostra} protocolos mais recentes. Atualizado às {r.atualizado.toLocaleTimeString("pt-BR")}.</caption>
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
                <tr><th className="px-3 py-2">Secretaria</th><th className="px-3 py-2">Em análise</th><th className="px-3 py-2">Vencem em ≤ 5 dias</th><th className="px-3 py-2">Vencidos</th><th className="px-3 py-2">Tempo médio de resposta</th><th className="px-3 py-2">Nota média</th></tr>
              </thead>
              <tbody className="divide-y">
                {r.linhas.map((l) => (
                  <tr key={l.nome}>
                    <td className="px-3 py-2 font-medium">{l.nome}
                      <div className="mt-1 h-1.5 w-full rounded bg-slate-100" aria-hidden><div className="h-1.5 rounded bg-brand" style={{ width: `${((l.abertos + l.total) / maxTotal) * 100}%` }} /></div></td>
                    <td className="px-3 py-2">{l.abertos}</td>
                    <td className={`px-3 py-2 ${l.vencendo ? "font-semibold text-amber-800" : ""}`}>{l.vencendo}</td>
                    <td className={`px-3 py-2 ${l.vencidos ? "font-semibold text-red-800" : ""}`}>{l.vencidos}</td>
                    <td className="px-3 py-2">{l.tempoMedio === null ? "—" : `${l.tempoMedio.toFixed(1)} dias`}</td>
                    <td className="px-3 py-2">{l.nota === null ? "—" : `${l.nota.toFixed(1)} (${l.notas})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Cartao>
        </>
      )}
    </div>
  );
}

// ======================= RELATÓRIOS / BACKUP =======================
export function Relatorios({ auditar }: { auditar: Auditar }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  async function paginar(maximo: number, montar: (c: QueryDocumentSnapshot | null) => Query): Promise<QueryDocumentSnapshot[]> {
    const out: QueryDocumentSnapshot[] = [];
    let cursor: QueryDocumentSnapshot | null = null;
    while (out.length < maximo) {
      const snap: QuerySnapshot = await getDocs(montar(cursor));
      out.push(...snap.docs);
      cursor = snap.docs[snap.docs.length - 1] ?? null;
      if (snap.docs.length < 500) break;
    }
    return out;
  }

  async function exportarProtocolos() {
    setOcupado("protocolos"); setErro(""); setMsg("");
    try {
      const f: ReturnType<typeof where>[] = [];
      if (de) f.push(where("criadoEm", ">=", Timestamp.fromDate(new Date(`${de}T00:00:00`))));
      if (ate) f.push(where("criadoEm", "<=", Timestamp.fromDate(new Date(`${ate}T23:59:59`))));
      const docs = await paginar(5000, (c) =>
        query(collection(db, "protocolos"), ...f, orderBy("criadoEm", "desc"), ...(c ? [startAfter(c)] : []), limit(500)));
      const linhas: unknown[][] = [["Protocolo", "Tipo", "Secretaria", "Situação", "Criado em", "Respondido em", "Concluído em", "Dias até a resposta", "Nota"]];
      docs.forEach((d) => {
        const c = d.get("criadoEm")?.toMillis?.(), r = d.get("respondidoEm")?.toMillis?.();
        linhas.push([d.id, TIPOS[d.get("tipo") as keyof typeof TIPOS] ?? "", d.get("secretariaNome"), d.get("status"), dt(d.get("criadoEm")), dt(d.get("respondidoEm")), dt(d.get("concluidoEm")),
          c && r ? ((r - c) / DIA).toFixed(1).replace(".", ",") : "", d.get("avaliacao") ?? ""]);
      });
      baixarCSV(`protocolos-${hoje()}.csv`, linhas);
      setMsg(`${docs.length} protocolos exportados. O arquivo foi criado no seu navegador; nada ficou salvo no servidor.`);
      await auditar("exportacao.csv", "protocolos", `${docs.length} linhas`);
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(""); }
  }

  async function exportarUsuarios() {
    if (!confirm("O arquivo terá nome, e-mail e telefone dos usuários (dados pessoais). Guarde-o com cuidado e apague quando não precisar mais. Continuar?")) return;
    setOcupado("usuarios"); setErro(""); setMsg("");
    try {
      const docs = await paginar(5000, (c) =>
        query(collection(db, "users"), orderBy("criadoEm", "desc"), ...(c ? [startAfter(c)] : []), limit(500)));
      const linhas: unknown[][] = [["Nome", "E-mail", "Telefone", "Situação", "Cadastro em"]];
      docs.forEach((d) => linhas.push([d.get("nome"), d.get("email"), d.get("telefone") ?? "", d.get("situacao") ?? "ativo", dt(d.get("criadoEm"))]));
      baixarCSV(`usuarios-${hoje()}.csv`, linhas);
      setMsg(`${docs.length} usuários exportados. O arquivo foi criado no seu navegador; nada ficou salvo no servidor.`);
      await auditar("exportacao.csv", "usuários", `${docs.length} linhas`);
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(""); }
  }

  async function backupConfig() {
    setOcupado("config"); setErro(""); setMsg("");
    try {
      const ler = async (n: string) => (await getDocs(collection(db, n))).docs.map((d) => ({ id: d.id, ...d.data() }));
      const [secretarias, equipe, config, anuncios] = await Promise.all([ler("secretarias"), ler("equipe"), ler("config"), ler("anuncios")]);
      const json = JSON.stringify({ geradoEm: new Date().toISOString(), secretarias, equipe, config, anuncios }, (_k, v) => (v && typeof v === "object" && typeof v.toDate === "function" ? v.toDate().toISOString() : v), 2);
      baixar(`backup-configuracao-${hoje()}.json`, new Blob([json], { type: "application/json" }));
      setMsg("Backup da configuração baixado (secretarias, servidores, aparência e anúncios).");
      await auditar("backup.config", "configuração", `${secretarias.length} secretarias, ${equipe.length} servidores, ${anuncios.length} anúncios`);
    } catch (e) { setErro(mensagemDeErro(e)); } finally { setOcupado(""); }
  }

  return (
    <div className="space-y-3">
      {erro && <Aviso>{erro}</Aviso>}
      {msg && <Aviso tipo="ok">{msg}</Aviso>}
      <Cartao className="space-y-3">
        <h3 className="font-semibold">Protocolos (CSV)</h3>
        <p className="text-sm text-slate-700">Número, tipo, secretaria, situação, datas e nota. <b>Sem nomes, e-mails ou textos das conversas.</b></p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">De <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="rounded-lg border px-2 py-1.5" /></label>
          <label className="text-sm">Até <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="rounded-lg border px-2 py-1.5" /></label>
          <Botao onClick={exportarProtocolos} carregando={ocupado === "protocolos"}><Download className="size-4" aria-hidden /> Baixar CSV</Botao>
        </div>
      </Cartao>
      <Cartao className="space-y-3">
        <h3 className="font-semibold">Usuários (CSV)</h3>
        <p className="text-sm text-slate-700">Nome, e-mail, telefone, situação e data de cadastro (até 5.000). Contém dados pessoais: use só quando necessário.</p>
        <Botao onClick={exportarUsuarios} carregando={ocupado === "usuarios"}><Download className="size-4" aria-hidden /> Baixar CSV</Botao>
      </Cartao>
      <Cartao className="space-y-3">
        <h3 className="font-semibold">Backup da configuração (JSON)</h3>
        <p className="text-sm text-slate-700">Secretarias, servidores, aparência e anúncios. Baixe de tempos em tempos e guarde em local seguro.</p>
        <Botao onClick={backupConfig} carregando={ocupado === "config"}><Download className="size-4" aria-hidden /> Baixar backup</Botao>
      </Cartao>
      <Aviso tipo="info">Sobre cópias de segurança: no plano gratuito o Firebase não faz backup automático do banco. As conversas ficam fora do alcance do administrador por sigilo, então não entram nestes arquivos. Os arquivos são gerados no seu navegador e não ficam guardados no servidor.</Aviso>
    </div>
  );
}

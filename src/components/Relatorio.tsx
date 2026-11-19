import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useSite } from "../lib/useConfig";
import { calcularEstatisticas } from "../lib/estatisticas";
import { relatorioCsv } from "../lib/relatorioCsv";
import { TIPOS, type Protocolo } from "../lib/types";
import { Aviso, Botao, Cartao } from "./ui";

// Relatório de gestão da Ouvidoria (Lei nº 13.460/2017): número de manifestações, motivos, análise dos pontos
// recorrentes e providências adotadas. Calculado no navegador a partir dos DADOS DOS PROTOCOLOS (tipo, secretaria,
// datas, nota). Nenhum nome, e-mail ou texto de conversa entra no documento.

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const num = (n: number) => String(n).replace(".", ",");

function linhas(pares: [string, string | number][]) {
  return pares.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="n">${esc(String(b))}</td></tr>`).join("");
}

export function RelatorioGestao({ lista, limiteAtingido, responsavel }: { lista: Protocolo[]; limiteAtingido: boolean; responsavel: string }) {
  const site = useSite();
  const anos = useMemo(() => {
    const s = new Set(lista.map((p) => p.criadoEm?.toDate?.().getFullYear()).filter((a): a is number => !!a));
    s.add(new Date().getFullYear());
    return [...s].sort((a, b) => b - a);
  }, [lista]);
  const [ano, setAno] = useState(anos[0]);
  const [mes, setMes] = useState(0); // 0 = ano inteiro
  const [analise, setAnalise] = useState("");
  const [providencias, setProvidencias] = useState("");
  const [erro, setErro] = useState("");

  const doPeriodo = useMemo(() => lista.filter((p) => {
    const d = p.criadoEm?.toDate?.();
    return d && d.getFullYear() === ano && (!mes || d.getMonth() + 1 === mes);
  }), [lista, ano, mes]);

  function baixarCsv() {
    setErro("");
    const periodo = mes ? `${MESES[mes - 1]} de ${ano}` : `Ano de ${ano}`;
    const csv = relatorioCsv(calcularEstatisticas(doPeriodo), site.nome, periodo, {
      prorrogadas: doPeriodo.filter((p) => p.prorrogadoEm).length,
      encaminhadas: doPeriodo.filter((p) => (p.encaminhamentos ?? 0) > 0).length,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-ouvidoria-${ano}${mes ? `-${String(mes).padStart(2, "0")}` : ""}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function gerar() {
    setErro("");
    const e = calcularEstatisticas(doPeriodo);
    const periodo = mes ? `${MESES[mes - 1]} de ${ano}` : `Ano de ${ano}`;
    const prorrogadas = doPeriodo.filter((p) => p.prorrogadoEm).length;
    const encaminhadas = doPeriodo.filter((p) => (p.encaminhamentos ?? 0) > 0).length;
    const tipos = Object.entries(e.porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => [TIPOS[k as keyof typeof TIPOS] ?? k, v] as [string, number]);
    const secs = Object.entries(e.porSecretaria).sort((a, b) => b[1].total - a[1].total);
    const meses = Object.entries(e.porMes).sort((a, b) => a[0].localeCompare(b[0]));
    const situacao: [string, number][] = [["Aguardando 1ª resposta", e.porStatus.aberto ?? 0], ["Respondidas", e.porStatus.respondido ?? 0], ["Concluídas", e.porStatus.concluido ?? 0]];
    const texto = (t: string) => t.trim() ? `<p class="livre">${esc(t.trim())}</p>` : `<p class="vazio">(não preenchido)</p>`;

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de gestão da Ouvidoria – ${esc(periodo)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;line-height:1.45;font-size:13px}
  h1{font-size:20px;margin:0}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
  .topo{display:flex;gap:14px;align-items:center;margin-bottom:6px}.topo img{width:56px;height:56px;object-fit:contain}
  .meta{color:#444;font-size:12px}table{border-collapse:collapse;width:100%;margin-top:4px}
  td,th{border:1px solid #bbb;padding:4px 8px;text-align:left}th{background:#eee}.n{text-align:right;width:120px}
  .grade{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.cx{border:1px solid #bbb;padding:8px}.cx b{display:block;font-size:18px}
  .livre{white-space:pre-wrap;border:1px solid #ddd;padding:8px}.vazio{color:#777;font-style:italic}
  .rodape{margin-top:28px;color:#555;font-size:11px}@media print{body{margin:12mm}h2{break-after:avoid}table{break-inside:avoid}}
</style></head><body>
<div class="topo">${site.logo ? `<img src="${esc(site.logo)}" alt="">` : ""}<div><h1>Relatório de gestão da Ouvidoria</h1>
<div class="meta">${esc(site.nome)} · ${esc(periodo)} · gerado em ${esc(new Date().toLocaleString("pt-BR"))}${responsavel ? ` por ${esc(responsavel)}` : ""}</div></div></div>

<h2>1. Manifestações recebidas</h2>
<div class="grade">
  <div class="cx"><b>${e.total}</b>manifestações</div>
  <div class="cx"><b>${e.dentroPrazoPct}%</b>respondidas no prazo</div>
  <div class="cx"><b>${num(e.tempoMedioRespostaDias)} dias</b>tempo médio da 1ª resposta</div>
  <div class="cx"><b>${e.vencidas}</b>sem resposta e com prazo vencido</div>
  <div class="cx"><b>${prorrogadas}</b>prazos prorrogados</div>
  <div class="cx"><b>${e.avaliacoes ? `${num(e.notaMedia)} / 5` : "—"}</b>satisfação (${e.avaliacoes} nota${e.avaliacoes === 1 ? "" : "s"})</div>
</div>
<table><tr><th>Situação</th><th class="n">Quantidade</th></tr>${linhas(situacao)}</table>

<h2>2. Motivos das manifestações</h2>
<table><tr><th>Tipo</th><th class="n">Quantidade</th></tr>${tipos.length ? linhas(tipos) : `<tr><td colspan="2">Nenhuma manifestação no período.</td></tr>`}</table>
<table><tr><th>Secretaria</th><th class="n">Total</th><th class="n">Concluídas</th><th class="n">Vencidas</th></tr>
${secs.map(([n, c]) => `<tr><td>${esc(n)}</td><td class="n">${c.total}</td><td class="n">${c.concluidas}</td><td class="n">${c.vencidas}</td></tr>`).join("") || `<tr><td colspan="4">—</td></tr>`}</table>
<p class="meta">${encaminhadas} manifestação(ões) foram encaminhadas pela Ouvidoria a outra secretaria.</p>
${meses.length > 1 ? `<table><tr><th>Mês</th><th class="n">Manifestações</th></tr>${linhas(meses.map(([m, v]) => [`${m.slice(5)}/${m.slice(0, 4)}`, v]))}</table>` : ""}

<h2>3. Análise dos pontos recorrentes</h2>${texto(analise)}
<h2>4. Providências adotadas pela administração</h2>${texto(providencias)}

<p class="rodape">Documento gerado pelo sistema de Ouvidoria a partir dos dados dos protocolos (tipo, secretaria, datas e nota).
Não contém nomes, contatos nem o conteúdo das mensagens dos cidadãos.${limiteAtingido ? " Atenção: foram considerados apenas os 1.000 protocolos mais recentes." : ""}</p>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) return setErro("O navegador bloqueou a nova janela. Permita pop-ups para este site e tente de novo.");
    w.document.open(); w.document.write(html); w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const sel = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  return (
    <Cartao className="space-y-3">
      <h3 className="flex items-center gap-2 font-semibold"><FileText className="size-5" aria-hidden /> Relatório de gestão (PDF)</h3>
      <p className="text-sm text-slate-700">Número de manifestações, motivos, prazos e satisfação do período, mais a sua análise e as providências.
        O relatório não traz nomes nem conteúdo das conversas. Na janela que abrir, escolha <b>Salvar como PDF</b>.</p>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Ano" value={ano} onChange={(e) => setAno(Number(e.target.value))} className={sel}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <select aria-label="Mês" value={mes} onChange={(e) => setMes(Number(e.target.value))} className={sel}>
          <option value={0}>Ano inteiro</option>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        <span className="self-center text-sm text-slate-700">{doPeriodo.length} manifestação(ões) no período</span>
      </div>
      <label className="block"><span className="mb-1 block text-sm font-medium">Análise dos pontos recorrentes</span>
        <textarea value={analise} onChange={(e) => setAnalise(e.target.value)} rows={4} maxLength={3000} className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
          placeholder="Ex.: a maioria das reclamações da Saúde trata de demora na marcação de consultas…" /></label>
      <label className="block"><span className="mb-1 block text-sm font-medium">Providências adotadas pela administração</span>
        <textarea value={providencias} onChange={(e) => setProvidencias(e.target.value)} rows={4} maxLength={3000} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
      {limiteAtingido && <Aviso tipo="info">O painel carrega os 1.000 protocolos mais recentes; períodos mais antigos podem ficar incompletos.</Aviso>}
      {erro && <Aviso>{erro}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Botao onClick={gerar}><FileText className="size-4" aria-hidden /> Gerar relatório</Botao>
        <Botao variante="secundario" onClick={baixarCsv}><FileSpreadsheet className="size-4" aria-hidden /> Baixar planilha (CSV)</Botao>
      </div>
      <p className="text-xs text-slate-600">Os textos acima não são salvos: copie-os antes de sair, se quiser reaproveitar.</p>
    </Cartao>
  );
}

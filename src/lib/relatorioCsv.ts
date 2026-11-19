import { TIPOS } from "./types";
import type { Resumo } from "./estatisticas";

// Planilha (CSV para Excel/Google Planilhas) do relatório de gestão. SÓ NÚMEROS: sem nomes, e-mails nem textos de conversa.
// Separador ";" e vírgula decimal (padrão do Excel em português) e BOM para os acentos abrirem certo.
const campo = (v: string | number) => {
  let t = String(v).replace(".", typeof v === "number" ? "," : ".");
  if (/^[=+\-@\t\r]/.test(t) && typeof v === "string") t = `'${t}`; // evita fórmula em planilha (nome de secretaria começando por "=")
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const linha = (...c: (string | number)[]) => c.map(campo).join(";");

export function relatorioCsv(e: Resumo, orgao: string, periodo: string, extra: { prorrogadas: number; encaminhadas: number }): string {
  const L: string[] = [];
  L.push(linha("Relatório de gestão da Ouvidoria"), linha("Órgão", orgao), linha("Período", periodo), "");
  L.push(linha("Indicador", "Valor"));
  L.push(linha("Manifestações", e.total), linha("Respondidas no prazo (%)", e.dentroPrazoPct), linha("Tempo médio da 1ª resposta (dias)", e.tempoMedioRespostaDias));
  L.push(linha("Sem resposta e com prazo vencido", e.vencidas), linha("Prazos prorrogados", extra.prorrogadas), linha("Encaminhadas a outra secretaria", extra.encaminhadas));
  L.push(linha("Nota média (1 a 5)", e.avaliacoes ? e.notaMedia : "—"), linha("Avaliações recebidas", e.avaliacoes), "");
  L.push(linha("Tipo", "Quantidade"));
  for (const [k, v] of Object.entries(e.porTipo).sort((a, b) => b[1] - a[1])) L.push(linha(TIPOS[k as keyof typeof TIPOS] ?? k, v));
  L.push("", linha("Secretaria", "Total", "Concluídas", "Vencidas"));
  for (const [k, c] of Object.entries(e.porSecretaria).sort((a, b) => b[1].total - a[1].total)) L.push(linha(k, c.total, c.concluidas, c.vencidas));
  L.push("", linha("Mês", "Manifestações"));
  for (const [m, v] of Object.entries(e.porMes).sort((a, b) => a[0].localeCompare(b[0]))) L.push(linha(`${m.slice(5)}/${m.slice(0, 4)}`, v));
  return "﻿" + L.join("\r\n") + "\r\n";
}

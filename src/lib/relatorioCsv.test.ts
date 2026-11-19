import { describe, expect, test } from "vitest";
import { relatorioCsv } from "./relatorioCsv";
import type { Resumo } from "./estatisticas";

const base: Resumo = {
  total: 12, porStatus: { aberto: 3 }, porTipo: { reclamacao: 8, elogio: 4 },
  porSecretaria: { "Saúde": { total: 9, vencidas: 1, concluidas: 5 }, "=SOMA(A1)": { total: 3, vencidas: 0, concluidas: 3 } },
  porMes: { "2026-10": 5, "2026-09": 7 }, vencidas: 1, tempoMedioRespostaDias: 4.5, dentroPrazoPct: 90, notaMedia: 4.2, avaliacoes: 3,
};

describe("planilha do relatório", () => {
  const csv = relatorioCsv(base, "Prefeitura de X", "Ano de 2026", { prorrogadas: 2, encaminhadas: 1 });
  test("começa com BOM, usa ; e vírgula decimal", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Tempo médio da 1ª resposta (dias);4,5");
    expect(csv).toContain("Prazos prorrogados;2");
  });
  test("traz tipos, secretarias e meses em ordem", () => {
    expect(csv).toMatch(/Reclamação;8/);
    expect(csv).toContain("Saúde;9;5;1");
    expect(csv.indexOf("09/2026")).toBeLessThan(csv.indexOf("10/2026"));
  });
  test("nome de secretaria que parece fórmula é neutralizado", () => {
    expect(csv).toContain("'=SOMA(A1);3;3;0");
    expect(csv).not.toMatch(/(^|\r\n)=SOMA/);
  });
  test("não contém e-mails", () => { expect(csv).not.toMatch(/@/); });
});

import test from "node:test";
import assert from "node:assert/strict";
import { ANOS_PADRAO, anosValidos, limiteRetencao } from "./retencao-regras.mjs";

const T = (s) => Date.parse(s);
test("o limite é exatamente N anos antes de agora", () => {
  assert.equal(limiteRetencao(T("2031-11-18T00:00:00Z"), 5), T("2026-11-18T00:00:00Z"));
  assert.equal(ANOS_PADRAO, 5);
});
test("protocolo concluído há menos de 5 anos fica; há mais de 5 anos entra na retenção", () => {
  const corte = limiteRetencao(T("2031-11-18T00:00:00Z"));
  assert.ok(T("2027-01-01T00:00:00Z") > corte);   // 4 anos e pouco: fica
  assert.ok(T("2026-01-01T00:00:00Z") < corte);   // mais de 5 anos: apagável
});
test("--anos só aceita inteiros de 1 a 30", () => {
  assert.equal(anosValidos("3"), 3);
  for (const ruim of ["0", "31", "2.5", "abc", undefined, ""]) assert.equal(anosValidos(ruim), null);
});

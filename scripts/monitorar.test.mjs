import test from "node:test";
import assert from "node:assert/strict";
import { avaliar } from "./monitorar-regras.mjs";

test("falha só quando uma verificação falhou", () => {
  assert.deepEqual(avaliar([{ nome: "a", ok: true, ms: 10 }, { nome: "b", ok: false, ms: 10 }]).falhas, ["b"]);
  assert.deepEqual(avaliar([{ nome: "a", ok: true, ms: 10 }]).falhas, []);
});
test("lentidão e e-mail sem configurar viram aviso, não falha", () => {
  const r = avaliar([{ nome: "a", ok: true, ms: 9000 }, { nome: "f", ok: true, ms: 5, detalhe: "e-mail NÃO configurado (RESEND_API_KEY)" }], 5000);
  assert.equal(r.falhas.length, 0);
  assert.equal(r.avisos.length, 2);
});

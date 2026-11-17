import { test } from "node:test";
import assert from "node:assert/strict";
import { DIA, montarAlertas, montarEmail, nivelPrazo } from "./prazos.mjs";

const agora = Date.UTC(2026, 10, 17, 11, 0);
const criado = (diasAtras) => agora - diasAtras * DIA;
const P = (numero, diasAtras, extra = {}) => ({ numero, secretariaId: "saude", secretariaNome: "Saúde", tipo: "reclamacao", status: "aberto", criadoEm: criado(diasAtras), ...extra });

test("níveis de prazo iguais aos do app", () => {
  assert.equal(nivelPrazo(P("a", 31), agora), "vencido");
  assert.equal(nivelPrazo(P("a", 29.5), agora), "hoje");
  assert.equal(nivelPrazo(P("a", 28.5), agora), "dois");
  assert.equal(nivelPrazo(P("a", 26), agora), "cinco");
  assert.equal(nivelPrazo(P("a", 21), agora), "dez");
  assert.equal(nivelPrazo(P("a", 1), agora), "ok");
  assert.equal(nivelPrazo(P("a", 40, { prorrogadoEm: criado(20) }), agora), "ok"); // prorrogado: 60 dias
});

test("cada servidor recebe só a própria secretaria; ouvidor recebe só os graves; inativos e prefeito nada", () => {
  const protocolos = [P("OUV-1", 35), P("OUV-2", 26), P("OUV-3", 1), P("OUV-4", 31, { secretariaId: "obras", secretariaNome: "Obras" }),
    P("OUV-5", 40, { status: "respondido" })];
  const equipe = [
    { email: "sam@x", nome: "Sam", papel: "secretario", secretariaId: "saude", ativo: true },
    { email: "ari@x", nome: "Ari", papel: "assessor", secretariaId: "saude", ativo: false },
    { email: "sol@x", nome: "Sol", papel: "secretario", secretariaId: "obras", ativo: true },
    { email: "edu@x", nome: "Edu", papel: "secretario", secretariaId: "educacao", ativo: true },
    { email: "olga@x", nome: "Olga", papel: "ouvidor", ativo: true },
    { email: "pedro@x", nome: "Pedro", papel: "prefeito", ativo: true },
  ];
  const e = montarAlertas(protocolos, equipe, agora);
  const por = Object.fromEntries(e.map((x) => [x.para, x.itens.map((i) => i.numero)]));
  assert.deepEqual(por, { "sam@x": ["OUV-1", "OUV-2"], "sol@x": ["OUV-4"], "olga@x": ["OUV-1", "OUV-4"] });
});

test("e-mail não traz conteúdo e escapa HTML", () => {
  const envio = { para: "sam@x", nome: "Sam <b>", papel: "secretario", itens: [{ numero: "OUV-1", tipo: "Reclamação", secretaria: "Saúde", prazo: "01/11/2026", situacao: "VENCIDO há 2 dia(s)", vencido: true }] };
  const m = montarEmail(envio, "Itabuna", "https://x/itabuna");
  assert.match(m.assunto, /\[Ouvidoria Itabuna\] 1 protocolo\(s\)/);
  assert.ok(m.html.includes("Sam &lt;b&gt;"));
  assert.ok(m.texto.includes("OUV-1"));
});

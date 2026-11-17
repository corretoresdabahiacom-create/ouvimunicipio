// Testes das regras de segurança do Firestore (firestore.rules).
// Rodam no emulador local: nunca tocam no banco real. Veja rules-tests/LEIA-ME.md.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, test } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch, type WriteBatch } from "firebase/firestore";

let env: RulesTestEnvironment;
type Db = ReturnType<ReturnType<RulesTestEnvironment["authenticatedContext"]>["firestore"]>;

const DIA = 86_400_000;
const NUM = "OUV-2026-ABCD1234";

// ---------- pessoas ----------
const ana = () => env.authenticatedContext("ana", { email: "ana@x.com", email_verified: true }).firestore();       // cidadã (autora)
const beto = () => env.authenticatedContext("beto", { email: "beto@x.com", email_verified: true }).firestore();    // outro cidadão
const sam = () => env.authenticatedContext("sam", { email: "sam@x.com", email_verified: true }).firestore();       // secretário da Saúde
const sol = () => env.authenticatedContext("sol", { email: "sol@x.com", email_verified: true }).firestore();       // secretário de Obras
const adm = () => env.authenticatedContext("adm", { email: "adm@x.com", email_verified: true }).firestore();       // administrador
const olga = () => env.authenticatedContext("olga", { email: "olga@x.com", email_verified: true }).firestore();     // ouvidora geral
const pedro = () => env.authenticatedContext("pedro", { email: "pedro@x.com", email_verified: true }).firestore();   // prefeito
const dono = () => env.authenticatedContext("dono", { email: "dono@x.com", email_verified: true }).firestore();     // SUPERADMIN
const semConfirmar = () => env.authenticatedContext("ana", { email: "ana@x.com", email_verified: false }).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

const perfil = (nome: string, email: string, extra: Record<string, unknown> = {}) =>
  ({ nome, email, situacao: "ativo", criadoEm: Timestamp.now(), aceiteVersao: "2026-10", aceiteEm: Timestamp.now(), ...extra });

async function semearBase() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "municipios/a"), { nome: "Município A", ativo: true, plano: "basico", criadoEm: Timestamp.now() });
    await setDoc(doc(db, "municipios/b"), { nome: "Município B", ativo: true, plano: "basico", criadoEm: Timestamp.now() });
    await setDoc(doc(db, "superadmins/dono@x.com"), { criadoEm: Timestamp.now() });
    await setDoc(doc(db, "municipios/a/users/ana"), perfil("Ana", "ana@x.com"));
    await setDoc(doc(db, "municipios/a/users/beto"), perfil("Beto", "beto@x.com"));
    await setDoc(doc(db, "municipios/a/users/sam"), perfil("Sam", "sam@x.com"));
    await setDoc(doc(db, "municipios/a/users/sol"), perfil("Sol", "sol@x.com"));
    await setDoc(doc(db, "municipios/a/users/adm"), perfil("Adm", "adm@x.com"));
    await setDoc(doc(db, "municipios/a/users/olga"), perfil("Olga", "olga@x.com"));
    await setDoc(doc(db, "municipios/a/users/pedro"), perfil("Pedro", "pedro@x.com"));
    await setDoc(doc(db, "municipios/a/secretarias/saude"), { nome: "Saúde", ativa: true });
    await setDoc(doc(db, "municipios/a/secretarias/obras"), { nome: "Obras", ativa: true });
    await setDoc(doc(db, "municipios/a/secretarias/velha"), { nome: "Velha", ativa: false });
    await setDoc(doc(db, "municipios/a/equipe/sam@x.com"), { nome: "Sam", papel: "secretario", secretariaId: "saude", ativo: true });
    await setDoc(doc(db, "municipios/a/equipe/sol@x.com"), { nome: "Sol", papel: "secretario", secretariaId: "obras", ativo: true });
    await setDoc(doc(db, "municipios/a/equipe/olga@x.com"), { nome: "Olga", papel: "ouvidor", ativo: true });
    await setDoc(doc(db, "municipios/a/equipe/pedro@x.com"), { nome: "Pedro", papel: "prefeito", ativo: true });
    await setDoc(doc(db, "municipios/a/equipe/adm@x.com"), { nome: "Adm", papel: "admin", ativo: true });
    await setDoc(doc(db, "municipios/a/config/site"), { nome: "Prefeitura", cor: "#0b3b8c", logo: "", atualizadoEm: Timestamp.now() });
    await setDoc(doc(db, "municipios/a/anuncios/a1"), { titulo: "Ativo", link: "", imagem: "data:image/png;base64,AAAA", ativo: true, ordem: 1, criadoEm: Timestamp.now() });
    await setDoc(doc(db, "municipios/a/anuncios/a2"), { titulo: "Inativo", link: "", imagem: "data:image/png;base64,AAAA", ativo: false, ordem: 2, criadoEm: Timestamp.now() });
  });
}

// Cria um protocolo já existente (como se tivesse sido registrado antes), com a 1ª mensagem e uma mídia.
async function semearProtocolo(extra: Record<string, unknown> = {}, opcoes: { semMensagem?: boolean } = {}) {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "municipios/a/protocolos", NUM), {
      numero: NUM, autorUid: "ana", secretariaId: "saude", secretariaNome: "Saúde", tipo: "reclamacao",
      status: "aberto", ultimaMsgPor: "cidadao", criadoEm: Timestamp.now(), ...extra,
    });
    if (!opcoes.semMensagem) {
      await setDoc(doc(db, "municipios/a/protocolos", NUM, "mensagens", "m00"), { de: "cidadao", autorUid: "ana", assunto: "Buraco na rua", texto: "Há um buraco grande.", anexos: [], criadoEm: Timestamp.now() });
      await setDoc(doc(db, "municipios/a/protocolos", NUM, "midias", "00_0_0"), { k: "00_0_0", mime: "image/jpeg", data: "AAAA" });
    }
  });
}
const respondido = { status: "respondido", ultimaMsgPor: "servidor", respondidoEm: Timestamp.now() };
const concluidoHa = (dias: number) => ({ ...respondido, status: "concluido", concluidoEm: Timestamp.fromMillis(Date.now() - dias * DIA) });

// Contador de envios (limite por conta). O app soma 1 no perfil, no MESMO lote de cada envio do cidadão.
//  previos: quantos envios o perfil já tinha na janela (0 = 1º envio, abre uma janela nova de 24 h)
//  novaJanela: força a abertura de uma janela nova; ref: referência do envio; sem: não registra o envio
type Contador = { previos?: number; novaJanela?: boolean; ref?: string; sem?: boolean };
function contar(b: WriteBatch, db: Db, uid: string, ref: string, c: Contador = {}) {
  if (c.sem) return;
  const previos = c.previos ?? 0;
  const nova = c.novaJanela ?? previos === 0;
  b.update(doc(db, "municipios/a/users", uid), nova
    ? { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: c.ref ?? ref }
    : { envios: previos + 1, ultimoEnvio: c.ref ?? ref });
}
async function semearContador(uid: string, envios: number, horasAtras: number) {
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), "municipios/a/users", uid), { envios, janelaEm: Timestamp.fromMillis(Date.now() - horasAtras * 3600_000), ultimoEnvio: "antigo" });
  });
}

// Mesmo lote que o app faz ao registrar uma manifestação.
function novoProtocolo(db: Db, numero: string, o: { uid?: string; secretariaId?: string; secretariaNome?: string; tipo?: string; anexos?: number; partes?: number; contador?: Contador } = {}) {
  const uid = o.uid ?? "ana";
  const b = writeBatch(db);
  contar(b, db, uid, numero, o.contador);
  b.set(doc(db, "municipios/a/protocolos", numero), {
    numero, autorUid: uid, secretariaId: o.secretariaId ?? "saude", secretariaNome: o.secretariaNome ?? "Saúde",
    tipo: o.tipo ?? "reclamacao", status: "aberto", ultimaMsgPor: "cidadao", criadoEm: serverTimestamp(),
  });
  b.set(doc(db, "municipios/a/protocolos", numero, "mensagens", "m00"), {
    de: "cidadao", autorUid: uid, assunto: "Buraco na rua", texto: "Há um buraco grande.",
    anexos: Array.from({ length: o.anexos ?? 0 }, (_, i) => ({ k: `00_${i}`, mime: "image/jpeg", partes: o.partes ?? 1 })), criadoEm: serverTimestamp(),
  });
  for (let a = 0; a < (o.anexos ?? 0); a++)
    for (let p = 0; p < (o.partes ?? 1); p++) {
      const k = `00_${a}_${p}`;
      b.set(doc(db, "municipios/a/protocolos", numero, "midias", k), { k, mime: "image/jpeg", data: "A".repeat(200) });
    }
  b.set(doc(collection(db, "municipios/a/notificacoes")), {
    uid, protocoloId: numero, tipo: "recebido", mensagem: `Protocolo ${numero} registrado.`,
    criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 30 * DIA),
  });
  return b;
}

// Mesmo lote que o servidor faz ao responder.
function respostaServidor(db: Db, idx = "01", para = "ana") {
  const b = writeBatch(db);
  b.set(doc(db, "municipios/a/protocolos", NUM, "mensagens", `m${idx}`), { de: "servidor", autorUid: "sam", texto: "Vamos consertar.", anexos: [], criadoEm: serverTimestamp() });
  b.update(doc(db, "municipios/a/protocolos", NUM), { status: "respondido", ultimaMsgPor: "servidor", respondidoEm: serverTimestamp() });
  b.set(doc(collection(db, "municipios/a/notificacoes")), {
    uid: para, protocoloId: NUM, tipo: "resposta", mensagem: "Há uma nova resposta.",
    criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 24 * 3600_000),
  });
  return b;
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-ouvi",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await semearBase(); });

// =====================================================================
describe("1-3. Cadastro, e-mail confirmado e perfil", () => {
  test("pessoa nova cria o próprio perfil aceitando os termos", async () => {
    const db = env.authenticatedContext("novo", { email: "novo@x.com", email_verified: true }).firestore();
    await assertSucceeds(setDoc(doc(db, "municipios/a/users/novo"), { nome: "Novo", email: "novo@x.com", situacao: "ativo", criadoEm: serverTimestamp(), aceiteVersao: "2026-10", aceiteEm: serverTimestamp() }));
  });
  test("não cria perfil em nome de outra pessoa", async () => {
    await assertFails(setDoc(doc(beto(), "municipios/a/users/novo"), { nome: "X", email: "beto@x.com", situacao: "ativo", criadoEm: serverTimestamp() }));
  });
  test("não nasce já com poderes (situacao diferente de ativo)", async () => {
    const db = env.authenticatedContext("novo", { email: "novo@x.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, "municipios/a/users/novo"), { nome: "Novo", email: "novo@x.com", situacao: "bloqueado", criadoEm: serverTimestamp() }));
  });
  test("e-mail NÃO confirmado não lê nada", async () => {
    await assertFails(getDoc(doc(semConfirmar(), "municipios/a/secretarias/saude")));
    await assertFails(getDoc(doc(semConfirmar(), "municipios/a/users/ana")));
  });
  test("e-mail confirmado lê a lista de secretarias; visitante não", async () => {
    await assertSucceeds(getDoc(doc(ana(), "municipios/a/secretarias/saude")));
    await assertFails(getDoc(doc(anonimo(), "municipios/a/secretarias/saude")));
  });
  test("o cidadão não consegue se bloquear nem trocar a própria situação", async () => {
    await assertFails(updateDoc(doc(ana(), "municipios/a/users/ana"), { situacao: "bloqueado" }));
  });
  test("o cidadão edita o próprio nome e telefone", async () => {
    await assertSucceeds(updateDoc(doc(ana(), "municipios/a/users/ana"), { nome: "Ana Maria", telefone: "71999998888" }));
    await assertFails(updateDoc(doc(ana(), "municipios/a/users/ana"), { telefone: "abc" }));
  });
  test("exclusão da própria conta: anonimiza o perfil", async () => {
    await assertSucceeds(updateDoc(doc(ana(), "municipios/a/users/ana"), { situacao: "excluido", nome: "(removido)", email: "" }));
  });
  test("exclusão da conta exige apagar nome e e-mail (não vale só trocar a situação)", async () => {
    await assertFails(updateDoc(doc(ana(), "municipios/a/users/ana"), { situacao: "excluido" }));
  });
  test("ninguém lê o perfil de outra pessoa; o administrador lê", async () => {
    await assertFails(getDoc(doc(beto(), "municipios/a/users/ana")));
    await assertSucceeds(getDoc(doc(adm(), "municipios/a/users/ana")));
  });
});

// =====================================================================
describe("4-6. Registro da manifestação, protocolo e anexos", () => {
  test("cidadão registra a manifestação (protocolo + 1ª mensagem + aviso)", async () => {
    await assertSucceeds(novoProtocolo(ana(), NUM).commit());
  });
  test("registro com 2 fotos de 3 partes cada", async () => {
    await assertSucceeds(novoProtocolo(ana(), NUM, { anexos: 2, partes: 3 }).commit());
  });
  test("registro com o máximo: 5 anexos de 12 partes (limite de acessos das regras no lote)", async () => {
    await assertSucceeds(novoProtocolo(ana(), NUM, { anexos: 5, partes: 12 }).commit());
  });
  test("sem aceitar os termos de uso, não registra", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "municipios/a/users/tom"), { nome: "Tom", email: "tom@x.com", situacao: "ativo", criadoEm: Timestamp.now() }); });
    const db = env.authenticatedContext("tom", { email: "tom@x.com", email_verified: true }).firestore();
    await assertFails(novoProtocolo(db, NUM, { uid: "tom" }).commit());
  });
  test("usuário bloqueado não registra", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "municipios/a/users/bia"), perfil("Bia", "bia@x.com", { situacao: "bloqueado" })); });
    const db = env.authenticatedContext("bia", { email: "bia@x.com", email_verified: true }).firestore();
    await assertFails(novoProtocolo(db, NUM, { uid: "bia" }).commit());
  });
  test("não registra em nome de outra pessoa", async () => {
    await assertFails(novoProtocolo(ana(), NUM, { uid: "beto" }).commit());
  });
  test("não registra para secretaria inativa", async () => {
    await assertFails(novoProtocolo(ana(), NUM, { secretariaId: "velha", secretariaNome: "Velha" }).commit());
  });
  test("não falsifica o nome da secretaria", async () => {
    await assertFails(novoProtocolo(ana(), NUM, { secretariaNome: "Prefeito" }).commit());
  });
  test("número de protocolo fora do padrão é recusado", async () => {
    await assertFails(novoProtocolo(ana(), "123").commit());
  });
  test("tipo de manifestação inválido é recusado", async () => {
    await assertFails(novoProtocolo(ana(), NUM, { tipo: "qualquer" }).commit());
  });
  test("tipos válidos: reclamação, denúncia, solicitação, sugestão, elogio, informação", async () => {
    const tipos = ["reclamacao", "denuncia", "solicitacao", "sugestao", "elogio", "informacao"];
    for (const [i, t] of tipos.entries()) await assertSucceeds(novoProtocolo(ana(), `OUV-2026-TIPO000${i}`, { tipo: t, contador: { previos: i } }).commit());
  });
  test("o protocolo não pode ser apagado por ninguém", async () => {
    await semearProtocolo();
    await assertFails(deleteDoc(doc(ana(), "municipios/a/protocolos", NUM)));
    await assertFails(deleteDoc(doc(adm(), "municipios/a/protocolos", NUM)));
  });
  test("a mensagem inicial (m00) não nasce solta, fora do lote do protocolo", async () => {
    await semearProtocolo({}, { semMensagem: true });
    await assertFails(setDoc(doc(ana(), "municipios/a/protocolos", NUM, "mensagens", "m00"), { de: "cidadao", autorUid: "ana", assunto: "Teste", texto: "Texto", anexos: [], criadoEm: serverTimestamp() }));
  });
  test("mídia solta (sem mensagem no mesmo lote) é recusada", async () => {
    await semearProtocolo();
    await assertFails(setDoc(doc(ana(), "municipios/a/protocolos", NUM, "midias", "00_1_0"), { k: "00_1_0", mime: "image/jpeg", data: "AAAA" }));
  });
  test("tipo de arquivo não permitido é recusado", async () => {
    const db = ana();
    const b = novoProtocolo(db, NUM);
    b.set(doc(db, "municipios/a/protocolos", NUM, "midias", "00_0_0"), { k: "00_0_0", mime: "application/x-msdownload", data: "AAAA" });
    await assertFails(b.commit());
  });
});

// =====================================================================
describe("18. Sigilo: quem pode ler a conversa", () => {
  beforeEach(async () => { await semearProtocolo(); });
  test("o autor lê protocolo, mensagem e mídia", async () => {
    await assertSucceeds(getDoc(doc(ana(), "municipios/a/protocolos", NUM)));
    await assertSucceeds(getDoc(doc(ana(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertSucceeds(getDoc(doc(ana(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
  });
  test("outro cidadão não lê nada", async () => {
    await assertFails(getDoc(doc(beto(), "municipios/a/protocolos", NUM)));
    await assertFails(getDoc(doc(beto(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertFails(getDoc(doc(beto(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
  });
  test("o servidor da secretaria destinatária lê tudo", async () => {
    await assertSucceeds(getDoc(doc(sam(), "municipios/a/protocolos", NUM)));
    await assertSucceeds(getDoc(doc(sam(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertSucceeds(getDoc(doc(sam(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
  });
  test("servidor de OUTRA secretaria não lê nada", async () => {
    await assertFails(getDoc(doc(sol(), "municipios/a/protocolos", NUM)));
    await assertFails(getDoc(doc(sol(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertFails(getDoc(doc(sol(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
  });
  test("o administrador vê só os metadados (estatísticas), nunca mensagens nem mídias", async () => {
    await assertSucceeds(getDoc(doc(adm(), "municipios/a/protocolos", NUM)));
    await assertFails(getDoc(doc(adm(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertFails(getDoc(doc(adm(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
    await assertFails(getDocs(collection(adm(), "municipios/a/protocolos", NUM, "mensagens")));
  });
  test("lista: o cidadão lista só os próprios protocolos", async () => {
    await assertSucceeds(getDocs(query(collection(ana(), "municipios/a/protocolos"), where("autorUid", "==", "ana"))));
    await assertFails(getDocs(collection(ana(), "municipios/a/protocolos")));
    await assertFails(getDocs(query(collection(beto(), "municipios/a/protocolos"), where("autorUid", "==", "ana"))));
  });
  test("lista: o servidor lista só a sua secretaria", async () => {
    await assertSucceeds(getDocs(query(collection(sam(), "municipios/a/protocolos"), where("secretariaId", "==", "saude"))));
    await assertFails(getDocs(query(collection(sam(), "municipios/a/protocolos"), where("secretariaId", "==", "obras"))));
  });
  test("usuário bloqueado perde o acesso à própria conversa", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/a/users/ana"), { situacao: "bloqueado" }); });
    await assertFails(getDoc(doc(ana(), "municipios/a/protocolos", NUM)));
  });
});

// =====================================================================
describe("8-11. Resposta, complementação, encerramento e avaliação", () => {
  beforeEach(async () => { await semearProtocolo(); });

  test("o servidor da secretaria responde (mensagem + status + aviso de 24 h)", async () => {
    await assertSucceeds(respostaServidor(sam()).commit());
  });
  test("servidor de outra secretaria não responde", async () => {
    await assertFails(respostaServidor(sol()).commit());
  });
  test("o cidadão não finge ser servidor", async () => {
    const db = ana();
    const b = writeBatch(db);
    b.set(doc(db, "municipios/a/protocolos", NUM, "mensagens", "m01"), { de: "servidor", autorUid: "ana", texto: "Resolvido.", anexos: [], criadoEm: serverTimestamp() });
    await assertFails(b.commit());
  });
  test("o servidor não cria o aviso 'resposta' sem registrar a resposta", async () => {
    await assertFails(setDoc(doc(collection(sam(), "municipios/a/notificacoes")), {
      uid: "ana", protocoloId: NUM, tipo: "resposta", mensagem: "x", criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 24 * 3600_000),
    }));
  });
  test("o aviso de resposta dura 24 h (não aceita 10 dias)", async () => {
    const db = sam();
    const b = writeBatch(db);
    b.set(doc(db, "municipios/a/protocolos", NUM, "mensagens", "m01"), { de: "servidor", autorUid: "sam", texto: "ok", anexos: [], criadoEm: serverTimestamp() });
    b.update(doc(db, "municipios/a/protocolos", NUM), { status: "respondido", ultimaMsgPor: "servidor", respondidoEm: serverTimestamp() });
    b.set(doc(collection(db, "municipios/a/notificacoes")), { uid: "ana", protocoloId: NUM, tipo: "resposta", mensagem: "x", criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 10 * DIA) });
    await assertFails(b.commit());
  });
  test("o cidadão complementa a própria mensagem", async () => {
    const db = ana();
    const b = writeBatch(db);
    contar(b, db, "ana", `${NUM}/m01`);
    b.set(doc(db, "municipios/a/protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "ana", texto: "Mais um detalhe.", anexos: [], criadoEm: serverTimestamp() });
    b.update(doc(db, "municipios/a/protocolos", NUM), { ultimaMsgPor: "cidadao" });
    await assertSucceeds(b.commit());
  });
  test("outro cidadão não escreve na conversa", async () => {
    const db = beto();
    await assertFails(setDoc(doc(db, "municipios/a/protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "beto", texto: "Intruso", anexos: [], criadoEm: serverTimestamp() }));
  });
  test("mensagens enviadas não podem ser alteradas nem apagadas (antes de 30 dias)", async () => {
    await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM, "mensagens", "m00"), { texto: "Mudei" }));
    await assertFails(deleteDoc(doc(ana(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertFails(updateDoc(doc(sam(), "municipios/a/protocolos", NUM, "mensagens", "m00"), { texto: "Mudei" }));
  });
  test("mensagem com mais de 5000 caracteres ou mais de 5 anexos é recusada", async () => {
    const db = ana();
    await assertFails(setDoc(doc(db, "municipios/a/protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "ana", texto: "x".repeat(5001), anexos: [], criadoEm: serverTimestamp() }));
    await assertFails(setDoc(doc(db, "municipios/a/protocolos", NUM, "mensagens", "m02"), { de: "cidadao", autorUid: "ana", texto: "ok", anexos: [1, 2, 3, 4, 5, 6], criadoEm: serverTimestamp() }));
  });

  describe("encerramento e nota", () => {
    beforeEach(async () => { await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/a/protocolos", NUM), respondido); }); });
    test("o cidadão conclui com nota 5", async () => {
      await assertSucceeds(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp(), avaliacao: 5 }));
    });
    test("nota fora de 1 a 5 é recusada", async () => {
      await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp(), avaliacao: 6 }));
      await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp(), avaliacao: 0 }));
    });
    test("o servidor conclui sem nota, mas não pode dar nota", async () => {
      await assertSucceeds(updateDoc(doc(sam(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
    });
    test("o servidor não dá nota no lugar do cidadão", async () => {
      await assertFails(updateDoc(doc(sam(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp(), avaliacao: 5 }));
    });
    test("servidor de outra secretaria e outro cidadão não concluem", async () => {
      await assertFails(updateDoc(doc(sol(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
      await assertFails(updateDoc(doc(beto(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
    });
    test("não conclui com data inventada (concluidoEm precisa ser a hora do servidor)", async () => {
      await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: Timestamp.fromMillis(Date.now() + 40 * DIA) }));
    });
    test("depois de concluído: o autor dá a nota uma única vez", async () => {
      await assertSucceeds(updateDoc(doc(sam(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
      await assertSucceeds(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { avaliacao: 4 }));
      await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { avaliacao: 5 }));
    });
    test("servidor concluir DEPOIS da nota do cidadão continua possível", async () => {
      await assertSucceeds(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { avaliacao: 3 }));
      await assertSucceeds(updateDoc(doc(sam(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
    });
    test("protocolo concluído não recebe novas mensagens", async () => {
      await assertSucceeds(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
      const db = ana();
      const b = writeBatch(db);
      contar(b, db, "ana", `${NUM}/m01`);
      b.set(doc(db, "municipios/a/protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "ana", texto: "Tarde demais", anexos: [], criadoEm: serverTimestamp() });
      await assertFails(b.commit());
    });
  });

  test("não conclui protocolo que ainda não foi respondido", async () => {
    await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
  });
  test("o cidadão não troca a secretaria, o autor nem o status por conta própria", async () => {
    await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { secretariaId: "obras" }));
    await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { autorUid: "beto" }));
    await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { status: "respondido" }));
  });
});

// =====================================================================
describe("Limite de envios por conta (proteção contra abuso e contra o fim da cota gratuita)", () => {
  const complemento = (db: Db, c?: Contador) => {
    const b = writeBatch(db);
    contar(b, db, "ana", `${NUM}/m01`, c);
    b.set(doc(db, "municipios/a/protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "ana", texto: "Complemento.", anexos: [], criadoEm: serverTimestamp() });
    b.update(doc(db, "municipios/a/protocolos", NUM), { ultimaMsgPor: "cidadao" });
    return b;
  };
  test("registrar manifestação SEM somar no contador é recusado", async () => {
    await assertFails(novoProtocolo(ana(), NUM, { contador: { sem: true } }).commit());
  });
  test("o envio registrado para outro protocolo não vale para este", async () => {
    await assertFails(novoProtocolo(ana(), NUM, { contador: { ref: "OUV-2026-OUTRO999" } }).commit());
  });
  test("um único registro não vale para dois protocolos no mesmo lote", async () => {
    const db = ana();
    const b = novoProtocolo(db, "OUV-2026-AAAA0001");
    b.set(doc(db, "municipios/a/protocolos", "OUV-2026-AAAA0002"), { numero: "OUV-2026-AAAA0002", autorUid: "ana", secretariaId: "saude", secretariaNome: "Saúde", tipo: "reclamacao", status: "aberto", ultimaMsgPor: "cidadao", criadoEm: serverTimestamp() });
    b.set(doc(db, "municipios/a/protocolos", "OUV-2026-AAAA0002", "mensagens", "m00"), { de: "cidadao", autorUid: "ana", assunto: "Segundo", texto: "Segundo protocolo", anexos: [], criadoEm: serverTimestamp() });
    await assertFails(b.commit());
  });
  test("complemento do cidadão sem registrar o envio é recusado; com registro passa", async () => {
    await semearProtocolo();
    await assertFails(complemento(ana(), { sem: true }).commit());
    await assertSucceeds(complemento(ana()).commit());
  });
  test("o 20º envio do dia passa; o 21º é recusado", async () => {
    await semearContador("ana", 19, 1);
    await assertSucceeds(novoProtocolo(ana(), "OUV-2026-LIM00020", { contador: { previos: 19 } }).commit());
    await assertFails(novoProtocolo(ana(), "OUV-2026-LIM00021", { contador: { previos: 20 } }).commit());
  });
  test("passadas 24 h, o contador recomeça", async () => {
    await semearContador("ana", 20, 25);
    await assertSucceeds(novoProtocolo(ana(), NUM, { contador: { previos: 20, novaJanela: true } }).commit());
  });
  test("dentro das 24 h não dá para abrir janela nova nem zerar o contador", async () => {
    await semearContador("ana", 20, 1);
    await assertFails(novoProtocolo(ana(), NUM, { contador: { previos: 20, novaJanela: true } }).commit());
    await assertFails(updateDoc(doc(ana(), "municipios/a/users/ana"), { envios: 0, ultimoEnvio: "x" }));
    await assertFails(updateDoc(doc(ana(), "municipios/a/users/ana"), { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: "x" }));
  });
  test("o contador só sobe de 1 em 1", async () => {
    await semearContador("ana", 5, 1);
    await assertFails(updateDoc(doc(ana(), "municipios/a/users/ana"), { envios: 5, ultimoEnvio: "x" }));
    await assertFails(updateDoc(doc(ana(), "municipios/a/users/ana"), { envios: 7, ultimoEnvio: "x" }));
    await assertSucceeds(updateDoc(doc(ana(), "municipios/a/users/ana"), { envios: 6, ultimoEnvio: "x" }));
  });
  test("o cidadão não altera contador de outra pessoa; o administrador também não", async () => {
    await assertFails(updateDoc(doc(beto(), "municipios/a/users/ana"), { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: "x" }));
    await assertFails(updateDoc(doc(adm(), "municipios/a/users/ana"), { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: "x" }));
  });
  test("a resposta do servidor não gasta o contador de ninguém", async () => {
    await semearProtocolo();
    await assertSucceeds(respostaServidor(sam()).commit());
  });
});

// =====================================================================
describe("12. Prazos legais: prorrogação única (Lei 13.460/2017, art. 16)", () => {
  const prorrogacao = (db: Db, o: { nome?: string; motivo?: string; uid?: string; avisar?: boolean; quando?: Timestamp } = {}) => {
    const b = writeBatch(db);
    b.update(doc(db, "municipios/a/protocolos", NUM), { prorrogadoEm: o.quando ?? serverTimestamp(), prorrogacaoMotivo: o.motivo ?? "Necessário ouvir o setor técnico responsável.", prorrogacaoPor: o.nome ?? "Sam" });
    if (o.avisar !== false) b.set(doc(collection(db, "municipios/a/notificacoes")), {
      uid: o.uid ?? "ana", protocoloId: NUM, tipo: "prorrogacao", mensagem: "O prazo foi prorrogado.",
      criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 30 * DIA),
    });
    return b;
  };
  beforeEach(async () => { await semearProtocolo(); });

  test("o servidor da secretaria prorroga o prazo, com motivo e aviso ao cidadão", async () => {
    await assertSucceeds(prorrogacao(sam()).commit());
    await assertSucceeds(getDoc(doc(ana(), "municipios/a/protocolos", NUM)));
  });
  test("só pode prorrogar UMA vez", async () => {
    await assertSucceeds(prorrogacao(sam()).commit());
    await assertFails(prorrogacao(sam()).commit());
  });
  test("o motivo é obrigatório (mínimo 10 e máximo 300 caracteres)", async () => {
    await assertFails(prorrogacao(sam(), { motivo: "curto" }).commit());
    await assertFails(prorrogacao(sam(), { motivo: "x".repeat(301) }).commit());
  });
  test("o nome registrado é o do servidor que prorrogou (não dá para assinar por outra pessoa)", async () => {
    await assertFails(prorrogacao(sam(), { nome: "Prefeito" }).commit());
  });
  test("a data da prorrogação é a do servidor do Firestore, não a do aparelho", async () => {
    await assertFails(prorrogacao(sam(), { quando: Timestamp.fromMillis(Date.now() + 60 * DIA) }).commit());
  });
  test("servidor de outra secretaria, cidadão e administrador não prorrogam", async () => {
    await assertFails(prorrogacao(sol(), { nome: "Sol" }).commit());
    await assertFails(prorrogacao(ana(), { nome: "Ana" }).commit());
    await assertFails(prorrogacao(adm(), { nome: "Adm" }).commit());
  });
  test("não prorroga depois de vencido (30 dias) nem depois da 1ª resposta", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/a/protocolos", NUM), { criadoEm: Timestamp.fromMillis(Date.now() - 31 * DIA) }); });
    await assertFails(prorrogacao(sam()).commit());
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/a/protocolos", NUM), { criadoEm: Timestamp.now(), ...respondido }); });
    await assertFails(prorrogacao(sam()).commit());
  });
  test("o aviso 'prorrogação' só nasce junto com a prorrogação, para o autor do protocolo", async () => {
    const aviso = { uid: "ana", protocoloId: NUM, tipo: "prorrogacao", mensagem: "x", criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 30 * DIA) };
    await assertFails(setDoc(doc(collection(sam(), "municipios/a/notificacoes")), aviso));
    await assertFails(prorrogacao(sam(), { uid: "beto" }).commit());
  });
  test("o cidadão lê a justificativa no próprio protocolo e o aviso", async () => {
    await assertSucceeds(prorrogacao(sam()).commit());
    const s = await assertSucceeds(getDocs(query(collection(ana(), "municipios/a/notificacoes"), where("uid", "==", "ana"))));
    if (s.size !== 1) throw new Error(`esperava 1 aviso, veio ${s.size}`);
  });
  test("depois de prorrogado, a secretaria ainda responde normalmente", async () => {
    await assertSucceeds(prorrogacao(sam()).commit());
    await assertSucceeds(respostaServidor(sam()).commit());
  });
});

// =====================================================================
describe("Retenção: a conversa só é apagada 30 dias depois de concluída", () => {
  test("antes de 30 dias, ninguém apaga a conversa nem as mídias", async () => {
    await semearProtocolo(concluidoHa(29));
    await assertFails(deleteDoc(doc(ana(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertFails(deleteDoc(doc(sam(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
    await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { apagada: true }));
  });
  test("depois de 30 dias, o autor e o servidor apagam e marcam como apagada", async () => {
    await semearProtocolo(concluidoHa(31));
    await assertSucceeds(deleteDoc(doc(ana(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
    await assertSucceeds(deleteDoc(doc(sam(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertSucceeds(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { apagada: true }));
  });
  test("terceiros e administrador nunca apagam a conversa, mesmo depois de 30 dias", async () => {
    await semearProtocolo(concluidoHa(31));
    await assertFails(deleteDoc(doc(beto(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertFails(deleteDoc(doc(sol(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertFails(deleteDoc(doc(adm(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
  });
  test("protocolo não concluído nunca tem conversa apagada", async () => {
    await semearProtocolo({ ...respondido });
    await assertFails(deleteDoc(doc(ana(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
  });
});

// =====================================================================
describe("15-16. Administração, equipe e bloqueio de usuário", () => {
  test("o administrador cria, edita e apaga secretarias; o cidadão não", async () => {
    await assertSucceeds(setDoc(doc(adm(), "municipios/a/secretarias/educacao"), { nome: "Educação", ativa: true }));
    await assertSucceeds(updateDoc(doc(adm(), "municipios/a/secretarias/educacao"), { ativa: false }));
    await assertSucceeds(deleteDoc(doc(adm(), "municipios/a/secretarias/educacao")));
    await assertFails(setDoc(doc(ana(), "municipios/a/secretarias/hack"), { nome: "Hack", ativa: true }));
    await assertFails(setDoc(doc(sam(), "municipios/a/secretarias/hack"), { nome: "Hack", ativa: true }));
  });
  test("o administrador cadastra um secretário numa secretaria que existe", async () => {
    await assertSucceeds(setDoc(doc(adm(), "municipios/a/equipe/novo@x.com"), { nome: "Novo", papel: "secretario", secretariaId: "saude", ativo: true }));
    await assertFails(setDoc(doc(adm(), "municipios/a/equipe/novo2@x.com"), { nome: "Novo", papel: "secretario", secretariaId: "nao-existe", ativo: true }));
    await assertFails(setDoc(doc(adm(), "municipios/a/equipe/novo3@x.com"), { nome: "Novo", papel: "chefe", secretariaId: "saude", ativo: true }));
  });
  test("quem não é administrador não mexe na equipe (nem o próprio secretário)", async () => {
    await assertFails(setDoc(doc(ana(), "municipios/a/equipe/ana@x.com"), { nome: "Ana", papel: "admin", ativo: true }));
    await assertFails(setDoc(doc(sam(), "municipios/a/equipe/sam@x.com"), { nome: "Sam", papel: "admin", ativo: true }));
    await assertFails(updateDoc(doc(sam(), "municipios/a/equipe/sam@x.com"), { papel: "admin" }));
  });
  test("o administrador não se rebaixa, não se desativa e não se apaga", async () => {
    await assertFails(setDoc(doc(adm(), "municipios/a/equipe/adm@x.com"), { nome: "Adm", papel: "secretario", secretariaId: "saude", ativo: true }));
    await assertFails(setDoc(doc(adm(), "municipios/a/equipe/adm@x.com"), { nome: "Adm", papel: "admin", ativo: false }));
    await assertFails(deleteDoc(doc(adm(), "municipios/a/equipe/adm@x.com")));
  });
  test("secretário desativado perde o acesso às conversas", async () => {
    await semearProtocolo();
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/a/equipe/sam@x.com"), { ativo: false }); });
    await assertFails(getDoc(doc(sam(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
  });
  test("o administrador bloqueia e desbloqueia; o bloqueado perde o acesso", async () => {
    await assertSucceeds(updateDoc(doc(adm(), "municipios/a/users/ana"), { situacao: "bloqueado" }));
    await assertFails(getDoc(doc(ana(), "municipios/a/secretarias/saude")));
    await assertFails(novoProtocolo(ana(), NUM).commit());
    await assertSucceeds(updateDoc(doc(adm(), "municipios/a/users/ana"), { situacao: "ativo" }));
    await assertSucceeds(getDoc(doc(ana(), "municipios/a/secretarias/saude")));
  });
  test("o administrador não bloqueia a si mesmo", async () => {
    await assertFails(updateDoc(doc(adm(), "municipios/a/users/adm"), { situacao: "bloqueado" }));
  });
  test("o administrador não edita o nome, o e-mail nem o telefone de ninguém", async () => {
    await assertFails(updateDoc(doc(adm(), "municipios/a/users/ana"), { nome: "Outro nome" }));
    await assertFails(updateDoc(doc(adm(), "municipios/a/users/ana"), { email: "novo@x.com" }));
  });
  test("o administrador exclui (anonimiza) um usuário", async () => {
    await assertSucceeds(updateDoc(doc(adm(), "municipios/a/users/ana"), { situacao: "excluido", nome: "(removido)", email: "" }));
  });
  test("usuário excluído não volta a ser ativado", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/a/users/ana"), { situacao: "excluido", nome: "(removido)", email: "" }); });
    await assertFails(updateDoc(doc(adm(), "municipios/a/users/ana"), { situacao: "ativo" }));
  });
});

// =====================================================================
describe("13. Notificações e avisos", () => {
  const aviso = (uid: string, dias = 7) => ({ uid, protocoloId: "", tipo: "aviso", mensagem: "Aviso da prefeitura.", criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + dias * DIA) });
  test("o administrador envia aviso a um usuário; ele lê e dispensa", async () => {
    await assertSucceeds(setDoc(doc(adm(), "municipios/a/notificacoes/n1"), aviso("ana")));
    await assertSucceeds(getDoc(doc(ana(), "municipios/a/notificacoes/n1")));
    await assertSucceeds(deleteDoc(doc(ana(), "municipios/a/notificacoes/n1")));
  });
  test("outro usuário não lê nem apaga o aviso alheio", async () => {
    await assertSucceeds(setDoc(doc(adm(), "municipios/a/notificacoes/n1"), aviso("ana")));
    await assertFails(getDoc(doc(beto(), "municipios/a/notificacoes/n1")));
    await assertFails(deleteDoc(doc(beto(), "municipios/a/notificacoes/n1")));
  });
  test("cidadão e servidor não enviam aviso do administrador", async () => {
    await assertFails(setDoc(doc(ana(), "municipios/a/notificacoes/n2"), aviso("beto")));
    await assertFails(setDoc(doc(sam(), "municipios/a/notificacoes/n3"), aviso("ana")));
  });
  test("aviso com prazo acima de 31 dias é recusado", async () => {
    await assertFails(setDoc(doc(adm(), "municipios/a/notificacoes/n4"), aviso("ana", 90)));
  });
  test("ninguém edita uma notificação", async () => {
    await assertSucceeds(setDoc(doc(adm(), "municipios/a/notificacoes/n1"), aviso("ana")));
    await assertFails(updateDoc(doc(ana(), "municipios/a/notificacoes/n1"), { mensagem: "Outra" }));
    await assertFails(updateDoc(doc(adm(), "municipios/a/notificacoes/n1"), { mensagem: "Outra" }));
  });
});

// =====================================================================
describe("Aparência e publicidade (públicas)", () => {
  const site = () => ({ nome: "Prefeitura", cor: "#0b3b8c", logo: "", contato: "", atualizadoEm: serverTimestamp() });
  test("a aparência é pública; só o administrador altera", async () => {
    await assertSucceeds(getDoc(doc(anonimo(), "municipios/a/config/site")));
    await assertSucceeds(setDoc(doc(adm(), "municipios/a/config/site"), site()));
    await assertFails(setDoc(doc(ana(), "municipios/a/config/site"), site()));
    await assertFails(setDoc(doc(adm(), "municipios/a/config/outra"), site()));
  });
  test("cor inválida ou logo que não é imagem é recusada", async () => {
    await assertFails(setDoc(doc(adm(), "municipios/a/config/site"), { ...site(), cor: "vermelho" }));
    await assertFails(setDoc(doc(adm(), "municipios/a/config/site"), { ...site(), logo: "javascript:alert(1)" }));
  });
  test("anúncios ativos são públicos; os inativos só para o administrador", async () => {
    await assertSucceeds(getDocs(query(collection(anonimo(), "municipios/a/anuncios"), where("ativo", "==", true))));
    await assertFails(getDoc(doc(anonimo(), "municipios/a/anuncios/a2")));
    await assertSucceeds(getDoc(doc(adm(), "municipios/a/anuncios/a2")));
  });
  test("anúncio com link que não é https é recusado", async () => {
    await assertFails(setDoc(doc(adm(), "municipios/a/anuncios/a3"), { titulo: "X", link: "javascript:alert(1)", imagem: "data:image/png;base64,AAAA", ativo: true, ordem: 1, criadoEm: Timestamp.now() }));
    await assertSucceeds(setDoc(doc(adm(), "municipios/a/anuncios/a4"), { titulo: "X", link: "https://exemplo.com.br", imagem: "data:image/png;base64,AAAA", ativo: true, ordem: 1, criadoEm: Timestamp.now() }));
  });
});

// =====================================================================
describe("14. Ouvidor geral: lê tudo, encaminha ao setor, cobra e deixa histórico", () => {
  const stats = (extra: Record<string, unknown> = {}) => ({
    geradoEm: serverTimestamp(), geradoPor: "Olga", total: 3, vencidas: 1, avaliacoes: 0,
    tempoMedioRespostaDias: 2.5, dentroPrazoPct: 80, notaMedia: 0,
    porStatus: { aberto: 3 }, porTipo: { reclamacao: 3 }, porSecretaria: { Saúde: { total: 3, vencidas: 1, concluidas: 0 } }, porMes: { "2026-11": 3 },
    ...extra,
  });
  // Mesmo lote do app: muda a secretaria e grava o histórico h{n}.
  function encaminhar(db: Db, o: { n?: number; para?: string; paraNome?: string; motivo?: string; por?: string; hid?: string } = {}) {
    const n = o.n ?? 1;
    const para = o.para ?? "obras", paraNome = o.paraNome ?? "Obras";
    const b = writeBatch(db);
    b.update(doc(db, "municipios/a/protocolos", NUM), { secretariaId: para, secretariaNome: paraNome, encaminhadoEm: serverTimestamp(), encaminhamentos: n });
    b.set(doc(db, "municipios/a/protocolos", NUM, "historico", o.hid ?? `h${n}`), {
      de: "saude", deNome: "Saúde", para, paraNome, por: o.por ?? "Olga", motivo: o.motivo ?? "Assunto é de obras.", criadoEm: serverTimestamp(),
    });
    return b;
  }
  beforeEach(async () => { await semearProtocolo(); });

  test("lê o protocolo, a lista, as mensagens e as mídias de qualquer secretaria", async () => {
    await assertSucceeds(getDoc(doc(olga(), "municipios/a/protocolos", NUM)));
    await assertSucceeds(getDocs(collection(olga(), "municipios/a/protocolos")));
    await assertSucceeds(getDoc(doc(olga(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertSucceeds(getDoc(doc(olga(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
  });
  test("NÃO escreve mensagens, NÃO apaga e NÃO altera status", async () => {
    const dbo = olga();
    const b = writeBatch(dbo);
    b.set(doc(dbo, "municipios/a/protocolos", NUM, "mensagens", "m01"), { de: "servidor", autorUid: "olga", texto: "Oi", anexos: [], criadoEm: serverTimestamp() });
    await assertFails(b.commit());
    await assertFails(updateDoc(doc(olga(), "municipios/a/protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
    await assertFails(deleteDoc(doc(olga(), "municipios/a/protocolos", NUM)));
  });
  test("encaminha para outra secretaria com histórico no mesmo lote", async () => {
    await assertSucceeds(encaminhar(olga()).commit());
    await assertSucceeds(getDoc(doc(sol(), "municipios/a/protocolos", NUM)));       // a nova secretaria passa a ver
    await assertFails(getDoc(doc(sam(), "municipios/a/protocolos", NUM)));          // a antiga deixa de ver
    await assertFails(getDoc(doc(sam(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
    await assertSucceeds(getDoc(doc(sol(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
  });
  test("o autor e a secretaria atual leem o histórico; outra secretaria não", async () => {
    await encaminhar(olga()).commit();
    await assertSucceeds(getDoc(doc(ana(), "municipios/a/protocolos", NUM, "historico", "h1")));
    await assertSucceeds(getDoc(doc(sol(), "municipios/a/protocolos", NUM, "historico", "h1")));
    await assertSucceeds(getDoc(doc(olga(), "municipios/a/protocolos", NUM, "historico", "h1")));
    await assertFails(getDoc(doc(sam(), "municipios/a/protocolos", NUM, "historico", "h1")));
    await assertFails(getDoc(doc(beto(), "municipios/a/protocolos", NUM, "historico", "h1")));
  });
  test("encaminhar sem o registro de histórico é recusado", async () => {
    await assertFails(updateDoc(doc(olga(), "municipios/a/protocolos", NUM), { secretariaId: "obras", secretariaNome: "Obras", encaminhadoEm: serverTimestamp(), encaminhamentos: 1 }));
  });
  test("histórico com nome de secretaria ou autor falsos é recusado", async () => {
    await assertFails(encaminhar(olga(), { paraNome: "Outra" }).commit());
    await assertFails(encaminhar(olga(), { por: "Fulano" }).commit());
    await assertFails(encaminhar(olga(), { motivo: "oi" }).commit());
    await assertFails(encaminhar(olga(), { hid: "h2" }).commit());
  });
  test("não encaminha para secretaria inativa nem para a mesma", async () => {
    await assertFails(encaminhar(olga(), { para: "velha", paraNome: "Velha" }).commit());
    await assertFails(encaminhar(olga(), { para: "saude", paraNome: "Saúde" }).commit());
  });
  test("não encaminha protocolo concluído", async () => {
    await env.clearFirestore(); await semearBase(); await semearProtocolo(concluidoHa(1));
    await assertFails(encaminhar(olga()).commit());
  });
  test("o contador de encaminhamentos só sobe de 1 em 1", async () => {
    await assertSucceeds(encaminhar(olga()).commit());
    await assertFails(encaminhar(olga(), { n: 3, para: "saude", paraNome: "Saúde" }).commit());
  });
  test("ninguém mais cria histórico nem encaminha (secretário, cidadão, admin)", async () => {
    for (const quem of [sam(), ana(), adm()]) await assertFails(encaminhar(quem).commit());
  });
  test("histórico é imutável", async () => {
    await encaminhar(olga()).commit();
    await assertFails(updateDoc(doc(olga(), "municipios/a/protocolos", NUM, "historico", "h1"), { motivo: "outro motivo" }));
    await assertFails(deleteDoc(doc(olga(), "municipios/a/protocolos", NUM, "historico", "h1")));
  });
  test("cobra a resposta (só protocolo aberto) e não mexe em mais nada", async () => {
    await assertSucceeds(updateDoc(doc(olga(), "municipios/a/protocolos", NUM), { cobradoEm: serverTimestamp() }));
    await assertFails(updateDoc(doc(olga(), "municipios/a/protocolos", NUM), { cobradoEm: Timestamp.fromMillis(1) }));
    await assertFails(updateDoc(doc(olga(), "municipios/a/protocolos", NUM), { cobradoEm: serverTimestamp(), status: "concluido" }));
  });
  test("cobrança em protocolo já respondido é recusada; secretário e cidadão não cobram", async () => {
    await assertFails(updateDoc(doc(sam(), "municipios/a/protocolos", NUM), { cobradoEm: serverTimestamp() }));
    await assertFails(updateDoc(doc(ana(), "municipios/a/protocolos", NUM), { cobradoEm: serverTimestamp() }));
    await env.clearFirestore(); await semearBase(); await semearProtocolo(respondido);
    await assertFails(updateDoc(doc(olga(), "municipios/a/protocolos", NUM), { cobradoEm: serverTimestamp() }));
  });
  test("ouvidor inativo ou sem e-mail confirmado perde o acesso", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/a/equipe/olga@x.com"), { ativo: false }); });
    await assertFails(getDoc(doc(olga(), "municipios/a/protocolos", NUM)));
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/a/equipe/olga@x.com"), { ativo: true }); });
    const nc = env.authenticatedContext("olga", { email: "olga@x.com", email_verified: false }).firestore();
    await assertFails(getDoc(doc(nc, "municipios/a/protocolos", NUM)));
  });
  test("o administrador cadastra ouvidor e prefeito sem secretaria; secretário continua exigindo secretaria", async () => {
    await assertSucceeds(setDoc(doc(adm(), "municipios/a/equipe/novo@x.com"), { nome: "Novo", papel: "ouvidor", ativo: true }));
    await assertSucceeds(setDoc(doc(adm(), "municipios/a/equipe/novo2@x.com"), { nome: "Novo2", papel: "prefeito", ativo: true }));
    await assertFails(setDoc(doc(adm(), "municipios/a/equipe/novo3@x.com"), { nome: "Novo3", papel: "secretario", ativo: true }));
    await assertFails(setDoc(doc(adm(), "municipios/a/equipe/novo4@x.com"), { nome: "Novo4", papel: "superadmin", ativo: true }));
  });
  test("o ouvidor não cadastra equipe nem lê a lista de usuários", async () => {
    await assertFails(setDoc(doc(olga(), "municipios/a/equipe/novo@x.com"), { nome: "Novo", papel: "ouvidor", ativo: true }));
    await assertFails(getDoc(doc(olga(), "municipios/a/users/ana")));
  });

  describe("estatísticas do prefeito: só números, sem dados pessoais", () => {
    test("ouvidor e administrador publicam; o prefeito, o secretário e o cidadão não", async () => {
      await assertSucceeds(setDoc(doc(olga(), "municipios/a/estatisticas/atual"), stats()));
      await assertSucceeds(setDoc(doc(adm(), "municipios/a/estatisticas/atual"), stats({ geradoPor: "Adm" })));
      await assertFails(setDoc(doc(pedro(), "municipios/a/estatisticas/atual"), stats({ geradoPor: "Pedro" })));
      await assertFails(setDoc(doc(sam(), "municipios/a/estatisticas/atual"), stats({ geradoPor: "Sam" })));
      await assertFails(setDoc(doc(ana(), "municipios/a/estatisticas/atual"), stats({ geradoPor: "Ana" })));
    });
    test("campos extras (ex.: texto de cidadão ou lista de protocolos) são recusados", async () => {
      await assertFails(setDoc(doc(olga(), "municipios/a/estatisticas/atual"), stats({ protocolos: [NUM] })));
      await assertFails(setDoc(doc(olga(), "municipios/a/estatisticas/atual"), stats({ nomes: ["Ana"] })));
    });
    test("data e autor precisam ser do servidor/do usuário; só existe o documento 'atual'", async () => {
      await assertFails(setDoc(doc(olga(), "municipios/a/estatisticas/atual"), stats({ geradoEm: Timestamp.fromMillis(1) })));
      await assertFails(setDoc(doc(olga(), "municipios/a/estatisticas/atual"), stats({ geradoPor: "Outro" })));
      await assertFails(setDoc(doc(olga(), "municipios/a/estatisticas/outro"), stats()));
      await assertFails(setDoc(doc(olga(), "municipios/a/estatisticas/atual"), stats({ total: "3" })));
    });
    test("o prefeito lê só as estatísticas", async () => {
      await setDoc(doc(olga(), "municipios/a/estatisticas/atual"), stats());
      await assertSucceeds(getDoc(doc(pedro(), "municipios/a/estatisticas/atual")));
      await assertSucceeds(getDoc(doc(adm(), "municipios/a/estatisticas/atual")));
      await assertFails(getDoc(doc(ana(), "municipios/a/estatisticas/atual")));
      await assertFails(getDoc(doc(sam(), "municipios/a/estatisticas/atual")));
      await assertFails(getDoc(doc(anonimo(), "municipios/a/estatisticas/atual")));
    });
  describe("painel público de transparência (opcional por município)", () => {
    const site = (extra: Record<string, unknown> = {}) => ({ nome: "Município A", cor: "#0b3b8c", logo: "", contato: "", atualizadoEm: serverTimestamp(), ...extra });
    test("desligado (padrão): visitante e cidadão não leem os números", async () => {
      await setDoc(doc(olga(), "municipios/a/estatisticas/atual"), stats());
      await assertFails(getDoc(doc(anonimo(), "municipios/a/estatisticas/atual")));
      await assertFails(getDoc(doc(ana(), "municipios/a/estatisticas/atual")));
    });
    test("o admin liga a transparência em Aparência; aí qualquer pessoa lê (só leitura)", async () => {
      await setDoc(doc(olga(), "municipios/a/estatisticas/atual"), stats());
      await assertSucceeds(setDoc(doc(adm(), "municipios/a/config/site"), site({ transparencia: true })));
      await assertSucceeds(getDoc(doc(anonimo(), "municipios/a/estatisticas/atual")));
      await assertSucceeds(getDoc(doc(ana(), "municipios/a/estatisticas/atual")));
      await assertFails(setDoc(doc(anonimo(), "municipios/a/estatisticas/atual"), stats({ geradoPor: "X" })));
      await assertFails(getDocs(collection(anonimo(), "municipios/a/estatisticas")));
    });
    test("a transparência de A não abre os números de B", async () => {
      await assertSucceeds(setDoc(doc(adm(), "municipios/a/config/site"), site({ transparencia: true })));
      await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "municipios/b/estatisticas/atual"), { total: 1 }); });
      await assertFails(getDoc(doc(anonimo(), "municipios/b/estatisticas/atual")));
    });
    test("só o admin liga, e o valor precisa ser verdadeiro/falso", async () => {
      await assertFails(setDoc(doc(olga(), "municipios/a/config/site"), site({ transparencia: true })));
      await assertFails(setDoc(doc(adm(), "municipios/a/config/site"), site({ transparencia: "sim" })));
    });
  });

    test("o prefeito NÃO lê protocolos, conversas, mídias, histórico, usuários nem notificações", async () => {
      await assertFails(getDoc(doc(pedro(), "municipios/a/protocolos", NUM)));
      await assertFails(getDocs(collection(pedro(), "municipios/a/protocolos")));
      await assertFails(getDoc(doc(pedro(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
      await assertFails(getDoc(doc(pedro(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
      await assertFails(getDoc(doc(pedro(), "municipios/a/users/ana")));
      await assertFails(getDocs(collection(pedro(), "municipios/a/notificacoes")));
    });
    test("o prefeito não escreve em nada", async () => {
      await assertFails(updateDoc(doc(pedro(), "municipios/a/protocolos", NUM), { cobradoEm: serverTimestamp() }));
      await assertFails(encaminhar(pedro()).commit());
      await assertFails(setDoc(doc(pedro(), "municipios/a/secretarias/nova"), { nome: "Nova", ativa: true }));
    });
  });
});

// =====================================================================
describe("17. Isolamento entre municípios e SUPERADMIN", () => {
  // Pessoas do município B (mesma conta pode existir nos dois, mas com perfis separados)
  const adminB = () => env.authenticatedContext("admb", { email: "admb@x.com", email_verified: true }).firestore();
  const servB = () => env.authenticatedContext("sb", { email: "sb@x.com", email_verified: true }).firestore();
  const olgaB = () => env.authenticatedContext("ob", { email: "ob@x.com", email_verified: true }).firestore();
  beforeEach(async () => {
    await semearProtocolo();
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await setDoc(doc(db, "municipios/b/users/admb"), perfil("AdmB", "admb@x.com"));
      await setDoc(doc(db, "municipios/b/users/sb"), perfil("SB", "sb@x.com"));
      await setDoc(doc(db, "municipios/b/users/ob"), perfil("OB", "ob@x.com"));
      await setDoc(doc(db, "municipios/b/secretarias/saude"), { nome: "Saúde B", ativa: true });
      await setDoc(doc(db, "municipios/b/equipe/admb@x.com"), { nome: "AdmB", papel: "admin", ativo: true });
      await setDoc(doc(db, "municipios/b/equipe/sb@x.com"), { nome: "SB", papel: "secretario", secretariaId: "saude", ativo: true });
      await setDoc(doc(db, "municipios/b/equipe/ob@x.com"), { nome: "OB", papel: "ouvidor", ativo: true });
    });
  });

  test("a equipe do município B não lê nada dos protocolos do município A", async () => {
    for (const quem of [adminB(), servB(), olgaB()]) {
      await assertFails(getDoc(doc(quem, "municipios/a/protocolos", NUM)));
      await assertFails(getDocs(collection(quem, "municipios/a/protocolos")));
      await assertFails(getDoc(doc(quem, "municipios/a/protocolos", NUM, "mensagens", "m00")));
      await assertFails(getDoc(doc(quem, "municipios/a/protocolos", NUM, "midias", "00_0_0")));
    }
  });
  test("a equipe do município B não escreve nada no município A", async () => {
    await assertFails(updateDoc(doc(olgaB(), "municipios/a/protocolos", NUM), { cobradoEm: serverTimestamp() }));
    await assertFails(setDoc(doc(adminB(), "municipios/a/secretarias/nova"), { nome: "Nova", ativa: true }));
    await assertFails(setDoc(doc(adminB(), "municipios/a/equipe/x@x.com"), { nome: "X", papel: "admin", ativo: true }));
    await assertFails(setDoc(doc(adminB(), "municipios/a/config/site"), { nome: "Hack", cor: "#000000", logo: "", atualizadoEm: serverTimestamp() }));
  });
  test("o admin de B não lista os usuários de A", async () => {
    await assertFails(getDoc(doc(adminB(), "municipios/a/users/ana")));
    await assertFails(getDocs(collection(adminB(), "municipios/a/users")));
  });
  test("o prefeito de A não lê as estatísticas de B", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "municipios/b/estatisticas/atual"), { total: 1 }); });
    await assertFails(getDoc(doc(pedro(), "municipios/b/estatisticas/atual")));
  });
  test("a equipe de A (mesmo papel) também não lê o município B", async () => {
    await assertFails(getDocs(collection(adm(), "municipios/b/protocolos")));
    await assertFails(getDoc(doc(sam(), "municipios/b/equipe/sb@x.com")));
    await assertFails(getDoc(doc(adm(), "municipios/b/users/sb")));
  });
  test("a mesma pessoa pode ter perfis nos dois municípios, separados", async () => {
    await assertSucceeds(setDoc(doc(env.authenticatedContext("ana", { email: "ana@x.com", email_verified: true }).firestore(), "municipios/b/users/ana"),
      { nome: "Ana", email: "ana@x.com", situacao: "ativo", criadoEm: serverTimestamp(), aceiteVersao: "2026-10", aceiteEm: serverTimestamp() }));
    await assertFails(getDoc(doc(adminB(), "municipios/a/users/ana")));   // o admin de B não vê o perfil dela em A
  });
  test("cidadão não cria protocolo em município suspenso nem em município que não existe", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/b"), { ativo: false }); });
    const db = env.authenticatedContext("ana", { email: "ana@x.com", email_verified: true }).firestore();
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "municipios/b/users/ana"), perfil("Ana", "ana@x.com")); });
    const b = writeBatch(db);
    b.update(doc(db, "municipios/b/users/ana"), { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: "OUV-2026-ZZZZ0001" });
    b.set(doc(db, "municipios/b/protocolos", "OUV-2026-ZZZZ0001"), { numero: "OUV-2026-ZZZZ0001", autorUid: "ana", secretariaId: "saude", secretariaNome: "Saúde B", tipo: "reclamacao", status: "aberto", ultimaMsgPor: "cidadao", criadoEm: serverTimestamp() });
    b.set(doc(db, "municipios/b/protocolos", "OUV-2026-ZZZZ0001", "mensagens", "m00"), { de: "cidadao", autorUid: "ana", assunto: "Teste", texto: "Teste", anexos: [], criadoEm: serverTimestamp() });
    await assertFails(b.commit());
    const db2 = env.authenticatedContext("ana", { email: "ana@x.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(db2, "municipios/inexistente/users/ana"), { nome: "Ana", email: "ana@x.com", situacao: "ativo", criadoEm: serverTimestamp() }));
  });
  test("município suspenso: cadastro novo negado, mas a equipe ainda lê o que já existe", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "municipios/a"), { ativo: false }); });
    const novo = env.authenticatedContext("novo", { email: "novo@x.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(novo, "municipios/a/users/novo"), { nome: "N", email: "novo@x.com", situacao: "ativo", criadoEm: serverTimestamp() }));
    await assertSucceeds(getDoc(doc(sam(), "municipios/a/protocolos", NUM)));
  });

  describe("SUPERADMIN", () => {
    test("cria município com slug válido; a pessoa comum não", async () => {
      await assertSucceeds(setDoc(doc(dono(), "municipios/novo-mun"), { nome: "Novo", ativo: true, plano: "padrao", criadoEm: serverTimestamp() }));
      await assertFails(setDoc(doc(adm(), "municipios/outro"), { nome: "Outro", ativo: true, plano: "padrao", criadoEm: serverTimestamp() }));
      await assertFails(setDoc(doc(ana(), "municipios/outro"), { nome: "Outro", ativo: true, plano: "padrao", criadoEm: serverTimestamp() }));
    });
    test("slug inválido, plano inválido e campos extras são recusados", async () => {
      await assertFails(setDoc(doc(dono(), "municipios/Maiuscula"), { nome: "X", ativo: true, plano: "basico", criadoEm: serverTimestamp() }));
      await assertFails(setDoc(doc(dono(), "municipios/ok1"), { nome: "X", ativo: true, plano: "ouro", criadoEm: serverTimestamp() }));
      await assertFails(setDoc(doc(dono(), "municipios/ok2"), { nome: "X", ativo: true, plano: "basico", criadoEm: serverTimestamp(), extra: 1 }));
    });
    test("suspende e reativa o município e muda o plano; não apaga", async () => {
      await assertSucceeds(updateDoc(doc(dono(), "municipios/a"), { ativo: false }));
      await assertSucceeds(updateDoc(doc(dono(), "municipios/a"), { ativo: true, plano: "completo" }));
      await assertFails(updateDoc(doc(adm(), "municipios/a"), { ativo: false }));
      await assertFails(deleteDoc(doc(dono(), "municipios/a")));
    });
    test("lista os municípios; o município (nome/situação) é público para abrir a tela de login", async () => {
      await assertSucceeds(getDocs(collection(dono(), "municipios")));
      await assertFails(getDocs(collection(adm(), "municipios")));
      await assertSucceeds(getDoc(doc(anonimo(), "municipios/a")));
    });
    test("cadastra o 1º administrador do município, mas só como admin e nunca o próprio e-mail", async () => {
      await assertSucceeds(setDoc(doc(dono(), "municipios/a/equipe/novoadm@x.com"), { nome: "Novo Adm", papel: "admin", ativo: true }));
      await assertFails(setDoc(doc(dono(), "municipios/a/equipe/novo@x.com"), { nome: "Novo", papel: "ouvidor", ativo: true }));
      await assertFails(setDoc(doc(dono(), "municipios/a/equipe/dono@x.com"), { nome: "Dono", papel: "admin", ativo: true }));
    });
    test("NÃO lê protocolos, conversas, mídias, histórico, usuários nem notificações de nenhum município", async () => {
      await assertFails(getDoc(doc(dono(), "municipios/a/protocolos", NUM)));
      await assertFails(getDocs(collection(dono(), "municipios/a/protocolos")));
      await assertFails(getDoc(doc(dono(), "municipios/a/protocolos", NUM, "mensagens", "m00")));
      await assertFails(getDoc(doc(dono(), "municipios/a/protocolos", NUM, "midias", "00_0_0")));
      await assertFails(getDoc(doc(dono(), "municipios/a/users/ana")));
      await assertFails(getDocs(collection(dono(), "municipios/a/notificacoes")));
      await assertFails(getDocs(collection(dono(), "municipios/b/protocolos")));
    });
    test("ninguém vira SUPERADMIN pelo app", async () => {
      await assertFails(setDoc(doc(adm(), "superadmins/adm@x.com"), { criadoEm: serverTimestamp() }));
      await assertFails(setDoc(doc(dono(), "superadmins/outro@x.com"), { criadoEm: serverTimestamp() }));
      await assertSucceeds(getDoc(doc(dono(), "superadmins/dono@x.com")));
      await assertFails(getDoc(doc(adm(), "superadmins/dono@x.com")));
    });
    test("SUPERADMIN sem e-mail confirmado não tem poderes", async () => {
      const nc = env.authenticatedContext("dono", { email: "dono@x.com", email_verified: false }).firestore();
      await assertFails(setDoc(doc(nc, "municipios/zzz"), { nome: "Z", ativo: true, plano: "basico", criadoEm: serverTimestamp() }));
    });
  });
});

// =====================================================================
describe("Padrão: tudo que não foi liberado está negado", () => {
  test("coleção desconhecida", async () => {
    await assertFails(setDoc(doc(adm(), "municipios/a/qualquer/coisa"), { a: 1 }));
    await assertFails(getDoc(doc(adm(), "municipios/a/qualquer/coisa")));
  });
});

// =====================================================================
// Ainda NÃO existem no sistema (Fases 2 e 3 do plano). Ficam aqui como lembrete obrigatório:
describe("Pendentes (Fases 2 e 3)", () => {
  test.todo("19. Pedidos de acesso à informação (LAI) e recursos, separados da Ouvidoria");
});

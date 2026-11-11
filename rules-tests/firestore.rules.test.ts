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
const semConfirmar = () => env.authenticatedContext("ana", { email: "ana@x.com", email_verified: false }).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

const perfil = (nome: string, email: string, extra: Record<string, unknown> = {}) =>
  ({ nome, email, situacao: "ativo", criadoEm: Timestamp.now(), aceiteVersao: "2026-10", aceiteEm: Timestamp.now(), ...extra });

async function semearBase() {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "users/ana"), perfil("Ana", "ana@x.com"));
    await setDoc(doc(db, "users/beto"), perfil("Beto", "beto@x.com"));
    await setDoc(doc(db, "users/sam"), perfil("Sam", "sam@x.com"));
    await setDoc(doc(db, "users/sol"), perfil("Sol", "sol@x.com"));
    await setDoc(doc(db, "users/adm"), perfil("Adm", "adm@x.com"));
    await setDoc(doc(db, "secretarias/saude"), { nome: "Saúde", ativa: true });
    await setDoc(doc(db, "secretarias/obras"), { nome: "Obras", ativa: true });
    await setDoc(doc(db, "secretarias/velha"), { nome: "Velha", ativa: false });
    await setDoc(doc(db, "equipe/sam@x.com"), { nome: "Sam", papel: "secretario", secretariaId: "saude", ativo: true });
    await setDoc(doc(db, "equipe/sol@x.com"), { nome: "Sol", papel: "secretario", secretariaId: "obras", ativo: true });
    await setDoc(doc(db, "equipe/adm@x.com"), { nome: "Adm", papel: "admin", ativo: true });
    await setDoc(doc(db, "config/site"), { nome: "Prefeitura", cor: "#0b3b8c", logo: "", atualizadoEm: Timestamp.now() });
    await setDoc(doc(db, "anuncios/a1"), { titulo: "Ativo", link: "", imagem: "data:image/png;base64,AAAA", ativo: true, ordem: 1, criadoEm: Timestamp.now() });
    await setDoc(doc(db, "anuncios/a2"), { titulo: "Inativo", link: "", imagem: "data:image/png;base64,AAAA", ativo: false, ordem: 2, criadoEm: Timestamp.now() });
  });
}

// Cria um protocolo já existente (como se tivesse sido registrado antes), com a 1ª mensagem e uma mídia.
async function semearProtocolo(extra: Record<string, unknown> = {}, opcoes: { semMensagem?: boolean } = {}) {
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, "protocolos", NUM), {
      numero: NUM, autorUid: "ana", secretariaId: "saude", secretariaNome: "Saúde", tipo: "reclamacao",
      status: "aberto", ultimaMsgPor: "cidadao", criadoEm: Timestamp.now(), ...extra,
    });
    if (!opcoes.semMensagem) {
      await setDoc(doc(db, "protocolos", NUM, "mensagens", "m00"), { de: "cidadao", autorUid: "ana", assunto: "Buraco na rua", texto: "Há um buraco grande.", anexos: [], criadoEm: Timestamp.now() });
      await setDoc(doc(db, "protocolos", NUM, "midias", "00_0_0"), { k: "00_0_0", mime: "image/jpeg", data: "AAAA" });
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
  b.update(doc(db, "users", uid), nova
    ? { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: c.ref ?? ref }
    : { envios: previos + 1, ultimoEnvio: c.ref ?? ref });
}
async function semearContador(uid: string, envios: number, horasAtras: number) {
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), "users", uid), { envios, janelaEm: Timestamp.fromMillis(Date.now() - horasAtras * 3600_000), ultimoEnvio: "antigo" });
  });
}

// Mesmo lote que o app faz ao registrar uma manifestação.
function novoProtocolo(db: Db, numero: string, o: { uid?: string; secretariaId?: string; secretariaNome?: string; tipo?: string; anexos?: number; partes?: number; contador?: Contador } = {}) {
  const uid = o.uid ?? "ana";
  const b = writeBatch(db);
  contar(b, db, uid, numero, o.contador);
  b.set(doc(db, "protocolos", numero), {
    numero, autorUid: uid, secretariaId: o.secretariaId ?? "saude", secretariaNome: o.secretariaNome ?? "Saúde",
    tipo: o.tipo ?? "reclamacao", status: "aberto", ultimaMsgPor: "cidadao", criadoEm: serverTimestamp(),
  });
  b.set(doc(db, "protocolos", numero, "mensagens", "m00"), {
    de: "cidadao", autorUid: uid, assunto: "Buraco na rua", texto: "Há um buraco grande.",
    anexos: Array.from({ length: o.anexos ?? 0 }, (_, i) => ({ k: `00_${i}`, mime: "image/jpeg", partes: o.partes ?? 1 })), criadoEm: serverTimestamp(),
  });
  for (let a = 0; a < (o.anexos ?? 0); a++)
    for (let p = 0; p < (o.partes ?? 1); p++) {
      const k = `00_${a}_${p}`;
      b.set(doc(db, "protocolos", numero, "midias", k), { k, mime: "image/jpeg", data: "A".repeat(200) });
    }
  b.set(doc(collection(db, "notificacoes")), {
    uid, protocoloId: numero, tipo: "recebido", mensagem: `Protocolo ${numero} registrado.`,
    criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 30 * DIA),
  });
  return b;
}

// Mesmo lote que o servidor faz ao responder.
function respostaServidor(db: Db, idx = "01", para = "ana") {
  const b = writeBatch(db);
  b.set(doc(db, "protocolos", NUM, "mensagens", `m${idx}`), { de: "servidor", autorUid: "sam", texto: "Vamos consertar.", anexos: [], criadoEm: serverTimestamp() });
  b.update(doc(db, "protocolos", NUM), { status: "respondido", ultimaMsgPor: "servidor", respondidoEm: serverTimestamp() });
  b.set(doc(collection(db, "notificacoes")), {
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
    await assertSucceeds(setDoc(doc(db, "users/novo"), { nome: "Novo", email: "novo@x.com", situacao: "ativo", criadoEm: serverTimestamp(), aceiteVersao: "2026-10", aceiteEm: serverTimestamp() }));
  });
  test("não cria perfil em nome de outra pessoa", async () => {
    await assertFails(setDoc(doc(beto(), "users/novo"), { nome: "X", email: "beto@x.com", situacao: "ativo", criadoEm: serverTimestamp() }));
  });
  test("não nasce já com poderes (situacao diferente de ativo)", async () => {
    const db = env.authenticatedContext("novo", { email: "novo@x.com", email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, "users/novo"), { nome: "Novo", email: "novo@x.com", situacao: "bloqueado", criadoEm: serverTimestamp() }));
  });
  test("e-mail NÃO confirmado não lê nada", async () => {
    await assertFails(getDoc(doc(semConfirmar(), "secretarias/saude")));
    await assertFails(getDoc(doc(semConfirmar(), "users/ana")));
  });
  test("e-mail confirmado lê a lista de secretarias; visitante não", async () => {
    await assertSucceeds(getDoc(doc(ana(), "secretarias/saude")));
    await assertFails(getDoc(doc(anonimo(), "secretarias/saude")));
  });
  test("o cidadão não consegue se bloquear nem trocar a própria situação", async () => {
    await assertFails(updateDoc(doc(ana(), "users/ana"), { situacao: "bloqueado" }));
  });
  test("o cidadão edita o próprio nome e telefone", async () => {
    await assertSucceeds(updateDoc(doc(ana(), "users/ana"), { nome: "Ana Maria", telefone: "71999998888" }));
    await assertFails(updateDoc(doc(ana(), "users/ana"), { telefone: "abc" }));
  });
  test("exclusão da própria conta: anonimiza o perfil", async () => {
    await assertSucceeds(updateDoc(doc(ana(), "users/ana"), { situacao: "excluido", nome: "(removido)", email: "" }));
  });
  test("exclusão da conta exige apagar nome e e-mail (não vale só trocar a situação)", async () => {
    await assertFails(updateDoc(doc(ana(), "users/ana"), { situacao: "excluido" }));
  });
  test("ninguém lê o perfil de outra pessoa; o administrador lê", async () => {
    await assertFails(getDoc(doc(beto(), "users/ana")));
    await assertSucceeds(getDoc(doc(adm(), "users/ana")));
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
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "users/tom"), { nome: "Tom", email: "tom@x.com", situacao: "ativo", criadoEm: Timestamp.now() }); });
    const db = env.authenticatedContext("tom", { email: "tom@x.com", email_verified: true }).firestore();
    await assertFails(novoProtocolo(db, NUM, { uid: "tom" }).commit());
  });
  test("usuário bloqueado não registra", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "users/bia"), perfil("Bia", "bia@x.com", { situacao: "bloqueado" })); });
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
    await assertFails(deleteDoc(doc(ana(), "protocolos", NUM)));
    await assertFails(deleteDoc(doc(adm(), "protocolos", NUM)));
  });
  test("a mensagem inicial (m00) não nasce solta, fora do lote do protocolo", async () => {
    await semearProtocolo({}, { semMensagem: true });
    await assertFails(setDoc(doc(ana(), "protocolos", NUM, "mensagens", "m00"), { de: "cidadao", autorUid: "ana", assunto: "Teste", texto: "Texto", anexos: [], criadoEm: serverTimestamp() }));
  });
  test("mídia solta (sem mensagem no mesmo lote) é recusada", async () => {
    await semearProtocolo();
    await assertFails(setDoc(doc(ana(), "protocolos", NUM, "midias", "00_1_0"), { k: "00_1_0", mime: "image/jpeg", data: "AAAA" }));
  });
  test("tipo de arquivo não permitido é recusado", async () => {
    const db = ana();
    const b = novoProtocolo(db, NUM);
    b.set(doc(db, "protocolos", NUM, "midias", "00_0_0"), { k: "00_0_0", mime: "application/x-msdownload", data: "AAAA" });
    await assertFails(b.commit());
  });
});

// =====================================================================
describe("18. Sigilo: quem pode ler a conversa", () => {
  beforeEach(async () => { await semearProtocolo(); });
  test("o autor lê protocolo, mensagem e mídia", async () => {
    await assertSucceeds(getDoc(doc(ana(), "protocolos", NUM)));
    await assertSucceeds(getDoc(doc(ana(), "protocolos", NUM, "mensagens", "m00")));
    await assertSucceeds(getDoc(doc(ana(), "protocolos", NUM, "midias", "00_0_0")));
  });
  test("outro cidadão não lê nada", async () => {
    await assertFails(getDoc(doc(beto(), "protocolos", NUM)));
    await assertFails(getDoc(doc(beto(), "protocolos", NUM, "mensagens", "m00")));
    await assertFails(getDoc(doc(beto(), "protocolos", NUM, "midias", "00_0_0")));
  });
  test("o servidor da secretaria destinatária lê tudo", async () => {
    await assertSucceeds(getDoc(doc(sam(), "protocolos", NUM)));
    await assertSucceeds(getDoc(doc(sam(), "protocolos", NUM, "mensagens", "m00")));
    await assertSucceeds(getDoc(doc(sam(), "protocolos", NUM, "midias", "00_0_0")));
  });
  test("servidor de OUTRA secretaria não lê nada", async () => {
    await assertFails(getDoc(doc(sol(), "protocolos", NUM)));
    await assertFails(getDoc(doc(sol(), "protocolos", NUM, "mensagens", "m00")));
    await assertFails(getDoc(doc(sol(), "protocolos", NUM, "midias", "00_0_0")));
  });
  test("o administrador vê só os metadados (estatísticas), nunca mensagens nem mídias", async () => {
    await assertSucceeds(getDoc(doc(adm(), "protocolos", NUM)));
    await assertFails(getDoc(doc(adm(), "protocolos", NUM, "mensagens", "m00")));
    await assertFails(getDoc(doc(adm(), "protocolos", NUM, "midias", "00_0_0")));
    await assertFails(getDocs(collection(adm(), "protocolos", NUM, "mensagens")));
  });
  test("lista: o cidadão lista só os próprios protocolos", async () => {
    await assertSucceeds(getDocs(query(collection(ana(), "protocolos"), where("autorUid", "==", "ana"))));
    await assertFails(getDocs(collection(ana(), "protocolos")));
    await assertFails(getDocs(query(collection(beto(), "protocolos"), where("autorUid", "==", "ana"))));
  });
  test("lista: o servidor lista só a sua secretaria", async () => {
    await assertSucceeds(getDocs(query(collection(sam(), "protocolos"), where("secretariaId", "==", "saude"))));
    await assertFails(getDocs(query(collection(sam(), "protocolos"), where("secretariaId", "==", "obras"))));
  });
  test("usuário bloqueado perde o acesso à própria conversa", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "users/ana"), { situacao: "bloqueado" }); });
    await assertFails(getDoc(doc(ana(), "protocolos", NUM)));
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
    b.set(doc(db, "protocolos", NUM, "mensagens", "m01"), { de: "servidor", autorUid: "ana", texto: "Resolvido.", anexos: [], criadoEm: serverTimestamp() });
    await assertFails(b.commit());
  });
  test("o servidor não cria o aviso 'resposta' sem registrar a resposta", async () => {
    await assertFails(setDoc(doc(collection(sam(), "notificacoes")), {
      uid: "ana", protocoloId: NUM, tipo: "resposta", mensagem: "x", criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 24 * 3600_000),
    }));
  });
  test("o aviso de resposta dura 24 h (não aceita 10 dias)", async () => {
    const db = sam();
    const b = writeBatch(db);
    b.set(doc(db, "protocolos", NUM, "mensagens", "m01"), { de: "servidor", autorUid: "sam", texto: "ok", anexos: [], criadoEm: serverTimestamp() });
    b.update(doc(db, "protocolos", NUM), { status: "respondido", ultimaMsgPor: "servidor", respondidoEm: serverTimestamp() });
    b.set(doc(collection(db, "notificacoes")), { uid: "ana", protocoloId: NUM, tipo: "resposta", mensagem: "x", criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + 10 * DIA) });
    await assertFails(b.commit());
  });
  test("o cidadão complementa a própria mensagem", async () => {
    const db = ana();
    const b = writeBatch(db);
    contar(b, db, "ana", `${NUM}/m01`);
    b.set(doc(db, "protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "ana", texto: "Mais um detalhe.", anexos: [], criadoEm: serverTimestamp() });
    b.update(doc(db, "protocolos", NUM), { ultimaMsgPor: "cidadao" });
    await assertSucceeds(b.commit());
  });
  test("outro cidadão não escreve na conversa", async () => {
    const db = beto();
    await assertFails(setDoc(doc(db, "protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "beto", texto: "Intruso", anexos: [], criadoEm: serverTimestamp() }));
  });
  test("mensagens enviadas não podem ser alteradas nem apagadas (antes de 30 dias)", async () => {
    await assertFails(updateDoc(doc(ana(), "protocolos", NUM, "mensagens", "m00"), { texto: "Mudei" }));
    await assertFails(deleteDoc(doc(ana(), "protocolos", NUM, "mensagens", "m00")));
    await assertFails(updateDoc(doc(sam(), "protocolos", NUM, "mensagens", "m00"), { texto: "Mudei" }));
  });
  test("mensagem com mais de 5000 caracteres ou mais de 5 anexos é recusada", async () => {
    const db = ana();
    await assertFails(setDoc(doc(db, "protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "ana", texto: "x".repeat(5001), anexos: [], criadoEm: serverTimestamp() }));
    await assertFails(setDoc(doc(db, "protocolos", NUM, "mensagens", "m02"), { de: "cidadao", autorUid: "ana", texto: "ok", anexos: [1, 2, 3, 4, 5, 6], criadoEm: serverTimestamp() }));
  });

  describe("encerramento e nota", () => {
    beforeEach(async () => { await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "protocolos", NUM), respondido); }); });
    test("o cidadão conclui com nota 5", async () => {
      await assertSucceeds(updateDoc(doc(ana(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp(), avaliacao: 5 }));
    });
    test("nota fora de 1 a 5 é recusada", async () => {
      await assertFails(updateDoc(doc(ana(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp(), avaliacao: 6 }));
      await assertFails(updateDoc(doc(ana(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp(), avaliacao: 0 }));
    });
    test("o servidor conclui sem nota, mas não pode dar nota", async () => {
      await assertSucceeds(updateDoc(doc(sam(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
    });
    test("o servidor não dá nota no lugar do cidadão", async () => {
      await assertFails(updateDoc(doc(sam(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp(), avaliacao: 5 }));
    });
    test("servidor de outra secretaria e outro cidadão não concluem", async () => {
      await assertFails(updateDoc(doc(sol(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
      await assertFails(updateDoc(doc(beto(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
    });
    test("não conclui com data inventada (concluidoEm precisa ser a hora do servidor)", async () => {
      await assertFails(updateDoc(doc(ana(), "protocolos", NUM), { status: "concluido", concluidoEm: Timestamp.fromMillis(Date.now() + 40 * DIA) }));
    });
    test("depois de concluído: o autor dá a nota uma única vez", async () => {
      await assertSucceeds(updateDoc(doc(sam(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
      await assertSucceeds(updateDoc(doc(ana(), "protocolos", NUM), { avaliacao: 4 }));
      await assertFails(updateDoc(doc(ana(), "protocolos", NUM), { avaliacao: 5 }));
    });
    test("servidor concluir DEPOIS da nota do cidadão continua possível", async () => {
      await assertSucceeds(updateDoc(doc(ana(), "protocolos", NUM), { avaliacao: 3 }));
      await assertSucceeds(updateDoc(doc(sam(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
    });
    test("protocolo concluído não recebe novas mensagens", async () => {
      await assertSucceeds(updateDoc(doc(ana(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
      const db = ana();
      const b = writeBatch(db);
      contar(b, db, "ana", `${NUM}/m01`);
      b.set(doc(db, "protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "ana", texto: "Tarde demais", anexos: [], criadoEm: serverTimestamp() });
      await assertFails(b.commit());
    });
  });

  test("não conclui protocolo que ainda não foi respondido", async () => {
    await assertFails(updateDoc(doc(ana(), "protocolos", NUM), { status: "concluido", concluidoEm: serverTimestamp() }));
  });
  test("o cidadão não troca a secretaria, o autor nem o status por conta própria", async () => {
    await assertFails(updateDoc(doc(ana(), "protocolos", NUM), { secretariaId: "obras" }));
    await assertFails(updateDoc(doc(ana(), "protocolos", NUM), { autorUid: "beto" }));
    await assertFails(updateDoc(doc(ana(), "protocolos", NUM), { status: "respondido" }));
  });
});

// =====================================================================
describe("Limite de envios por conta (proteção contra abuso e contra o fim da cota gratuita)", () => {
  const complemento = (db: Db, c?: Contador) => {
    const b = writeBatch(db);
    contar(b, db, "ana", `${NUM}/m01`, c);
    b.set(doc(db, "protocolos", NUM, "mensagens", "m01"), { de: "cidadao", autorUid: "ana", texto: "Complemento.", anexos: [], criadoEm: serverTimestamp() });
    b.update(doc(db, "protocolos", NUM), { ultimaMsgPor: "cidadao" });
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
    b.set(doc(db, "protocolos", "OUV-2026-AAAA0002"), { numero: "OUV-2026-AAAA0002", autorUid: "ana", secretariaId: "saude", secretariaNome: "Saúde", tipo: "reclamacao", status: "aberto", ultimaMsgPor: "cidadao", criadoEm: serverTimestamp() });
    b.set(doc(db, "protocolos", "OUV-2026-AAAA0002", "mensagens", "m00"), { de: "cidadao", autorUid: "ana", assunto: "Segundo", texto: "Segundo protocolo", anexos: [], criadoEm: serverTimestamp() });
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
    await assertFails(updateDoc(doc(ana(), "users/ana"), { envios: 0, ultimoEnvio: "x" }));
    await assertFails(updateDoc(doc(ana(), "users/ana"), { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: "x" }));
  });
  test("o contador só sobe de 1 em 1", async () => {
    await semearContador("ana", 5, 1);
    await assertFails(updateDoc(doc(ana(), "users/ana"), { envios: 5, ultimoEnvio: "x" }));
    await assertFails(updateDoc(doc(ana(), "users/ana"), { envios: 7, ultimoEnvio: "x" }));
    await assertSucceeds(updateDoc(doc(ana(), "users/ana"), { envios: 6, ultimoEnvio: "x" }));
  });
  test("o cidadão não altera contador de outra pessoa; o administrador também não", async () => {
    await assertFails(updateDoc(doc(beto(), "users/ana"), { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: "x" }));
    await assertFails(updateDoc(doc(adm(), "users/ana"), { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: "x" }));
  });
  test("a resposta do servidor não gasta o contador de ninguém", async () => {
    await semearProtocolo();
    await assertSucceeds(respostaServidor(sam()).commit());
  });
});

// =====================================================================
describe("Retenção: a conversa só é apagada 30 dias depois de concluída", () => {
  test("antes de 30 dias, ninguém apaga a conversa nem as mídias", async () => {
    await semearProtocolo(concluidoHa(29));
    await assertFails(deleteDoc(doc(ana(), "protocolos", NUM, "mensagens", "m00")));
    await assertFails(deleteDoc(doc(sam(), "protocolos", NUM, "midias", "00_0_0")));
    await assertFails(updateDoc(doc(ana(), "protocolos", NUM), { apagada: true }));
  });
  test("depois de 30 dias, o autor e o servidor apagam e marcam como apagada", async () => {
    await semearProtocolo(concluidoHa(31));
    await assertSucceeds(deleteDoc(doc(ana(), "protocolos", NUM, "midias", "00_0_0")));
    await assertSucceeds(deleteDoc(doc(sam(), "protocolos", NUM, "mensagens", "m00")));
    await assertSucceeds(updateDoc(doc(ana(), "protocolos", NUM), { apagada: true }));
  });
  test("terceiros e administrador nunca apagam a conversa, mesmo depois de 30 dias", async () => {
    await semearProtocolo(concluidoHa(31));
    await assertFails(deleteDoc(doc(beto(), "protocolos", NUM, "mensagens", "m00")));
    await assertFails(deleteDoc(doc(sol(), "protocolos", NUM, "mensagens", "m00")));
    await assertFails(deleteDoc(doc(adm(), "protocolos", NUM, "mensagens", "m00")));
  });
  test("protocolo não concluído nunca tem conversa apagada", async () => {
    await semearProtocolo({ ...respondido });
    await assertFails(deleteDoc(doc(ana(), "protocolos", NUM, "mensagens", "m00")));
  });
});

// =====================================================================
describe("15-16. Administração, equipe e bloqueio de usuário", () => {
  test("o administrador cria, edita e apaga secretarias; o cidadão não", async () => {
    await assertSucceeds(setDoc(doc(adm(), "secretarias/educacao"), { nome: "Educação", ativa: true }));
    await assertSucceeds(updateDoc(doc(adm(), "secretarias/educacao"), { ativa: false }));
    await assertSucceeds(deleteDoc(doc(adm(), "secretarias/educacao")));
    await assertFails(setDoc(doc(ana(), "secretarias/hack"), { nome: "Hack", ativa: true }));
    await assertFails(setDoc(doc(sam(), "secretarias/hack"), { nome: "Hack", ativa: true }));
  });
  test("o administrador cadastra um secretário numa secretaria que existe", async () => {
    await assertSucceeds(setDoc(doc(adm(), "equipe/novo@x.com"), { nome: "Novo", papel: "secretario", secretariaId: "saude", ativo: true }));
    await assertFails(setDoc(doc(adm(), "equipe/novo2@x.com"), { nome: "Novo", papel: "secretario", secretariaId: "nao-existe", ativo: true }));
    await assertFails(setDoc(doc(adm(), "equipe/novo3@x.com"), { nome: "Novo", papel: "chefe", secretariaId: "saude", ativo: true }));
  });
  test("quem não é administrador não mexe na equipe (nem o próprio secretário)", async () => {
    await assertFails(setDoc(doc(ana(), "equipe/ana@x.com"), { nome: "Ana", papel: "admin", ativo: true }));
    await assertFails(setDoc(doc(sam(), "equipe/sam@x.com"), { nome: "Sam", papel: "admin", ativo: true }));
    await assertFails(updateDoc(doc(sam(), "equipe/sam@x.com"), { papel: "admin" }));
  });
  test("o administrador não se rebaixa, não se desativa e não se apaga", async () => {
    await assertFails(setDoc(doc(adm(), "equipe/adm@x.com"), { nome: "Adm", papel: "secretario", secretariaId: "saude", ativo: true }));
    await assertFails(setDoc(doc(adm(), "equipe/adm@x.com"), { nome: "Adm", papel: "admin", ativo: false }));
    await assertFails(deleteDoc(doc(adm(), "equipe/adm@x.com")));
  });
  test("secretário desativado perde o acesso às conversas", async () => {
    await semearProtocolo();
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "equipe/sam@x.com"), { ativo: false }); });
    await assertFails(getDoc(doc(sam(), "protocolos", NUM, "mensagens", "m00")));
  });
  test("o administrador bloqueia e desbloqueia; o bloqueado perde o acesso", async () => {
    await assertSucceeds(updateDoc(doc(adm(), "users/ana"), { situacao: "bloqueado" }));
    await assertFails(getDoc(doc(ana(), "secretarias/saude")));
    await assertFails(novoProtocolo(ana(), NUM).commit());
    await assertSucceeds(updateDoc(doc(adm(), "users/ana"), { situacao: "ativo" }));
    await assertSucceeds(getDoc(doc(ana(), "secretarias/saude")));
  });
  test("o administrador não bloqueia a si mesmo", async () => {
    await assertFails(updateDoc(doc(adm(), "users/adm"), { situacao: "bloqueado" }));
  });
  test("o administrador não edita o nome, o e-mail nem o telefone de ninguém", async () => {
    await assertFails(updateDoc(doc(adm(), "users/ana"), { nome: "Outro nome" }));
    await assertFails(updateDoc(doc(adm(), "users/ana"), { email: "novo@x.com" }));
  });
  test("o administrador exclui (anonimiza) um usuário", async () => {
    await assertSucceeds(updateDoc(doc(adm(), "users/ana"), { situacao: "excluido", nome: "(removido)", email: "" }));
  });
  test("usuário excluído não volta a ser ativado", async () => {
    await env.withSecurityRulesDisabled(async (c) => { await updateDoc(doc(c.firestore(), "users/ana"), { situacao: "excluido", nome: "(removido)", email: "" }); });
    await assertFails(updateDoc(doc(adm(), "users/ana"), { situacao: "ativo" }));
  });
});

// =====================================================================
describe("13. Notificações e avisos", () => {
  const aviso = (uid: string, dias = 7) => ({ uid, protocoloId: "", tipo: "aviso", mensagem: "Aviso da prefeitura.", criadoEm: serverTimestamp(), expiraEm: Timestamp.fromMillis(Date.now() + dias * DIA) });
  test("o administrador envia aviso a um usuário; ele lê e dispensa", async () => {
    await assertSucceeds(setDoc(doc(adm(), "notificacoes/n1"), aviso("ana")));
    await assertSucceeds(getDoc(doc(ana(), "notificacoes/n1")));
    await assertSucceeds(deleteDoc(doc(ana(), "notificacoes/n1")));
  });
  test("outro usuário não lê nem apaga o aviso alheio", async () => {
    await assertSucceeds(setDoc(doc(adm(), "notificacoes/n1"), aviso("ana")));
    await assertFails(getDoc(doc(beto(), "notificacoes/n1")));
    await assertFails(deleteDoc(doc(beto(), "notificacoes/n1")));
  });
  test("cidadão e servidor não enviam aviso do administrador", async () => {
    await assertFails(setDoc(doc(ana(), "notificacoes/n2"), aviso("beto")));
    await assertFails(setDoc(doc(sam(), "notificacoes/n3"), aviso("ana")));
  });
  test("aviso com prazo acima de 31 dias é recusado", async () => {
    await assertFails(setDoc(doc(adm(), "notificacoes/n4"), aviso("ana", 90)));
  });
  test("ninguém edita uma notificação", async () => {
    await assertSucceeds(setDoc(doc(adm(), "notificacoes/n1"), aviso("ana")));
    await assertFails(updateDoc(doc(ana(), "notificacoes/n1"), { mensagem: "Outra" }));
    await assertFails(updateDoc(doc(adm(), "notificacoes/n1"), { mensagem: "Outra" }));
  });
});

// =====================================================================
describe("Aparência e publicidade (públicas)", () => {
  const site = () => ({ nome: "Prefeitura", cor: "#0b3b8c", logo: "", contato: "", atualizadoEm: serverTimestamp() });
  test("a aparência é pública; só o administrador altera", async () => {
    await assertSucceeds(getDoc(doc(anonimo(), "config/site")));
    await assertSucceeds(setDoc(doc(adm(), "config/site"), site()));
    await assertFails(setDoc(doc(ana(), "config/site"), site()));
    await assertFails(setDoc(doc(adm(), "config/outra"), site()));
  });
  test("cor inválida ou logo que não é imagem é recusada", async () => {
    await assertFails(setDoc(doc(adm(), "config/site"), { ...site(), cor: "vermelho" }));
    await assertFails(setDoc(doc(adm(), "config/site"), { ...site(), logo: "javascript:alert(1)" }));
  });
  test("anúncios ativos são públicos; os inativos só para o administrador", async () => {
    await assertSucceeds(getDocs(query(collection(anonimo(), "anuncios"), where("ativo", "==", true))));
    await assertFails(getDoc(doc(anonimo(), "anuncios/a2")));
    await assertSucceeds(getDoc(doc(adm(), "anuncios/a2")));
  });
  test("anúncio com link que não é https é recusado", async () => {
    await assertFails(setDoc(doc(adm(), "anuncios/a3"), { titulo: "X", link: "javascript:alert(1)", imagem: "data:image/png;base64,AAAA", ativo: true, ordem: 1, criadoEm: Timestamp.now() }));
    await assertSucceeds(setDoc(doc(adm(), "anuncios/a4"), { titulo: "X", link: "https://exemplo.com.br", imagem: "data:image/png;base64,AAAA", ativo: true, ordem: 1, criadoEm: Timestamp.now() }));
  });
});

// =====================================================================
describe("Padrão: tudo que não foi liberado está negado", () => {
  test("coleção desconhecida", async () => {
    await assertFails(setDoc(doc(adm(), "qualquer/coisa"), { a: 1 }));
    await assertFails(getDoc(doc(adm(), "qualquer/coisa")));
  });
});

// =====================================================================
// Ainda NÃO existem no sistema (Fases 2 e 3 do plano). Ficam aqui como lembrete obrigatório:
describe("Pendentes (Fases 2 e 3)", () => {
  test.todo("12. Prorrogação de prazo (1 vez, até +30 dias, com justificativa e registro do servidor)");
  test.todo("14. Ouvidor geral acompanha e redistribui demandas, com histórico de encaminhamentos");
  test.todo("17. Isolamento entre municípios: usuário de um município não lê nem escreve em outro");
  test.todo("19. Pedidos de acesso à informação (LAI) e recursos, separados da Ouvidoria");
  test.todo("Prefeito: vê indicadores, nunca denúncias nem dados pessoais");
});

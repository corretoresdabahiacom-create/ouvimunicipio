import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { randomInt } from "node:crypto";

initializeApp();
setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

const db = getFirestore();
const auth = getAuth();

const PRAZO_RESPOSTA_DIAS = 30;
const EXPIRA_NOTIFICACAO_HORAS = 24;
const MAX_PROTOCOLOS_POR_DIA = 10;
const MAX_ANEXOS = 5;
const MAX_BYTES_IMAGEM = 10 * 1024 * 1024;
const MAX_BYTES_VIDEO = 50 * 1024 * 1024;
const OPTS = { enforceAppCheck: true } as const;

type Papel = "cidadao" | "servidor" | "admin";

// ---------- helpers ----------
function exigirVerificado(req: CallableRequest) {
  if (!req.auth) throw new HttpsError("unauthenticated", "Faça login.");
  if (req.auth.token.email_verified !== true)
    throw new HttpsError("failed-precondition", "Confirme seu e-mail para continuar.");
  return req.auth;
}

function exigirPapel(req: CallableRequest, papel: Papel) {
  const a = exigirVerificado(req);
  if (a.token.role !== papel) throw new HttpsError("permission-denied", "Sem permissão.");
  return a;
}

function texto(v: unknown, campo: string, max: number, min = 1): string {
  if (typeof v !== "string") throw new HttpsError("invalid-argument", `${campo} inválido.`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw new HttpsError("invalid-argument", `${campo} inválido.`);
  return s;
}

function email(v: unknown): string {
  const s = texto(v, "E-mail", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new HttpsError("invalid-argument", "E-mail inválido.");
  return s;
}

function numeroProtocolo(): string {
  const ano = new Date().getFullYear();
  return `OUV-${ano}-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
}

async function auditar(acao: string, uid: string, detalhe: Record<string, unknown> = {}) {
  await db.collection("auditoria").add({ acao, uid, detalhe, em: FieldValue.serverTimestamp() });
}

// Envio de e-mail: usa a extensão "Trigger Email" do Firebase (coleção `mail`).
async function enviarEmail(to: string, subject: string, html: string) {
  await db.collection("mail").add({ to, message: { subject, html } });
}

// ---------- cidadão ----------
export const criarProtocolo = onCall(OPTS, async (req) => {
  const a = exigirVerificado(req);
  const uid = a.uid;
  const d = (req.data ?? {}) as Record<string, unknown>;

  const protocoloId = texto(d.protocoloId, "ID", 40);
  if (!/^[A-Za-z0-9]{10,40}$/.test(protocoloId)) throw new HttpsError("invalid-argument", "ID inválido.");
  const secretariaId = texto(d.secretariaId, "Secretaria", 64);
  const assunto = texto(d.assunto, "Assunto", 120, 3);
  const mensagem = texto(d.mensagem, "Mensagem", 5000, 3);
  const anexosIn = Array.isArray(d.anexos) ? (d.anexos as unknown[]) : [];
  if (anexosIn.length > MAX_ANEXOS) throw new HttpsError("invalid-argument", "Máximo de 5 anexos.");

  const sec = await db.doc(`secretarias/${secretariaId}`).get();
  if (!sec.exists || sec.get("ativa") !== true) throw new HttpsError("not-found", "Secretaria indisponível.");

  // limite diário por usuário (anti-spam)
  const hoje = new Date().toISOString().slice(0, 10);
  const limRef = db.doc(`limites/${uid}_${hoje}`);
  await db.runTransaction(async (t) => {
    const s = await t.get(limRef);
    const n = (s.get("n") as number | undefined) ?? 0;
    if (n >= MAX_PROTOCOLOS_POR_DIA) throw new HttpsError("resource-exhausted", "Limite diário atingido.");
    t.set(limRef, { n: n + 1, uid, dia: hoje, expiraEm: Timestamp.fromMillis(Date.now() + 48 * 3600e3) });
  });

  // valida cada anexo no Storage (existe, é do usuário, tipo e tamanho permitidos)
  const bucket = getStorage().bucket();
  const anexos: { path: string; tipo: "imagem" | "video"; bytes: number }[] = [];
  for (const raw of anexosIn) {
    const nome = texto((raw as any)?.nome, "Arquivo", 120);
    if (!/^[A-Za-z0-9._-]+$/.test(nome)) throw new HttpsError("invalid-argument", "Nome de arquivo inválido.");
    const path = `uploads/${uid}/${protocoloId}/${nome}`;
    const [existe] = await bucket.file(path).exists();
    if (!existe) throw new HttpsError("invalid-argument", "Anexo não encontrado.");
    const [meta] = await bucket.file(path).getMetadata();
    const ct = String(meta.contentType ?? "");
    const bytes = Number(meta.size ?? 0);
    const imagem = /^image\/(jpeg|png|webp|gif)$/.test(ct);
    const video = /^video\/(mp4|webm|quicktime)$/.test(ct);
    if ((!imagem && !video) || bytes > (imagem ? MAX_BYTES_IMAGEM : MAX_BYTES_VIDEO)) {
      await bucket.file(path).delete().catch(() => undefined);
      throw new HttpsError("invalid-argument", "Tipo ou tamanho de anexo não permitido.");
    }
    anexos.push({ path, tipo: imagem ? "imagem" : "video", bytes });
  }

  const ref = db.doc(`protocolos/${protocoloId}`);
  if ((await ref.get()).exists) throw new HttpsError("already-exists", "Protocolo já existe.");
  const numero = numeroProtocolo();
  const agora = Timestamp.now();
  const prazo = Timestamp.fromMillis(agora.toMillis() + PRAZO_RESPOSTA_DIAS * 86400e3);

  await ref.set({
    numero, autorUid: uid, secretariaId, secretariaNome: sec.get("nome"),
    assunto, mensagem, anexos, status: "aberto",
    criadoEm: agora, prazoEm: prazo,
  });
  await db.collection("notificacoes").add({
    uid, protocoloId, numero, tipo: "recebido",
    mensagem: `Protocolo ${numero} registrado para ${sec.get("nome")}. Prazo de resposta: ${PRAZO_RESPOSTA_DIAS} dias.`,
    criadoEm: agora,
    expiraEm: Timestamp.fromMillis(agora.toMillis() + 30 * 86400e3),
  });
  return { protocoloId, numero, prazoEm: prazo.toMillis() };
});

// ---------- servidor ----------
export const responderProtocolo = onCall(OPTS, async (req) => {
  const a = exigirPapel(req, "servidor");
  const d = (req.data ?? {}) as Record<string, unknown>;
  const protocoloId = texto(d.protocoloId, "ID", 40);
  const resposta = texto(d.resposta, "Resposta", 5000, 3);

  const ref = db.doc(`protocolos/${protocoloId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Protocolo não encontrado.");
  if (snap.get("secretariaId") !== a.token.secretariaId)
    throw new HttpsError("permission-denied", "Protocolo de outra secretaria.");
  if (snap.get("status") === "respondido") throw new HttpsError("failed-precondition", "Já respondido.");

  const agora = Timestamp.now();
  await ref.update({ status: "respondido", resposta, respondidoPor: a.uid, respondidoEm: agora });
  await db.collection("notificacoes").add({
    uid: snap.get("autorUid"), protocoloId, numero: snap.get("numero"), tipo: "resposta",
    mensagem: `Seu protocolo ${snap.get("numero")} foi respondido. Atenção: este aviso será apagado em ${EXPIRA_NOTIFICACAO_HORAS} horas. A resposta continua disponível no protocolo.`,
    criadoEm: agora,
    expiraEm: Timestamp.fromMillis(agora.toMillis() + EXPIRA_NOTIFICACAO_HORAS * 3600e3),
  });
  await auditar("protocolo.responder", a.uid, { protocoloId });
  return { ok: true };
});

// ---------- admin: secretarias ----------
export const adminSalvarSecretaria = onCall(OPTS, async (req) => {
  const a = exigirPapel(req, "admin");
  const d = (req.data ?? {}) as Record<string, unknown>;
  const nome = texto(d.nome, "Nome", 120, 2);
  const ativa = d.ativa !== false;
  const id = typeof d.id === "string" && d.id ? texto(d.id, "ID", 64) : db.collection("secretarias").doc().id;
  await db.doc(`secretarias/${id}`).set({ nome, ativa, atualizadoEm: FieldValue.serverTimestamp() }, { merge: true });
  await auditar("secretaria.salvar", a.uid, { id });
  return { id };
});

export const adminExcluirSecretaria = onCall(OPTS, async (req) => {
  const a = exigirPapel(req, "admin");
  const id = texto((req.data as any)?.id, "ID", 64);
  const emUso = await db.collection("users").where("secretariaId", "==", id).limit(1).get();
  if (!emUso.empty) throw new HttpsError("failed-precondition", "Há servidores nesta secretaria.");
  await db.doc(`secretarias/${id}`).delete();
  await auditar("secretaria.excluir", a.uid, { id });
  return { ok: true };
});

// ---------- admin: servidores ----------
export const adminCriarServidor = onCall(OPTS, async (req) => {
  const a = exigirPapel(req, "admin");
  const d = (req.data ?? {}) as Record<string, unknown>;
  const nome = texto(d.nome, "Nome", 120, 2);
  const mail = email(d.email);
  const secretariaId = texto(d.secretariaId, "Secretaria", 64);
  const cargo = d.cargo === "assessor" ? "assessor" : "secretario";
  if (!(await db.doc(`secretarias/${secretariaId}`).get()).exists)
    throw new HttpsError("not-found", "Secretaria não existe.");

  const user = await auth.createUser({ email: mail, displayName: nome, emailVerified: false });
  await auth.setCustomUserClaims(user.uid, { role: "servidor", secretariaId });
  await db.doc(`users/${user.uid}`).set({
    nome, email: mail, role: "servidor", cargo, secretariaId, ativo: true, criadoEm: FieldValue.serverTimestamp(),
  });
  // convite: o servidor define a senha pelo link, o que também confirma o e-mail
  const link = await auth.generatePasswordResetLink(mail);
  await enviarEmail(mail, "Acesso ao sistema Ouvidoria Municipal",
    `<p>Olá, ${nome}.</p><p>Você foi cadastrado como servidor. Defina sua senha (isto confirma seu e-mail): <a href="${link}">definir senha</a>.</p>`);
  await auditar("servidor.criar", a.uid, { uid: user.uid, secretariaId });
  return { uid: user.uid };
});

export const adminAtualizarServidor = onCall(OPTS, async (req) => {
  const a = exigirPapel(req, "admin");
  const d = (req.data ?? {}) as Record<string, unknown>;
  const uid = texto(d.uid, "UID", 128);
  const alvo = await db.doc(`users/${uid}`).get();
  if (!alvo.exists || alvo.get("role") !== "servidor") throw new HttpsError("not-found", "Servidor não encontrado.");
  const upd: Record<string, unknown> = {};
  if (d.nome !== undefined) upd.nome = texto(d.nome, "Nome", 120, 2);
  if (d.cargo !== undefined) upd.cargo = d.cargo === "assessor" ? "assessor" : "secretario";
  if (d.ativo !== undefined) upd.ativo = d.ativo === true;
  if (d.secretariaId !== undefined) {
    const sid = texto(d.secretariaId, "Secretaria", 64);
    if (!(await db.doc(`secretarias/${sid}`).get()).exists) throw new HttpsError("not-found", "Secretaria não existe.");
    upd.secretariaId = sid;
    await auth.setCustomUserClaims(uid, { role: "servidor", secretariaId: sid });
  }
  if (upd.ativo === false) {
    await auth.updateUser(uid, { disabled: true });
    await auth.revokeRefreshTokens(uid);
  } else if (upd.ativo === true) {
    await auth.updateUser(uid, { disabled: false });
  }
  await db.doc(`users/${uid}`).update(upd);
  await auditar("servidor.atualizar", a.uid, { uid });
  return { ok: true };
});

export const adminExcluirServidor = onCall(OPTS, async (req) => {
  const a = exigirPapel(req, "admin");
  const uid = texto((req.data as any)?.uid, "UID", 128);
  const alvo = await db.doc(`users/${uid}`).get();
  if (!alvo.exists || alvo.get("role") !== "servidor") throw new HttpsError("not-found", "Servidor não encontrado.");
  await auth.deleteUser(uid);
  await db.doc(`users/${uid}`).delete();
  await auditar("servidor.excluir", a.uid, { uid });
  return { ok: true };
});

// ---------- manutenção ----------
// Apaga notificações vencidas (ex.: aviso de resposta, 24 h) e contadores antigos.
export const limparExpirados = onSchedule({ schedule: "every 60 minutes", timeZone: "America/Sao_Paulo" }, async () => {
  const agora = Timestamp.now();
  for (const col of ["notificacoes", "limites"]) {
    let snap;
    do {
      snap = await db.collection(col).where("expiraEm", "<=", agora).limit(400).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (!snap.empty) await batch.commit();
    } while (snap.size === 400);
  }
});

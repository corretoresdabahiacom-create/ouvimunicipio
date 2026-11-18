// Apagamento DEFINITIVO dos dados de um município já EXCLUÍDO no painel do superadmin.
// Faz backup (.ndjson) de tudo antes e só apaga com --confirmar <slug>. O documento municipios/{slug} fica
// (marcado como excluído), para o endereço continuar bloqueado. Só apaga logins (Authentication) com --logins.
//
// Uso (PowerShell, na pasta scripts, depois de "npm install"):
//   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\chave-servico.json"
//   node apagar-municipio.mjs alagoinhas                       (só mostra o que seria apagado)
//   node apagar-municipio.mjs alagoinhas --confirmar alagoinhas  (faz backup e apaga)
// Opcional: --logins também apaga os LOGINS (Authentication) das pessoas desse município. Só apaga quem não tem
// cadastro em nenhum outro município e nunca apaga superadmin. Sem --confirmar, só mostra quantos seriam apagados.
//   node apagar-municipio.mjs alagoinhas --logins
//   node apagar-municipio.mjs alagoinhas --confirmar alagoinhas --logins
import { createWriteStream } from "node:fs";
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const slug = process.argv[2] ?? "";
const iC = process.argv.indexOf("--confirmar");
const confirmado = iC > 0 && process.argv[iC + 1] === slug;
const comLogins = process.argv.includes("--logins");
if (!/^[a-z0-9-]{2,40}$/.test(slug)) { console.error("Informe o endereço do município. Ex.: node apagar-municipio.mjs alagoinhas"); process.exit(1); }

const conta = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp({ credential: conta ? cert(JSON.parse(conta)) : applicationDefault() });
const db = getFirestore();
const ref = db.doc(`municipios/${slug}`);
const m = await ref.get();
if (!m.exists) { console.error(`Município /${slug} não existe.`); process.exit(1); }
if (m.get("excluido") !== true) { console.error(`Município /${slug} NÃO está excluído. Exclua primeiro no painel do superadmin.`); process.exit(1); }

const ser = (v) => v instanceof Timestamp ? { __ts: v.toMillis() } : Array.isArray(v) ? v.map(ser)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)])) : v;

async function percorrer(r, cb) {
  for (const c of await r.listCollections()) for (const d of (await c.get()).docs) { await cb(d); await percorrer(d.ref, cb); }
}
// Logins que só existem por causa deste município (calculado ANTES de apagar os dados).
async function loginsExclusivos() {
  const uids = new Set(), emails = new Set();
  for (const d of (await ref.collection("users").get()).docs) { uids.add(d.id); const e = d.get("email"); if (typeof e === "string") emails.add(e.toLowerCase()); }
  for (const d of (await ref.collection("equipe").get()).docs) emails.add(d.id.toLowerCase());
  const supers = new Set((await db.collection("superadmins").get()).docs.map((d) => d.id.toLowerCase()));
  const outros = (await db.collection("municipios").get()).docs.filter((d) => d.id !== slug);
  const auth = getAuth();
  const alvo = new Map(); // uid -> e-mail
  for (const e of emails) { try { const u = await auth.getUserByEmail(e); uids.add(u.uid); } catch { /* sem login */ } }
  for (const uid of uids) {
    let u; try { u = await auth.getUser(uid); } catch { continue; }
    const email = (u.email ?? "").toLowerCase();
    if (supers.has(email)) continue;
    let usadoFora = false;
    for (const m of outros) {
      if ((await m.ref.collection("users").doc(uid).get()).exists || (email && (await m.ref.collection("equipe").doc(email).get()).exists)) { usadoFora = true; break; }
    }
    if (!usadoFora) alvo.set(uid, email);
  }
  return alvo;
}
const logins = comLogins ? await loginsExclusivos() : new Map();
let n = 0;
const arquivo = `backup-${slug}-${new Date().toISOString().slice(0, 10)}.ndjson`;
const saida = confirmado ? createWriteStream(arquivo) : null;
await percorrer(ref, async (d) => { n++; saida?.write(JSON.stringify({ path: d.ref.path, data: ser(d.data()) }) + "\n"); });
if (!confirmado) {
  console.log(`/${slug} (${m.get("nome")}): ${n} documento(s) seriam apagados. Nada foi feito.`);
  if (comLogins) console.log(`${logins.size} login(s) seriam apagados (só existem neste município): ${[...logins.values()].join(", ") || "nenhum"}`);
  console.log(`Para apagar: node apagar-municipio.mjs ${slug} --confirmar ${slug}${comLogins ? " --logins" : ""}`);
  process.exit(0);
}
await new Promise((r) => saida.end(r));
console.log(`Backup: ${arquivo} (${n} documentos). Guarde-o em local seguro (contém dados pessoais) ou apague quando não precisar mais.`);
for (const c of await ref.listCollections()) await db.recursiveDelete(c);
console.log(`Dados de /${slug} apagados. O endereço continua bloqueado.`);
if (comLogins) {
  for (const uid of logins.keys()) await getAuth().deleteUser(uid);
  console.log(`${logins.size} login(s) apagado(s). Quem tem cadastro em outro município ou é superadmin foi mantido.`);
}

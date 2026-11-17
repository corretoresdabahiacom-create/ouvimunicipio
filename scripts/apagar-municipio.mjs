// Apagamento DEFINITIVO dos dados de um município já EXCLUÍDO no painel do superadmin.
// Faz backup (.ndjson) de tudo antes e só apaga com --confirmar <slug>. O documento municipios/{slug} fica
// (marcado como excluído), para o endereço continuar bloqueado. Não apaga logins (Authentication), que são globais.
//
// Uso (PowerShell, na pasta scripts, depois de "npm install"):
//   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\chave-servico.json"
//   node apagar-municipio.mjs alagoinhas                       (só mostra o que seria apagado)
//   node apagar-municipio.mjs alagoinhas --confirmar alagoinhas  (faz backup e apaga)
import { createWriteStream } from "node:fs";
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const slug = process.argv[2] ?? "";
const iC = process.argv.indexOf("--confirmar");
const confirmado = iC > 0 && process.argv[iC + 1] === slug;
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
let n = 0;
const arquivo = `backup-${slug}-${new Date().toISOString().slice(0, 10)}.ndjson`;
const saida = confirmado ? createWriteStream(arquivo) : null;
await percorrer(ref, async (d) => { n++; saida?.write(JSON.stringify({ path: d.ref.path, data: ser(d.data()) }) + "\n"); });
if (!confirmado) {
  console.log(`/${slug} (${m.get("nome")}): ${n} documento(s) seriam apagados. Nada foi feito.`);
  console.log(`Para apagar: node apagar-municipio.mjs ${slug} --confirmar ${slug}`);
  process.exit(0);
}
await new Promise((r) => saida.end(r));
console.log(`Backup: ${arquivo} (${n} documentos). Guarde-o em local seguro (contém dados pessoais) ou apague quando não precisar mais.`);
for (const c of await ref.listCollections()) await db.recursiveDelete(c);
console.log(`Dados de /${slug} apagados. O endereço continua bloqueado.`);

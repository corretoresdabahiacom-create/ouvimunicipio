// Migra os dados do formato antigo (coleções na raiz) para municipios/{slug}/… e cadastra o SUPERADMIN.
// NÃO apaga nada do formato antigo. Faz primeiro um BACKUP completo (arquivo .ndjson) e confere as contagens no fim.
//
// Uso (no PowerShell, dentro da pasta scripts, depois de "npm install"):
//   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\chave-servico.json"
//   node migrar-para-municipio.mjs --slug itabuna --nome "Prefeitura de Itabuna" --superadmin voce@email.com --dry-run
//   (se o resumo estiver certo, rode de novo SEM --dry-run)
//
// A chave de serviço: Firebase > Configurações do projeto > Contas de serviço > "Gerar nova chave privada".
// É um segredo: não envie para o GitHub nem para mim. Apague o arquivo depois.
import { createWriteStream } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? d : (process.argv[i + 1] ?? true); };
const slug = String(arg("slug", ""));
const nome = String(arg("nome", ""));
const superadmin = String(arg("superadmin", "")).toLowerCase();
const plano = String(arg("plano", "basico"));
const seco = process.argv.includes("--dry-run");
if (!/^[a-z0-9-]{2,40}$/.test(slug) || nome.length < 2) { console.error("Informe --slug (a-z, 0-9, -) e --nome."); process.exit(1); }
if (!["basico", "padrao", "completo"].includes(plano)) { console.error("--plano: basico, padrao ou completo."); process.exit(1); }

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const COLECOES = ["config", "equipe", "secretarias", "anuncios", "users", "notificacoes"]; // estatisticas é recalculada pelo app
const SUBS = ["mensagens", "midias", "historico"];

const ser = (v) => v instanceof Timestamp ? { __ts: v.toMillis() } : Array.isArray(v) ? v.map(ser)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)])) : v;

const arquivo = `backup-${new Date().toISOString().slice(0, 10)}.ndjson`;
const saida = createWriteStream(arquivo);
const contagem = { origem: {}, destino: {} };
const conta = (o, k) => { o[k] = (o[k] ?? 0) + 1; };

let lote = db.batch(), n = 0;
async function gravar(ref, dados) {
  if (seco) return;
  lote.set(ref, dados); n++;
  if (n >= 400) { await lote.commit(); lote = db.batch(); n = 0; }
}
const alvo = (...seg) => db.doc(["municipios", slug, ...seg].join("/"));

async function copiarDoc(d, caminhoRelativo, grupo) {
  saida.write(JSON.stringify({ path: d.ref.path, data: ser(d.data()) }) + "\n");
  conta(contagem.origem, grupo);
  await gravar(alvo(...caminhoRelativo), d.data());
  conta(contagem.destino, grupo);
}

console.log(seco ? "MODO TESTE (nada será gravado, só o backup)." : "Gravando de verdade.");
for (const c of COLECOES) for (const d of (await db.collection(c).get()).docs) await copiarDoc(d, [c, d.id], c);
for (const p of (await db.collection("protocolos").get()).docs) {
  await copiarDoc(p, ["protocolos", p.id], "protocolos");
  for (const s of SUBS) for (const d of (await p.ref.collection(s).get()).docs) await copiarDoc(d, ["protocolos", p.id, s, d.id], `protocolos/${s}`);
}
if (!seco) {
  await gravar(db.doc(`municipios/${slug}`), { nome, ativo: true, plano, criadoEm: FieldValue.serverTimestamp() });
  if (superadmin) await gravar(db.doc(`superadmins/${superadmin}`), { criadoEm: FieldValue.serverTimestamp() });
  if (n) await lote.commit();
}
await new Promise((r) => saida.end(r));
console.log("Backup:", arquivo);
console.log("Documentos lidos (formato antigo):", contagem.origem);
if (!seco) {
  // confere os totais no destino
  const conf = {};
  for (const c of COLECOES) conf[c] = (await db.collection(`municipios/${slug}/${c}`).count().get()).data().count;
  conf.protocolos = (await db.collection(`municipios/${slug}/protocolos`).count().get()).data().count;
  console.log("Documentos no novo município:", conf);
  const dif = COLECOES.concat("protocolos").filter((k) => (contagem.origem[k] ?? 0) !== conf[k]);
  console.log(dif.length ? `ATENÇÃO: contagens diferentes em: ${dif.join(", ")}. NÃO publique as regras novas.` : "Contagens conferem.");
}
console.log("Nada foi apagado do formato antigo. Confira o app antes de apagar manualmente.");

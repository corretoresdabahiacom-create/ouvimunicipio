// Retenção de dados: apaga os protocolos concluídos há mais de N anos (padrão 5), com tudo que pertence a eles
// (conversa, mídia, histórico e a cópia da consulta pública). Faz BACKUP (.ndjson) antes e só apaga com --confirmar.
// Nunca toca em protocolos não concluídos. Não depende de plano pago: roda no GitHub Actions (retencao.yml) ou no seu computador.
//
//   node retencao.mjs                      (só mostra quantos seriam apagados, por município)
//   node retencao.mjs --anos 3             (outro prazo)
//   node retencao.mjs --confirmar          (faz backup e apaga)
import { createWriteStream } from "node:fs";
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { ANOS_PADRAO, anosValidos, limiteRetencao } from "./retencao-regras.mjs";

const iA = process.argv.indexOf("--anos");
const anos = iA > 0 ? anosValidos(process.argv[iA + 1]) : ANOS_PADRAO;
if (!anos) { console.error("--anos deve ser um número inteiro de 1 a 30."); process.exit(1); }
const confirmado = process.argv.includes("--confirmar");

const conta = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp({ credential: conta ? cert(JSON.parse(conta)) : applicationDefault() });
const db = getFirestore();
const corte = Timestamp.fromMillis(limiteRetencao(Date.now(), anos));
console.log(`Protocolos concluídos antes de ${corte.toDate().toISOString().slice(0, 10)} (mais de ${anos} anos). ${confirmado ? "MODO APAGAR" : "Modo simulação: nada será apagado."}`);

const ser = (v) => v instanceof Timestamp ? { __ts: v.toMillis() } : Array.isArray(v) ? v.map(ser)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)])) : v;
async function percorrer(r, cb) { for (const c of await r.listCollections()) for (const d of (await c.get()).docs) { await cb(d); await percorrer(d.ref, cb); } }

const arquivo = `backup-retencao-${new Date().toISOString().slice(0, 10)}.ndjson`;
const saida = confirmado ? createWriteStream(arquivo) : null;
let total = 0;
for (const m of (await db.collection("municipios").get()).docs) {
  const velhos = await m.ref.collection("protocolos").where("status", "==", "concluido").where("concluidoEm", "<", corte).get();
  if (velhos.empty) continue;
  console.log(`/${m.id}: ${velhos.size} protocolo(s)`);
  total += velhos.size;
  if (!confirmado) continue;
  for (const p of velhos.docs) {
    saida.write(JSON.stringify({ path: p.ref.path, data: ser(p.data()) }) + "\n");
    await percorrer(p.ref, async (d) => { saida.write(JSON.stringify({ path: d.ref.path, data: ser(d.data()) }) + "\n"); });
    const espelho = m.ref.collection("consulta").doc(p.id);
    await db.recursiveDelete(p.ref);
    await espelho.delete();
  }
}
if (saida) await new Promise((r) => saida.end(r));
console.log(confirmado ? `Apagados ${total} protocolo(s). Backup: ${arquivo} (contém dados do protocolo; guarde com segurança ou apague).` : `${total} protocolo(s) seriam apagados.`);

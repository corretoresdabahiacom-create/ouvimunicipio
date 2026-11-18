// Monitoramento (gratuito, no GitHub Actions): confere se o site, as funções e o banco estão respondendo.
// Termina com erro quando algo falha; o GitHub avisa por e-mail quando o workflow falha. Não grava nada no banco.
// Variáveis: APP_URL (ex.: https://ouvimunicipio.pages.dev) e, opcional, FIREBASE_SERVICE_ACCOUNT (confere o Firestore).
import { avaliar } from "./monitorar-regras.mjs";

const base = (process.env.APP_URL || "https://ouvimunicipio.pages.dev").replace(/\/+$/, "");
const lento = 5000;

async function medir(nome, fn) {
  const t0 = Date.now();
  try { const detalhe = await fn(); return { nome, ok: true, ms: Date.now() - t0, detalhe }; }
  catch (e) { return { nome, ok: false, ms: Date.now() - t0, detalhe: String(e?.message ?? e) }; }
}
const get = async (url) => { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); return r; };

const resultados = [
  await medir("Site (página inicial)", async () => { const r = await get(base + "/"); if (!r.ok) throw new Error(`HTTP ${r.status}`); }),
  await medir("Funções (/api/saude)", async () => {
    const r = await get(base + "/api/saude"); const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(`HTTP ${r.status} ${JSON.stringify(j)}`);
    return j.configuracao?.email ? "e-mail configurado" : "e-mail NÃO configurado (RESEND_API_KEY)";
  }),
];
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  resultados.push(await medir("Banco de dados (Firestore)", async () => {
    const { initializeApp, cert } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    const s = await getFirestore().collection("municipios").limit(1).get();
    return `${s.size} município(s) lido(s)`;
  }));
}

const { falhas, avisos } = avaliar(resultados, lento);
for (const r of resultados) console.log(`${r.ok ? "OK    " : "FALHOU"} ${r.nome} — ${r.ms} ms${r.detalhe ? ` — ${r.detalhe}` : ""}`);
for (const a of avisos) console.log(`ATENÇÃO ${a}`);
if (falhas.length) { console.error(`\n${falhas.length} verificação(ões) falharam: ${falhas.join("; ")}`); process.exit(1); }
console.log("\nTudo funcionando.");

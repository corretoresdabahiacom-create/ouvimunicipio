// Alertas diários de prazo por e-mail (rodado pelo GitHub Actions, .github/workflows/alertas-prazo.yml).
// Lê SÓ os metadados dos protocolos abertos e a equipe de cada município ativo; nunca lê conversas, anexos nem cidadãos.
// Envia: a cada secretário/assessor, os protocolos da sua secretaria vencidos ou que vencem em até 5 dias;
//        a cada ouvidor geral, um resumo dos vencidos e dos que vencem em até 2 dias.
//
// Uso:  node alertas-prazo.mjs [--teste] [--municipio slug]
//   --teste  mostra os e-mails na tela e NÃO envia
// Ambiente: FIREBASE_SERVICE_ACCOUNT (JSON da conta de serviço), RESEND_API_KEY, RESEND_FROM, APP_URL
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { montarAlertas, montarEmail } from "./prazos.mjs";

const teste = process.argv.includes("--teste");
const iM = process.argv.indexOf("--municipio");
const soMunicipio = iM > 0 ? process.argv[iM + 1] : "";
const APP_URL = (process.env.APP_URL || "https://ouvimunicipio.pages.dev").replace(/\/$/, "");

const conta = process.env.FIREBASE_SERVICE_ACCOUNT;
initializeApp({ credential: conta ? cert(JSON.parse(conta)) : applicationDefault() });
const db = getFirestore();

async function enviar(lote) {
  if (!lote.length) return 0;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurada.");
  const from = process.env.RESEND_FROM || "Ouvidoria <onboarding@resend.dev>";
  let ok = 0;
  for (let i = 0; i < lote.length; i += 100) {
    const parte = lote.slice(i, i + 100).map((e) => ({ from, to: [e.para], subject: e.assunto, html: e.html, text: e.texto }));
    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(parte),
    });
    if (!r.ok) console.error(`Falha no envio (${r.status}): ${(await r.text()).slice(0, 300)}`);
    else ok += parte.length;
  }
  return ok;
}

const agora = Date.now();
const municipios = soMunicipio
  ? [await db.doc(`municipios/${soMunicipio}`).get()].filter((d) => d.exists)
  : (await db.collection("municipios").where("ativo", "==", true).get()).docs;

let total = 0, enviados = 0;
for (const m of municipios) {
  const base = db.collection("municipios").doc(m.id);
  const nome = (await base.collection("config").doc("site").get()).get("nome") || m.get("nome") || m.id;
  const equipe = (await base.collection("equipe").where("ativo", "==", true).get()).docs.map((d) => ({ email: d.id, ...d.data() }));
  const protocolos = (await base.collection("protocolos").where("status", "==", "aberto")
    .select("numero", "secretariaId", "secretariaNome", "tipo", "status", "criadoEm", "prorrogadoEm").get()).docs.map((d) => d.data());
  const envios = montarAlertas(protocolos, equipe, agora);
  const emails = envios.map((e) => ({ para: e.para, ...montarEmail(e, nome, `${APP_URL}/${m.id}`) }));
  total += emails.length;
  console.log(`${m.id}: ${protocolos.length} aberto(s), ${emails.length} e-mail(s) de alerta`);
  if (teste) for (const e of emails) console.log(`  → ${e.para}: ${e.assunto}\n${e.texto.replace(/^/gm, "     ")}`);
  else enviados += await enviar(emails);
}
console.log(teste ? `MODO TESTE: ${total} e-mail(s) seriam enviados. Nada foi enviado.` : `${enviados} de ${total} e-mail(s) enviados.`);
if (!teste && enviados < total) process.exitCode = 1;

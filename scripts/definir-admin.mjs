// Uso (uma única vez, no seu computador):
//   1. Console Firebase > Configurações > Contas de serviço > Gerar nova chave privada
//      (NUNCA envie esse arquivo a ninguém nem o coloque no repositório).
//   2. GOOGLE_APPLICATION_CREDENTIALS=caminho/chave.json node scripts/definir-admin.mjs email@do-admin.gov.br
// A conta precisa já existir (cadastre-se no app e confirme o e-mail antes).
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) { console.error("Informe o e-mail do administrador."); process.exit(1); }
initializeApp({ credential: applicationDefault(), projectId: "ouvimunicipio-f2bf7" });
const user = await getAuth().getUserByEmail(email);
if (!user.emailVerified) { console.error("E-mail ainda não confirmado."); process.exit(1); }
await getAuth().setCustomUserClaims(user.uid, { role: "admin" });
await getFirestore().doc(`users/${user.uid}`).set({ nome: user.displayName ?? "Administrador", email, role: "admin", ativo: true, criadoEm: FieldValue.serverTimestamp() }, { merge: true });
console.log("Admin definido:", email, "(faça logout/login para valer)");

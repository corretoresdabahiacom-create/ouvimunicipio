import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import firebaseConfig from "../../firebase-applet-config.json";

const { firestoreDatabaseId, ...webConfig } = firebaseConfig;

export const app = initializeApp(webConfig);

// App Check (reCAPTCHA Enterprise): só aceita requisições vindas deste app. Ative a chave em produção.
const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
let appCheck: AppCheck | null = null;
if (siteKey) {
  appCheck = initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
}

/** Token do App Check (ou "" se desativado). Enviado às funções do Cloudflare, que o repassam ao Firestore. */
export async function tokenAppCheck(): Promise<string> {
  if (!appCheck) return "";
  try { return (await getToken(appCheck)).token; } catch { return ""; }
}

export const auth = getAuth(app);
export const db = getFirestore(app, firestoreDatabaseId || "(default)");

// Cloudflare Pages Function: GET /api/saude — verificação de funcionamento (usada pelo monitoramento).
// Não mostra segredos nem dados: só diz se as peças de que as funções dependem estão respondendo/configuradas.
import { resp } from "../_comum";

interface Env { FIREBASE_PROJECT_ID?: string; RESEND_API_KEY?: string; AUDIT_EMAIL?: string }

export async function onRequestGet(context: { env: Env }) {
  const { env } = context;
  // chaves públicas de login do Google: sem elas as funções não conseguem confirmar quem é o administrador
  const login = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
    .then((r) => r.ok).catch(() => false);
  const configuracao = {
    projeto: !!env.FIREBASE_PROJECT_ID,
    email: !!env.RESEND_API_KEY,   // envio de e-mails configurado?
    auditoria: !!env.AUDIT_EMAIL,
  };
  const ok = login && configuracao.projeto;
  return resp(ok ? 200 : 503, { ok, login, configuracao, hora: new Date().toISOString() });
}

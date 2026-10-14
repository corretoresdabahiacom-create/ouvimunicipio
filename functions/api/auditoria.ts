// Cloudflare Pages Function: POST /api/auditoria
// Envia por e-mail o registro de uma ação administrativa (não grava nada no banco).
// Só aceita pedidos de um ADMIN com e-mail confirmado: valida o ID token do Firebase
// e confirma o papel lendo equipe/{email} no Firestore COM o token do próprio usuário
// (as regras do Firestore é que decidem; nenhuma chave privada é necessária).
interface Env {
  FIREBASE_PROJECT_ID: string;
  RESEND_API_KEY: string;   // segredo
  AUDIT_EMAIL: string;      // para onde vai o registro (ex.: seu e-mail)
  RESEND_FROM?: string;     // padrão: sandbox do Resend (só entrega ao dono da conta Resend)
}

const ACOES: Record<string, string> = {
  "secretaria.criar": "Secretaria criada",
  "secretaria.editar": "Secretaria editada",
  "secretaria.excluir": "Secretaria excluída",
  "servidor.criar": "Servidor cadastrado",
  "servidor.editar": "Servidor editado",
  "servidor.excluir": "Servidor excluído",
  "config.editar": "Aparência do site alterada",
  "anuncio.criar": "Anúncio criado",
  "anuncio.editar": "Anúncio editado",
  "anuncio.excluir": "Anúncio excluído",
  "usuario.bloquear": "Usuário bloqueado",
  "usuario.desbloquear": "Usuário desbloqueado",
  "usuario.excluir": "Usuário excluído",
};

const JSON_H = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const resp = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: JSON_H });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function verificarToken(idToken: string, projectId: string): Promise<{ email: string; uid: string } | null> {
  const [h, p, s] = idToken.split(".");
  if (!h || !p || !s) return null;
  const header = JSON.parse(new TextDecoder().decode(b64(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64(p)));
  if (header.alg !== "RS256" || !header.kid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (!claims.sub || claims.exp <= now || claims.iat > now + 60) return null;
  if (claims.email_verified !== true || typeof claims.email !== "string") return null;

  const jwks: any = await (await fetch(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
    { cf: { cacheTtl: 3600, cacheEverything: true } } as any,
  )).json();
  const jwk = jwks.keys?.find((k: any) => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64(s), new TextEncoder().encode(`${h}.${p}`));
  return ok ? { email: claims.email.toLowerCase(), uid: claims.sub } : null;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  try {
    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return resp(401, { error: "Não autenticado." });
    const idToken = auth.slice(7);

    const user = await verificarToken(idToken, env.FIREBASE_PROJECT_ID);
    if (!user) return resp(401, { error: "Token inválido." });

    // Confirma que é admin ativo (o Firestore aplica as regras usando o token do usuário).
    const r = await fetch(
      `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/equipe/${encodeURIComponent(user.email)}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    if (!r.ok) return resp(403, { error: "Sem permissão." });
    const doc: any = await r.json();
    if (doc.fields?.papel?.stringValue !== "admin" || doc.fields?.ativo?.booleanValue !== true)
      return resp(403, { error: "Sem permissão." });

    const body: any = await request.json().catch(() => ({}));
    const titulo = ACOES[String(body.acao)];
    if (!titulo) return resp(400, { error: "Ação inválida." });
    const alvo = String(body.alvo ?? "").slice(0, 200);
    const detalhe = String(body.detalhe ?? "").slice(0, 500);

    const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const html = `<h2>${esc(titulo)}</h2>
<p><b>Quem:</b> ${esc(user.email)}<br><b>Quando:</b> ${esc(quando)} (Brasília)<br><b>Alvo:</b> ${esc(alvo)}</p>
${detalhe ? `<p><b>Detalhes:</b> ${esc(detalhe)}</p>` : ""}
<p style="color:#666;font-size:12px">Registro automático de auditoria – Ouvidoria Municipal.</p>`;

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM || "Ouvidoria Auditoria <onboarding@resend.dev>",
        to: [env.AUDIT_EMAIL],
        subject: `[Auditoria] ${titulo}: ${alvo}`.slice(0, 200),
        html,
      }),
    });
    if (!send.ok) return resp(502, { error: "Falha ao enviar o e-mail de auditoria." });
    return resp(200, { ok: true });
  } catch {
    return resp(500, { error: "Erro interno." });
  }
}

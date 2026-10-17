// Utilitários compartilhados pelas Pages Functions (este arquivo não é uma rota).
export interface EnvBase { FIREBASE_PROJECT_ID: string; RESEND_API_KEY: string; RESEND_FROM?: string }

export const JSON_H = { "Content-Type": "application/json", "Cache-Control": "no-store" };
export const resp = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: JSON_H });
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export async function verificarToken(idToken: string, projectId: string): Promise<{ email: string; uid: string } | null> {
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


// Exige "Authorization: Bearer <ID token>" de um ADMIN ativo com e-mail confirmado.
// O papel é lido do Firestore com o token do próprio usuário (as regras decidem).
export async function exigirAdmin(request: Request, projectId: string): Promise<{ email: string } | Response> {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return resp(401, { error: "Não autenticado." });
  const idToken = auth.slice(7);
  const user = await verificarToken(idToken, projectId);
  if (!user) return resp(401, { error: "Token inválido." });
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/equipe/${encodeURIComponent(user.email)}`,
    { headers: { Authorization: `Bearer ${idToken}`, ...(request.headers.get("X-Firebase-AppCheck") ? { "X-Firebase-AppCheck": request.headers.get("X-Firebase-AppCheck")! } : {}) } },
  );
  if (!r.ok) return resp(403, { error: "Sem permissão." });
  const doc: any = await r.json();
  if (doc.fields?.papel?.stringValue !== "admin" || doc.fields?.ativo?.booleanValue !== true)
    return resp(403, { error: "Sem permissão." });
  return { email: user.email };
}

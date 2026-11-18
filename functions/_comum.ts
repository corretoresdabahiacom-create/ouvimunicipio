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


// Exige "Authorization: Bearer <ID token>" de um ADMIN ativo (do município informado) com e-mail confirmado.
// O papel é lido do Firestore com o token do próprio usuário (as regras decidem).
export const SLUG_OK = /^[a-z0-9-]{2,40}$/;
export async function exigirAdmin(request: Request, projectId: string, municipio: unknown): Promise<{ email: string; municipio: string; idToken: string } | Response> {
  // O papel é sempre conferido DENTRO do município informado: admin de um município não age em outro.
  if (typeof municipio !== "string" || !SLUG_OK.test(municipio)) return resp(400, { error: "Município inválido." });
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return resp(401, { error: "Não autenticado." });
  const idToken = auth.slice(7);
  // Token malformado não pode virar erro 500: qualquer falha na verificação é "não autenticado".
  const user = await verificarToken(idToken, projectId).catch(() => null);
  if (!user) return resp(401, { error: "Token inválido." });
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/municipios/${municipio}/equipe/${encodeURIComponent(user.email)}`,
    { headers: { Authorization: `Bearer ${idToken}`, ...(request.headers.get("X-Firebase-AppCheck") ? { "X-Firebase-AppCheck": request.headers.get("X-Firebase-AppCheck")! } : {}) } },
  );
  if (!r.ok) return resp(403, { error: "Sem permissão." });
  const doc: any = await r.json();
  if (doc.fields?.papel?.stringValue !== "admin" || doc.fields?.ativo?.booleanValue !== true)
    return resp(403, { error: "Sem permissão." });
  return { email: user.email, municipio, idToken };
}

// ---------- limite de chamadas (melhor esforço) ----------
// Guarda a contagem na memória do servidor que atendeu o pedido. O Cloudflare pode usar vários servidores, então isto
// BARRA abusos simples (um administrador com a conta roubada disparando e-mails em sequência), mas não é um limite exato.
// Para um limite exato e global, configure também uma "Regra de limitação de taxa" no painel do Cloudflare (veja SETUP_FIREBASE.md).
const chamadas = new Map<string, number[]>();
export function limitar(chave: string, max: number, janelaMs: number, agora = Date.now()): boolean {
  const recentes = (chamadas.get(chave) ?? []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= max) { chamadas.set(chave, recentes); return false; }
  recentes.push(agora);
  chamadas.set(chave, recentes);
  if (chamadas.size > 5000) for (const [k, v] of chamadas) if (!v.some((t) => agora - t < janelaMs)) chamadas.delete(k);
  return true;
}
export const MUITAS = () => resp(429, { error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo." });

// ---------- destinatários de e-mail em massa ----------
// O administrador só pode escrever para pessoas que TÊM conta ativa no próprio município. A conferência usa o token dele
// (as regras do Firestore permitem ao administrador ler a lista de usuários do município e a de nenhum outro).
export async function usuariosAtivosDoMunicipio(idToken: string, projectId: string, municipio: string, emails: string[], appCheck?: string | null): Promise<Set<string>> {
  const achados = new Set<string>();
  for (let i = 0; i < emails.length; i += 10) {
    const lote = emails.slice(i, i + 10);
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/municipios/${municipio}:runQuery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json", ...(appCheck ? { "X-Firebase-AppCheck": appCheck } : {}) },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "users" }],
        where: { fieldFilter: { field: { fieldPath: "email" }, op: "IN", value: { arrayValue: { values: lote.map((e) => ({ stringValue: e })) } } } } } }),
    });
    if (!r.ok) throw new Error("consulta-usuarios");
    for (const linha of (await r.json()) as any[]) {
      const f = linha.document?.fields;
      const email = f?.email?.stringValue;
      if (typeof email === "string" && (f?.situacao?.stringValue ?? "ativo") === "ativo") achados.add(email.toLowerCase());
    }
  }
  return achados;
}

// ---------- leitura de um documento do Firestore COM o token da própria pessoa (as regras decidem) ----------
export interface DocFS { status: number; fields: Record<string, any> }
export async function lerDocumento(idToken: string, projectId: string, caminho: string, appCheck?: string | null): Promise<DocFS> {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${caminho}`,
    { headers: { Authorization: `Bearer ${idToken}`, ...(appCheck ? { "X-Firebase-AppCheck": appCheck } : {}) } });
  if (!r.ok) return { status: r.status, fields: {} };
  const j: any = await r.json();
  return { status: 200, fields: j.fields ?? {} };
}
export async function usuarioDoToken(request: Request, projectId: string): Promise<{ email: string; uid: string; idToken: string } | Response> {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return resp(401, { error: "Não autenticado." });
  const idToken = auth.slice(7);
  const u = await verificarToken(idToken, projectId).catch(() => null);
  return u ? { ...u, idToken } : resp(401, { error: "Token inválido." });
}

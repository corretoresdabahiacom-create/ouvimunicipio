// Cloudflare Pages Function: POST /api/mensagem
// Envia um e-mail do ADMIN para até 100 usuários por chamada (cada um recebe o seu, sem ver os demais).
import { exigirAdmin, resp, esc, limitar, MUITAS, usuariosAtivosDoMunicipio } from "../_comum";

interface Env {
  FIREBASE_PROJECT_ID: string;
  RESEND_API_KEY: string;
  RESEND_FROM?: string;   // remetente de domínio verificado no Resend
  NOME_ORGAO?: string;    // nome exibido no remetente (padrão: Ouvidoria Municipal)
}

const EMAIL_OK = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  try {
    const b: any = await request.json().catch(() => ({}));
    const adm = await exigirAdmin(request, env.FIREBASE_PROJECT_ID, b.municipio);
    if (adm instanceof Response) return adm;
    // no máximo 10 blocos de envio (até 100 e-mails cada) a cada 10 minutos por administrador
    if (!limitar(`msg:${adm.municipio}:${adm.email}`, 10, 600_000)) return MUITAS();

    const assunto = String(b.assunto ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 150);
    const texto = String(b.texto ?? "").trim().slice(0, 2000);
    const pedidos: string[] = Array.isArray(b.emails)
      ? [...new Set<string>(b.emails.map((e: unknown) => String(e).trim().toLowerCase()).filter((e: string) => e.length <= 254 && EMAIL_OK.test(e)))]
      : [];
    if (assunto.length < 3 || texto.length < 3) return resp(400, { error: "Informe assunto e mensagem." });
    if (pedidos.length === 0 || pedidos.length > 100) return resp(400, { error: "Escolha de 1 a 100 destinatários por envio." });
    // só vale quem tem conta ATIVA neste município: o administrador não usa o sistema para escrever a e-mails de fora
    const validos = await usuariosAtivosDoMunicipio(adm.idToken, env.FIREBASE_PROJECT_ID, adm.municipio, pedidos, request.headers.get("X-Firebase-AppCheck"));
    const destinos = pedidos.filter((e) => validos.has(e));
    if (destinos.length === 0) return resp(400, { error: "Nenhum dos e-mails é de usuário ativo deste município." });

    const orgao = env.NOME_ORGAO || "Ouvidoria Municipal";
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px">
<h2 style="margin:0 0 12px">${esc(assunto)}</h2>
<p style="white-space:pre-wrap;line-height:1.5">${esc(texto)}</p>
<hr style="border:none;border-top:1px solid #ddd;margin:20px 0">
<p style="color:#666;font-size:12px">Mensagem enviada pela ${esc(orgao)}. Não responda a este e-mail: use o aplicativo para falar com a ouvidoria.</p></div>`;
    const from = env.RESEND_FROM || "Ouvidoria <onboarding@resend.dev>";

    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(destinos.map((to) => ({ from, to: [to], subject: assunto, html }))),
    });
    if (!r.ok) return resp(502, { error: "O serviço de e-mail recusou o envio. Confira a chave e o remetente (RESEND_FROM)." });
    return resp(200, { ok: true, enviados: destinos.length, ignorados: pedidos.length - destinos.length });
  } catch {
    return resp(500, { error: "Erro interno." });
  }
}

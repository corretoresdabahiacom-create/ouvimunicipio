// Cloudflare Pages Function: POST /api/auditoria
// Envia por e-mail o registro de uma ação administrativa (não grava nada no banco).
// Só aceita pedidos de um ADMIN com e-mail confirmado: valida o ID token do Firebase
// e confirma o papel lendo equipe/{email} no Firestore COM o token do próprio usuário
// (as regras do Firestore é que decidem; nenhuma chave privada é necessária).
import { exigirAdmin, resp, esc, limitar, MUITAS } from "../_comum";

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
  "mensagem.enviar": "Mensagem enviada a usuários",
  "exportacao.csv": "Exportação de dados (CSV)",
  "backup.config": "Backup de configuração baixado",
};

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;
  try {
    const body: any = await request.json().catch(() => ({}));
    const adm = await exigirAdmin(request, env.FIREBASE_PROJECT_ID, body.municipio);
    if (adm instanceof Response) return adm;
    if (!limitar(`aud:${adm.municipio}:${adm.email}`, 60, 600_000)) return MUITAS();

    const titulo = ACOES[String(body.acao)];
    if (!titulo) return resp(400, { error: "Ação inválida." });
    const alvo = String(body.alvo ?? "").slice(0, 200);
    const detalhe = String(body.detalhe ?? "").slice(0, 500);

    const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const html = `<h2>${esc(titulo)}</h2>
<p><b>Município:</b> ${esc(adm.municipio)}<br><b>Quem:</b> ${esc(adm.email)}<br><b>Quando:</b> ${esc(quando)} (Brasília)<br><b>Alvo:</b> ${esc(alvo)}</p>
${detalhe ? `<p><b>Detalhes:</b> ${esc(detalhe)}</p>` : ""}
<p style="color:#666;font-size:12px">Registro automático de auditoria – Ouvidoria Municipal.</p>`;

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM || "Ouvidoria Auditoria <onboarding@resend.dev>",
        to: [env.AUDIT_EMAIL],
        subject: `[Auditoria ${adm.municipio}] ${titulo}: ${alvo}`.slice(0, 200),
        html,
      }),
    });
    if (!send.ok) return resp(502, { error: "Falha ao enviar o e-mail de auditoria." });
    return resp(200, { ok: true });
  } catch {
    return resp(500, { error: "Erro interno." });
  }
}

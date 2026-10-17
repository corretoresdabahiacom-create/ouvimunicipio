import { auth } from "./firebase";

// Envia por e-mail o registro de uma ação do administrador (nada é gravado no banco).
export async function registrarAuditoria(acao: string, alvo: string, detalhe = ""): Promise<boolean> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return false;
    const r = await fetch("/api/auditoria", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ acao, alvo, detalhe }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Envia e-mail do admin a até 100 usuários por chamada. Retorna mensagem de erro ou "" se deu certo.
export async function enviarEmailUsuarios(emails: string[], assunto: string, texto: string): Promise<string> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return "Sessão expirada. Entre novamente.";
    const r = await fetch("/api/mensagem", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emails, assunto, texto }),
    });
    if (r.ok) return "";
    const j = await r.json().catch(() => ({}));
    return j.error || "Falha ao enviar o e-mail.";
  } catch {
    return "Sem conexão com o servidor de e-mail.";
  }
}

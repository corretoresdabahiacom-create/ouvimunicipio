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

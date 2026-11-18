import { auth, tokenAppCheck } from "./firebase";
import { idMunicipio } from "./municipio";

// Fotos e vídeos no Cloudflare R2 (via /api/midia). Só é usado quando o R2 está configurado no Cloudflare;
// senão o app continua guardando a mídia no Firestore, como antes.
export const MAX_ANEXO_R2 = 20_000_000;   // por arquivo (vídeos curtos)
export const MAX_TOTAL_R2 = 40_000_000;   // por mensagem

let disponivel: Promise<boolean> | null = null;
export function r2Disponivel(): Promise<boolean> {
  disponivel ??= fetch("/api/midia?status=1").then((r) => r.ok ? r.json() : { r2: false }).then((j) => j.r2 === true).catch(() => false);
  return disponivel;
}

async function cabecalhos(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  return { Authorization: `Bearer ${token}`, "X-Firebase-AppCheck": await tokenAppCheck() };
}
const consulta = (numero: string, k?: string) => `/api/midia?${new URLSearchParams({ municipio: idMunicipio(), protocolo: numero, ...(k ? { k } : {}) })}`;

export async function enviarParaR2(numero: string, k: string, blob: Blob): Promise<void> {
  const r = await fetch(consulta(numero, k), { method: "POST", headers: await cabecalhos(), body: blob });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Falha ao enviar o anexo.");
}

export async function baixarDoR2(numero: string, k: string): Promise<Blob | null> {
  const r = await fetch(consulta(numero, k), { headers: await cabecalhos() });
  return r.ok ? r.blob() : null;
}

/** Apaga os arquivos de uma conversa vencida (30 dias após a conclusão). Lança erro se não conseguir (para tentar de novo depois). */
export async function apagarDoR2(numero: string): Promise<void> {
  const r = await fetch(consulta(numero), { method: "DELETE", headers: await cabecalhos() });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Falha ao apagar os anexos.");
}

/** Superadmin: apaga os arquivos de um município já excluído. Devolve quantos foram apagados. */
export async function apagarMunicipioDoR2(slug: string): Promise<number> {
  const r = await fetch(`/api/midia?${new URLSearchParams({ municipio: slug, tudo: "1" })}`, { method: "DELETE", headers: await cabecalhos() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Falha ao apagar os arquivos do município.");
  return j.apagados ?? 0;
}

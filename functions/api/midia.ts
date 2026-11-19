// Cloudflare Pages Function: /api/midia — fotos e vídeos das conversas no Cloudflare R2 (em vez de dentro do Firestore).
//   POST   ?municipio=&protocolo=&k=01_0   envia o arquivo (corpo = bytes). Só o AUTOR da mensagem, e só de um anexo que a mensagem declara.
//   GET    ?municipio=&protocolo=&k=01_0   baixa o arquivo. Só quem as REGRAS do Firestore deixam ler a mensagem (autor, secretaria, ouvidor).
//   DELETE ?municipio=&protocolo=          apaga os arquivos de uma conversa já vencida (30 dias após a conclusão).
//   DELETE ?municipio=&tudo=1              superadmin: apaga os arquivos de um município EXCLUÍDO.
//   GET    ?status=1                       diz se o R2 está configurado (binding MIDIA).
// Nenhuma permissão é decidida aqui "de cabeça": a função lê o documento no Firestore com o token da própria pessoa e as regras respondem.
import { SLUG_OK, lerDocumento, limitar, MUITAS, resp, usuarioDoToken } from "../_comum";
import { identificarPelosBytes } from "../../src/lib/tipoArquivo";

export interface R2Bucket {
  put(key: string, value: ArrayBuffer, opts?: any): Promise<unknown | null>;
  get(key: string): Promise<{ body: ReadableStream; size: number } | null>;
  list(opts: { prefix: string; limit?: number; cursor?: string }): Promise<{ objects: { key: string }[]; truncated: boolean; cursor?: string }>;
  delete(keys: string | string[]): Promise<void>;
}
interface Env { FIREBASE_PROJECT_ID: string; MIDIA?: R2Bucket }

export const MAX_BYTES_R2 = 20_000_000; // vídeos curtos; as fotos já chegam reduzidas (~700 KB)
const NUM_OK = /^OUV-[0-9]{4}-[A-Z0-9]{8}$/;
const K_OK = /^([0-4][0-9])_([0-4])$/;
const chaveR2 = (m: string, n: string, k: string) => `${m}/${n}/${k}`;
const DIA = 86_400_000;

// anexos[] de uma mensagem do Firestore (formato REST) -> [{ k, mime, tipo, bytes, r2 }]
export function lerAnexos(fields: Record<string, any>) {
  const vals: any[] = fields.anexos?.arrayValue?.values ?? [];
  return vals.map((v) => {
    const f = v.mapValue?.fields ?? {};
    return { k: f.k?.stringValue as string, mime: f.mime?.stringValue as string, tipo: f.tipo?.stringValue as string,
      bytes: Number(f.bytes?.integerValue ?? -1), r2: f.r2?.booleanValue === true };
  });
}

export async function onRequest(context: { request: Request; env: Env }) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.get("status")) return resp(200, { r2: !!env.MIDIA });
    if (!env.MIDIA) return resp(501, { error: "O armazenamento de mídia (R2) não está configurado." });

    const m = url.searchParams.get("municipio") ?? "";
    const n = url.searchParams.get("protocolo") ?? "";
    const k = url.searchParams.get("k") ?? "";
    if (!SLUG_OK.test(m)) return resp(400, { error: "Município inválido." });

    const user = await usuarioDoToken(request, env.FIREBASE_PROJECT_ID);
    if (user instanceof Response) return user;
    const appCheck = request.headers.get("X-Firebase-AppCheck");
    const ler = (caminho: string) => lerDocumento(user.idToken, env.FIREBASE_PROJECT_ID, caminho, appCheck);

    // ----- superadmin apaga tudo de um município excluído -----
    if (request.method === "DELETE" && url.searchParams.get("tudo")) {
      const su = await ler(`superadmins/${encodeURIComponent(user.email)}`);
      const mun = await ler(`municipios/${m}`);
      if (su.status !== 200) return resp(403, { error: "Sem permissão." });
      if (mun.fields.excluido?.booleanValue !== true) return resp(409, { error: "O município precisa estar excluído." });
      return resp(200, { ok: true, apagados: await apagarPrefixo(env.MIDIA, `${m}/`) });
    }

    if (!NUM_OK.test(n)) return resp(400, { error: "Protocolo inválido." });

    // ----- apagar a conversa vencida -----
    if (request.method === "DELETE") {
      const p = await ler(`municipios/${m}/protocolos/${n}`);
      if (p.status !== 200) return resp(403, { error: "Sem permissão." });
      const concluidoEm = Date.parse(p.fields.concluidoEm?.timestampValue ?? "");
      if (p.fields.status?.stringValue !== "concluido" || !(concluidoEm + 30 * DIA <= Date.now()))
        return resp(409, { error: "A conversa só pode ser apagada 30 dias depois de concluída." });
      return resp(200, { ok: true, apagados: await apagarPrefixo(env.MIDIA, `${m}/${n}/`) });
    }

    const kk = K_OK.exec(k);
    if (!kk) return resp(400, { error: "Anexo inválido." });
    const msg = await ler(`municipios/${m}/protocolos/${n}/mensagens/m${kk[1]}`); // as regras: autor, secretaria ou ouvidor
    if (msg.status !== 200) return resp(403, { error: "Sem permissão." });
    const meta = lerAnexos(msg.fields).find((a) => a.k === k && a.r2);
    if (!meta) return resp(404, { error: "Anexo não encontrado." });

    if (request.method === "GET") {
      if (!limitar(`mget:${user.uid}`, 300, 600_000)) return MUITAS();
      const o = await env.MIDIA.get(chaveR2(m, n, k));
      if (!o) return resp(404, { error: "Arquivo não encontrado." });
      return new Response(o.body, { headers: {
        "Content-Type": meta.mime, "Content-Length": String(o.size), "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'", "Content-Disposition": "inline",
      } });
    }

    if (request.method === "POST") {
      if (msg.fields.autorUid?.stringValue !== user.uid) return resp(403, { error: "Só quem escreveu a mensagem envia os anexos dela." });
      if (!limitar(`mput:${user.uid}`, 60, 600_000)) return MUITAS();
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES_R2) return resp(413, { error: "Arquivo vazio ou grande demais." });
      if (bytes.byteLength !== meta.bytes) return resp(400, { error: "O tamanho não confere com o anexo da mensagem." });
      const real = identificarPelosBytes(new Uint8Array(bytes.slice(0, 16)));
      if (!real || real.mime !== meta.mime || real.tipo !== meta.tipo) return resp(415, { error: "O conteúdo do arquivo não confere com o tipo informado." });
      // só grava se ainda não existe (ninguém troca um anexo depois de enviado)
      const gravou = await env.MIDIA.put(chaveR2(m, n, k), bytes, { httpMetadata: { contentType: real.mime }, onlyIf: { etagDoesNotMatch: "*" } });
      if (!gravou) return resp(409, { error: "Este anexo já foi enviado." });
      return resp(201, { ok: true });
    }
    return resp(405, { error: "Método não permitido." });
  } catch {
    return resp(500, { error: "Erro interno." });
  }
}

async function apagarPrefixo(b: R2Bucket, prefixo: string): Promise<number> {
  let total = 0, cursor: string | undefined;
  for (let i = 0; i < 50; i++) {
    const l = await b.list({ prefix: prefixo, limit: 500, cursor });
    if (l.objects.length) { await b.delete(l.objects.map((o) => o.key)); total += l.objects.length; }
    if (!l.truncated) break;
    cursor = l.cursor;
  }
  return total;
}

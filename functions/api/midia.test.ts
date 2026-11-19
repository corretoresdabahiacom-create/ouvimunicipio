import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const usuario = { email: "ana@x.com", uid: "ana", idToken: "tok" };
let quem: typeof usuario | Response = usuario;
vi.mock("../_comum", async (orig) => ({ ...(await orig<typeof import("../_comum")>()), usuarioDoToken: async () => quem }));
import { onRequest, lerAnexos, type R2Bucket } from "./midia";

// R2 de mentira (um mapa)
function r2(): R2Bucket & { itens: Map<string, ArrayBuffer> } {
  const itens = new Map<string, ArrayBuffer>();
  return {
    itens,
    async put(k, v, o) { if (o?.onlyIf?.etagDoesNotMatch === "*" && itens.has(k)) return null; itens.set(k, v); return {}; },
    async get(k) { const v = itens.get(k); return v ? { body: new Response(v).body!, size: v.byteLength } : null; },
    async list({ prefix }) { return { objects: [...itens.keys()].filter((x) => x.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
    async delete(ks) { for (const k of Array.isArray(ks) ? ks : [ks]) itens.delete(k); },
  };
}

const JPEG = (() => { const b = new Uint8Array(40); b.set([0xff, 0xd8, 0xff, 0xe0]); return b; })();
const EXE = (() => { const b = new Uint8Array(40); b.set([0x4d, 0x5a]); return b; })();
const NUM = "OUV-2026-ABCD1234";
const BASE = "https://x.pages.dev/api/midia";
const q = (o: Record<string, string>) => `${BASE}?${new URLSearchParams(o)}`;
const anexo = (o: Record<string, unknown> = {}) => ({ mapValue: { fields: {
  k: { stringValue: "00_0" }, mime: { stringValue: "image/jpeg" }, tipo: { stringValue: "imagem" }, bytes: { integerValue: "40" }, r2: { booleanValue: true }, ...o } } });
const docMsg = (autor = "ana", anexos = [anexo()]) => ({ fields: { autorUid: { stringValue: autor }, anexos: { arrayValue: { values: anexos } } } });

// Firestore de mentira: caminho -> { status, corpo }
function firestore(tab: Record<string, { status: number; corpo?: unknown }>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const caminho = decodeURIComponent(url.split("/documents/")[1]);
    const r = tab[caminho] ?? { status: 403 };
    return { ok: r.status === 200, status: r.status, json: async () => r.corpo ?? {} };
  }));
}
const MSG = `municipios/alagoinhas/protocolos/${NUM}/mensagens/m00`;
const env = (m?: R2Bucket) => ({ FIREBASE_PROJECT_ID: "p", MIDIA: m });
const post = (corpo: Uint8Array, o: Record<string, string> = {}) =>
  new Request(q({ municipio: "alagoinhas", protocolo: NUM, k: "00_0", ...o }), { method: "POST", body: corpo as BodyInit });

describe("/api/midia (mídia no R2)", () => {
  beforeEach(() => { quem = usuario; });
  afterEach(() => vi.unstubAllGlobals());

  test("sem R2 configurado: status mostra false e o resto responde 501", async () => {
    expect(await (await onRequest({ request: new Request(q({ status: "1" })), env: env() })).json()).toEqual({ r2: false });
    expect((await onRequest({ request: post(JPEG), env: env() })).status).toBe(501);
  });

  test("lê os anexos da mensagem no formato do Firestore", () => {
    expect(lerAnexos(docMsg().fields)).toEqual([{ k: "00_0", mime: "image/jpeg", tipo: "imagem", bytes: 40, r2: true }]);
  });

  test("o autor envia o arquivo; o tipo real e o tamanho precisam bater com o que a mensagem declara", async () => {
    firestore({ [MSG]: { status: 200, corpo: docMsg() } });
    const b = r2();
    expect((await onRequest({ request: post(JPEG), env: env(b) })).status).toBe(201);
    expect(b.itens.has(`alagoinhas/${NUM}/00_0`)).toBe(true);
  });

  test("recusa executável com nome de foto, tamanho diferente do declarado e envio repetido", async () => {
    firestore({ [MSG]: { status: 200, corpo: docMsg() } });
    const b = r2();
    expect((await onRequest({ request: post(EXE), env: env(b) })).status).toBe(415);
    expect((await onRequest({ request: post(JPEG.slice(0, 20)), env: env(b) })).status).toBe(400);
    expect((await onRequest({ request: post(JPEG), env: env(b) })).status).toBe(201);
    expect((await onRequest({ request: post(JPEG), env: env(b) })).status).toBe(409);
    expect(b.itens.size).toBe(1);
  });

  test("só o autor da mensagem envia; quem não consegue ler a mensagem (regras do Firestore) é barrado", async () => {
    firestore({ [MSG]: { status: 200, corpo: docMsg("beto") } });
    expect((await onRequest({ request: post(JPEG), env: env(r2()) })).status).toBe(403);
    firestore({}); // Firestore nega a leitura
    expect((await onRequest({ request: post(JPEG), env: env(r2()) })).status).toBe(403);
  });

  test("anexo que a mensagem não declara (ou que não é do R2) não pode ser enviado", async () => {
    firestore({ [MSG]: { status: 200, corpo: docMsg("ana", [anexo({ r2: { booleanValue: false } })]) } });
    expect((await onRequest({ request: post(JPEG), env: env(r2()) })).status).toBe(404);
    firestore({ [MSG]: { status: 200, corpo: docMsg() } });
    expect((await onRequest({ request: post(JPEG, { k: "00_3" }), env: env(r2()) })).status).toBe(404);
  });

  test("baixar: quem lê a mensagem recebe o arquivo com cabeçalhos de segurança; sem permissão, nada", async () => {
    const b = r2(); b.itens.set(`alagoinhas/${NUM}/00_0`, JPEG.buffer.slice(0) as ArrayBuffer);
    firestore({ [MSG]: { status: 200, corpo: docMsg("ana") } });
    quem = { ...usuario, email: "sam@x.com", uid: "sam" };            // secretário: as regras deixam ler a mensagem
    const r = await onRequest({ request: new Request(q({ municipio: "alagoinhas", protocolo: NUM, k: "00_0" })), env: env(b) });
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("image/jpeg");
    expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(r.headers.get("Cache-Control")).toContain("no-store");
    firestore({});                                                     // administrador/prefeito: as regras negam
    expect((await onRequest({ request: new Request(q({ municipio: "alagoinhas", protocolo: NUM, k: "00_0" })), env: env(b) })).status).toBe(403);
  });

  test("sem login ou com dados inválidos", async () => {
    quem = new Response("{}", { status: 401 });
    expect((await onRequest({ request: post(JPEG), env: env(r2()) })).status).toBe(401);
    quem = usuario;
    expect((await onRequest({ request: post(JPEG, { municipio: "../x" }), env: env(r2()) })).status).toBe(400);
    expect((await onRequest({ request: post(JPEG, { protocolo: "x" }), env: env(r2()) })).status).toBe(400);
    expect((await onRequest({ request: post(JPEG, { k: "99_9" }), env: env(r2()) })).status).toBe(400);
  });

  test("apagar a conversa: só depois de 30 dias da conclusão, e só os arquivos daquele protocolo", async () => {
    const b = r2();
    b.itens.set(`alagoinhas/${NUM}/00_0`, JPEG.buffer as ArrayBuffer);
    b.itens.set(`alagoinhas/OUV-2026-OUTRO999/00_0`, JPEG.buffer as ArrayBuffer);
    const del = () => new Request(q({ municipio: "alagoinhas", protocolo: NUM }), { method: "DELETE" });
    const dias = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
    const P = `municipios/alagoinhas/protocolos/${NUM}`;
    firestore({ [P]: { status: 200, corpo: { fields: { status: { stringValue: "concluido" }, concluidoEm: { timestampValue: dias(10) } } } } });
    expect((await onRequest({ request: del(), env: env(b) })).status).toBe(409);
    firestore({ [P]: { status: 200, corpo: { fields: { status: { stringValue: "respondido" } } } } });
    expect((await onRequest({ request: del(), env: env(b) })).status).toBe(409);
    firestore({ [P]: { status: 200, corpo: { fields: { status: { stringValue: "concluido" }, concluidoEm: { timestampValue: dias(31) } } } } });
    const r = await onRequest({ request: del(), env: env(b) });
    expect(r.status).toBe(200);
    expect([...b.itens.keys()]).toEqual(["alagoinhas/OUV-2026-OUTRO999/00_0"]);
  });

  test("superadmin apaga os arquivos de município EXCLUÍDO; outros e município ativo não", async () => {
    const b = r2();
    b.itens.set("alagoinhas/a/1", JPEG.buffer as ArrayBuffer); b.itens.set("outro/a/1", JPEG.buffer as ArrayBuffer);
    const req = () => new Request(q({ municipio: "alagoinhas", tudo: "1" }), { method: "DELETE" });
    firestore({ "municipios/alagoinhas": { status: 200, corpo: { fields: { excluido: { booleanValue: true } } } } });
    expect((await onRequest({ request: req(), env: env(b) })).status).toBe(403);            // não é superadmin
    firestore({ "superadmins/ana@x.com": { status: 200 }, "municipios/alagoinhas": { status: 200, corpo: { fields: { excluido: { booleanValue: false } } } } });
    expect((await onRequest({ request: req(), env: env(b) })).status).toBe(409);            // não está excluído
    firestore({ "superadmins/ana@x.com": { status: 200 }, "municipios/alagoinhas": { status: 200, corpo: { fields: { excluido: { booleanValue: true } } } } });
    expect((await onRequest({ request: req(), env: env(b) })).status).toBe(200);
    expect([...b.itens.keys()]).toEqual(["outro/a/1"]);
  });
});

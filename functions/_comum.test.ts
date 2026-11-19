import { afterEach, describe, expect, test, vi } from "vitest";
import { limitar, usuariosAtivosDoMunicipio } from "./_comum";

describe("limite de chamadas", () => {
  test("barra a chamada seguinte ao passar do máximo e libera depois da janela", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(limitar("k1", 3, 1000, t0 + i)).toBe(true);
    expect(limitar("k1", 3, 1000, t0 + 10)).toBe(false);
    expect(limitar("k1", 3, 1000, t0 + 2000)).toBe(true);
  });
  test("cada chave tem a sua contagem", () => {
    expect(limitar("a", 1, 1000, 5)).toBe(true);
    expect(limitar("b", 1, 1000, 5)).toBe(true);
    expect(limitar("a", 1, 1000, 6)).toBe(false);
  });
});

describe("destinatários de e-mail em massa", () => {
  afterEach(() => vi.unstubAllGlobals());
  const linha = (email: string, situacao?: string) => ({ document: { fields: { email: { stringValue: email }, ...(situacao ? { situacao: { stringValue: situacao } } : {}) } } });

  test("só passa quem tem conta ATIVA no município (bloqueados e desconhecidos ficam de fora)", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => [linha("ana@x.com", "ativo"), linha("bia@x.com", "bloqueado"), { readTime: "x" }] });
    vi.stubGlobal("fetch", f);
    const ok = await usuariosAtivosDoMunicipio("tok", "proj", "alagoinhas", ["ana@x.com", "bia@x.com", "fora@x.com"]);
    expect([...ok]).toEqual(["ana@x.com"]);
    expect(f.mock.calls[0][0]).toContain("/municipios/alagoinhas:runQuery");
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });
  test("consulta em blocos de 10 e usa o token do próprio administrador", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", f);
    await usuariosAtivosDoMunicipio("tok", "proj", "m", Array.from({ length: 25 }, (_, i) => `u${i}@x.com`));
    expect(f).toHaveBeenCalledTimes(3);
  });
  test("se o Firestore recusar a consulta, o envio é cancelado (não envia às cegas)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(usuariosAtivosDoMunicipio("tok", "proj", "m", ["a@x.com"])).rejects.toThrow();
  });
});

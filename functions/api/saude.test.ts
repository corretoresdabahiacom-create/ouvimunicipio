import { afterEach, describe, expect, test, vi } from "vitest";
import { onRequestGet } from "./saude";

describe("/api/saude", () => {
  afterEach(() => vi.unstubAllGlobals());
  test("200 quando o login do Google responde e o projeto está configurado; não vaza segredos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const r = await onRequestGet({ env: { FIREBASE_PROJECT_ID: "p", RESEND_API_KEY: "segredo-123" } });
    const t = await r.text();
    expect(r.status).toBe(200);
    expect(t).not.toContain("segredo-123");
    expect(JSON.parse(t).configuracao).toEqual({ projeto: true, email: true, auditoria: false });
  });
  test("503 quando o login do Google não responde", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
    expect((await onRequestGet({ env: { FIREBASE_PROJECT_ID: "p" } })).status).toBe(503);
  });
  test("503 quando falta o projeto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    expect((await onRequestGet({ env: {} })).status).toBe(503);
  });
});

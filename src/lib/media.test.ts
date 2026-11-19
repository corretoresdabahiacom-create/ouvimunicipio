import { describe, expect, test } from "vitest";
import { identificar, identificarPelosBytes } from "./media";

const bytes = (...v: (number | string)[]) => Uint8Array.from(v.flatMap((x) => typeof x === "number" ? [x] : [...x].map((c) => c.charCodeAt(0))));
const cheio = (b: Uint8Array) => { const o = new Uint8Array(32); o.set(b); return o; };

describe("tipo real do arquivo pelos primeiros bytes", () => {
  test("reconhece imagens JPEG, PNG e WebP", () => {
    expect(identificarPelosBytes(cheio(bytes(0xff, 0xd8, 0xff, 0xe0)))?.mime).toBe("image/jpeg");
    expect(identificarPelosBytes(cheio(bytes(0x89, "PNG\r\n")))?.mime).toBe("image/png");
    expect(identificarPelosBytes(cheio(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 ")))?.mime).toBe("image/webp");
  });
  test("reconhece MP4, MOV e WebM", () => {
    expect(identificarPelosBytes(cheio(bytes(0, 0, 0, 0x20, "ftypisom")))).toEqual({ tipo: "video", mime: "video/mp4" });
    expect(identificarPelosBytes(cheio(bytes(0, 0, 0, 0x14, "ftypqt  ")))).toEqual({ tipo: "video", mime: "video/quicktime" });
    expect(identificarPelosBytes(cheio(bytes(0x1a, 0x45, 0xdf, 0xa3)))).toEqual({ tipo: "video", mime: "video/webm" });
  });
  test("recusa executável, PDF, HTML, texto, HEIC e áudio, mesmo com nome de foto", () => {
    expect(identificarPelosBytes(cheio(bytes("MZ")))).toBeNull();
    expect(identificarPelosBytes(cheio(bytes("%PDF-1.7")))).toBeNull();
    expect(identificarPelosBytes(cheio(bytes("<html><script>")))).toBeNull();
    expect(identificarPelosBytes(cheio(bytes(0, 0, 0, 0x18, "ftypheic")))).toBeNull();
    expect(identificarPelosBytes(cheio(bytes(0, 0, 0, 0x18, "ftypM4A ")))).toBeNull();
    expect(identificarPelosBytes(bytes("abc"))).toBeNull();
  });
  test("lê o arquivo de verdade", async () => {
    const f = new File([cheio(bytes(0xff, 0xd8, 0xff, 0xe0))], "foto.jpg", { type: "image/jpeg" });
    expect((await identificar(f))?.tipo).toBe("imagem");
    expect(await identificar(new File(["MZ......................"], "foto.jpg", { type: "image/jpeg" }))).toBeNull();
  });
});

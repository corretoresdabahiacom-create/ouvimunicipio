// Reconhece o tipo REAL de um arquivo pelos primeiros bytes. Módulo puro: roda no navegador e nas funções do Cloudflare.
export interface Conteudo { tipo: "imagem" | "video"; mime: string }
const MARCAS_MP4 = ["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "MSNV", "dash", "f4v ", "3gp4", "3gp5", "3gp6", "3g2a", "XAVC"];
const txt = (b: Uint8Array, de: number, ate: number) => String.fromCharCode(...b.slice(de, ate));

/** Reconhece JPEG, PNG, WebP, MP4/MOV e WebM pelos primeiros bytes. Devolve null para qualquer outra coisa. */
export function identificarPelosBytes(b: Uint8Array): Conteudo | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { tipo: "imagem", mime: "image/jpeg" };
  if (b[0] === 0x89 && txt(b, 1, 4) === "PNG") return { tipo: "imagem", mime: "image/png" };
  if (txt(b, 0, 4) === "RIFF" && txt(b, 8, 12) === "WEBP") return { tipo: "imagem", mime: "image/webp" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { tipo: "video", mime: "video/webm" };
  if (txt(b, 4, 8) === "ftyp") {
    const marca = txt(b, 8, 12);
    if (marca === "qt  ") return { tipo: "video", mime: "video/quicktime" };
    if (MARCAS_MP4.includes(marca)) return { tipo: "video", mime: "video/mp4" };
  }
  return null; // inclui HEIC/AVIF (também começam por "ftyp") e áudio M4A
}



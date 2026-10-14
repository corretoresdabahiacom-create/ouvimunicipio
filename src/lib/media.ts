// Mídia sem Firebase Storage: imagens comprimidas e vídeos curtos são divididos em partes
// de ~700 KB (base64 < 940 mil caracteres) e gravados no Firestore junto com o protocolo.
export const MAX_ANEXOS = 5;
export const MAX_TOTAL_BYTES = 7_000_000; // limite do lote do Firestore é 10 MiB (base64 incha ~33%)
export const MAX_VIDEO_BYTES = 7_000_000;
const TAMANHO_PARTE = 699_000; // múltiplo de 3 => os pedaços em base64 se concatenam sem erro
export const MAX_PARTES = 12;

const VIDEO_OK = ["video/mp4", "video/webm", "video/quicktime"];

export function tipoDe(file: File): "imagem" | "video" | null {
  if (file.type.startsWith("image/")) return "imagem";
  if (VIDEO_OK.includes(file.type)) return "video";
  return null;
}

export async function comprimirImagem(file: File, maxLado = 1600, alvoBytes = 700_000): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error("Não foi possível ler a imagem.");
  const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  let q = 0.8;
  let blob: Blob | null = null;
  for (let i = 0; i < 6; i++) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= alvoBytes) break;
    q -= 0.12;
  }
  if (!blob) throw new Error("Falha ao comprimir a imagem.");
  return blob;
}

function blobParaBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

export async function dividirEmPartes(b: Blob): Promise<string[]> {
  const partes: string[] = [];
  for (let i = 0; i < b.size; i += TAMANHO_PARTE) partes.push(await blobParaBase64(b.slice(i, i + TAMANHO_PARTE)));
  if (partes.length > MAX_PARTES) throw new Error("Arquivo grande demais.");
  return partes;
}

export function juntarPartes(partes: string[], mime: string): Blob {
  const arrays = partes.map((p) => Uint8Array.from(atob(p), (c) => c.charCodeAt(0)));
  return new Blob(arrays as BlobPart[], { type: mime });
}

export function formatarBytes(n: number): string {
  return n < 1_000_000 ? `${Math.round(n / 1000)} KB` : `${(n / 1_000_000).toFixed(1)} MB`;
}

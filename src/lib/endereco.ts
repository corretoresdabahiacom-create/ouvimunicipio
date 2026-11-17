// Endereço (slug) do município a partir do nome da cidade ou de um link colado.
// "São Gonçalo dos Campos" -> "sao-goncalo-dos-campos"; "https://x.dev/alagoinhas" -> "alagoinhas"
const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");

// Durante a digitação: não corta o hífen do fim (senão não dá para digitar "sao-goncalo").
export function digitandoEndereco(texto: string): string {
  const partes = texto.split("/");
  const final = texto.includes("/") ? (partes.filter(Boolean).pop() ?? "") : texto;
  return semAcento(final).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 40);
}

// Versão final (ao criar): também tira hífens das pontas.
export function paraEndereco(texto: string): string {
  return digitandoEndereco(texto.trim()).replace(/^-+|-+$/g, "");
}

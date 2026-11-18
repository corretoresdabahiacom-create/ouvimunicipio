// Regra de retenção: protocolo CONCLUÍDO é guardado por N anos (padrão 5) a partir da conclusão; depois é apagado.
// (Antes disso, a conversa e os anexos já foram apagados 30 dias após a conclusão, pelo próprio app.)
export const ANOS_PADRAO = 5;
export function limiteRetencao(agoraMs, anos = ANOS_PADRAO) {
  const d = new Date(agoraMs);
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  return d.getTime();
}
export function anosValidos(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : null;
}

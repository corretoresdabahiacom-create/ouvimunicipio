// Decide o que é falha e o que é só aviso (separado para ser testado).
export function avaliar(resultados, limiteLentoMs = 5000) {
  const falhas = resultados.filter((r) => !r.ok).map((r) => r.nome);
  const avisos = resultados.filter((r) => r.ok && r.ms > limiteLentoMs).map((r) => `${r.nome} lento (${r.ms} ms)`);
  for (const r of resultados) if (r.ok && /NÃO configurado/.test(r.detalhe ?? "")) avisos.push(`${r.nome}: ${r.detalhe}`);
  return { falhas, avisos };
}

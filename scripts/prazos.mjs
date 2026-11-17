// Regras de prazo (iguais às do app, src/components/ui.tsx) e montagem dos alertas. Sem acesso ao banco: fácil de testar.
export const DIA = 86_400_000;
export const PRAZO_DIAS = 30;
export const PRORROGACAO_DIAS = 30;
export const NIVEIS_ALERTA = ["vencido", "hoje", "dois", "cinco"]; // "dez" e "ok" não geram e-mail
const TIPOS = { reclamacao: "Reclamação", denuncia: "Denúncia", solicitacao: "Solicitação", sugestao: "Sugestão", elogio: "Elogio", informacao: "Pedido de informação" };

const ms = (t) => (t == null ? null : typeof t === "number" ? t : t instanceof Date ? t.getTime() : t.toMillis());

export function prazoFinal(p) {
  const c = ms(p.criadoEm);
  return c == null ? null : c + (PRAZO_DIAS + (p.prorrogadoEm ? PRORROGACAO_DIAS : 0)) * DIA;
}

export function nivelPrazo(p, agora) {
  const f = prazoFinal(p);
  if (f == null) return null;
  const r = f - agora;
  if (r < 0) return "vencido";
  if (r < DIA) return "hoje";
  if (r <= 2 * DIA) return "dois";
  if (r <= 5 * DIA) return "cinco";
  if (r <= 10 * DIA) return "dez";
  return "ok";
}

export function situacao(p, agora) {
  const n = nivelPrazo(p, agora);
  const dias = Math.ceil((prazoFinal(p) - agora) / DIA);
  if (n === "vencido") return `VENCIDO há ${Math.max(1, -dias + 1)} dia(s)`;
  if (n === "hoje") return "vence HOJE";
  return `vence em ${dias} dia(s)`;
}

// protocolos: só metadados com status "aberto" (sem 1ª resposta). equipe: [{ email, papel, secretariaId, ativo, nome }]
// Retorna a lista de e-mails a enviar: um por servidor da secretaria com alertas e um resumo por ouvidor geral.
export function montarAlertas(protocolos, equipe, agora) {
  const comAlerta = protocolos
    .filter((p) => p.status === "aberto" && NIVEIS_ALERTA.includes(nivelPrazo(p, agora)))
    .sort((a, b) => prazoFinal(a) - prazoFinal(b));
  const porSecretaria = new Map();
  for (const p of comAlerta) {
    if (!porSecretaria.has(p.secretariaId)) porSecretaria.set(p.secretariaId, []);
    porSecretaria.get(p.secretariaId).push(p);
  }
  const linha = (p) => ({ numero: p.numero, tipo: TIPOS[p.tipo] ?? "Manifestação", secretaria: p.secretariaNome,
    prazo: new Date(prazoFinal(p)).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    situacao: situacao(p, agora), vencido: nivelPrazo(p, agora) === "vencido" });

  const envios = [];
  for (const m of equipe.filter((x) => x.ativo === true)) {
    if ((m.papel === "secretario" || m.papel === "assessor") && porSecretaria.has(m.secretariaId)) {
      envios.push({ para: m.email, nome: m.nome, papel: m.papel, itens: porSecretaria.get(m.secretariaId).map(linha) });
    }
    if (m.papel === "ouvidor") {
      const graves = comAlerta.filter((p) => ["vencido", "hoje", "dois"].includes(nivelPrazo(p, agora)));
      if (graves.length) envios.push({ para: m.email, nome: m.nome, papel: m.papel, itens: graves.map(linha) });
    }
  }
  return envios;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// E-mail SEM conteúdo das manifestações: só número, tipo, secretaria e prazo.
export function montarEmail(envio, municipio, link) {
  const vencidos = envio.itens.filter((i) => i.vencido).length;
  const assunto = `[Ouvidoria ${municipio}] ${envio.itens.length} protocolo(s) com prazo ${vencidos ? "vencido ou " : ""}perto de vencer`;
  const intro = envio.papel === "ouvidor"
    ? "Resumo da Ouvidoria: protocolos sem resposta que já venceram ou vencem em até 2 dias, em todas as secretarias."
    : "Protocolos da sua secretaria ainda sem a 1ª resposta e com prazo vencido ou perto de vencer.";
  const linhas = envio.itens.map((i) => `<tr><td style="padding:4px 8px;font-family:monospace">${esc(i.numero)}</td><td style="padding:4px 8px">${esc(i.tipo)}</td>`
    + (envio.papel === "ouvidor" ? `<td style="padding:4px 8px">${esc(i.secretaria)}</td>` : "")
    + `<td style="padding:4px 8px">${esc(i.prazo)}</td><td style="padding:4px 8px;${i.vencido ? "color:#b91c1c;font-weight:bold" : ""}">${esc(i.situacao)}</td></tr>`).join("");
  const html = `<p>Olá, ${esc(envio.nome)}.</p><p>${intro}</p>
<table style="border-collapse:collapse;font-size:14px" border="1"><tr><th>Protocolo</th><th>Tipo</th>${envio.papel === "ouvidor" ? "<th>Secretaria</th>" : ""}<th>Prazo</th><th>Situação</th></tr>${linhas}</table>
<p><a href="${esc(link)}">Abrir a Ouvidoria</a>. Se precisar de mais tempo, abra o protocolo e use "Prorrogar prazo" (uma única vez, com justificativa) antes de vencer.</p>
<p style="color:#666;font-size:12px">Aviso automático diário. Este e-mail não contém o conteúdo das manifestações.</p>`;
  const texto = `${intro}\n\n${envio.itens.map((i) => `${i.numero} · ${i.tipo}${envio.papel === "ouvidor" ? ` · ${i.secretaria}` : ""} · prazo ${i.prazo} · ${i.situacao}`).join("\n")}\n\n${link}`;
  return { assunto, html, texto };
}

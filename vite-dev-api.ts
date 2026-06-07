import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize GoogleGenAI client lazily if the key is present.
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-vite',
        }
      }
    });
    console.log("Vite Dev Server: Gemini API client initialized successfully.");
  } catch (err) {
    console.error("Vite Dev Server: Failed to initialize Gemini API client:", err);
  }
}

function classifyFallback(texto: string, tipo: string = "Reclamação", secretarias?: any[]) {
  const t = texto.toLowerCase();
  
  let categoria = "Geral";
  let secretaria = "Ouvidoria";
  let prioridade = "Média";
  let resposta = "Sua manifestação foi registrada com sucesso e será analisada pela equipe responsável da Ouvidoria em até 5 dias úteis.";

  let foundSec = "";
  if (secretarias && Array.isArray(secretarias)) {
    for (const sec of secretarias) {
      if (sec.funcoes && typeof sec.funcoes === "string") {
        const funcoesLower = sec.funcoes.toLowerCase();
        const tokens = t.split(/[\s,.;:!?\/()_\-]+/).filter(w => w.length > 3);
        for (const token of tokens) {
          if (funcoesLower.includes(token)) {
            foundSec = sec.nome;
            break;
          }
        }
      }
      if (foundSec) break;
    }
  }

  if (foundSec) {
    secretaria = foundSec;
    categoria = foundSec;
    prioridade = "Média";
    resposta = `Agradecemos por registrar seu relato. Com base nas competências cadastradas, sua solicitação foi pré-direcionada para a secretaria "${foundSec}". Uma equipe técnica fará a avaliação nos próximos dias.`;
  } else if (t.includes("buraco") || t.includes("pavimento") || t.includes("asfalto") || t.includes("rua") || t.includes("avenida") || t.includes("cratera")) {
    categoria = "Pavimentação";
    secretaria = "Infraestrutura";
    prioridade = "Alta";
    resposta = "Agradecemos o envio do seu relato sobre o asfalto ou pavimentação. Encaminhamos este chamado diretamente à Secretaria de Infraestrutura como ALTA prioridade. Uma equipe técnica será programada para vistoriar o trecho em até 5 dias úteis.";
  } else if (t.includes("poste") || t.includes("iluminação") || t.includes("luz") || t.includes("lâmpada") || t.includes("escuro")) {
    categoria = "Iluminação Pública";
    secretaria = "Infraestrutura";
    prioridade = "Média";
    resposta = "Recebemos sua manifestação sobre falhas ou lâmpadas queimadas na iluminação pública. Ela foi registrada na Secretaria de Infraestrutura. O prazo padrão para manutenção de luminárias é de 3 dias úteis.";
  } else if (t.includes("lixo") || t.includes("limpeza") || t.includes("entulho") || t.includes("capina") || t.includes("mato")) {
    categoria = "Limpeza Urbana";
    secretaria = "Serviços Públicos";
    prioridade = "Alta";
    resposta = "Registramos seu chamado de limpeza urbana (como lixo, entulhos ou mato alto). Solicitamos o envio imediato da equipe de conservação e limpeza da Secretaria de Serviços Públicos para verificar e resolver a situação.";
  } else if (t.includes("água") || t.includes("esgoto") || t.includes("vazamento") || t.includes("bueiro") || t.includes("saneamento")) {
    categoria = "Saneamento";
    secretaria = "Saneamento";
    prioridade = "Alta";
    resposta = "Identificamos uma queixa de saneamento, vazamento de água ou esgoto. Registramos na Secretaria de Saneamento em caráter prioritário. Nossos técnicos de campo atuarão para sanar o vazamento o quanto antes.";
  } else if (t.includes("saúde") || t.includes("ubs") || t.includes("médico") || t.includes("remédio") || t.includes("consulta") || t.includes("hospital")) {
    categoria = "Saúde";
    secretaria = "Saúde";
    prioridade = "Média";
    resposta = "Compreendemos a importância de sua demanda referente ao atendimento de Saúde. Encaminhamos o seu relato para a ouvidoria da Secretaria de Saúde e a gerência técnica do posto responsável para devidas apurações.";
  } else if (t.includes("escola") || t.includes("creche") || t.includes("aluno") || t.includes("profess") || t.includes("ensino") || t.includes("aula")) {
    categoria = "Educação";
    secretaria = "Educação";
    prioridade = "Média";
    resposta = "Demanda anotada e enviada à Secretaria de Educação. Entraremos em contato com a equipe pedagógica ou de infraestrutura escolar para analisar o ocorrido e prestar os devidos esclarecimentos.";
  } else if (t.includes("assalto") || t.includes("roubo") || t.includes("policia") || t.includes("segurança") || t.includes("guarda") || t.includes("vandalismo")) {
    categoria = "Segurança";
    secretaria = "Segurança";
    prioridade = "Alta";
    resposta = "Registramos sua manifestação sobre segurança pública. Repassamos as informações coletadas para a Guarda Municipal e a Secretaria de Segurança para intensificar o patrulhamento preventivo na região.";
  }

  if (tipo === "Denúncia" && prioridade !== "Alta") {
    prioridade = "Urgente";
  }

  return { categoria, secretaria, prioridade, resposta, is_ai: false };
}

function despachoFallback(protocolo: string, tipo: string, descricao: string, rascunho: string, agenteNome: string, agenteCargo: string, acao: string) {
  if (acao === "suggest") {
    const respFallback = `DESPACHO ADMINISTRATIVO ORDINÁRIO\n\nÀ Equipe Técnica de Fiscalização e Diligências de Campo,\n\nEm atenção ao chamado de Ouvidoria nº #${protocolo} referente a [${tipo}], fundamentado no relato de que: "${descricao?.substring(0, 150)}...".\n\nNo uso das atribuições regulares deste cargo, determino o encaminhamento imediato desta manifestação às equipes de operações competentes para que realizem a vistoria técnica necessária in loco, elaborem o relatório circunstanciado e tomem as providências saneadoras de urgência.\n\nPublique-se, registre-se e dê-se ciência aos interessados.\n\nGabinete Municipal de Gestão\nAssinado: ${agenteNome || "Agente de Governo"} (${agenteCargo || "Servidor"})`;
    return { despacho: respFallback, is_ai: false };
  } else {
    const respFallback = `DESPACHO DE EXTRATO MUNICIPAL\n\nReferência: Processo de Ouvidoria nº #${protocolo} (${tipo})\n\nEm atenção aos trâmites regulares e ao acolhimento da demanda, despacho na forma recomendada:\n\n"${rascunho || "Proceda-se com o acolhimento do chamado e andamento operacional."}"\n\nFica determinado o cumprimento imediato das diligências instrutórias pelas frentes de obras e serviços.\n\nAssinado e Deferido:\n${agenteNome || "Agente de Governo"} (${agenteCargo || "Servidor Generalista"})`;
    return { despacho: respFallback, is_ai: false };
  }
}

export async function handleLocalClassify(body: any) {
  const { descricao, tipo, secretarias } = body;
  if (!descricao) {
    throw new Error("Descrição vazia ou inválida");
  }

  if (!ai) {
    return classifyFallback(descricao, tipo, secretarias);
  }

  try {
    let secretariasContext = "";
    if (secretarias && Array.isArray(secretarias) && secretarias.length > 0) {
      secretariasContext = `\nAs secretarias disponíveis cadastradas no município e as descrições de suas Atribuições/Funções são:\n` + 
        secretarias.map((s: any) => `- Nome: "${s.nome}"\n  Atribuições/Funções: "${s.funcoes || "Diversas responsabilidades"}"`).join("\n");
    }

    const prompt = `Analise a seguinte descrição de uma manifestação cidadã (reclamação, denúncia, sugestão ou elogio) e classifique-a nos parâmetros para o sistema da prefeitura municipal.

Descrição inserida pelo cidadão: "${descricao}"
Tipo de manifestação selecionado: "${tipo || "Reclamação"}"
${secretariasContext ? `\nUse exatamente uma das secretarias fornecidas abaixo para fazer a classificação, preferencialmente combinando com a Atribuição/Função correspondente:${secretariasContext}\n` : ""}

Classifique nos seguintes campos exatamente:
1. categoria: Qual é a categoria temática ou assunto do problema? Escolha a mais adequada. Se houver secretarias personalizadas acima, use o nome de uma categoria pertinente curta (p.ex. 'Pavimentação', 'Iluminação', 'Zoonoses', 'Esporte' ou 'Geral').
2. secretaria: Qual secretaria municipal deve resolver isso? ${secretariasContext ? "Deve ser EXATAMENTE ou de preferência um dos NOMES de secretaria informados na lista acima." : "Pode ser 'Infraestrutura', 'Serviços Públicos', 'Saúde', 'Saneamento', 'Educação', 'Segurança' ou 'Ouvidoria'."}
3. prioridade: Qual a gravidade e prioridade do atendimento? Deve ser exatamente uma destas: 'Baixa', 'Média', 'Alta', 'Urgente'.
4. resposta: Escreva uma resposta oficial, educada e muito empática da ouvidoria da prefeitura ao cidadão em português brasileiro. Confirme o recebimento do chamado relacionado com a descrição dada e detalhe que a secretaria responsável foi acionada. Mantenha um tom profissional, atencioso e prestativo.

Retorne em formato JSON correspondente.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categoria: {
              type: Type.STRING
            },
            secretaria: {
              type: Type.STRING
            },
            prioridade: {
              type: Type.STRING
            },
            resposta: {
              type: Type.STRING
            }
          },
          required: ["categoria", "secretaria", "prioridade", "resposta"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      categoria: parsed.categoria || "Geral",
      secretaria: parsed.secretaria || "Ouvidoria",
      prioridade: parsed.prioridade || "Média",
      resposta: parsed.resposta || "Sua manifestação foi registrada e será processada pela ouvidoria municipal.",
      is_ai: true
    };
  } catch (error) {
    console.warn("Vite Dev Server Gemini classification failed, running fallback:", error);
    return classifyFallback(descricao, tipo, secretarias);
  }
}

export async function handleLocalDespacho(body: any) {
  const { protocolo, tipo, descricao, rascunho, agenteNome, agenteCargo, acao } = body;
  
  if (!protocolo) {
    throw new Error("Número do protocolo é obrigatório.");
  }

  if (!ai) {
    return despachoFallback(protocolo, tipo, descricao, rascunho, agenteNome, agenteCargo, acao);
  }

  try {
    let prompt = "";
    if (acao === "suggest") {
      prompt = `Você é um assessor de alto nível de redação jurídica e governamental de uma Prefeitura Municipal brasileira.
Sua tarefa é rascunhar um "DESPACHO" administrativo oficial (decisão do cargo que instrui as equipes, determina providências operacionais ou fiscalizatórias na rua/campo) redigido pelo agente público:
- Nome do Agente Emissor: "${agenteNome || "Agente Público"}"
- Cargo Regulamentar: "${agenteCargo || "Servidor"}"

O chamado de Ouvidoria a ser despachado é:
- Protocolo: #${protocolo}
- Tema/Tipo de Reclamação: ${tipo}
- Relato do cidadão: "${descricao}"

Escreva um despacho elegante, altamente formal, assertivo, e em conformidade estrita com o padrão de redação oficial da administração pública brasileira em português do Brasil. O despacho deve instruir expressamente a ação técnica pertinente ao cargo (por exemplo, se for engenheiro/diretor/coordenador, vistorias técnicas e reparos urgentes; se for Prefeito/Secretário, dotação de recursos e coordenação macro; se for Procurador, emissão de parecer de legalidade). 
Mantenha a redação objetiva e concisa (máximo de 3 parágrafos). Termine com um bloco de assinatura elegante do agente. Retorne no formato JSON requerido.`;
    } else {
      prompt = `Você é um renomado assessor de redação institucional e jurídica de prefeituras municipais e gabinetes de alta governança.
Sua tarefa é RECEBER um rascunho de despacho escrito por um agente público e MELHORÁ-LO (elevar o vocabulário, padronizar conforme as normas oficiais de redação brasileira, garantir concisão técnica e formatar de forma impecável).

Agente público autor:
- Nome: "${agenteNome || "Agente de Gestão"}"
- Cargo: "${agenteCargo || "Servidor"}"

Referência do Chamado:
- Protocolo: #${protocolo}
- Tipo/Tema: ${tipo}
- Conteúdo do cidadão: "${descricao}"

Rascunho de texto escrito pelo usuário:
"${rascunho}"

Escreva uma versão otimizada, extremamente polida, oficial, gramaticalmente irretocável em português brasileiro. Preserve integralmente o sentido e as decisões descritas no rascunho original do agente, mas aperfeiçoe a prosa de forma primorosa. Termine com o bloco decorativo de assinatura do agente correspondente. Retorne no formato JSON requerido.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            despacho: {
              type: Type.STRING
            }
          },
          required: ["despacho"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      despacho: parsed.despacho || "Erro ao produzir ou melhorar o teor do despacho governamental.",
      is_ai: true
    };
  } catch (error) {
    console.warn("Vite Dev Server Gemini despacho failed, running fallback:", error);
    return despachoFallback(protocolo, tipo, descricao, rascunho, agenteNome, agenteCargo, acao);
  }
}

// Cloudflare Pages Function for POST /api/classify
interface Env {
  GEMINI_API_KEY?: string;
}

// Rule-based fallback classifier matching server.ts exactly
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

export async function onRequestPost(context: { request: any; env: Env }) {
  const { request, env } = context;
  
  try {
    const rawBody = await request.text();
    const body: any = JSON.parse(rawBody || "{}");
    const { descricao, tipo, secretarias } = body;

    if (!descricao) {
      return new Response(JSON.stringify({ error: "Descrição vazia ou inválida" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const apiKey = env.GEMINI_API_KEY || "";
    if (!apiKey) {
      console.log("No GEMINI_API_KEY secret configured in Cloudflare environment. Running fallback.");
      return new Response(JSON.stringify(classifyFallback(descricao, tipo, secretarias)), {
        headers: { "Content-Type": "application/json" }
      });
    }

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

    // Standard Gemini REST endpoint fetch call (completely future-proof and fast)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const requestPayload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            categoria: {
              type: "STRING",
              description: "A temática principal do relato, por ex: Pavimentação, Iluminação Pública, Limpeza Urbana, Saneamento, Saúde, Segurança, Educação, Geral"
            },
            secretaria: {
              type: "STRING",
              description: "A secretaria municipal correspondente recomendada pela IA"
            },
            prioridade: {
              type: "STRING",
              description: "A prioridade estimada: Baixa, Média, Alta, Urgente"
            },
            resposta: {
              type: "STRING",
              description: "Uma resposta oficial, acolhedora e explicativa do que será feito"
            }
          },
          required: ["categoria", "secretaria", "prioridade", "resposta"]
        }
      }
    };

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload)
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API Call failed with status ${geminiResponse.status}: ${errorText}`);
    }

    const geminiData: any = await geminiResponse.json();
    const candidateText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(candidateText);

    return new Response(JSON.stringify({
      categoria: parsed.categoria || "Geral",
      secretaria: parsed.secretaria || "Ouvidoria",
      prioridade: parsed.prioridade || "Média",
      resposta: parsed.resposta || "Sua manifestação foi registrada e será processada pela ouvidoria municipal.",
      is_ai: true
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Gemini classification failed on Cloudflare, running fallback:", error);
    try {
      const body: any = await request.clone().json().catch(() => ({}));
      const fallbackResult = classifyFallback(body.descricao || "", body.tipo, body.secretarias);
      return new Response(JSON.stringify(fallbackResult), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Exception occurred: " + error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

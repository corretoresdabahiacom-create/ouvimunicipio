// Cloudflare Pages Function for POST /api/despacho
interface Env {
  GEMINI_API_KEY?: string;
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

export async function onRequestPost(context: { request: any; env: Env }) {
  const { request, env } = context;

  try {
    const rawBody = await request.text();
    const body: any = JSON.parse(rawBody || "{}");
    const { protocolo, tipo, descricao, rascunho, agenteNome, agenteCargo, acao } = body;

    if (!protocolo) {
      return new Response(JSON.stringify({ error: "Número do protocolo é obrigatório." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const apiKey = env.GEMINI_API_KEY || "";
    if (!apiKey) {
      console.log("No GEMINI_API_KEY secret configured in Cloudflare environment. Running formatted fallback.");
      return new Response(JSON.stringify(despachoFallback(protocolo, tipo, descricao, rascunho, agenteNome, agenteCargo, acao)), {
        headers: { "Content-Type": "application/json" }
      });
    }

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
            despacho: {
              type: "STRING",
              description: "O texto completo do despacho redigido ou aprimorado de forma impecável com quebras de linha normais '\\n'."
            }
          },
          required: ["despacho"]
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
      throw new Error(`Gemini API Call for despacho failed: ${errorText}`);
    }

    const geminiData: any = await geminiResponse.json();
    const candidateText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(candidateText);

    return new Response(JSON.stringify({
      despacho: parsed.despacho || "Erro ao produzir ou melhorar o teor do despacho governamental.",
      is_ai: true
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Gemini despacho helper failed on Cloudflare, running fallback:", error);
    try {
      const body: any = await request.clone().json().catch(() => ({}));
      const fallbackResult = despachoFallback(
        body.protocolo || "",
        body.tipo || "",
        body.descricao || "",
        body.rascunho || "",
        body.agenteNome || "",
        body.agenteCargo || "",
        body.acao || "suggest"
      );
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

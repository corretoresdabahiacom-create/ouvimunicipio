# Auditoria técnica — Fase 1 (Estabilização)

Data: 10/11/2026. Versão auditada: ramo `main` com App Check e conversa sigilosa.

## O que foi EXECUTADO de verdade
| Item | Resultado |
|---|---|
| `npm install` | OK |
| `npm run lint` (verificação de tipos TypeScript) | OK, 0 erros |
| `npm run build` | OK. Pacotes: app 288 kB, firebase 722 kB, painéis em arquivos separados |
| `npm audit` | 6 alertas antes; 2 corrigidos (Vite e re2js); restam 4, explicados em M1 |
| Testes das regras do Firestore | **Escritos (97 casos), ainda NÃO executados.** O emulador não baixa no meu ambiente. Rodam no GitHub (aba Actions) após o próximo envio |

## O que NÃO foi verificado (não afirmo que funciona)
Instalação do PWA em celular, responsividade em tablet/celular, leitor de tela, fluxo completo na tela
(cadastro → resposta → conclusão → apagamento após 30 dias), e-mail de auditoria e e-mail em massa.
O teste de ponta a ponta combinado ("vamos testar depois") continua pendente.

## Problemas encontrados

### Críticos (segurança, perda de dados, acesso indevido)
Nenhum confirmado pela leitura do código. Ressalva importante: as regras novas (conversa sigilosa, LGPD,
lotes com mídia) nunca tinham rodado em emulador. Os testes novos existem para confirmar isso (ver A1).

### Altos
| # | Problema | Situação |
|---|---|---|
| A1 | Nenhum teste automático. Regras de segurança só validadas por leitura | Testes criados + verificação automática no GitHub. **Aguardando 1ª execução** |
| A2 | Sem limite de uso por conta. Uma conta verificada podia criar protocolos e mídias sem parar (até ~7 MB cada) e esgotar a cota gratuita do Firestore | **Corrigido, aguardando os testes.** Máx. 20 envios (manifestação nova ou complemento) a cada 24 h por conta; o contador fica no perfil e as regras exigem somá-lo no mesmo lote de cada envio (um registro vale para um único envio). Respostas dos servidores não contam |
| A3 | O administrador técnico pode cadastrar um segundo e-mail dele como secretário e ler as conversas dessa secretaria. Só o e-mail de auditoria denunciaria | **Não corrigido.** Exige separar os perfis (admin técnico ≠ ouvidor) — Fase 2 |
| A4 | E-mail de auditoria inativo (Resend não configurado): ações do administrador ficam sem registro | Pendente de você (chave do Resend) |
| A5 | Fotos e vídeos são gravados no Firestore em base64. Funciona no plano gratuito, mas o plano de evolução pede evitar isso | **Decisão necessária** (ver abaixo) |
| A6 | O apagamento da conversa 30 dias após concluir é feito pelo navegador de quem abrir o app. Se ninguém abrir, nada é apagado. Além disso, o plano pede considerar prazos legais de guarda e preservação de provas | **Decisão necessária** (ver abaixo) |

### Médios
| # | Problema | Situação |
|---|---|---|
| M1 | `npm audit`: 4 alertas "altos" em `firebase → @grpc/grpc-js`. É biblioteca de servidor; conferi que **não vai** no pacote do app (0 ocorrências nos arquivos gerados). Vite (moderado, só servidor de desenvolvimento) foi atualizado | Risco real baixo. Acompanhar atualizações do Firebase |
| M2 | E-mail em massa: o administrador pode digitar qualquer endereço, não só usuários cadastrados. Se a conta admin for roubada, vira relé de spam | Não corrigido. Proposta: aceitar só e-mails cadastrados + limite diário |
| M3 | Tipo de arquivo é conferido pelo tipo informado pelo navegador, não pelo conteúdo real. Imagens são recomprimidas (isso neutraliza), vídeos não são inspecionados | Não corrigido |
| M4 | Sem limite de chamadas nas funções `/api` do Cloudflare (só exige login de administrador) | Baixo risco hoje; limitar com regra do Cloudflare (WAF) |
| M5 | "lint" só confere tipos (não há ESLint); não há testes de tela | Pendente |
| M6 | Termos e Política de Privacidade são modelos: precisam de revisão jurídica e do contato do encarregado (LGPD) | Pendente de você |
| M7 | Não existem: prorrogação de prazo, reabertura, ouvidor geral, LAI, mapa, relatórios gerenciais, multi-município | Fases 2 e 3 |

### Baixos
| # | Problema | Situação |
|---|---|---|
| B1 | `.env.example` desatualizado (falava de reCAPTCHA v3) | **Corrigido** |
| B2 | Token malformado nas funções do Cloudflare respondia erro 500 em vez de 401 | **Corrigido** |
| B3 | `aceiteVersao` aceita qualquer texto não vazio | Não corrigido (ao exigir a versão exata, cada novo termo exigiria republicar as regras) |
| B4 | CSP mantém `'unsafe-inline'` só em estilos (necessário para o React) | Aceito |

## Arquivos modificados / criados nesta etapa
- `.env.example`, `functions/_comum.ts`, `package-lock.json` (Vite atualizado)
- `rules-tests/` (testes das regras + LEIA-ME), `.github/workflows/ci.yml` (verificação automática)
- `AUDITORIA.md` (este arquivo)
- **Regras do Firestore alteradas (limite de envios, A2): `firestore.rules`, `src/lib/limite.ts`, `Cidadao.tsx`, `Conversa.tsx`.**
  **Ordem de publicação:** (1) enviar ao GitHub e esperar o fluxo "Verificação" ficar verde; (2) publicar o novo
  `firestore.rules` no console do Firebase; (3) o Cloudflare publica o app em seguida. Entre (2) e (3) o envio de
  mensagens pode falhar por alguns minutos (app antigo × regras novas). Não publique as regras se algum teste falhar.

## Decisões que preciso de você (não bloqueiam a verificação dos testes)
1. **Fotos e vídeos:** continuar no Firestore (grátis, com limite de tamanho) ou usar o Cloudflare R2 (URLs temporárias, sem limite apertado). O R2 normalmente exige cadastrar forma de pagamento no Cloudflare, mesmo com cota gratuita (confirmar antes).
2. **Prazo de guarda:** manter "apagar 30 dias após concluir" (sua regra) ou guardar por mais tempo por exigência legal/prova. Se mantiver, um apagamento confiável precisaria de uma rotina no servidor.
3. **Vários municípios (Fase 3):** um único projeto Firebase com identificador do município em cada dado (grátis, mas todos no mesmo banco) ou um projeto por município (isolamento total, mais trabalho).

## Custos e dependências futuras (fora do plano gratuito)
WhatsApp oficial (pago por conversa), IA para classificar/resumir (API paga; só com base legal e sem dados sigilosos),
envio de e-mail em volume (Resend pago acima de ~100/dia), domínio próprio (para e-mail e para cada prefeitura).
Mapa pode usar OpenStreetMap (gratuito).

---

# Fase 2 — Produto municipal (andamento)

| Item do plano | Situação |
|---|---|
| **Prazos legais da Ouvidoria (Lei 13.460/2017, art. 16)** | **Feito, aguardando os testes.** Prazo de 30 dias; prorrogação única de +30 dias pelo servidor, com justificativa obrigatória (10 a 300 caracteres), nome e data do servidor registrados, comunicação ao cidadão (aviso no app + motivo visível no protocolo). Só vale antes da 1ª resposta e antes de vencer. Alertas em 10, 5 e 2 dias, no dia do vencimento e vencido. Aba **Vencidas** na secretaria; indicadores do administrador já consideram a prorrogação |
| **Ouvidor geral** (papel `ouvidor`) | **Feito, aguardando os testes.** Decisão sua: lê o conteúdo das conversas e os dados do protocolo (só leitura, não responde pelo setor). Vê todas as secretarias, filtra por secretaria, tipo, situação e prazo, busca pelo número. **Encaminha** o protocolo a outra secretaria (motivo obrigatório; histórico imutável visível ao cidadão e às secretarias; o setor antigo perde o acesso e o novo passa a ter) e **cobra** resposta (aviso interno, o cidadão não vê). Denúncias não têm restrição extra: o ouvidor lê todas |
| **Painel do prefeito** (papel `prefeito`) | **Feito, aguardando os testes.** Lê só um documento de números (`estatisticas/atual`): totais, por tipo, por secretaria, vencidas, evolução mensal, % no prazo, tempo médio, nota média. Nenhum protocolo, conversa ou usuário. O resumo é calculado pelo navegador do ouvidor (ao abrir o painel, no máximo a cada 12 h, ou no botão "Atualizar painel do prefeito"), usando os 1.000 protocolos mais recentes |
| LAI (Lei 12.527/2011): 20 + 10 dias, recursos | Não iniciado (módulo separado) |
| Mapa de ocorrências | Não iniciado (pode usar OpenStreetMap, gratuito) |
| Relatórios mensais/anuais (PDF/Excel) | Não iniciado (CSV já existe) |
| Notificações por e-mail/WhatsApp/PWA | Parcial: aviso no app e e-mail do administrador. WhatsApp oficial é pago |
| Status "Em triagem", "Encaminhado", "Aguardando informações", "Reaberto" | Não iniciado |

Limitações do ouvidor/prefeito: as regras limitam o resumo a números e tamanhos máximos, mas não impedem que o ouvidor
publique números errados (ele calcula no navegador). O administrador técnico ainda pode cadastrar um segundo e-mail dele
como ouvidor e ler conversas (mesmo risco A3; só o e-mail de auditoria denuncia). As regras usam `string()` e `existsAfter()`
em protocolos/historico: **precisam passar nos testes antes de publicar**. **Publique as regras e o app juntos** (app novo
com regras antigas não encaminha; regras novas com app antigo funcionam, pois só acrescentam permissões).

Limitações conhecidas dos prazos: as regras não conseguem **obrigar** o aviso ao cidadão (o app sempre o cria no mesmo
lote, mas um servidor mal-intencionado poderia prorrogar sem avisar); a contagem é em dias corridos, sem suspensão por
feriados (a regulamentação municipal pode definir de outro modo).

---

# Fase 3 — SaaS multi-município (andamento)

| Item | Situação |
|---|---|
| Multi-município por caminho (`municipios/{id}/…`), um único projeto Firebase | **Feito, aguardando os testes.** Detalhes e ordem de publicação em `PLANO_FASE3.md` |
| SUPERADMIN (por e-mail, cadastrado só no console) | **Feito, aguardando os testes.** Cria/suspende município, troca plano, cadastra o 1º admin. Não lê conversas nem usuários |
| Isolamento entre municípios nas regras | **Feito, aguardando os testes** (16 casos novos; total 135, ainda NÃO executados) |
| Migração dos dados atuais | Script pronto (`scripts/`), **não executado** (exige a chave de serviço, que é sua) |
| Planos | Só rótulo (básico/padrão/completo); sem limite aplicado nem cobrança |
| Monitoramento | Não iniciado (sugestões em `PLANO_FASE3.md`) |
| Excluir conta × vários municípios (LGPD) | **Pendente de decisão** (ver limitações no plano) |

**Risco principal:** mudança grande em todas as regras, nunca executada. Não publique nada antes do "Verificação" verde e do teste manual.

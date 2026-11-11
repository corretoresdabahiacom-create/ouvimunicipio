# Auditoria técnica — Fase 1 (Estabilização)

Data: 10/11/2026. Versão auditada: ramo `main` com App Check e conversa sigilosa.

## O que foi EXECUTADO de verdade
| Item | Resultado |
|---|---|
| `npm install` | OK |
| `npm run lint` (verificação de tipos TypeScript) | OK, 0 erros |
| `npm run build` | OK. Pacotes: app 288 kB, firebase 722 kB, painéis em arquivos separados |
| `npm audit` | 6 alertas antes; 2 corrigidos (Vite e re2js); restam 4, explicados em M1 |
| Testes das regras do Firestore | **Escritos (87 casos), ainda NÃO executados.** O emulador não baixa no meu ambiente. Rodam no GitHub (aba Actions) após o próximo envio |

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

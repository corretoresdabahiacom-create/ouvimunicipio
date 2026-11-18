# Configuração (plano gratuito do Firebase + Cloudflare Pages)

Projeto Firebase: `ouvimunicipio-f2bf7` (banco `(default)`). Não usa Cloud Functions nem Storage (ambos exigem plano pago).
Tudo de um município fica em `municipios/{municipio}/…` no Firestore; o endereço do app é `/{municipio}`.

## 1. Console Firebase
1. **Authentication → Método de login:** ative **E-mail/senha**. Em *Configurações → Domínios autorizados* inclua o domínio do app (`ouvimunicipio.pages.dev` ou o seu).
2. **Firestore Database:** `southamerica-east1`.
3. **Firestore → Regras:** cole o conteúdo de `firestore.rules` e publique. Só publique depois que a verificação do GitHub
   ("Testar as regras do Firestore") estiver verde.
4. **App Check:** reCAPTCHA Enterprise. A chave do site fica em `firebase-applet-config.json` (`recaptchaSiteKey`); a imposição
   está ativa no Cloud Firestore.
5. *(TTL do Firestore exige faturamento e NÃO é usado.)* O próprio app apaga avisos vencidos e conversas 30 dias após a conclusão.

## 2. SUPERADMIN (uma vez, manualmente)
1. Em **Firestore → Dados**, crie a coleção `superadmins` com um documento cujo ID é **o seu e-mail em minúsculas**
   (um campo qualquer, por exemplo `ativo = true`). Ninguém consegue se tornar superadmin pelo app.
2. Abra `https://ouvimunicipio.pages.dev/superadmin`, entre com esse e-mail (ou crie a conta e confirme o e-mail).
3. Crie o município: **cidade**, **estado (UF)**, nome oficial (preenchido sozinho) e endereço (gerado da cidade; pode colar o link) e cadastre o administrador dele
   (use **outro e-mail**: o superadmin não pode se cadastrar como administrador).

## 3. Administrador e equipe do município
O administrador abre `/{municipio}`, cria a conta com o e-mail cadastrado e confirma. Em **Admin** ele cria as secretarias,
a aparência (nome, logo, cor, contato do encarregado LGPD), os anúncios e a equipe:
secretário/assessor (com secretaria), ouvidor geral e prefeito. Cada pessoa cria a conta em `/{municipio}` com o mesmo e-mail.
Remover ou desativar o cadastro tira o acesso na hora.

## 4. Cloudflare Pages
- **Build command:** `npm run build` · **Output directory:** `dist`
- `FIREBASE_PROJECT_ID` já vem do `wrangler.jsonc`.
- Variáveis (Settings → Variables and Secrets):
  - `RESEND_API_KEY` (*Secret*) = chave do resend.com
  - `AUDIT_EMAIL` = e-mail que recebe o registro das ações dos administradores (de todos os municípios)
  - `RESEND_FROM` (opcional) = remetente de domínio verificado; sem isso o Resend só entrega ao dono da conta
  - `NOME_ORGAO` (opcional) = nome no rodapé dos e-mails enviados aos usuários
  - `VITE_MUNICIPIO_PADRAO` (opcional, de *build*) = município aberto quando o endereço é só `/`
  - `VITE_CONTATO_SUPERADMIN` (opcional, de *build*) = e-mail que aparece no painel do administrador para pedir a exclusão do município
- **Limite de chamadas (recomendado):** as funções já barram abusos simples (10 envios em massa e 60 registros de auditoria a cada
  10 min por administrador), mas a contagem é por servidor. Para um limite exato, no painel do Cloudflare crie uma
  *Regra de limitação de taxa* (Security → WAF → Rate limiting rules) para o caminho `/api/` (ex.: 30 pedidos por minuto por IP).

## Limites de mídia (guardada no próprio Firestore)
- Fotos reduzidas automaticamente (~700 KB cada). Vídeos até 7 MB (clipes curtos). Soma por mensagem: 7 MB. Máx. 5 anexos.
- Cada conta pode fazer até 20 envios (manifestação nova ou complemento) a cada 24 h.

## Segurança em resumo
- Conversas e anexos: lidos pelo autor, pela secretaria responsável e pelo ouvidor geral do mesmo município.
  Administrador, prefeito e superadmin **não** leem conversas.
- Papéis vêm de `municipios/{municipio}/equipe` (só o admin do município escreve; o superadmin só cria administradores).
- Nada de um município é lido ou gravado por pessoas de outro (coberto por testes automáticos).
- Prazo legal de 30 dias com prorrogação única (+30, justificativa obrigatória, cidadão avisado).
- Cabeçalhos de segurança e CSP em `public/_headers`.

## Painel do administrador
- **Usuários:** lista com nome, e-mail e telefone; bloquear/desbloquear e excluir (apaga os dados pessoais).
  Sem Cloud Functions o app não apaga o *login*: para liberar um e-mail, remova-o em Authentication → Usuários.
- **Mensagens:** aviso no app (2 a 30 dias) e/ou e-mail (até 500 pessoas por envio, em blocos de 100).
- **Aparência:** nome, logomarca e cor (contraste mínimo 4,5 com texto branco). **Publicidade:** até 10 anúncios no carrossel.
- **Relatórios:** indicadores e CSV. O **relatório de gestão em PDF** e a **planilha (CSV)** ficam no painel do ouvidor geral.
- **Transparência:** em Aparência, "Publicar o painel de transparência" abre `/{municipio}/transparencia` ao público (só números).

## Termos e LGPD
Textos-modelo em `src/components/Legal.tsx` (revise com a assessoria jurídica). Versão em `VERSAO_TERMOS`
(`src/lib/types.ts`); mudar a versão pede novo aceite de todos.

## Alertas diários de prazo por e-mail (opcional, gratuito)
Rodam no GitHub Actions (`.github/workflows/alertas-prazo.yml`), de segunda a sexta às 8h, e ficam **desligados** até você configurar:
1. Firebase → Configurações do projeto → **Contas de serviço** → *Gerar nova chave privada* (arquivo JSON; é um segredo).
2. GitHub → repositório → Settings → Secrets and variables → Actions → **Secrets**: `FIREBASE_SERVICE_ACCOUNT` (cole o conteúdo
   inteiro do JSON), `RESEND_API_KEY` e `RESEND_FROM` (remetente de domínio verificado no Resend; sem isso só chega ao dono da conta).
   Depois apague o arquivo JSON do computador.
3. Teste: aba **Actions** → *Alertas de prazo* → *Run workflow* com "Modo teste" marcado. O registro mostra quem receberia o quê.
4. Para ligar o envio diário: aba **Variables** → `ALERTAS_ATIVOS` = `true` (e, se usar domínio próprio, `APP_URL`).

## Monitoramento (opcional, gratuito)
`/api/saude` mostra se as funções estão no ar (sem expor segredos). O workflow **Monitoramento** (`.github/workflows/monitoramento.yml`) confere de hora em hora
o site, as funções e (se o Secret `FIREBASE_SERVICE_ACCOUNT` existir) o banco; se algo falhar, o GitHub avisa por e-mail. Para ligar: Variables → `MONITORAMENTO_ATIVO` = `true`
(e `APP_URL`, se usar domínio próprio). Teste agora em Actions → *Monitoramento* → *Run workflow*.

## Retenção de dados (quanto tempo se guarda)
- **Conversa e anexos:** apagados 30 dias depois da conclusão (feito pelo app).
- **Protocolo concluído (só números e datas, sem texto):** guardado **5 anos** após a conclusão e depois apagado, junto com a cópia da consulta pública.
  Roda em `scripts/retencao.mjs` (mensal, workflow **Retenção de dados**); fica **desligado** até `RETENCAO_ATIVA` = `true`. Teste sem apagar: *Run workflow*
  (modo simulação). Para mudar o prazo: `node retencao.mjs --anos 3`. Antes de apagar ele grava um backup (`.ndjson`), guardado 30 dias na execução do workflow.
  Isto é uma sugestão de prazo; confirme com a assessoria jurídica do município (tabela de temporalidade) e ajuste `ANOS_RETENCAO` em `src/lib/types.ts` e no workflow.
- **Conta do cidadão:** até ele pedir a exclusão. **Avisos:** 2 a 30 dias.

## Etapas do protocolo
A situação continua sendo aberto → respondido → concluído, com etapas que a refinam:
- **Em triagem:** o ouvidor geral marca (botão no protocolo) que está analisando para encaminhar. Não muda prazo.
- **Aguardando informações:** a secretaria marca, ao enviar a mensagem, que precisa de dados do cidadão. O prazo fica **suspenso** até ele responder
  (no máximo 20 dias por pedido, até 2 pedidos) e não conta como a 1ª resposta. Quando o cidadão responde, os dias de espera são somados ao prazo.
- **Reaberto:** o cidadão pode reabrir **uma vez**, até 30 dias após a conclusão (enquanto a conversa ainda existe). O prazo conta de novo a partir da reabertura.
Os alertas por e-mail e a consulta pública usam a mesma regra de prazo do app.

## Pedido de acesso à informação (LAI)
Tipo próprio ("Pedido de acesso à informação (LAI)", Lei 12.527/2011): prazo de **20 dias**, prorrogável **uma vez por mais 10** (com justificativa);
o cidadão pode apresentar **recurso** (uma vez, até 10 dias depois da resposta) e a administração deve decidir em **5 dias**. Aparece nos relatórios como um tipo à parte.
Obs.: a ouvidoria atua como canal; classificação de sigilo e a autoridade que julga o recurso seguem o decreto municipal de cada prefeitura.

## Mapa, consulta e respostas-modelo
- Local da ocorrência: opcional para o cidadão (GPS ou toque no mapa). Mapa nas abas da secretaria e do ouvidor.
- Consulta sem login: `/{municipio}/consulta` (link na tela de login).
- Respostas-modelo: aba "Respostas-modelo" do painel da secretaria (o secretário edita; a equipe usa).

## Painel do superadmin: editar, suspender e excluir município
- **Editar:** muda o nome oficial, a cidade e o estado. O endereço (`/{municipio}`) não muda, porque links e o app instalado dependem dele.
- **Suspender/Reativar:** pausa temporária. Ninguém cria contas nem manifestações; os dados ficam intactos.
- **Excluir:** definitivo pelo painel (pede para digitar o endereço). O município some da lista, ninguém mais acessa e o
  endereço nunca mais pode ser usado (assim um município novo não herda os dados do antigo). Os dados continuam guardados.
- **Administradores:** no botão **Administradores** de cada município você vê quem administra, **desativa/reativa** (tira o acesso na hora)
  e **remove**. Para corrigir um e-mail errado: cadastre o certo em "Administrador do município" e remova o errado.
  O administrador (servidor ou prefeito) **não exclui** o município: ele pede por e-mail ao superadmin.
- **Apagar os dados de vez** (depois de excluir): com a chave da conta de serviço, na pasta `scripts`:
  `node apagar-municipio.mjs alagoinhas` (mostra quantos documentos) e
  `node apagar-municipio.mjs alagoinhas --confirmar alagoinhas` (faz backup `.ndjson` e apaga). Acrescente `--logins` para apagar também os **logins** (Authentication) das pessoas desse município;
  só apaga quem não tem cadastro em outro município e nunca um superadmin. Sem `--confirmar`, só mostra quem seria apagado.

## Fotos e vídeos no Cloudflare R2 (opcional)

Sem isto, o app continua guardando mídia no Firestore (fotos pequenas, em pedaços). Com o R2, cabem vídeos curtos: **20 MB por arquivo e 40 MB por mensagem**.

1. No painel do Cloudflare: **R2 → Create bucket**, nome `ouvimunicipio-midia`. O R2 exige cartão cadastrado; o uso pequeno cabe na faixa gratuita (10 GB).
2. No `wrangler.jsonc`, acrescente (à mão, depois de criar o bucket):
   ```jsonc
   "r2_buckets": [{ "binding": "MIDIA", "bucket_name": "ouvimunicipio-midia" }]
   ```
   Alternativa: Pages → projeto → Settings → Bindings → R2 bucket, variável `MIDIA`.
3. Publique. O app detecta o R2 sozinho (`/api/midia?status=1`); se o bucket sair do ar, volta ao Firestore.

Como funciona: a mensagem é gravada primeiro e o arquivo sobe depois; o servidor confere o tipo real do arquivo (não confia no nome) e só aceita quem participa do protocolo. Os arquivos são apagados 30 dias após a conclusão da conversa (junto com a conversa). Ao excluir um município, use o botão **Apagar arquivos (R2)** na lista de excluídos do painel do superadmin. Recomenda-se também uma regra de limite de requisições do Cloudflare para `/api/*`.

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
3. Crie o município (endereço só com letras minúsculas, números e hífen) e cadastre o administrador dele
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
- **Relatórios:** indicadores e CSV. O **relatório de gestão em PDF** fica no painel do ouvidor geral.
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

## Mapa, consulta e respostas-modelo
- Local da ocorrência: opcional para o cidadão (GPS ou toque no mapa). Mapa nas abas da secretaria e do ouvidor.
- Consulta sem login: `/{municipio}/consulta` (link na tela de login).
- Respostas-modelo: aba "Respostas-modelo" do painel da secretaria (o secretário edita; a equipe usa).

# Configuração (plano gratuito do Firebase + Cloudflare Pages)

Projeto Firebase: `ouvimunicipio-f2bf7`. Não usa Cloud Functions nem Storage (ambos exigem plano pago).

## 1. Console Firebase
1. **Authentication → Método de login:** ative **E-mail/senha**. Em *Configurações → Domínios autorizados* inclua o domínio do app (`*.pages.dev` ou o seu).
2. **Firestore Database:** criado em `southamerica-east1`.
3. **Firestore → Regras:** cole o conteúdo de `firestore.rules` e publique (sempre que o arquivo mudar).
4. *(TTL do Firestore exige faturamento ativo e NÃO é usado.)* Os avisos vencidos somem da tela após 24 h e o próprio app os apaga
   do banco na próxima vez que o cidadão abrir o aplicativo.
5. **App Check (recomendado):** registre o app Web com reCAPTCHA v3 (gratuito), copie a *chave do site* para a variável
   `VITE_RECAPTCHA_SITE_KEY` na Cloudflare e só então ative a imposição para o Firestore.

## 2. Primeiro administrador (uma vez, manualmente)
1. Abra o app, crie sua conta e **confirme o e-mail**.
2. No Firestore, crie a coleção `equipe` e o documento com ID = **seu e-mail em minúsculas**, com os campos:
   `nome` (texto), `papel` = `admin` (texto), `ativo` = `true` (booleano).
3. Saia e entre de novo: o painel **Admin** aparece.

## 3. Como o servidor entra
No painel Admin → *Servidores*, cadastre o e-mail, a função (secretário ou assessor) e a secretaria.
A pessoa cria a conta no app com **esse mesmo e-mail** e confirma o e-mail. Remover ou desativar o cadastro tira o acesso na hora.

## 4. Cloudflare Pages
- **Build command:** `npm run build` · **Output directory:** `dist`
- Variáveis (Settings → Variables and Secrets):
  - `FIREBASE_PROJECT_ID` = `ouvimunicipio-f2bf7`
  - `AUDIT_EMAIL` = e-mail que recebe o registro das ações do admin
  - `RESEND_API_KEY` = chave gratuita de resend.com (marcar como *Secret*)
  - `NOME_ORGAO` (opcional) = nome que aparece no rodapé dos e-mails enviados aos usuários
  - `RESEND_FROM` (opcional) = remetente de domínio verificado; sem isso o Resend só entrega ao e-mail dono da conta
  - `VITE_RECAPTCHA_SITE_KEY` (opcional) = chave do site do reCAPTCHA v3

## Limites de mídia (guardada no próprio Firestore)
- Fotos: reduzidas automaticamente no celular (~700 KB cada).
- Vídeos: até 7 MB (clipes curtos). Soma dos anexos: 7 MB. Máximo de 5 anexos por mensagem.

## Segurança em resumo
- Mensagens e anexos só são lidos pelo autor e pelos servidores da secretaria escolhida. O admin **não** lê mensagens.
- Papéis vêm da coleção `equipe` (só o admin escreve); e-mail confirmado é obrigatório para tudo.
- Prazo de 30 dias (`criadoEm` + 30) e horário de resposta são gravados pelo servidor; respostas são imutáveis.
- Avisos de resposta expiram em 24 h (somem da tela e são apagados do banco quando o cidadão abre o app).
- Cabeçalhos de segurança e CSP em `public/_headers`.

## Painel do administrador
- **Secretarias / Servidores:** cadastro, edição e exclusão (ver acima).
- **Usuários:** total de cadastrados, lista com nome, e-mail e telefone (opcional), busca e filtros (situação, com telefone).
  O admin pode **bloquear/desbloquear** (reversível) e **excluir** (apaga nome, e-mail e telefone e bloqueia para sempre).
  Sem Cloud Functions não é possível apagar o *login* da pessoa pelo app: para liberar um e-mail para novo cadastro,
  remova-o também em Firebase → Authentication → Usuários.
- **Aparência:** nome do município, logomarca (reduzida automaticamente) e cor principal do layout (o app exige contraste mínimo 4,5 com texto branco).
  Vale na hora para todos, inclusive na tela de login.
- **Publicidade:** até 10 anúncios no carrossel da tela inicial (imagem 3:1, título e link https opcional), com ordem, ativar/desativar e exclusão.
  O carrossel aparece na tela de login e para os cidadãos.

> Depois de atualizar o código, **republique o `firestore.rules`** no console do Firebase.

## Observação sobre o nome no ícone instalado
O nome e o ícone do app **instalado** (manifest) são fixos ("Ouvidoria"); a marca e as cores mudam dentro do app.

## Mensagens do Admin aos usuários
Em **Admin → Usuários**: filtre, marque as pessoas (ou deixe nenhuma marcada para usar todo o filtro) e clique em *Enviar mensagem*.
- **Aviso no aplicativo**: aparece na aba Avisos por 2–30 dias e some sozinho (não precisa de nada além das regras novas).
- **E-mail**: usa `/api/mensagem` (Cloudflare) com `RESEND_API_KEY` e, para entregar a qualquer pessoa, `RESEND_FROM` de um domínio verificado no Resend. Até 500 pessoas por envio.
- **Republique o `firestore.rules`** (há uma regra nova para avisos).

# Configuração do Firebase (plano gratuito Spark – sem Cloud Functions)

Projeto: `ouvimunicipio-f2bf7`

## 1. Console Firebase
1. **Authentication → Método de login:** ative **E-mail/senha**. Em *Configurações → Domínios autorizados*, inclua o domínio do app.
2. **Firestore Database:** criar banco em modo produção, região `southamerica-east1`.
3. **Firestore → TTL:** crie uma política para a coleção `notificacoes`, campo `expiraEm` (apaga avisos vencidos sem custo).
4. **Storage:** abra a página. Se pedir upgrade de plano, veja "Mídia" abaixo.
5. **App Check:** registre o app Web com reCAPTCHA v3 (gratuito) e ative a *imposição* para Firestore e Storage.

## 2. Publicar as regras
Pelo console (Firestore → Regras; Storage → Regras) colando `firestore.rules` e `storage.rules`,
ou com `npx firebase-tools deploy --only firestore,storage`.

## 3. Primeiro administrador (uma vez, manualmente)
1. Cadastre-se no app com o seu e-mail e **confirme o e-mail**.
2. No Firestore, crie o documento `equipe/seu-email-em-minusculas` com:
   `nome` (texto), `papel` = `admin`, `ativo` = `true`.
A partir daí o admin cadastra secretarias e servidores pelo próprio app.

## 4. Como o servidor entra
O admin cadastra o e-mail do servidor (papel `secretario` ou `assessor` + secretaria).
O servidor cria a conta com esse e-mail, **confirma o e-mail** e passa a ver só os protocolos da sua secretaria.
Excluir/desativar o cadastro em `equipe` retira o acesso imediatamente.

## 5. E-mail de auditoria (Cloudflare Pages → Settings → Variables and Secrets)
- `FIREBASE_PROJECT_ID` = `ouvimunicipio-f2bf7`
- `AUDIT_EMAIL` = e-mail que receberá o registro das ações do admin
- `RESEND_API_KEY` = chave da conta gratuita em resend.com (marcar como *Secret*)
- `RESEND_FROM` (opcional) = remetente de domínio verificado. Sem isso o Resend só entrega ao e-mail dono da conta.

## Mídia (limites reduzidos)
Imagem até **2 MB** (o app comprime antes) e vídeo até **15 MB**.
Desde 2024 o Firebase Storage em projetos novos exige o plano Blaze. Se a página do Storage pedir upgrade,
a alternativa gratuita é hospedar anexos no Cloudflare R2 ou aceitar apenas imagens comprimidas
(guardadas no próprio Firestore, ~300 KB cada). Decida após verificar a página do Storage.

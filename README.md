# Ouvidoria Municipal (SaaS multi-município)

App (PWA) para o cidadão enviar mensagens (texto, foto e vídeo) à secretaria do município e acompanhar o protocolo.
Um único projeto Firebase atende vários municípios; cada um tem seu endereço: `https://ouvimunicipio.pages.dev/{municipio}`.

- **Cidadão:** cadastro com confirmação de e-mail → escolhe a secretaria → envia → protocolo com prazo de 30 dias
  (prorrogável uma vez) → conversa com a secretaria → conclui e avalia. Limite de 20 envios por dia.
- **Secretário/assessor:** vê só os protocolos da sua secretaria, responde e pode prorrogar o prazo com justificativa.
- **Ouvidor geral:** lê todos os protocolos do município, encaminha a outra secretaria (com histórico) e cobra respostas.
- **Prefeito:** vê só números (totais, prazos, notas), sem dados pessoais.
- **Administrador do município:** secretarias, equipe, aparência, anúncios, usuários, relatórios. Ações registradas por e-mail.
- **SUPERADMIN** (`/superadmin`): cria e suspende municípios e cadastra o 1º administrador de cada um. Não lê conversas.

Veja `SETUP_FIREBASE.md` para configurar e publicar, `AUDITORIA.md` para o estado de segurança e `PLANO_FASE3.md`
para o modelo multi-município.

```
npm install
npm run dev      # desenvolvimento
npm run build    # gera dist/
npm run lint     # verificação de tipos
cd rules-tests && npm test   # testes das regras (precisa de Java 21)
```

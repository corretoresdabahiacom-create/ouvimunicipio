# Fase 3 — SaaS multi-município (plano, ainda NÃO implementado)

Decisões do dono: **um único projeto Firebase** (plano gratuito) e **SUPERADMIN só por e-mail cadastrado**.

## Pré-requisito (não avançar antes)
1. Push do `fase2b.bundle` e fluxo "Verificação" do GitHub **verde** (as regras atuais nunca rodaram em emulador).
2. Regras atuais publicadas e app testado de ponta a ponta.
Motivo: a Fase 3 reescreve TODAS as regras. Sobre base não verificada, uma falha não teria causa identificável.

## Modelo de dados proposto (isolamento por caminho)
Tudo que é de um município passa a ficar **dentro do caminho dele**, e não só com um campo `municipioId`:

```
superadmins/{email}                      papel global (só você); sem acesso a conversas
municipios/{mid}                         nome, slug, ativo, plano, limites, criadoEm
municipios/{mid}/config/site             aparência (hoje config/site)
municipios/{mid}/equipe/{email}          admin, secretario, assessor, ouvidor, prefeito
municipios/{mid}/secretarias/{id}
municipios/{mid}/protocolos/{numero}/…   mensagens, midias, historico
municipios/{mid}/estatisticas/atual
municipios/{mid}/anuncios/{id}
users/{uid}                              cidadão (global); campo municipioId = onde se cadastrou
notificacoes/{id}                        continua do dono (uid), com municipioId
```

Por que caminho e não só campo: cada regra começa em `match /municipios/{mid}/…` e o papel é lido em
`municipios/{mid}/equipe/{email}`. Alguém da equipe de A **não tem** documento em B, então não passa em nenhuma regra de B.
Com campo solto, bastaria uma regra esquecer de comparar `municipioId` para vazar dados.

## Regras novas
- `municipioAtivo(mid)`: município existe e `ativo == true`. Município suspenso bloqueia escrita (plano vencido).
- `superadmin()`: existe `superadmins/{meuEmail}`. Pode criar/editar `municipios/{mid}` e cadastrar o 1º admin do município.
  **Não lê** protocolos, mensagens, mídias, histórico, nem `users`.
- Papéis (`ehAdmin`, `ehServidor`, `ehOuvidor`, `ehPrefeito`) passam a receber `mid`.
- Cidadão: protocolo só pode ser criado em município ativo; `autorUid` continua obrigatório.
- Limite de envios (20/24 h) continua global por conta.

## Cliente
- O município vem do endereço: `/{slug}` (o `pages.dev` não tem subdomínio por cliente; domínio próprio permite `slug.dominio.com` depois).
  Precisa de regra de redirecionamento do SPA (`public/_redirects`).
- `useConfig`/`SiteProvider` carregam `municipios/{mid}/config/site` pelo slug (aparência por município).
- Painel SUPERADMIN (novo, lazy): lista de municípios, criar, suspender, escolher plano, cadastrar o admin inicial.
- Funções do Cloudflare (`/api/auditoria`, `/api/mensagem`) recebem `mid` e conferem o papel em `municipios/{mid}/equipe/{email}`.

## Planos e limites (começo simples, grátis)
Campo `plano` (básico/padrão/…) e `limites` (usuários da equipe, protocolos/mês) **informativos** no painel.
Aplicar limite por contador nas regras só se for realmente necessário (cada contador custa escrita extra).
Cobrança automática: fora do escopo (exigiria Blaze e gateway de pagamento).

## Migração dos dados atuais
1. **Backup antes** (exportação oficial do Firestore exige Blaze, então: script que lê todas as coleções e grava JSON; você guarda o arquivo).
2. Script de migração copia `config`, `equipe`, `secretarias`, `anuncios`, `protocolos/**` para `municipios/{primeiro}/…`
   (protocolos antigos com seus números preservados). Executado por você, uma vez, com o app em manutenção.
3. Só depois publicar as regras novas; as antigas coleções ficam intocadas até você conferir (apagar manualmente depois).

## Monitoramento (sem custo)
Cloudflare Web Analytics e página de status das funções; alerta por e-mail de auditoria (Resend) para ações do superadmin.
Painel do Firebase mostra uso de leituras/escritas contra a cota gratuita; o superadmin vê por município quantos protocolos há.

## Testes obrigatórios (viram `test` em rules-tests)
- Equipe/admin/ouvidor/prefeito de A não lê nem escreve em nada de B (todas as coleções e subcoleções).
- Cidadão de A não cria protocolo em município B inexistente ou suspenso.
- Superadmin cria município, mas **não lê** conversa nem usuário.
- Admin de município não cria município nem se torna superadmin.
- Município suspenso: escrita negada, leitura do histórico mantida.
- Migração: protocolos antigos continuam legíveis pelo autor.

## Riscos
- Mudança grande e de uma vez (regras + cliente + migração + funções): fazer em commits pequenos, regras antes do cliente, tudo verde no CI.
- Custo de leituras sobe com a quantidade de municípios (cada painel lê o seu); mitigado pelo caminho (consultas limitadas ao município).
- Cidadão em dois municípios usa a mesma conta; aceito (conta global, protocolos separados).

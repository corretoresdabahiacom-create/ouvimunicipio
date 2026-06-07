# 🌐 Manual de Implantação e Deploy na Cloudflare (Pages + Workers)

Este aplicativo foi configurado e otimizado com suporte nativo de alto desempenho para a infraestrutura da **Cloudflare**. Com esta preparação, suas chamadas de Inteligência Artificial e processamento do portal funcionarão na nuvem com **tempo de inicialização zero (zero-cold-starts)**, latência ultrabaixa e escalabilidade global ilimitada.

Fomos além e convertemos a API para o sistema nativo de **Cloudflare Pages Functions**. Assim, você não precisa gerenciar um container de Node Express separado; os endpoints rodam diretamente na borda (edge nodes) integrados na mesma conta de hospedagem do frontend!

---

## 🛠️ Como implantar na Cloudflare em 3 Passos

### 📋 Pré-requisitos
Certifique-se de configurar a sua conta na Cloudflare e ter a CLI `wrangler` instalada (caso faça deploy via terminal), ou simplesmente conecte o seu repositório Git diretamente no painel da Cloudflare.

---

### Passo 1: Gerar a Build Estática do Frontend
No terminal do seu projeto, execute o comando padrão para compilar os assets públicos de React e Tailwind CSS:
```bash
npm run build
```
Isso produzirá a pasta de distribuição estática `/dist` na raiz do seu projeto. Esta é a pasta que a Cloudflare Pages utilizará como diretório público de distribuição eletrônica de ativos.

---

### Passo 2: O Poder de Cloudflare Pages "Functions" (Nativo)
A Cloudflare compilará automaticamente os endpoints da nossa API do Express para o ecossistema Serverless do **Cloudflare Workers**. 
* Nós criamos a estrutura na pasta `/functions/api/`:
  - `/functions/api/classify.ts` -> Processamento de inteligência artificial ou classificação de posturas em contingência para relatos da Ouvidoria.
  - `/functions/api/despacho.ts` -> Redação técnica ou aperfeiçoamento gramatical de despachos oficiais de gabinete para a prefeitura.

Tudo o que você precisa fazer é apontar o diretório de produção para a pasta `/dist`. A Cloudflare Pages detectará a pasta `/functions/` automaticamente e fará o deploy dos Workers integrados no mesmo domínio.

---

### Passo 3: Configurar a Chave da API Gemini nos Segredos (Secrets)
Para que as classificações avançadas de postura e o assistente de gabinetes jurídicos operem com o poder do modelo **Gemini-3.5-Flash** nativo em Cloudflare (com segurança absoluta e ocultação de chaves):

1. Acesse o **Painel da Cloudflare**.
2. Vá para **Workers & Pages** > selecione o seu projeto do portal.
3. Clique na aba **Settings** (Configurações) > **Variables and Secrets** (Variáveis e Segredos).
4. No bloco **Environment Variables**, clique em **Add variable** de ambiente em nível de Produção e Desenvolvimento:
   * **Key**: `GEMINI_API_KEY`
   * **Value**: *Insira aqui sua Chave de API Google AI Studio*
5. Clique em **Encrypt** (criptografar) e depois em **Save**!

---

## 🔥 Benefícios desta Arquitetura em Cloudflare (Edge Workers)
- **Desempenho Extremo**: As requisições de triagem são processadas na borda geográfica mais próxima do cidadão.
- **Isenção de Servidor Fixo**: Economia total, sem custos de containers de aplicação rodando 24 horas por dia.
- **Qualidade e Alta Precisão**: O código de contingência offline garantirá que, em momentos de indisponibilidade da rede ou limite de cotas do Gemini, a manifestação seja devidamente categorizada por meio de algoritmo lógico rigoroso em Javascript Puro.
- **Conformidade em Transparência**: O login e as telas de aceitação de Termos de Uso (LGPD) persistem no navegador e no Firestore cliente, funcionando de maneira consistente sob qualquer servidor de borda!

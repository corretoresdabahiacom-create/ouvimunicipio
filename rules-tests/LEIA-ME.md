# Testes das regras de segurança (Firestore)

Os testes (135) simulam cidadão, secretário, ouvidor, prefeito, administrador, superadmin e visitante,
em dois municípios, tentando ler e gravar no banco,
e conferem se as regras (`firestore.rules`) liberam ou negam. Rodam num emulador local:
**nunca tocam no banco real**.

## Onde ver o resultado (sem instalar nada)
Depois de enviar ao GitHub (`git push`), abra a aba **Actions** do repositório. O fluxo
**Verificação** tem duas tarefas: "Compilar o app" e "Testar as regras do Firestore". Verde = passou.

## Rodar no seu computador (opcional)
Precisa de Node 22 e Java 21.

    cd rules-tests
    npm install
    npm test

## Regra de ouro
Toda mudança em `firestore.rules` só vai para o console do Firebase depois que **todos** os testes passarem.
O item `todo` no fim do arquivo (LAI) é uma funcionalidade que ainda não existe.

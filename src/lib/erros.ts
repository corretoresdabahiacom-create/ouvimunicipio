const MAPA: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/invalid-email": "E-mail inválido.",
  "auth/email-already-in-use": "Este e-mail já está cadastrado.",
  "auth/weak-password": "Senha fraca. Use ao menos 8 caracteres com letras e números.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  "auth/network-request-failed": "Sem conexão com a internet.",
  "auth/user-disabled": "Conta desativada. Procure a prefeitura.",
  "permission-denied": "Você não tem permissão para esta ação.",
  "unavailable": "Serviço indisponível. Tente novamente.",
};

export function mensagemDeErro(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const chave = code.replace("firestore/", "");
  return MAPA[code] ?? MAPA[chave] ?? (e instanceof Error && !code ? e.message : "Algo deu errado. Tente novamente.");
}

// Limite de envios por conta (proteção contra abuso e contra o fim da cota gratuita do Firestore).
// Cada manifestação nova ou complemento do cidadão conta 1 envio. Máximo de LIMITE_ENVIOS_DIA a cada 24 h,
// contados a partir do primeiro envio da janela. As regras do Firestore EXIGEM esta atualização no mesmo
// lote do envio (ver firestore.rules, "limite de envios"), então não dá para burlar pelo navegador.
import { getDoc, serverTimestamp, type WriteBatch } from "firebase/firestore";

import { docM } from "./municipio";

export const LIMITE_ENVIOS_DIA = 20;
const JANELA_MS = 86_400_000;

export class LimiteEnvios extends Error {
  constructor() { super(`Limite de ${LIMITE_ENVIOS_DIA} envios por dia atingido. Tente novamente mais tarde.`); }
}

/** `ref` identifica o envio: "<protocolo>" (manifestação nova) ou "<protocolo>/<mNN>" (complemento). */
export async function registrarEnvio(lote: WriteBatch, uid: string, ref: string): Promise<void> {
  const alvo = docM("users", uid);
  const d = (await getDoc(alvo)).data() ?? {};
  const inicio: number | undefined = d.janelaEm?.toMillis?.();
  const dentro = inicio !== undefined && Date.now() - inicio < JANELA_MS;
  const envios = dentro ? Number(d.envios ?? 0) : 0;
  if (envios >= LIMITE_ENVIOS_DIA) throw new LimiteEnvios();
  lote.update(alvo, dentro
    ? { envios: envios + 1, ultimoEnvio: ref }
    : { envios: 1, janelaEm: serverTimestamp(), ultimoEnvio: ref });
}

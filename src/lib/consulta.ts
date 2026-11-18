import { getDoc, setDoc } from "firebase/firestore";
import { docM } from "./municipio";

// Mantém a ficha pública (municipios/{m}/consulta/{numero}) igual ao protocolo. As regras só aceitam cópia fiel,
// então copiamos os valores do protocolo como estão no banco. Feito DEPOIS de cada mudança e sem bloquear o fluxo:
// se falhar (sem conexão, por exemplo), o atendimento segue normalmente e a ficha é corrigida na próxima mudança.
export async function sincronizarFicha(numero: string): Promise<void> {
  try {
    const s = await getDoc(docM("protocolos", numero));
    if (!s.exists()) return;
    const p = s.data();
    const ficha: Record<string, unknown> = { status: p.status, secretariaNome: p.secretariaNome, criadoEm: p.criadoEm };
    for (const k of ["respondidoEm", "concluidoEm", "prorrogadoEm", "reabertoEm", "aguardandoDesde", "suspensoDias"]) if (p[k] !== undefined && p[k] !== null) ficha[k] = p[k];
    if (p.tipo === "lai") ficha.lai = true;
    await setDoc(docM("consulta", numero), ficha);
  } catch { /* a ficha pública é conveniência: nunca atrapalha o atendimento */ }
}

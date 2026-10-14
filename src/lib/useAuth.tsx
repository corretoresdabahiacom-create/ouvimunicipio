import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Perfil } from "./types";

interface Ctx {
  user: User | null;
  perfil: Perfil | null;
  carregando: boolean;
  erroPerfil: string;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
}
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

async function carregarPerfil(user: User): Promise<Perfil> {
  const email = (user.email ?? "").toLowerCase();
  const base: Perfil = { uid: user.uid, email, nome: user.displayName ?? "", papel: "cidadao" };

  // Perfil básico do cidadão (criado na primeira vez com e-mail confirmado).
  const uref = doc(db, "users", user.uid);
  const usnap = await getDoc(uref);
  if (!usnap.exists()) {
    await setDoc(uref, { nome: (user.displayName ?? "").slice(0, 120), criadoEm: serverTimestamp() });
  } else if (usnap.get("nome")) {
    base.nome = usnap.get("nome");
  }

  // Equipe (admin/secretário/assessor): cadastrada pelo administrador, pelo e-mail.
  const esnap = await getDoc(doc(db, "equipe", email));
  if (esnap.exists() && esnap.get("ativo") === true) {
    base.papel = esnap.get("papel");
    base.secretariaId = esnap.get("secretariaId");
    base.nome = esnap.get("nome") || base.nome;
  }
  return base;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroPerfil, setErroPerfil] = useState("");

  const resolver = useCallback(async (u: User | null) => {
    setUser(u);
    setErroPerfil("");
    if (u && u.emailVerified) {
      try { setPerfil(await carregarPerfil(u)); }
      catch { setPerfil(null); setErroPerfil("Não foi possível carregar seu perfil. Tente novamente."); }
    } else {
      setPerfil(null);
    }
    setCarregando(false);
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => { void resolver(u); }), [resolver]);

  const recarregar = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    await u.reload();
    await u.getIdToken(true); // atualiza o claim email_verified usado pelas regras
    await resolver(auth.currentUser);
  }, [resolver]);

  const sair = useCallback(async () => { await signOut(auth); }, []);

  return <AuthCtx.Provider value={{ user, perfil, carregando, erroPerfil, recarregar, sair }}>{children}</AuthCtx.Provider>;
}

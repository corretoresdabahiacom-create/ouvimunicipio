import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const atualizar = vi.fn().mockResolvedValue(undefined);
const apagar = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...p: string[]) => p.join("/"),
  query: (c: string) => c,
  where: () => null,
  doc: (_db: unknown, ...p: string[]) => p.join("/"),
  updateDoc: (...a: unknown[]) => atualizar(...a),
  deleteDoc: (...a: unknown[]) => apagar(...a),
  onSnapshot: (_q: unknown, ok: (s: unknown) => void) => {
    ok({ docs: [
      { id: "errado@x.com", get: (k: string) => ({ nome: "Fulano", ativo: true })[k] },
      { id: "certo@x.com", get: (k: string) => ({ nome: "Beltrano", ativo: false })[k] },
    ] });
    return () => {};
  },
}));
import { AdminsDoMunicipio } from "./SuperAdminAdmins";

describe("administradores do município (superadmin)", () => {
  beforeEach(() => { atualizar.mockClear(); apagar.mockClear(); });

  test("lista os administradores e marca quem está desativado", () => {
    render(<AdminsDoMunicipio mun="alagoinhas" nomeMun="Alagoinhas" />);
    expect(screen.getByText("errado@x.com")).toBeInTheDocument();
    expect(screen.getByText(/desativado/)).toBeInTheDocument();
  });
  test("desativar e reativar mudam só o campo ativo, no documento do município certo", async () => {
    render(<AdminsDoMunicipio mun="alagoinhas" nomeMun="Alagoinhas" />);
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));
    expect(atualizar).toHaveBeenCalledWith("municipios/alagoinhas/equipe/errado@x.com", { ativo: false });
    await userEvent.click(screen.getByRole("button", { name: "Reativar" }));
    expect(atualizar).toHaveBeenCalledWith("municipios/alagoinhas/equipe/certo@x.com", { ativo: true });
  });
  test("remover pede confirmação antes de apagar", async () => {
    render(<AdminsDoMunicipio mun="alagoinhas" nomeMun="Alagoinhas" />);
    await userEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);
    expect(apagar).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Remover" })[1]); // o botão de confirmar do aviso
    expect(apagar).toHaveBeenCalledWith("municipios/alagoinhas/equipe/certo@x.com"); // a lista vem em ordem de e-mail
  });
});

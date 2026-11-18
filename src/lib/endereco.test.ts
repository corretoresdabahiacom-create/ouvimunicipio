import { describe, expect, test } from "vitest";
import { digitandoEndereco, paraEndereco } from "./endereco";

describe("endereço do município", () => {
  test("tira acentos e troca espaços por hífen", () => {
    expect(paraEndereco("São Gonçalo dos Campos")).toBe("sao-goncalo-dos-campos");
    expect(paraEndereco("  Alagoinhas ")).toBe("alagoinhas");
  });
  test("aceita um link colado e fica com o último trecho", () => {
    expect(paraEndereco("https://ouvimunicipio.pages.dev/alagoinhas")).toBe("alagoinhas");
    expect(paraEndereco("https://ouvimunicipio.pages.dev/alagoinhas/")).toBe("alagoinhas");
  });
  test("durante a digitação mantém o hífen do fim; na versão final, não", () => {
    expect(digitandoEndereco("sao-")).toBe("sao-");
    expect(paraEndereco("sao-")).toBe("sao");
  });
  test("remove símbolos, junta hífens repetidos e limita a 40 caracteres", () => {
    expect(paraEndereco("A!!b  --  c")).toBe("ab-c");
    expect(paraEndereco("a".repeat(80))).toHaveLength(40);
  });
});

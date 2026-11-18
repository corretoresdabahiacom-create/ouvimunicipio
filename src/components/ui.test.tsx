import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Selo, diasSuspensos, etapaRotulo, nivelPrazo, prazoFinal } from "./ui";
import type { Protocolo } from "../lib/types";

const DIA = 86_400_000;
const agora = Date.UTC(2026, 10, 18, 12);
const ts = (diasAtras: number) => ({ toDate: () => new Date(agora - diasAtras * DIA), toMillis: () => agora - diasAtras * DIA }) as never;
const P = (extra: Partial<Protocolo> = {}) => ({ id: "1", numero: "OUV-1", status: "aberto", criadoEm: ts(10), ...extra }) as Protocolo;

describe("situação mostrada ao usuário", () => {
  test("aberto se desdobra em aguardando informações, reaberto, em triagem e em análise (nessa ordem de importância)", () => {
    expect(etapaRotulo("aberto", P()).texto).toBe("Em análise");
    expect(etapaRotulo("aberto", P({ triagemEm: ts(1) })).texto).toBe("Em triagem");
    expect(etapaRotulo("aberto", P({ triagemEm: ts(1), reabertoEm: ts(1) })).texto).toBe("Reaberto");
    expect(etapaRotulo("aberto", P({ reabertoEm: ts(1), aguardandoDesde: ts(1) })).texto).toBe("Aguardando informações");
  });
  test("respondido e concluído não mudam por causa dos campos extras", () => {
    expect(etapaRotulo("respondido", P({ aguardandoDesde: ts(1) })).texto).toBe("Respondido");
    expect(etapaRotulo("concluido", P({ reabertoEm: ts(1) })).texto).toBe("Concluído");
  });
  test("o selo aparece na tela", () => {
    render(<Selo status="aberto" p={P({ aguardandoDesde: ts(1) })} />);
    expect(screen.getByText("Aguardando informações")).toBeInTheDocument();
  });
});

describe("prazo no app (mesma regra dos alertas por e-mail)", () => {
  test("30 dias do envio; +30 se prorrogado", () => {
    expect(prazoFinal(P(), agora)!.getTime()).toBe(agora - 10 * DIA + 30 * DIA);
    expect(prazoFinal(P({ prorrogadoEm: ts(2) }), agora)!.getTime()).toBe(agora - 10 * DIA + 60 * DIA);
  });
  test("a espera por informações soma ao prazo, no máximo 20 dias por pedido", () => {
    expect(diasSuspensos(P({ aguardandoDesde: ts(3) }), agora)).toBe(3);
    expect(diasSuspensos(P({ aguardandoDesde: ts(50), suspensoDias: 5 }), agora)).toBe(25);
    expect(diasSuspensos(P({ status: "respondido", aguardandoDesde: ts(3) }), agora)).toBe(0);
  });
  test("protocolo vencido deixa de estar vencido com a espera somada, e reaberto recomeça a contagem", () => {
    expect(nivelPrazo(P({ criadoEm: ts(40) }), agora)).toBe("vencido");
    expect(nivelPrazo(P({ criadoEm: ts(40), suspensoDias: 15 }), agora)).toBe("cinco");
    expect(nivelPrazo(P({ criadoEm: ts(100), reabertoEm: ts(2) }), agora)).toBe("ok");
  });
});

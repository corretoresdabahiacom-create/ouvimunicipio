// VLibras: widget oficial e gratuito do Governo Federal que traduz o texto da tela para Libras.
// Só é baixado quando a pessoa pede (botão "Libras"), para não pesar no carregamento de quem não usa.
declare global {
  interface Window { VLibras?: { Widget: new (url: string) => unknown } }
}

const BASE = "https://vlibras.gov.br/app";
let carregando: Promise<void> | null = null;

function abrirPainel() {
  document.querySelector<HTMLElement>("[vw-access-button]")?.click();
}

export function ativarLibras(): Promise<void> {
  if (carregando) return carregando.then(abrirPainel);
  carregando = new Promise<void>((resolve, reject) => {
    // estrutura exigida pelo widget (mesma da documentação oficial)
    const raiz = document.createElement("div");
    raiz.setAttribute("vw", "");
    raiz.className = "enabled";
    raiz.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
    document.body.appendChild(raiz);

    const s = document.createElement("script");
    s.src = `${BASE}/vlibras-plugin.js`;
    s.async = true;
    s.onload = () => {
      try {
        new window.VLibras!.Widget(BASE);
        // o widget se monta no evento "load" da página, que já passou: dispara a montagem agora
        if (typeof window.onload === "function") window.onload(new Event("load"));
        setTimeout(abrirPainel, 800);
        resolve();
      } catch (e) { reject(e); }
    };
    s.onerror = () => {
      raiz.remove(); s.remove(); carregando = null;
      reject(new Error("Não foi possível carregar o VLibras. Verifique a conexão e tente de novo."));
    };
    document.head.appendChild(s);
  });
  return carregando;
}

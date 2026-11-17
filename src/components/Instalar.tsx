import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Smartphone, Monitor } from "lucide-react";
import { Botao, Cartao } from "./ui";
import { idMunicipio } from "../lib/municipio";

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function Instalar() {
  const [qr, setQr] = useState("");
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [instalado, setInstalado] = useState(window.matchMedia("(display-mode: standalone)").matches);
  // o QR Code leva direto ao município (sem isso, um celular novo cairia na página inicial genérica)
  const url = `${window.location.origin}/${idMunicipio()}`;

  useEffect(() => { QRCode.toDataURL(url, { width: 280, margin: 2 }).then(setQr).catch(() => undefined); }, [url]);
  useEffect(() => {
    const antes = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    const depois = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", antes);
    window.addEventListener("appinstalled", depois);
    return () => { window.removeEventListener("beforeinstallprompt", antes); window.removeEventListener("appinstalled", depois); };
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Instalar o aplicativo</h2>
      <Cartao className="space-y-3 text-center">
        <p className="text-slate-700">Aponte a câmera do celular para o QR Code e abra o link para instalar.</p>
        {qr && <img src={qr} alt={`QR Code para abrir ${url}`} className="mx-auto size-56 rounded-lg border bg-white p-2" />}
        <p className="break-all text-xs text-slate-600">{url}</p>
      </Cartao>
      <Cartao className="space-y-3">
        {instalado
          ? <p className="font-medium text-emerald-700">✅ O aplicativo já está instalado neste aparelho.</p>
          : evt
            ? <Botao onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}><Download className="size-4" aria-hidden /> Instalar neste aparelho</Botao>
            : <p className="text-sm text-slate-600">Se o botão de instalação não aparecer, use as instruções abaixo.</p>}
        <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div><p className="flex items-center gap-1 font-semibold"><Smartphone className="size-4" aria-hidden /> Celular</p>
            <p><b>Android (Chrome):</b> menu ⋮ → “Instalar aplicativo”.<br /><b>iPhone (Safari):</b> botão Compartilhar → “Adicionar à Tela de Início”.</p></div>
          <div><p className="flex items-center gap-1 font-semibold"><Monitor className="size-4" aria-hidden /> Computador</p>
            <p>No Chrome ou Edge, clique no ícone de instalar na barra de endereço, ou menu → “Instalar Ouvidoria”.</p></div>
        </div>
      </Cartao>
    </div>
  );
}

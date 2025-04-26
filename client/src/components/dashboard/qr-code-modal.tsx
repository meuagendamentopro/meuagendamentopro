import * as React from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Share2 } from "lucide-react";

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  providerName: string;
}

export default function QRCodeModal({ open, onOpenChange, url, providerName }: QRCodeModalProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (open && url) {
      setIsLoading(true);
      
      // Gerar QR code em "formato Data URL" para exibir como imagem
      QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((dataUrl) => {
          setQrCodeDataUrl(dataUrl);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Erro ao gerar QR code:", err);
          setIsLoading(false);
        });
    }
  }, [open, url]);

  // Função para baixar o QR Code como imagem
  const handleDownload = () => {
    if (qrCodeDataUrl) {
      const link = document.createElement("a");
      link.href = qrCodeDataUrl;
      link.download = `qrcode-agendamento-${providerName.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Função para compartilhar o QR Code (se a Web Share API estiver disponível)
  const handleShare = async () => {
    if (navigator.share && qrCodeDataUrl) {
      try {
        // Converter Data URL para blob
        const response = await fetch(qrCodeDataUrl);
        const blob = await response.blob();
        const file = new File([blob], "qrcode-agendamento.png", { type: "image/png" });
        
        await navigator.share({
          title: `Link de Agendamento - ${providerName}`,
          text: `Escaneie este QR Code para agendar com ${providerName}`,
          files: [file],
        });
      } catch (error) {
        console.error("Erro ao compartilhar:", error);
        // Fallback para compartilhar apenas o URL
        navigator.share({
          title: `Link de Agendamento - ${providerName}`,
          text: `Faça seu agendamento online com ${providerName}`,
          url: url,
        }).catch(err => console.error("Erro ao compartilhar URL:", err));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code para Agendamento</DialogTitle>
          <DialogDescription>
            Os clientes podem escanear este QR Code para acessar seu link de agendamento diretamente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center p-4">
          {isLoading ? (
            <div className="w-[300px] h-[300px] flex items-center justify-center bg-gray-100 rounded-md">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : qrCodeDataUrl ? (
            <>
              <img 
                src={qrCodeDataUrl} 
                alt="QR Code de Agendamento" 
                className="border rounded-md p-2 bg-white"
              />
              <p className="text-xs text-center mt-2 text-gray-500">
                {url}
              </p>
            </>
          ) : (
            <div className="w-[300px] h-[300px] flex items-center justify-center bg-gray-100 rounded-md">
              <p className="text-sm text-gray-500 text-center p-4">
                Não foi possível gerar o QR Code. Tente novamente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row justify-between sm:justify-between gap-2">
          <Button 
            type="button" 
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Fechar
          </Button>
          
          <div className="flex gap-2">
            <Button 
              type="button" 
              onClick={handleDownload} 
              disabled={!qrCodeDataUrl || isLoading}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Baixar
            </Button>
            
            {navigator.share && (
              <Button 
                type="button" 
                onClick={handleShare} 
                disabled={!qrCodeDataUrl || isLoading}
                className="gap-2"
              >
                <Share2 className="h-4 w-4" />
                Compartilhar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
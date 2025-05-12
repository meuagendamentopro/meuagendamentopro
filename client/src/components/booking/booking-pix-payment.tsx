import React, { useState, useEffect } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QRCodeSVG } from "qrcode.react";

interface BookingPixPaymentProps {
  appointmentId: number;
  providerId: number;
  servicePrice: number;
  serviceName: string;
  onPaymentComplete: () => void;
  onCancel: () => void;
}

interface PixResponse {
  transactionId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
}

const BookingPixPayment: React.FC<BookingPixPaymentProps> = ({
  appointmentId,
  providerId,
  servicePrice,
  serviceName,
  onPaymentComplete,
  onCancel
}) => {
  const { toast } = useToast();
  const [pixData, setPixData] = useState<PixResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const [checkTimer, setCheckTimer] = useState<NodeJS.Timeout | null>(null);

  // Gerar código PIX ao carregar o componente
  useEffect(() => {
    generatePixCode();
    
    // Limpar timer ao desmontar
    return () => {
      if (checkTimer) clearInterval(checkTimer);
    };
  }, []);

  // Verificar status de pagamento periodicamente
  useEffect(() => {
    if (pixData?.transactionId && paymentStatus !== "paid") {
      // Configurar checagem a cada 5 segundos
      const timer = setInterval(checkPaymentStatus, 5000);
      setCheckTimer(timer);
      
      return () => clearInterval(timer);
    }
  }, [pixData, paymentStatus]);

  // Gerar um novo código PIX
  const generatePixCode = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await apiRequest('POST', '/api/payments/generate-pix', {
        appointmentId,
        amount: servicePrice / 100, // Convertendo de centavos para reais
        providerId,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao gerar PIX');
      }
      
      const data = await response.json();
      setPixData(data);
      setPaymentStatus("pending");
      toast({
        title: "Código PIX gerado",
        description: "Escaneie o QR Code para realizar o pagamento.",
      });
    } catch (error: any) {
      console.error("Erro ao gerar PIX:", error);
      setError(error.message || "Não foi possível gerar o código PIX");
      toast({
        title: "Erro ao gerar PIX",
        description: error.message || "Ocorreu um erro ao gerar o código PIX.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  // Verificar se o pagamento foi realizado
  const checkPaymentStatus = async () => {
    if (!pixData?.transactionId || paymentStatus === "paid") return;
    
    try {
      const response = await apiRequest('GET', `/api/payments/${appointmentId}/status`);
      const data = await response.json();
      
      setPaymentStatus(data.paymentStatus);
      
      // Se o pagamento foi concluído
      if (data.paymentStatus === "paid") {
        if (checkTimer) clearInterval(checkTimer);
        toast({
          title: "Pagamento confirmado!",
          description: "Seu pagamento foi recebido com sucesso!",
        });
        onPaymentComplete();
      }
    } catch (error) {
      console.error("Erro ao verificar status do pagamento:", error);
    }
  };

  // Renderizar o estado de carregamento
  if (isLoading && !pixData) {
    return (
      <Card className="w-full max-w-md mx-auto my-4">
        <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-center text-gray-600">Gerando código de pagamento...</p>
        </CardContent>
      </Card>
    );
  }

  // Renderizar o estado de erro
  if (error && !pixData) {
    return (
      <Card className="w-full max-w-md mx-auto my-4">
        <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[300px]">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium mb-2">Erro ao gerar pagamento</h3>
          <p className="text-center text-gray-600 mb-4">{error}</p>
          <Button onClick={generatePixCode} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </>
            )}
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center pb-6">
          <Button variant="outline" onClick={onCancel} className="w-full">
            Cancelar
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Renderizar o pagamento confirmado
  if (paymentStatus === "paid") {
    return (
      <Card className="w-full max-w-md mx-auto my-4">
        <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[300px]">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <h3 className="text-xl font-medium mb-2">Pagamento confirmado!</h3>
          <p className="text-center text-gray-600">
            Seu pagamento foi processado com sucesso.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center pb-6">
          <Button onClick={onPaymentComplete} className="w-full">
            Continuar
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Renderizar o QR Code para pagamento
  return (
    <Card className="w-full max-w-md mx-auto my-4">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <h3 className="text-lg font-medium mb-4">Pagamento PIX</h3>
          <p className="text-sm text-gray-600 mb-6">
            Escaneie o QR Code abaixo para finalizar seu agendamento de {serviceName}
          </p>
          
          {pixData && (
            <div className="bg-white p-4 rounded-lg border mb-4">
              {pixData.qrCodeBase64 ? (
                <img 
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`} 
                  alt="QR Code PIX" 
                  className="mx-auto"
                  style={{ maxWidth: "200px", height: "auto" }}
                />
              ) : (
                <div className="flex justify-center">
                  <QRCodeSVG 
                    value={pixData.qrCode} 
                    size={200}
                  />
                </div>
              )}
            </div>
          )}
          
          <div className="bg-gray-50 p-4 rounded-lg w-full mb-4">
            <p className="font-semibold mb-1">Código PIX copia e cola:</p>
            <div className="bg-white border rounded p-2 text-xs break-all">
              {pixData?.qrCode}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 text-xs w-full"
              onClick={() => {
                navigator.clipboard.writeText(pixData?.qrCode || "");
                toast({
                  title: "Código copiado!",
                  description: "Cole o código no seu aplicativo de banco",
                });
              }}
            >
              Copiar código
            </Button>
          </div>
          
          <div className="text-sm text-gray-600 mb-4">
            <p>Após o pagamento, o sistema verificará automaticamente.</p>
            <p className="mt-2">
              Valor: <span className="font-medium">R$ {(servicePrice / 100).toFixed(2)}</span>
            </p>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="mb-2" 
            onClick={checkPaymentStatus}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Verificar pagamento
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pb-6">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          variant="ghost" 
          onClick={generatePixCode} 
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Gerar novo PIX
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default BookingPixPayment;
import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw, CheckCircle, Settings, QrCode } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";

interface PixPaymentProps {
  appointmentId: number;
  servicePrice: number;
  serviceName: string;
  paymentAmount?: number;
  paymentPercentage?: number;
}

export interface PixResponse {
  transactionId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string;
  paymentAmount?: number;
  paymentPercentage?: number;
}

// Função utilitária para formatar valores em Reais
const formatCurrency = (valueInCents: number) => {
  const valueInReais = valueInCents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valueInReais);
};

export const AppointmentPixPayment: React.FC<PixPaymentProps> = ({ appointmentId, servicePrice, serviceName, paymentAmount, paymentPercentage }) => {
  const [refreshInterval, setRefreshInterval] = useState<number | null>(5000); // Atualiza a cada 5 segundos
  
  // Verificar se o provedor tem configuração de PIX ativa
  const { data: providerSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['/api/my-provider/settings'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/my-provider/settings');
      return await res.json();
    }
  });

  // Consulta para verificar o status do pagamento
  const { data: paymentStatus, isLoading: statusLoading } = useQuery({
    queryKey: [`/api/payments/${appointmentId}/status`],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/payments/${appointmentId}/status`);
      const data = await res.json();
      
      // Se o pagamento foi concluído, parar a atualização automática
      if (data.paymentStatus === 'paid') {
        setRefreshInterval(null);
        toast({
          title: "Pagamento confirmado!",
          description: "O pagamento via PIX foi processado com sucesso.",
          variant: "default",
        });
      }
      
      return data;
    },
    refetchInterval: refreshInterval !== null ? refreshInterval : false,
    enabled: !!appointmentId
  });

  // Mutação para gerar um novo PIX
  const generatePixMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/payments/generate-pix', {
        appointmentId,
        amount: servicePrice / 100 // Convertendo de centavos para reais
      });
      return await res.json();
    },
    onSuccess: () => {
      // Revalidar o status do pagamento
      queryClient.invalidateQueries({ queryKey: [`/api/payments/${appointmentId}/status`] });
      // Revalidar os detalhes do agendamento
      queryClient.invalidateQueries({ queryKey: ['/api/my-appointments'] });
      toast({
        title: "QR Code PIX gerado",
        description: "Um novo código PIX foi gerado para este agendamento.",
      });
      // Verificar o status a cada 5 segundos após gerar um novo PIX
      setRefreshInterval(5000);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar PIX",
        description: error.message || "Não foi possível gerar o código PIX. Tente novamente.",
        variant: "destructive",
      });
    }
  });

  // Verificar o status do pagamento manualmente
  const handleCheckStatus = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/payments/${appointmentId}/status`] });
  };

  // Gerar um novo código PIX
  const handleGeneratePix = () => {
    generatePixMutation.mutate();
  };

  // Usando a função formatCurrency definida acima

  // Verificar se o pagamento já foi realizado
  const isPaid = paymentStatus?.paymentStatus === 'paid';
  
  // Verificar se o pagamento ainda está pendente
  const isPending = paymentStatus?.paymentStatus === 'pending';
  
  // Verificar se o pagamento não é necessário
  const isNotRequired = paymentStatus?.paymentStatus === 'not_required';
  
  // Verificar se o PIX está configurado e ativo
  const isPixConfigured = providerSettings?.pixEnabled && providerSettings?.pixMercadoPagoToken;
  
  // Calcular o valor restante a ser pago
  const calculateRemainingAmount = () => {
    if (paymentAmount && servicePrice > paymentAmount) {
      return servicePrice - paymentAmount;
    }
    return servicePrice;
  };
  
  const remainingAmount = calculateRemainingAmount();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Pagamento PIX</CardTitle>
        <CardDescription>
          {isPaid
            ? "Pagamento confirmado"
            : isPending
              ? "Escaneie o QR Code para pagar"
              : isNotRequired
                ? "Pagamento presencial"
                : isPixConfigured
                  ? "Gere um código PIX para receber o pagamento"
                  : "Configure o PIX nas configurações do seu perfil"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {statusLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isPaid ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <AlertTitle className="text-green-800">Pagamento confirmado!</AlertTitle>
            <AlertDescription className="text-green-700">
              O pagamento de {formatCurrency(servicePrice)} para {serviceName} foi recebido.
            </AlertDescription>
          </Alert>
        ) : isPending && paymentStatus?.qrCodeBase64 ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="flex flex-col items-center p-3 bg-white rounded-lg border">
              <img 
                src={`data:image/png;base64,${paymentStatus.qrCodeBase64}`} 
                alt="QR Code PIX" 
                className="w-48 h-48 object-contain"
              />
              <span className="text-sm text-gray-500 mt-2">
                {paymentAmount && paymentAmount > 0 && servicePrice > paymentAmount ? (
                  <>
                    Valor: {formatCurrency(paymentStatus.paymentAmount || remainingAmount)} 
                    <span className="text-xs ml-1">
                      (Valor restante do total: {formatCurrency(servicePrice)})
                    </span>
                  </>
                ) : (
                  <>Valor: {formatCurrency(paymentStatus.paymentAmount || servicePrice)}</>
                )}
              </span>
            </div>
            
            <div className="w-full p-3 bg-gray-50 rounded border mt-4">
              <p className="text-sm font-medium mb-1">Código PIX Copia e Cola:</p>
              <div className="flex">
                <div className="flex-1 bg-white p-2 text-xs rounded-l overflow-x-auto whitespace-nowrap border-y border-l">
                  {paymentStatus.qrCode}
                </div>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="rounded-l-none"
                  onClick={() => {
                    navigator.clipboard.writeText(paymentStatus.qrCode);
                    toast({
                      title: "Código copiado!",
                      description: "O código PIX foi copiado para a área de transferência.",
                    });
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
            
            <Alert className="bg-blue-50 border-blue-200 mt-4">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <AlertTitle className="text-blue-800">Aguardando pagamento</AlertTitle>
              <AlertDescription className="text-blue-700">
                Após o pagamento, a confirmação pode levar alguns instantes para ser processada.
              </AlertDescription>
            </Alert>
          </div>
        ) : isNotRequired ? (
          <Alert className="bg-gray-50 border-gray-200">
            <AlertCircle className="h-5 w-5 text-gray-600" />
            <AlertTitle className="text-gray-800">Pagamento presencial</AlertTitle>
            <AlertDescription className="text-gray-700">
              Este agendamento não requer pagamento antecipado via PIX. O valor de {formatCurrency(servicePrice)} será cobrado presencialmente.
            </AlertDescription>
          </Alert>
        ) : !isPixConfigured ? (
          <div className="text-center py-4">
            <Alert className="bg-amber-50 border-amber-200 mb-4">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <AlertTitle className="text-amber-800">Configuração necessária</AlertTitle>
              <AlertDescription className="text-amber-700">
                Você precisa configurar sua chave PIX e token do Mercado Pago para receber pagamentos.
              </AlertDescription>
            </Alert>
            <Button 
              variant="outline"
              onClick={() => window.location.href = '/settings'}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurar PIX
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="mb-4">
              {paymentAmount && paymentAmount > 0 ? (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Valor total:</span>
                    <span className="font-medium">{formatCurrency(servicePrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Valor já pago:</span>
                    <span className="font-medium">{formatCurrency(paymentAmount)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-medium">
                    <span>Valor restante:</span>
                    <span>{formatCurrency(remainingAmount)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 mb-4">
                  Gere um código PIX para receber o pagamento de {formatCurrency(servicePrice)}.
                </p>
              )}
            </div>
            <Button 
              onClick={handleGeneratePix}
              disabled={generatePixMutation.isPending}
            >
              {generatePixMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <QrCode className="mr-2 h-4 w-4" />
              Gerar PIX {remainingAmount !== servicePrice ? "para valor restante" : ""}
            </Button>
          </div>
        )}
      </CardContent>
      {isPending && (
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCheckStatus}
            disabled={statusLoading}
          >
            {statusLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Verificar pagamento
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleGeneratePix}
            disabled={generatePixMutation.isPending}
          >
            {generatePixMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Gerar novo PIX"
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
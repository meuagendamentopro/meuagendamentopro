import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, CalendarPlus } from "lucide-react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface SubscriptionTransaction {
  id: number;
  userId: number;
  planId: number;
  transactionId: string | null;
  paymentMethod: string;
  status: string;
  amount: number;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
  pixQrCodeExpiration: string | null;
  paidAt: string | null;
  createdAt: string;
  plan: {
    id: number;
    name: string;
    description: string | null;
    durationMonths: number;
    price: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export default function SubscriptionHistoryPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // Obter planos de assinatura
  const { data: plans } = useQuery({
    queryKey: ["/api/subscription/plans"],
    enabled: !!user
  });

  // Estado para controlar quando usar fallback
  const [useFallback, setUseFallback] = React.useState(false);
  
  const { data: history, isLoading, error, refetch } = useQuery<SubscriptionTransaction[]>({
    queryKey: ["/api/subscription/history", useFallback],
    queryFn: async () => {
      const url = useFallback 
        ? "/api/subscription/history?fallback=true" 
        : "/api/subscription/history";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!user,
    retry: 1,
    staleTime: 0, // Sem cache para garantir dados atualizados
    refetchOnWindowFocus: true
  });

  // Efeito para tratar erros e alternar para modo fallback
  React.useEffect(() => {
    if (error && !useFallback) {
      console.log("Erro ao buscar histórico, tentando com fallback");
      setUseFallback(true);
    }
  }, [error, useFallback]);

  // Função para formatar valores em reais
  const formatCurrency = (valueInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valueInCents / 100);
  };

  // Função para formatar data
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Função para retornar a cor do badge com base no status
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
      case 'confirmed':
      case 'approved':
        return "success";
      case 'pending':
        return "warning";
      case 'failed':
      case 'cancelled':
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Função para traduzir o status para português
  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
      case 'confirmed':
      case 'approved':
        return "Pago";
      case 'pending':
        return "Pendente";
      case 'failed':
        return "Falhou";
      case 'cancelled':
        return "Cancelado";
      default:
        return status;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          className="mr-2"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">Histórico de Assinaturas</h1>
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-auto"
          onClick={() => refetch()}
        >
          Atualizar
        </Button>
      </div>

      {/* Seção de Renovação Antecipada */}
      {user && user.subscriptionExpiry && (
        <div className="mb-6">
          <Alert 
            className="bg-muted hover:bg-muted/80 cursor-pointer transition-colors"
            onClick={() => navigate('/renew-subscription')}
          >
            <CalendarPlus className="h-5 w-5" />
            <AlertTitle>Renovação Antecipada</AlertTitle>
            <AlertDescription className="mt-2">
              <div className="flex flex-col gap-3">
                <p>
                  Sua assinatura atual expira em {" "}
                  <span className="font-semibold">
                    {new Date(user.subscriptionExpiry).toLocaleDateString('pt-BR')}
                  </span>
                  . Renove antecipadamente e mantenha seu acesso sem interrupções.
                </p>
                <Button
                  variant="default"
                  className="self-start mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/renew-subscription');
                  }}
                >
                  Renovar agora
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Minhas assinaturas</CardTitle>
          <CardDescription>
            Veja o histórico completo de suas assinaturas e renovações no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">
                Ocorreu um erro ao carregar o histórico de assinaturas.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => {
                  setUseFallback(false);
                  refetch();
                }} variant="outline">
                  Tentar novamente
                </Button>
                <Button onClick={() => {
                  setUseFallback(true);
                  refetch();
                }} variant="secondary">
                  Usar dados de exemplo
                </Button>
              </div>
            </div>
          ) : history && history.length > 0 ? (
            <Table>
              <TableCaption>Histórico completo de assinaturas</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {formatDate(transaction.createdAt)}
                    </TableCell>
                    <TableCell>{transaction.plan.name}</TableCell>
                    <TableCell>{transaction.plan.durationMonths} {transaction.plan.durationMonths === 1 ? 'mês' : 'meses'}</TableCell>
                    <TableCell>{formatCurrency(transaction.amount)}</TableCell>
                    <TableCell className="capitalize">
                      {transaction.paymentMethod === 'pix' ? 'PIX' : transaction.paymentMethod}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(transaction.status) as any}>
                        {getStatusText(transaction.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.paidAt ? formatDate(transaction.paidAt) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Você ainda não possui histórico de assinaturas.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
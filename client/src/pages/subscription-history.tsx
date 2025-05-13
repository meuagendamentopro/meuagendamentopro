import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

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

  const { data: history, isLoading, error, refetch } = useQuery<SubscriptionTransaction[]>({
    queryKey: ["/api/subscription/history"],
    enabled: !!user,
    retry: 3,
    staleTime: 30 * 1000, // 30 segundos
  });

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
      </div>

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
              <Button onClick={() => refetch()} variant="outline">
                Tentar novamente
              </Button>
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
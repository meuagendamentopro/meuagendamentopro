import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, CalendarPlus, Gift, FileX } from "lucide-react";
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

  // Opção para usar ou não o fallback
  const [useFallback, setUseFallback] = React.useState(false);
  
  const { data: history, isLoading, error, refetch } = useQuery<SubscriptionTransaction[]>({
    queryKey: ["/api/subscription/history", useFallback],
    queryFn: async () => {
      try {
        // Primeiro tenta buscar dados reais
        const url = "/api/subscription/history";
        const response = await fetch(url);
        
        if (!response.ok) {
          // Se falhar e não for erro de autenticação, tenta o fallback
          if (response.status !== 401 && useFallback) {
            const fallbackUrl = "/api/subscription/history?fallback=true";
            const fallbackResponse = await fetch(fallbackUrl);
            
            if (!fallbackResponse.ok) {
              throw new Error(`Erro ${fallbackResponse.status}: ${fallbackResponse.statusText}`);
            }
            
            return fallbackResponse.json();
          }
          
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
      } catch (error) {
        console.error("Erro ao buscar histórico:", error);
        
        // Se o fallback estiver ativado, tenta buscar dados de exemplo
        if (useFallback) {
          const fallbackUrl = "/api/subscription/history?fallback=true";
          const fallbackResponse = await fetch(fallbackUrl);
          
          if (!fallbackResponse.ok) {
            throw new Error(`Erro no fallback: ${fallbackResponse.status}`);
          }
          
          return fallbackResponse.json();
        }
        
        throw error;
      }
    },
    enabled: !!user,
    retry: 1,
    staleTime: 60000, // Cache por 1 minuto
    refetchOnWindowFocus: false,
    refetchOnMount: true
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
  
  // Função para verificar se o usuário está em período de teste
  const isInTrialPeriod = (user: any) => {
    if (!user) return false;
    
    // Se temos dados de histórico de assinaturas, o usuário não está em período de teste
    if (history && history.length > 0) {
      return false;
    }
    
    // Verificar se o usuário tem uma assinatura paga
    // Se a data de expiração estiver longe no futuro (mais de 7 dias), não é período de teste
    if (user.subscriptionExpiry) {
      const expiryDate = new Date(user.subscriptionExpiry);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Se a expiração estiver mais de 7 dias no futuro, é uma assinatura paga
      if (daysUntilExpiry > 7) {
        return false;
      }
    }
    
    // Verificar data de criação, se o usuário foi criado recentemente (menos de 7 dias)
    if (user.createdAt) {
      const createdAt = new Date(user.createdAt);
      const now = new Date();
      const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      
      // Usuário criado há menos de 7 dias é considerado em período de teste
      if (daysSinceCreation < 7) {
        // Verificar data de expiração - usuários em teste têm expiração próxima (3-4 dias)
        if (user.subscriptionExpiry) {
          const expiryDate = new Date(user.subscriptionExpiry);
          const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Se a expiração está próxima e o usuário é novo, é período de teste
          return daysUntilExpiry <= 4;
        }
        return true;
      }
    }
    
    return false;
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
        <div className="flex gap-2 ml-auto">
          <Button 
            variant={useFallback ? "default" : "outline"} 
            size="sm"
            onClick={() => setUseFallback(!useFallback)}
          >
            {useFallback ? "Usando dados de exemplo" : "Usar dados de exemplo"}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Seção de Renovação Antecipada - Para todos os usuários, incluindo período de teste */}
      {user && (
        <div className="mb-6">
          <Alert 
            className="bg-muted hover:bg-muted/80 cursor-pointer transition-colors"
            onClick={() => navigate('/renew-subscription')}
          >
            {isInTrialPeriod(user) ? <Gift className="h-5 w-5" /> : <CalendarPlus className="h-5 w-5" />}
            <AlertTitle>
              {isInTrialPeriod(user) ? "Assine um plano" : "Renovação Antecipada"}
            </AlertTitle>
            <AlertDescription className="mt-2">
              <div className="flex flex-col gap-3">
                <p>
                  {isInTrialPeriod(user) ? (
                    <>
                      Você está em <span className="font-semibold">período de teste</span>. 
                      Assine agora um plano para manter seu acesso após o período de teste.
                    </>
                  ) : user.subscriptionExpiry ? (
                    <>
                      Sua assinatura atual expira em {" "}
                      <span className="font-semibold">
                        {user.subscriptionExpiry ? new Date(user.subscriptionExpiry).toLocaleDateString('pt-BR') : 'N/A'}
                      </span>
                      . Renove antecipadamente e mantenha seu acesso sem interrupções.
                    </>
                  ) : (
                    <>
                      Assine um plano para continuar utilizando o sistema sem interrupções.
                    </>
                  )}
                </p>
                <Button
                  variant="default"
                  className="self-start mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/renew-subscription');
                  }}
                >
                  {isInTrialPeriod(user) ? "Assinar agora" : "Renovar agora"}
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
              <div className="flex justify-center">
                <Button onClick={() => {
                  refetch();
                }} variant="outline">
                  Tentar novamente
                </Button>
              </div>
            </div>
          ) : isInTrialPeriod(user) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Gift className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Período de Teste Gratuito</h3>
              <p className="text-muted-foreground max-w-md">
                Você está utilizando o período de teste de 3 dias. Após esse período, 
                será necessário escolher um plano para continuar usando o sistema.
              </p>
            </div>
          ) : history && Array.isArray(history) && history.length > 0 ? (
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
                {history.map((transaction: SubscriptionTransaction) => (
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
            <div className="flex flex-col items-center justify-center py-8">
              <FileX className="h-8 w-8 text-muted-foreground mb-2" />
              <div className="text-center text-muted-foreground">
                Você ainda não possui histórico de assinaturas.
                {!useFallback && (
                  <Button 
                    variant="link"
                    className="mt-2"
                    onClick={() => setUseFallback(true)}
                  >
                    Mostrar dados de exemplo
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, Lock, 
         Calendar, CalendarCheck, Clock, Users, Link2, 
         CreditCard, Bell, Smartphone, BadgeCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { QRCodeSVG } from 'qrcode.react';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge } from "@/components/ui/badge";

export default function RenewSubscriptionPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user: authUser, logoutMutation } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [paymentStep, setPaymentStep] = useState<'select-plan' | 'login' | 'processing' | 'payment' | 'success'>('select-plan');
  const [pixData, setPixData] = useState<any>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(1800); // 30 minutos em segundos
  const [progressValue, setProgressValue] = useState<number>(100);
  const [isGeneratingPix, setIsGeneratingPix] = useState<boolean>(false);
  const [credentials, setCredentials] = useState<{username: string, password: string} | null>(null);
  
  // Validação do formulário de login
  const loginSchema = z.object({
    username: z.string().min(1, "Usuário é obrigatório"),
    password: z.string().min(1, "Senha é obrigatória"),
  });
  
  // Form hook para o formulário de login
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Buscar planos de assinatura disponíveis
  const { data: plans, isLoading, error } = useQuery({
    queryKey: ['/api/subscription/plans'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/subscription/plans');
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao buscar planos de assinatura');
      }
      return res.json();
    }
  });
  
  // Não precisamos buscar o usuário aqui pois já temos acesso através do useAuth
  // const { data: user } = useQuery({
  //   queryKey: ['/api/user'],
  //   queryFn: async () => {
  //     try {
  //       const res = await apiRequest('GET', '/api/user');
  //       if (!res.ok) {
  //         return null;
  //       }
  //       return res.json();
  //     } catch (error) {
  //       return null;
  //     }
  //   }
  // });
  
  // Extrair dados do usuário da URL
  const [location] = useLocation();
  const [urlUserId, setUrlUserId] = useState<number | null>(null);
  const [expiredUser, setExpiredUser] = useState<any>(null);
  
  useEffect(() => {
    // Verificar se o usuário já está autenticado
    if (authUser) {
      console.log('Usuário já está autenticado:', authUser);
      
      // Se o usuário tem assinatura expirada, podemos usar diretamente
      // @ts-ignore - Propriedade adicionada pelo backend
      if (authUser.subscriptionExpired) {
        console.log('Usuário autenticado com assinatura expirada');
        // Não precisa fazer nada, já temos os dados do usuário
      }
      return;
    }
    
    // Se não está autenticado, extrair username e userId da URL
    const params = new URLSearchParams(location.split('?')[1]);
    const username = params.get('username');
    const userIdParam = params.get('userId');
    
    // Se temos userId direto
    if (userIdParam) {
      const parsedId = parseInt(userIdParam, 10);
      if (!isNaN(parsedId)) {
        setUrlUserId(parsedId);
        console.log(`ID do usuário extraído da URL: ${parsedId}`);
      }
    }
    
    // Se temos username, consultar a API para obter informações
    if (username) {
      console.log(`Username extraído da URL: ${username}`);
      
      // Buscar informações do usuário
      const fetchUserInfo = async () => {
        try {
          const res = await apiRequest('GET', `/api/subscription/user-info?username=${encodeURIComponent(username)}`);
          if (res.ok) {
            const userData = await res.json();
            setExpiredUser(userData);
            setUrlUserId(userData.id);
            console.log(`Informações do usuário obtidas: ${userData.name} (ID: ${userData.id})`);
          } else {
            console.error('Erro ao buscar informações do usuário:', await res.json());
          }
        } catch (error) {
          console.error('Falha ao buscar informações do usuário:', error);
        }
      };
      
      fetchUserInfo();
    }
  }, [location, authUser]);
  
  // Formatar preço em reais
  const formatCurrency = (valueInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valueInCents / 100);
  };
  
  // Função para selecionar um plano
  const handleSelectPlan = async (planId: number) => {
    setSelectedPlanId(planId);
    
      console.log("Selecionando plano, estado atual:", {
      usuarioLogado: authUser ? `ID: ${authUser.id}` : 'Não',
      usuarioExpirado: expiredUser ? `ID: ${expiredUser.id || 'indefinido'}` : 'Não',
      urlUserId: urlUserId || 'Não definido',
      credenciais: credentials ? 'Definidas' : 'Não definidas'
    });
    
    // Se temos algum tipo de identificação, prosseguir com o pagamento
    if (authUser?.id || expiredUser?.id || urlUserId || expiredUser?.username) {
      await generatePayment(planId);
    } else {
      // Se não temos nenhuma forma de identificação, vamos para o formulário de login
      setPaymentStep('login');
      toast({
        title: "Identificação necessária",
        description: "Por favor, faça login para continuar com a renovação."
      });
    }
  };
  
  // Função para processar o login
  const onSubmitLogin = async (values: z.infer<typeof loginSchema>) => {
    setCredentials(values);
    
    try {
      // Primeiro, tentar fazer login diretamente via API
      const loginRes = await apiRequest('POST', '/api/login', {
        username: values.username,
        password: values.password
      });
      
      // Se o login foi bem-sucedido, recarregar os dados do usuário
      if (loginRes.ok) {
        const userData = await loginRes.json();
        console.log('Usuário autenticado:', userData);
        
        // Atualizar o cache do React Query com os dados do usuário
        queryClient.setQueryData(['/api/user'], userData);
        
        // Se temos ID de assinatura, podemos prosseguir
        if (selectedPlanId) {
          await generatePayment(selectedPlanId);
        }
        
        // Exibir mensagem de sucesso
        toast({
          title: "Autenticado com sucesso",
          description: `Bem-vindo(a), ${userData.name}!`,
        });
      } else {
        // Se o login falhou, verificar se é por causa de assinatura expirada
        const error = await loginRes.json();
        console.error('Erro ao fazer login:', error);
        
        if (error.expired) {
          // Se assinatura expirada, ainda podemos usar as informações diretamente da resposta
          // A API retorna informações básicas do usuário junto com o erro de expiração
          setExpiredUser({
            id: error.id,
            name: error.name,
            username: error.username,
            subscriptionExpiry: error.subscriptionExpiry
          });
          setUrlUserId(error.id);
          
          console.log("Usuário com assinatura expirada identificado:", {
            id: error.id,
            name: error.name,
            username: error.username
          });
          
          toast({
            title: "Usuário identificado",
            description: "Sua assinatura está expirada, mas você pode renová-la agora.",
          });
          
          // Se temos ID de assinatura, podemos prosseguir
          if (selectedPlanId) {
            await generatePayment(selectedPlanId, values);
          }
        } else {
          // Outros erros de login
          toast({
            title: "Falha na autenticação",
            description: error.error || "Credenciais inválidas",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Erro ao processar login:', error);
      toast({
        title: "Erro ao processar login",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  // Função para gerar pagamento
  const generatePayment = async (planId: number, loginCredentials?: {username: string, password: string}) => {
    setPaymentStep('processing');
    setIsGeneratingPix(true);
    
    try {
      // Preparar dados do pagamento com ou sem credenciais
      const paymentData: any = { planId };
      
      // Prioridade 1: Usar o ID do usuário logado (se disponível)
      if (authUser?.id) {
        paymentData.userId = authUser.id;
        console.log(`Usando ID do usuário logado: ${authUser.id}`);
      } 
      // Prioridade 2: Usar o ID do usuário extraído da URL
      else if (urlUserId) {
        paymentData.userId = urlUserId;
        console.log(`Incluindo userId ${urlUserId} da URL no pagamento`);
      }
      
      // Prioridade 3: Usar credenciais de login fornecidas
      if (loginCredentials) {
        paymentData.username = loginCredentials.username;
        paymentData.password = loginCredentials.password;
        console.log(`Usando credenciais de login: ${loginCredentials.username}`);
      } 
      // Prioridade 4: Usar informações do usuário expirado
      else if (expiredUser?.username) {
        paymentData.username = expiredUser.username;
        console.log(`Incluindo username ${expiredUser.username} no pagamento`);
      }
      
      // Extrair parâmetros da URL para identificação adicional
      const params = new URLSearchParams(location.split('?')[1]);
      const usernameParam = params.get('username');
      
      // Passar parâmetro username na URL se disponível
      if (usernameParam && !paymentData.username) {
        paymentData.username = usernameParam;
        console.log(`Usando username da URL: ${usernameParam}`);
      }
      
      // Log de depuração
      console.log('Dados de pagamento:', JSON.stringify(paymentData));
      
      // Construir a URL com parâmetros para identificação
      let url = '/api/subscription/generate-payment';
      if (usernameParam) {
        url += `?username=${encodeURIComponent(usernameParam)}`;
      }
      
      // Chamar API para gerar o PIX
      const response = await apiRequest('POST', url, paymentData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao gerar pagamento');
      }
      
      const data = await response.json();
      setPixData(data);
      setPaymentStep('payment');
      setTimeRemaining(1800); // Reiniciar o contador (30 minutos)
      setProgressValue(100);
      
      // Gerar QR code localmente
      if (data.pixQrCode) {
        generateQRCode(data.pixQrCode);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao gerar pagamento",
        description: error.message || "Não foi possível gerar o pagamento. Tente novamente.",
        variant: "destructive",
      });
      
      // Se o erro for de autenticação, voltamos para o login
      if (error.message && (error.message.includes("autenticado") || error.message.includes("autenticação"))) {
        setPaymentStep('login');
      } else {
        setPaymentStep('select-plan');
      }
    } finally {
      setIsGeneratingPix(false);
    }
  };
  
  // Gerar QR code
  const generateQRCode = (text: string) => {
    try {
      setQrCodeUrl(text);
    } catch (error: any) {
      console.error('Erro ao gerar QR code:', error);
    }
  };
  
  // Desabilitar conexão WebSocket na página de renovação para evitar erros
  // já que o usuário não está autenticado
  useEffect(() => {
    // Desabilitar conexão WebSocket durante a renovação para evitar erros
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function MockWebSocket() {
      console.log("WebSocket desabilitado durante renovação de assinatura");
      return {} as any;
    } as any;
    
    return () => {
      // Restaurar WebSocket ao sair da página
      window.WebSocket = originalWebSocket;
    };
  }, []);
  
  // Verificar status do pagamento periodicamente
  useEffect(() => {
    if (pixData?.transactionId && paymentStep === 'payment') {
      const checkPaymentStatus = async () => {
        try {
          // Construir URL com parâmetros para identificação
          let url = `/api/subscription/payment-status/${pixData.transactionId}`;
          if (expiredUser?.username) {
            url += `?username=${encodeURIComponent(expiredUser.username)}`;
          }
          
          const response = await apiRequest('GET', url);
          if (!response.ok) {
            return;
          }
          
          const data = await response.json();
          if (data.status === 'paid' || data.status === 'confirmed' || data.status === 'approved') {
            setPaymentStep('success');
            toast({
              title: "Pagamento confirmado!",
              description: "Sua assinatura foi renovada com sucesso!",
              variant: "default",
            });
            
            // Atualizar dados do usuário
            queryClient.invalidateQueries({ queryKey: ['/api/user'] });
            
            // Redirecionar após 3 segundos
            setTimeout(() => {
              // Se temos informações do usuário, podemos montrar mensagem mais personalizada
              if (expiredUser?.username) {
                console.log(`Redirecionando usuário ${expiredUser.username} para tela de login após renovação`);
                navigate('/auth', { 
                  state: { 
                    message: "Sua assinatura foi renovada com sucesso! Faça login para continuar." 
                  }
                });
              } else {
                navigate('/auth');
              }
            }, 3000);
          }
        } catch (error) {
          console.error('Erro ao verificar status do pagamento:', error);
        }
      };
      
      // Verificar a cada 5 segundos
      const interval = setInterval(checkPaymentStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [pixData, paymentStep, navigate, toast, expiredUser]);
  
  // Timer de expiração para o PIX
  useEffect(() => {
    if (paymentStep === 'payment' && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            // Quando o timer chegar a zero, voltar para a seleção de planos
            setPaymentStep('select-plan');
            toast({
              title: "Tempo expirado",
              description: "O tempo para pagamento expirou. Por favor, tente novamente.",
              variant: "destructive",
            });
            return 0;
          }
          const newValue = prev - 1;
          setProgressValue((newValue / 1800) * 100);
          return newValue;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [paymentStep, timeRemaining, toast]);
  
  // Formatar tempo restante
  const formatTimeRemaining = () => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-lg">Carregando planos de assinatura...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <AlertCircle className="w-10 h-10 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Erro ao carregar planos</h1>
        <p className="text-lg mb-4">Não foi possível carregar os planos de assinatura. Por favor, tente novamente mais tarde.</p>
        <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    );
  }
  
  if (paymentStep === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-lg">Gerando pagamento...</p>
      </div>
    );
  }
  
  if (paymentStep === 'payment' && pixData) {
    return (
      <div className="container max-w-4xl mx-auto p-4">
        <Card className="w-full mb-8">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Pagamento via PIX</CardTitle>
            <CardDescription className="text-center">
              Escaneie o QR Code abaixo para renovar sua assinatura
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
              {pixData.pixQrCodeBase64 ? (
                <img 
                  src={`data:image/png;base64,${pixData.pixQrCodeBase64}`} 
                  alt="QR Code PIX" 
                  className="mx-auto"
                  style={{ maxWidth: "250px", height: "auto" }}
                />
              ) : qrCodeUrl ? (
                <QRCodeSVG
                  value={qrCodeUrl}
                  size={250}
                  level="H"
                  className="mx-auto"
                />
              ) : (
                <div className="w-64 h-64 bg-gray-200 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
              )}
            </div>
            
            <div className="w-full max-w-md mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Tempo restante para pagamento:</span>
                <span className="font-bold">{formatTimeRemaining()}</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>
            
            <div className="w-full max-w-md p-4 bg-gray-50 rounded-lg mb-6">
              <h3 className="font-semibold mb-2">Código PIX (Copiar e colar)</h3>
              <div className="relative">
                <textarea 
                  readOnly
                  className="w-full p-3 border rounded-md bg-white text-xs font-mono"
                  rows={4}
                  value={pixData.pixQrCode || ""}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    navigator.clipboard.writeText(pixData.pixQrCode || "");
                    toast({
                      title: "Código copiado!",
                      variant: "default",
                    });
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
            
            <div className="text-center space-y-2 text-sm text-muted-foreground">
              <div className="mb-4">
                <div className="flex items-center justify-center gap-1 text-orange-600 font-medium">
                  <Clock className="h-4 w-4" />
                  <span>Tempo restante:</span>
                  <span>
                    {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div className="w-full max-w-xs mx-auto mt-2">
                  <Progress value={progressValue} className="h-2" />
                </div>
              </div>
              <p>Abra o aplicativo do seu banco e realize o pagamento via PIX.</p>
              <p>Após o pagamento, sua assinatura será renovada automaticamente.</p>
              <p className="text-xs">O pagamento pode levar alguns instantes para ser confirmado.</p>
            </div>
          </CardContent>
          <CardFooter className="justify-center">
            <Button 
              variant="outline" 
              onClick={() => setPaymentStep('select-plan')}
              className="mt-2"
            >
              Voltar para seleção de planos
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (paymentStep === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Pagamento confirmado!</h1>
        <p className="text-lg mb-4">Sua assinatura foi renovada com sucesso.</p>
        <p className="mb-8">Você será redirecionado para a página inicial em instantes...</p>
        <Button onClick={() => navigate('/')}>Ir para página inicial</Button>
      </div>
    );
  }

  // Tela de login para autenticação antes do pagamento
  if (paymentStep === 'login') {
    return (
      <div className="container max-w-md mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">Acesso Necessário</CardTitle>
            <CardDescription className="text-center">
              Para renovar sua assinatura, informe suas credenciais de acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex justify-center">
              <Lock className="w-12 h-12 text-primary" />
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitLogin)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuário</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome de usuário" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Sua senha" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full">
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : 'Continuar'}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button 
              variant="ghost" 
              onClick={() => setPaymentStep('select-plan')}
            >
              Voltar para seleção de planos
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Tela de seleção de planos (padrão)
  return (
    <div className="container max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Renovação de Assinatura</h1>
        <div className="flex gap-2">
          {/* Botão para voltar ao sistema (apenas quando assinatura válida) */}
          {authUser?.subscriptionExpiry && new Date(authUser.subscriptionExpiry) > new Date() && (
            <Button
              variant="default"
              onClick={() => navigate('/')}
            >
              Voltar ao Sistema
            </Button>
          )}
          
          {/* Botão de Sair/Logout */}
          <Button 
            variant="outline" 
            onClick={() => {
              // Usar o logoutMutation do hook useAuth para garantir consistência
              logoutMutation.mutate(undefined, {
                onSuccess: () => {
                  // Limpar cache e redirecionar para a página de login
                  queryClient.removeQueries({ queryKey: ['/api/user'] });
                  navigate('/auth');
                },
                onError: (error) => {
                  console.error('Erro ao fazer logout:', error);
                  // Mesmo em caso de erro, redirecionar para a página de login
                  navigate('/auth');
                }
              });
            }}
          >
            Sair
          </Button>
        </div>
      </div>

      <div className="text-center mb-8">
        {/* Saudação personalizada com o nome do usuário */}
        {(authUser?.name || expiredUser?.name) && (
          <p className="text-xl font-medium text-primary mb-4">
            Olá, {authUser?.name || expiredUser?.name}!
          </p>
        )}
        
        <p className="text-lg text-muted-foreground mb-4">
          Não deixe de utilizar o melhor sistema de agendamentos. Temos as seguintes ofertas para você:
        </p>
        
        {/* Forma de identificação - login rápido se não estiver autenticado */}
        {!authUser?.id && !urlUserId && !expiredUser?.id && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 max-w-md mx-auto">
            <h2 className="text-md font-medium mb-2 text-blue-800">Identifique-se para continuar</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitLogin)} className="space-y-3">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuário</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome de usuário" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Sua senha" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Autenticando...
                    </>
                  ) : 'Identificar'}
                </Button>
              </form>
            </Form>
          </div>
        )}
        
        {/* Informações de depuração - apenas para desenvolvimento */}
        {(authUser?.id || urlUserId || expiredUser?.id) && (
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-4 text-sm text-center">
            <p className="text-green-800 font-medium">Usuário identificado com sucesso!</p>
          </div>
        )}
        
        {/* Mensagem sobre expiração da assinatura */}
        {(authUser?.subscriptionExpiry || expiredUser?.subscriptionExpiry) && (
          <div className="inline-block bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm">
            <p className="font-medium text-yellow-800">
              {(() => {
                const expiryDate = new Date(authUser?.subscriptionExpiry || expiredUser?.subscriptionExpiry);
                const now = new Date();
                
                if (expiryDate > now) {
                  return (
                    <>
                      Sua assinatura é válida até {expiryDate.toLocaleDateString('pt-BR')}
                    </>
                  );
                } else {
                  return (
                    <>
                      Sua assinatura expirou em {expiryDate.toLocaleDateString('pt-BR')}
                    </>
                  );
                }
              })()}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {plans?.map((plan: any) => (
          <Card key={plan.id} className={`overflow-hidden ${selectedPlanId === plan.id ? 'border-primary ring-1 ring-primary shadow-lg scale-[1.02]' : 'hover:border-primary/50 hover:shadow'} transition-all`}>
            <div className="p-1 bg-gradient-to-r from-primary to-primary/80"></div>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-center mb-1">
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                {plan.durationMonths >= 12 && (
                  <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                    <BadgeCheck className="w-3 h-3 mr-1 inline" />
                    Melhor valor
                  </Badge>
                )}
                {plan.durationMonths === 3 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                    <Clock className="w-3 h-3 mr-1 inline" />
                    Popular
                  </Badge>
                )}
              </div>
              <CardDescription>
                {plan.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mt-1 mb-5">
                <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                  {formatCurrency(plan.price)}
                </span>
                {plan.durationMonths === 1 ? (
                  <span className="text-muted-foreground ml-1">/mês</span>
                ) : (
                  <span className="text-muted-foreground ml-1">/{plan.durationMonths} meses</span>
                )}
                
                {plan.durationMonths > 1 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Equivalente a {formatCurrency(Math.round(plan.price / plan.durationMonths))}/mês
                  </div>
                )}
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center">
                  <CalendarCheck className="h-4 w-4 mr-2 text-green-500" />
                  <span>Agendamentos ilimitados</span>
                </div>
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2 text-green-500" />
                  <span>Gestão completa de clientes</span>
                </div>
                <div className="flex items-center">
                  <Link2 className="h-4 w-4 mr-2 text-green-500" />
                  <span>Link de agendamento personalizado</span>
                </div>
                <div className="flex items-center">
                  <CreditCard className="h-4 w-4 mr-2 text-green-500" />
                  <span>Pagamento via PIX</span>
                </div>
                <div className="flex items-center">
                  <Bell className="h-4 w-4 mr-2 text-green-500" />
                  <span>Notificações em tempo real</span>
                </div>
                <div className="flex items-center">
                  <Smartphone className="h-4 w-4 mr-2 text-green-500" />
                  <span>Acesso em dispositivos móveis</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => handleSelectPlan(plan.id)}
                disabled={isGeneratingPix}
                variant={selectedPlanId === plan.id ? "default" : "outline"}
              >
                {isGeneratingPix && selectedPlanId === plan.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando PIX...
                  </>
                ) : (
                  'Selecionar Plano'
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
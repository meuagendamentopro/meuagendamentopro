import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { VerificationPending } from "@/components/auth/verification-pending";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import TermsOfServiceDialog from "@/components/auth/terms-of-service-dialog";

const loginSchema = z.object({
  username: z.string().min(1, "Nome de usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const registerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<string>("login");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberCredentials, setRememberCredentials] = useState<boolean>(false);
  const { 
    user, 
    isLoading, 
    loginMutation, 
    registerMutation, 
    pendingVerification,
    setPendingVerification 
  } = useAuth();
  const [location, navigate] = useLocation();
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const { toast } = useToast();
  
  // Funções para gerenciar credenciais salvas
  const saveCredentials = (username: string, password: string) => {
    if (rememberCredentials) {
      localStorage.setItem('savedCredentials', JSON.stringify({ username, password }));
    } else {
      localStorage.removeItem('savedCredentials');
    }
  };
  
  const loadSavedCredentials = () => {
    try {
      const saved = localStorage.getItem('savedCredentials');
      if (saved) {
        const credentials = JSON.parse(saved);
        return credentials;
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais salvas:', error);
      localStorage.removeItem('savedCredentials');
    }
    return null;
  };
  
  // Consulta para buscar as configurações do sistema
  const { data: systemSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const response = await fetch('/api/system-settings');
      if (!response.ok) {
        throw new Error('Erro ao buscar configurações do sistema');
      }
      return response.json();
    },
  });
  
  // Verifica se há uma mensagem de sucesso na navegação (após renovação de assinatura)
  const locationState = typeof window !== 'undefined' ? window.history.state?.usr : null;
  
  useEffect(() => {
    if (locationState?.success) {
      toast({
        title: "Sucesso!",
        description: locationState.message,
        variant: "default",
      });
      
      // Limpa o estado para não mostrar a mensagem novamente em recarregamentos
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title);
      }
    }
  }, [locationState, toast]);
  
  // Carrega credenciais salvas quando o componente é montado
  useEffect(() => {
    const savedCredentials = loadSavedCredentials();
    if (savedCredentials) {
      loginForm.setValue('username', savedCredentials.username);
      loginForm.setValue('password', savedCredentials.password);
      setRememberCredentials(true);
    }
  }, []);
  
  // Redireciona para a página principal se o usuário já estiver autenticado
  useEffect(() => {
    if (user && !pendingVerification) {
      navigate("/dashboard");
    }
  }, [user, navigate, pendingVerification]);
  
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });
  
  const onLoginSubmit = async (values: LoginFormValues) => {
    try {
      await loginMutation.mutateAsync(values);
      // Salva as credenciais se o login foi bem-sucedido
      saveCredentials(values.username, values.password);
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      // O erro já é tratado no hook useAuth
    }
  };
  
  const onRegisterSubmit = async (values: RegisterFormValues) => {
    try {
      await registerMutation.mutateAsync(values);
    } catch (error) {
      console.error("Erro ao registrar:", error);
      // O erro já é tratado no hook useAuth
    }
  };
  
  // Usar o estado de carregamento das mutações diretamente
  // Nota: Usamos isPending das mutações em vez de isLoading do hook para garantir feedback visual
  
  // Exibe o componente de verificação pendente se necessário
  if (pendingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <VerificationPending 
            email={pendingVerification.email} 
            onBack={() => setPendingVerification(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex flex-col justify-center py-8 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-4xl">
          {/* Container principal */}
          <div className="flex flex-col lg:flex-row rounded-lg shadow-lg overflow-hidden">
            {/* Login/Register form */}
            <div className="w-full lg:w-1/2 bg-white p-4 sm:p-6 lg:p-8">
              <div className="mb-8 text-center">
                <div className="flex flex-col items-center justify-center mb-4">
                  <img 
                    id="auth-logo"
                    src="/images/logo.png" 
                    alt="Meu Agendamento PRO" 
                    className="h-40 object-contain max-w-[400px]"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      // Mostrar texto alternativo se a imagem não carregar
                      const parent = target.parentElement;
                      if (parent) {
                        const h1 = document.createElement('h1');
                        h1.className = 'text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent';
                        h1.textContent = 'Meu Agendamento PRO';
                        parent.appendChild(h1);
                      }
                    }}
                  />
                </div>
                <p className="text-gray-600 text-sm sm:text-base mb-4">
                  Sistema de agendamento online para profissionais
                </p>
                
                <div className="mb-6">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => navigate("/")}
                  >
                    &#8592; Voltar para a página inicial
                  </Button>
                </div>
              </div>
              
              <Tabs defaultValue="login" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="register">Cadastro</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <Card>
                    <CardHeader>
                      <CardTitle>Login</CardTitle>
                      <CardDescription>
                        Entre com suas credenciais para acessar sua conta.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...loginForm}>
                        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                          <FormField
                            control={loginForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome de Usuário</FormLabel>
                                <FormControl>
                                  <Input placeholder="Seu nome de usuário" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={loginForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Senha</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      type={showPassword ? "text" : "password"} 
                                      placeholder="Sua senha" 
                                      {...field} 
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowPassword(!showPassword)}
                                    >
                                      {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-gray-500" />
                                      ) : (
                                        <Eye className="h-4 w-4 text-gray-500" />
                                      )}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="rememberCredentials"
                              checked={rememberCredentials}
                              onChange={(e) => {
                                setRememberCredentials(e.target.checked);
                                // Se desmarcou, remove as credenciais salvas
                                if (!e.target.checked) {
                                  localStorage.removeItem('savedCredentials');
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor="rememberCredentials" className="text-sm font-normal text-gray-700">
                              Lembrar Credenciais
                            </label>
                          </div>
                          
                          <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={loginMutation.isPending}
                          >
                            {loginMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Entrando...
                              </>
                            ) : (
                              "Entrar"
                            )}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                    <CardFooter>
                      <p className="text-xs text-gray-500 text-center w-full">
                        Esqueceu sua senha? Entre em contato com o administrador do sistema.
                      </p>
                    </CardFooter>
                  </Card>
                </TabsContent>
                
                <TabsContent value="register">
                  <Card>
                    <CardHeader>
                      <CardTitle>Cadastro</CardTitle>
                      <CardDescription>
                        Crie uma nova conta para acessar o sistema.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Form {...registerForm}>
                        <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                          <FormField
                            control={registerForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome Completo</FormLabel>
                                <FormControl>
                                  <Input placeholder="Seu nome completo" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome de Usuário</FormLabel>
                                <FormControl>
                                  <Input placeholder="Escolha um nome de usuário" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="seu.email@exemplo.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Senha</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      type={showPassword ? "text" : "password"} 
                                      placeholder="Escolha uma senha" 
                                      {...field} 
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowPassword(!showPassword)}
                                    >
                                      {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-gray-500" />
                                      ) : (
                                        <Eye className="h-4 w-4 text-gray-500" />
                                      )}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={registerForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirmar Senha</FormLabel>
                                <FormControl>
                                  <Input 
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="Confirme sua senha" 
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={registerMutation.isPending}
                          >
                            {registerMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Criando Conta...
                              </>
                            ) : (
                              "Criar Conta"
                            )}
                          </Button>
                        </form>
                      </Form>
                    </CardContent>
                    <CardFooter>
                      <p className="text-xs text-gray-500 text-center w-full">
                        Ao se cadastrar, você concorda com nossos <button 
                          onClick={(e) => {
                            e.preventDefault();
                            setTermsDialogOpen(true);
                          }} 
                          className="text-primary underline hover:text-primary/80 focus:outline-none"
                        >
                          termos de serviço
                        </button> e terá um período de teste gratuito de {systemSettings?.trialPeriodDays || 3} dias.
                      </p>
                      <TermsOfServiceDialog 
                        open={termsDialogOpen} 
                        onOpenChange={setTermsDialogOpen} 
                      />
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Hero section - visible only on large screens */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-blue-700 text-white p-8 lg:p-12 flex-col justify-center">
              <div>
                <h2 className="text-2xl lg:text-3xl font-extrabold mb-4">
                  Gerencie sua agenda profissional com eficiência
                </h2>
                <p className="text-base lg:text-lg mb-6 lg:mb-8 text-white/90">
                  O Meu Agendamento PRO é uma plataforma completa para profissionais que desejam otimizar sua agenda, 
                  automatizar confirmações, receber pagamentos e oferecer uma experiência superior aos seus clientes.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <svg
                      className="h-5 w-5 mr-2 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    Controle total sobre sua agenda de atendimentos
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="h-5 w-5 mr-2 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    Recebimento de pagamentos via PIX integrado
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="h-5 w-5 mr-2 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    Notificações por WhatsApp
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="h-5 w-5 mr-2 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    Link personalizado para seus clientes agendarem
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="h-5 w-5 mr-2 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    Histórico completo de clientes e atendimentos
                  </li>
                  <li className="flex items-center">
                    <svg
                      className="h-5 w-5 mr-2 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    Relatórios financeiros
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer com direitos reservados - posicionado na parte inferior da página */}
      <footer className="w-full py-4 bg-gray-100 border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Meu Agendamento PRO - Todos os direitos reservados
          </p>
        </div>
      </footer>
    </div>
  );
}

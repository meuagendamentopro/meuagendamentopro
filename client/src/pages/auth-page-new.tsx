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
  const { 
    user, 
    isLoading, 
    loginMutation, 
    registerMutation, 
    pendingVerification,
    setPendingVerification 
  } = useAuth();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  
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
                    src="/api/system-settings/logo" 
                    alt="Meu Agendamento PRO" 
                    className="h-32 object-contain max-w-[360px]"
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
                <p className="text-gray-600 text-sm sm:text-base mb-6">
                  Sistema de agendamento online para profissionais
                </p>
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
                          
                          <Button 
                            type="submit" 
                            className="w-full" 
                            disabled={isLoading}
                          >
                            {isLoading ? (
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
                            disabled={isLoading}
                          >
                            {isLoading ? (
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
                        Ao se cadastrar, você concorda com nossos termos de serviço e terá um período de teste gratuito de 3 dias.
                      </p>
                    </CardFooter>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
            
            {/* Hero section - visible only on large screens */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-blue-700 text-white p-8 lg:p-12 flex-col justify-center">
              <div>
                <h2 className="text-2xl lg:text-3xl font-extrabold mb-4">
                  Gerencie seus agendamentos com facilidade
                </h2>
                <p className="text-base lg:text-lg mb-6 lg:mb-8 text-white/90">
                  O Meu Agendamento PRO é uma plataforma completa para profissionais que desejam otimizar sua agenda, 
                  automatizar confirmações e melhorar a experiência de seus clientes.
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
                    Confirmação automática de agendamentos
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
                    Histórico de clientes e atendimentos
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

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoCircledIcon, ShieldCheckIcon } from "@radix-ui/react-icons";

// Esquema para validação de atualização de perfil
const updateProfileSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido")
});

// Esquema para validação de atualização de senha
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(6, "Senha atual deve ter pelo menos 6 caracteres"),
  newPassword: z.string().min(8, "Nova senha deve ter pelo menos 8 caracteres"),
  confirmPassword: z.string().min(8, "Confirmação de senha deve ter pelo menos 8 caracteres")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"]
});

type ProfileFormValues = z.infer<typeof updateProfileSchema>;
type PasswordFormValues = z.infer<typeof updatePasswordSchema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("info");
  
  // Se não tiver usuário, mostrar mensagem
  if (!user) {
    return (
      <div className="flex justify-center items-center h-full">
        <p>Carregando perfil...</p>
      </div>
    );
  }

  // Formulário para dados do perfil
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || ""
    }
  });
  
  // Formulário para alteração de senha
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });
  
  // Mutation para atualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PATCH", "/api/user/profile", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Falha ao atualizar perfil");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Perfil atualizado",
        description: "Seus dados foram atualizados com sucesso",
      });
      
      // Atualizar o cache do usuário
      queryClient.setQueryData(["/api/user"], data);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar perfil",
        variant: "destructive",
      });
    }
  });
  
  // Mutation para atualizar senha
  const updatePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      const res = await apiRequest("PATCH", "/api/user/profile", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Falha ao atualizar senha");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi atualizada com sucesso",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar senha",
        variant: "destructive",
      });
    }
  });

  // Função para enviar formulário de perfil
  function onProfileSubmit(data: ProfileFormValues) {
    updateProfileMutation.mutate(data);
  }
  
  // Função para enviar formulário de senha
  function onPasswordSubmit(data: PasswordFormValues) {
    updatePasswordMutation.mutate(data);
  }
  
  // Gerar iniciais para o avatar
  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfil"
        description="Visualize e altere suas informações pessoais"
      />
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col items-center sm:flex-row sm:space-x-4 sm:items-start">
              <Avatar className="h-24 w-24 mb-4 sm:mb-0">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                ) : null}
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left">
                <CardTitle className="text-2xl mb-1">{user.name}</CardTitle>
                <CardDescription className="mb-2">{user.email}</CardDescription>
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {user.role === 'admin' ? 'Administrador' : 'Provedor de Serviços'}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert variant="default" className="bg-muted">
                <InfoCircledIcon className="h-4 w-4 mr-2" />
                <AlertTitle>Informações da Conta</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Nome de usuário:</div>
                    <div>{user.username}</div>
                    <div className="text-muted-foreground">Status:</div>
                    <div className="flex items-center">
                      <div className={`h-2 w-2 rounded-full mr-2 ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </div>
                    <div className="text-muted-foreground">Membro desde:</div>
                    <div>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</div>
                    {user.role === 'provider' && (
                      <>
                        <div className="text-muted-foreground">Assinatura:</div>
                        <div className="flex items-center">
                          <ShieldCheckIcon className="h-4 w-4 mr-2 text-green-500" />
                          {user.neverExpires
                            ? 'Sem expiração'
                            : user.subscriptionExpiry
                            ? new Date(user.subscriptionExpiry) > new Date()
                              ? `Expira em ${new Date(user.subscriptionExpiry).toLocaleDateString('pt-BR')}`
                              : 'Expirada'
                            : 'Não disponível'}
                        </div>
                      </>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
        
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Pessoais</CardTitle>
                  <CardDescription>
                    Atualize seus dados pessoais aqui.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                      <FormField
                        control={profileForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome</FormLabel>
                            <FormControl>
                              <Input placeholder="Seu nome completo" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={profileForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input placeholder="seu@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending || !profileForm.formState.isDirty}
                      >
                        {updateProfileMutation.isPending ? "Atualizando..." : "Salvar alterações"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="security" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Segurança</CardTitle>
                  <CardDescription>
                    Altere sua senha para manter sua conta segura.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha atual</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Digite sua senha atual" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nova senha</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Digite a nova senha" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmar nova senha</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Confirme a nova senha" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="submit"
                        disabled={updatePasswordMutation.isPending || !passwordForm.formState.isDirty}
                      >
                        {updatePasswordMutation.isPending ? "Atualizando..." : "Atualizar senha"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
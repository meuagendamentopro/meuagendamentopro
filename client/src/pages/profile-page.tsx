import { useState, useRef, ChangeEvent, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Bell, Camera, InfoIcon, MessageSquare, ShieldIcon, Trash2, X } from "lucide-react";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

// Esquema para validação de configurações de notificação
const notificationSettingsSchema = z.object({
  enableWhatsApp: z.boolean().default(false),
  accountSid: z.string().min(1, "Account SID é obrigatório").optional(),
  authToken: z.string().min(1, "Auth Token é obrigatório").optional(),
  phoneNumber: z.string().min(1, "Número de telefone é obrigatório").optional(),
  enableAppointmentConfirmation: z.boolean().default(true),
  enableAppointmentReminder: z.boolean().default(true),
  enableCancellationNotice: z.boolean().default(true)
});

type ProfileFormValues = z.infer<typeof updateProfileSchema>;
type PasswordFormValues = z.infer<typeof updatePasswordSchema>;
type NotificationSettingsValues = z.infer<typeof notificationSettingsSchema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("info");
  const [hasWhatsAppConfig, setHasWhatsAppConfig] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Consulta para buscar configurações de notificação
  const { data: notificationSettings, isLoading: isLoadingNotificationSettings } = useQuery<NotificationSettingsValues>({
    queryKey: ['/api/notification-settings'],
    enabled: user?.role === 'provider'
  });
  
  // Efeito para carregar configurações quando os dados estiverem disponíveis
  useEffect(() => {
    if (notificationSettings) {
      notificationForm.reset({
        enableWhatsApp: !!notificationSettings.enableWhatsApp,
        accountSid: notificationSettings.accountSid || '',
        authToken: notificationSettings.authToken || '',
        phoneNumber: notificationSettings.phoneNumber || '',
        enableAppointmentConfirmation: notificationSettings.enableAppointmentConfirmation !== false,
        enableAppointmentReminder: notificationSettings.enableAppointmentReminder !== false,
        enableCancellationNotice: notificationSettings.enableCancellationNotice !== false
      });
      setHasWhatsAppConfig(!!notificationSettings.enableWhatsApp && 
                           !!notificationSettings.accountSid && 
                           !!notificationSettings.phoneNumber);
      setIsLoadingConfig(false);
    } else if (!isLoadingNotificationSettings) {
      setIsLoadingConfig(false);
    }
  }, [notificationSettings, isLoadingNotificationSettings]);
  
  // Form para configurações de notificação
  const notificationForm = useForm<NotificationSettingsValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      enableWhatsApp: false,
      enableAppointmentConfirmation: true,
      enableAppointmentReminder: true,
      enableCancellationNotice: true
    }
  });
  
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
  
  // Handler para upload de avatar
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };
  
  // Mutation para upload de avatar
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("avatar", file);
      
      const res = await fetch("/api/user/upload-avatar", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Falha ao fazer upload da imagem");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Avatar atualizado",
        description: "Sua foto de perfil foi atualizada com sucesso.",
      });
      // Atualizar o cache do usuário
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setIsUploading(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar avatar",
        description: error.message,
        variant: "destructive",
      });
      // Reset para o avatar anterior
      setAvatarPreview(user?.avatarUrl || null);
      setIsUploading(false);
    },
  });
  
  // Handler para quando um arquivo é selecionado
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Verificar tipo e tamanho do arquivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo de imagem (JPG, PNG, etc).",
        variant: "destructive",
      });
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 5MB.",
        variant: "destructive",
      });
      return;
    }
    
    // Criar preview da imagem
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // Enviar para o servidor
    uploadAvatarMutation.mutate(file);
  };
  
  // Mutation para remover avatar
  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/user/avatar", {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Falha ao remover foto");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Foto removida",
        description: "Sua foto de perfil foi removida com sucesso",
      });
      
      // Atualizar o cache do usuário com os dados atualizados
      // Forçar atualização completa através de invalidação do cache
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Limpar a prévia
      setAvatarPreview(null);
      
      // Forçar o refresh da página para garantir que a interface seja atualizada
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover foto",
        variant: "destructive",
      });
    }
  });

  // Remover avatar
  const handleRemoveAvatar = () => {
    removeAvatarMutation.mutate();
  };
  
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
  
  // Mutation para atualizar configurações de notificação
  const updateNotificationSettingsMutation = useMutation({
    mutationFn: async (data: NotificationSettingsValues) => {
      const res = await apiRequest("POST", "/api/notification-settings", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Falha ao atualizar configurações de notificação");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configurações atualizadas",
        description: "Suas configurações de notificação foram atualizadas com sucesso.",
      });
      setHasWhatsAppConfig(notificationForm.getValues("enableWhatsApp"));
      // Recarregar as configurações após atualização
      queryClient.invalidateQueries({ queryKey: ['/api/notification-settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar configurações de notificação",
        variant: "destructive",
      });
    }
  });
  
  // Mutation para testar credenciais do Twilio
  const testTwilioCredentialsMutation = useMutation({
    mutationFn: async () => {
      const data = {
        accountSid: notificationForm.getValues("accountSid"),
        authToken: notificationForm.getValues("authToken"),
        phoneNumber: notificationForm.getValues("phoneNumber")
      };
      
      const res = await apiRequest("POST", "/api/notification-settings/test", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || "Falha ao testar credenciais");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Credenciais válidas",
        description: "As credenciais do Twilio foram verificadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Credenciais inválidas",
        description: error.message || "Erro ao verificar credenciais do Twilio",
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

  function onNotificationSubmit(data: NotificationSettingsValues) {
    updateNotificationSettingsMutation.mutate(data);
  }
  
  // Função para testar credenciais do Twilio
  function handleTestTwilioCredentials() {
    testTwilioCredentialsMutation.mutate();
  }
  
  // Gerar iniciais para o avatar
  const initials = user?.name 
    ? user.name
        .split(' ')
        .filter(n => n)
        .map(n => n[0] || '')
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : "U";

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
              <div className="relative">
                <div className="relative group">
                  <Avatar className="h-24 w-24 mb-4 sm:mb-0 border-2 border-primary/20">
                    {avatarPreview ? (
                      <AvatarImage src={avatarPreview} alt={user.name} />
                    ) : user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                    ) : null}
                    <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                  </Avatar>
                  <div 
                    className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer"
                    onClick={handleAvatarClick}
                  >
                    <Camera className="h-6 w-6" />
                  </div>
                  {(avatarPreview || user.avatarUrl) && (
                    <button 
                      className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 shadow-lg hover:bg-red-700 transition-colors"
                      onClick={handleRemoveAvatar}
                      type="button"
                      title="Remover foto"
                      aria-label="Remover foto"
                    >
                      <X className="h-5 w-5 stroke-[3]" />
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                    <div className="loading-spinner w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
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
                <InfoIcon className="h-4 w-4 mr-2" />
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
                          <ShieldIcon className="h-4 w-4 mr-2 text-green-500" />
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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
              <TabsTrigger value="notifications">Notificações</TabsTrigger>
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
            
            <TabsContent value="notifications" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notificações</CardTitle>
                  <CardDescription>Configure como seus clientes receberão notificações de agendamentos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Form {...notificationForm}>
                    <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <h3 className="text-base font-medium">Notificações por WhatsApp</h3>
                            <p className="text-sm text-muted-foreground">
                              Enviar confirmações e lembretes de agendamentos via WhatsApp
                            </p>
                          </div>
                          <FormField
                            control={notificationForm.control}
                            name="enableWhatsApp"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {notificationForm.watch("enableWhatsApp") && (
                        <>
                          <Separator />
                          <div className="space-y-4">
                            <h3 className="text-base font-medium">Configurações do Twilio</h3>
                            <p className="text-sm text-muted-foreground">
                              Configure suas credenciais do Twilio para enviar mensagens por WhatsApp.
                              <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                                Obter conta Twilio
                              </a>
                            </p>

                            <FormField
                              control={notificationForm.control}
                              name="accountSid"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Account SID</FormLabel>
                                  <FormControl>
                                    <Input placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={notificationForm.control}
                              name="authToken"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Auth Token</FormLabel>
                                  <FormControl>
                                    <Input type="password" placeholder="Seu Auth Token do Twilio" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={notificationForm.control}
                              name="phoneNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Número WhatsApp</FormLabel>
                                  <FormControl>
                                    <Input placeholder="+14155238886" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                  <p className="text-xs text-muted-foreground">
                                    Número completo com código do país (Ex: +14155238886)
                                  </p>
                                </FormItem>
                              )}
                            />
                            
                            <div className="pt-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleTestTwilioCredentials}
                                disabled={testTwilioCredentialsMutation.isPending || 
                                         !notificationForm.watch("accountSid") || 
                                         !notificationForm.watch("authToken") || 
                                         !notificationForm.watch("phoneNumber")}
                                className="w-full"
                              >
                                {testTwilioCredentialsMutation.isPending ? (
                                  <>
                                    <div className="loading-spinner w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                    Testando credenciais...
                                  </>
                                ) : (
                                  <>Testar credenciais</>
                                )}
                              </Button>
                              <p className="text-xs text-muted-foreground mt-2">
                                Teste suas credenciais do Twilio antes de salvar as configurações.
                              </p>
                            </div>
                          </div>

                          <Separator />

                          <div className="space-y-4">
                            <h3 className="text-base font-medium">Tipos de notificação</h3>
                            <p className="text-sm text-muted-foreground">
                              Escolha quais notificações serão enviadas aos seus clientes.
                            </p>

                            <div className="space-y-2">
                              <FormField
                                control={notificationForm.control}
                                name="enableAppointmentConfirmation"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">Confirmação de agendamento</FormLabel>
                                      <FormDescription>
                                        Notificar cliente quando um agendamento for criado
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={notificationForm.control}
                                name="enableAppointmentReminder"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">Lembrete de agendamento</FormLabel>
                                      <FormDescription>
                                        Enviar lembrete 24h antes e no dia do agendamento
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={notificationForm.control}
                                name="enableCancellationNotice"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">Aviso de cancelamento</FormLabel>
                                      <FormDescription>
                                        Notificar cliente quando um agendamento for cancelado
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <Button 
                        type="submit" 
                        disabled={updateNotificationSettingsMutation.isPending || !notificationForm.formState.isDirty}
                      >
                        {updateNotificationSettingsMutation.isPending ? "Salvando..." : "Salvar configurações"}
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
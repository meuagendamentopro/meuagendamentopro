import { useState, useRef, ChangeEvent, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
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
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import WhatsAppSettings from "@/components/whatsapp/whatsapp-settings";
import TestWhatsAppSend from "@/components/whatsapp/test-whatsapp";

// Esquema para validação de atualização de perfil
const updateProfileSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal('')),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

// Esquema para validação de atualização de senha
const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(8, "Nova senha deve ter pelo menos 8 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// Esquema para validação de configurações de notificação
const notificationSettingsSchema = z.object({
  enableWhatsApp: z.boolean().default(false),
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  phoneNumber: z.string().optional(),
  enableAppointmentConfirmation: z.boolean().default(false),
  enableAppointmentReminder: z.boolean().default(false),
  enableCancellationNotice: z.boolean().default(false),
});

// Definição de tipos baseados nos esquemas
type ProfileFormValues = z.infer<typeof updateProfileSchema>;
type PasswordFormValues = z.infer<typeof updatePasswordSchema>;
type NotificationSettingsValues = z.infer<typeof notificationSettingsSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("info");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);

  // Form para o perfil
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      bio: user?.bio || "",
    },
  });

  // Form para senha
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Form para configurações de notificação
  const notificationForm = useForm<NotificationSettingsValues>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      enableWhatsApp: false,
      accountSid: "",
      authToken: "",
      phoneNumber: "",
      enableAppointmentConfirmation: false,
      enableAppointmentReminder: false,
      enableCancellationNotice: false,
    },
  });

  // Mutation para upload de imagem de perfil
  const uploadProfileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("profileImage", file);

      const res = await fetch("/api/profile/image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao enviar imagem");
      }

      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Imagem atualizada",
        description: "Sua imagem de perfil foi atualizada com sucesso.",
      });
      // Limpar preview e arquivo após sucesso
      setPreviewUrl(null);
      setProfileFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar imagem de perfil",
        variant: "destructive",
      });
    }
  });

  // Mutation para remover imagem de perfil
  const removeProfileImageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/profile/image");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao remover imagem");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Imagem removida",
        description: "Sua imagem de perfil foi removida com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover imagem de perfil",
        variant: "destructive",
      });
    }
  });

  // Mutation para atualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao atualizar perfil");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: "Perfil atualizado",
        description: "Seu perfil foi atualizado com sucesso.",
      });
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
      const res = await apiRequest("POST", "/api/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Falha ao atualizar senha");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi atualizada com sucesso.",
      });
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar senha",
        variant: "destructive",
      });
    }
  });

  // Atualização dos valores padrão quando o usuário é carregado
  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        bio: user.bio || "",
      });
    }
  }, [user, profileForm]);

  // Função para lidar com a mudança de arquivo de imagem
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setProfileFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  // Função para acionar o seletor de arquivo
  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  // Função para remover a imagem de perfil existente
  function handleRemoveImage() {
    if (user?.profileImageUrl) {
      removeProfileImageMutation.mutate();
    } else {
      setPreviewUrl(null);
      setProfileFile(null);
    }
  }

  // Função para cancelar o upload
  function handleCancelUpload() {
    setPreviewUrl(null);
    setProfileFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Função para submeter o formulário de atualização de perfil
  function onProfileSubmit(data: ProfileFormValues) {
    updateProfileMutation.mutate(data);
  }

  // Função para submeter o formulário de alteração de senha
  function onPasswordSubmit(data: PasswordFormValues) {
    updatePasswordMutation.mutate(data);
  }

  // Função para submeter o formulário de configurações de notificação
  function onNotificationSubmit(data: NotificationSettingsValues) {
    // Esta função foi substituída pelo componente dedicado WhatsAppSettings
    console.log("Esta função não é mais utilizada - veja WhatsAppSettings");
  }

  return (
    <div className="container py-4 md:py-8">
      <PageHeader
        title="Meu Perfil"
        description="Gerencie suas informações, senhas e configurações de notificações"
      >
        <div className="flex space-x-2">
          {profileFile && (
            <Button 
              variant="default" 
              onClick={() => uploadProfileImageMutation.mutate(profileFile)}
              disabled={uploadProfileImageMutation.isPending}
            >
              {uploadProfileImageMutation.isPending ? "Enviando..." : "Salvar imagem"}
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="mt-6 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
              <div className="relative">
                <Avatar className="w-24 h-24 border-2 border-border">
                  <AvatarImage 
                    src={previewUrl || user?.profileImageUrl || undefined} 
                    alt={user?.name || "Avatar"} 
                  />
                  <AvatarFallback className="text-2xl">
                    {user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
                
                <div className="absolute -bottom-2 -right-2 flex space-x-1">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="icon" 
                    className="h-8 w-8 rounded-full shadow"
                    onClick={handleAvatarClick}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  
                  {(previewUrl || user?.profileImageUrl) && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      className="h-8 w-8 rounded-full shadow"
                      onClick={handleRemoveImage}
                      disabled={removeProfileImageMutation.isPending}
                    >
                      {removeProfileImageMutation.isPending ? (
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  
                  {previewUrl && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 rounded-full shadow"
                      onClick={handleCancelUpload}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 space-y-2 text-center md:text-left">
                <h3 className="text-xl font-semibold">{user?.name}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                {user?.role === "admin" && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <ShieldIcon className="h-3 w-3" />
                    Administrador
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
              <TabsTrigger value="notifications">Notificações</TabsTrigger>
            </TabsList>
            
            <TabsContent value="info" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações do Perfil</CardTitle>
                  <CardDescription>Atualize seus dados pessoais e informações de contato.</CardDescription>
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
                              <Input placeholder="Seu endereço de email" {...field} />
                            </FormControl>
                            <FormDescription>
                              Este email será usado para enviar notificações.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={profileForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input placeholder="Seu número de telefone" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={profileForm.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bio</FormLabel>
                            <FormControl>
                              <Input placeholder="Uma breve descrição sobre você" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending || !profileForm.formState.isDirty}
                      >
                        {updateProfileMutation.isPending ? "Atualizando..." : "Atualizar perfil"}
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
                  <CardDescription>Atualize sua senha para manter sua conta segura.</CardDescription>
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
                              <Input type="password" placeholder="••••••••" {...field} />
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
                              <Input type="password" placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormDescription>
                              Sua senha deve ter pelo menos 8 caracteres.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirme a nova senha</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="••••••••" {...field} />
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
                  <WhatsAppSettings />
                  
                  <Separator className="my-4" />
                  
                  <div className="pt-4">
                    <h3 className="text-lg font-medium mb-4">Testar Envio de WhatsApp</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Use esta ferramenta para testar se suas configurações de WhatsApp estão funcionando corretamente.
                    </p>
                    
                    <TestWhatsAppSend />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
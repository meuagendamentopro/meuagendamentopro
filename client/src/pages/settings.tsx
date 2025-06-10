import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { playNotificationSound } from "@/lib/notification-sound";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatPhoneNumber } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/layout/page-header";
import { Clock, Calendar, Phone, Smartphone, CreditCard, DollarSign, Percent } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import WhatsAppPopup from "@/components/whatsapp-popup";
import { TimeExclusionManager } from "@/components/time-exclusions/time-exclusion-manager";
import { Switch } from "@/components/ui/switch";
import { useImpersonation } from "@/hooks/use-impersonation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Schema para validação do formulário
const settingsFormSchema = z.object({
  // Configurações de conta
  accountType: z.enum(['individual', 'company']).default('individual'),
  
  // Configurações de horário de trabalho
  workingHoursStart: z.coerce.number().int().min(0).max(23),
  workingHoursEnd: z.coerce.number().int().min(1).max(24),
  workingDays: z.string(),
  phone: z.string().optional(),
  
  // Configurações de pagamento PIX
  pixEnabled: z.boolean().default(false),
  pixKeyType: z.string().optional(),
  pixKey: z.string().optional(),
  pixCompanyName: z.string().optional(),
  pixRequirePayment: z.boolean().default(false),
  pixPaymentPercentage: z.coerce.number().int().min(1).max(100).default(100),
  
  // Configurações do Mercado Pago
  pixMercadoPagoToken: z.string().optional(),
  pixIdentificationNumber: z.string().optional(),
  
  // Templates de mensagens WhatsApp
  whatsappTemplateAppointment: z.string().optional().default("Caro {cliente}. Seu agendamento para o dia {data} às {hora} foi confirmado."),
}).refine(data => data.workingHoursEnd > data.workingHoursStart, {
  message: "O horário de término deve ser maior que o horário de início",
  path: ["workingHoursEnd"]
}).refine(
  data => !data.pixEnabled || (data.pixEnabled && data.pixKey && data.pixKeyType),
  {
    message: "Tipo de chave e chave PIX são obrigatórios quando o pagamento PIX está habilitado",
    path: ["pixKey"]
  }
);

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { impersonationStatus } = useImpersonation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompanyConfirmDialog, setShowCompanyConfirmDialog] = useState(false);
  const [pendingAccountType, setPendingAccountType] = useState<'individual' | 'company' | null>(null);

  // Função para tratar mudança do tipo de conta
  const handleAccountTypeChange = (newAccountType: 'individual' | 'company') => {
    const currentAccountType = form.getValues('accountType');
    
    // Se está tentando mudar de individual para company, mostrar confirmação
    if (currentAccountType === 'individual' && newAccountType === 'company') {
      setPendingAccountType(newAccountType);
      setShowCompanyConfirmDialog(true);
      return;
    }
    
    // Se está tentando mudar de company para individual, não permitir
    if (currentAccountType === 'company' && newAccountType === 'individual') {
      toast({
        title: "Alteração não permitida",
        description: "Não é possível alterar de conta empresa para conta individual.",
        variant: "destructive",
      });
      return;
    }
    
    // Para outras mudanças, aplicar diretamente
    form.setValue('accountType', newAccountType);
  };

  // Função para confirmar mudança para conta empresa
  const confirmCompanyAccountChange = () => {
    if (pendingAccountType) {
      // Atualizar o formulário
      form.setValue('accountType', pendingAccountType);
      
      // Salvar automaticamente no banco de dados
      updateAccountType.mutate(pendingAccountType);
      
      // Fechar o dialog
      setShowCompanyConfirmDialog(false);
      setPendingAccountType(null);
    }
  };

  // Função para cancelar mudança para conta empresa
  const cancelCompanyAccountChange = () => {
    setShowCompanyConfirmDialog(false);
    setPendingAccountType(null);
  };

  // Invalidar queries quando o status de simulação mudar
  React.useEffect(() => {
    console.log("Status de simulação mudou na página de configurações:", impersonationStatus);
    if (impersonationStatus) {
      // Invalidar as queries principais para recarregar dados do usuário simulado
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-provider"] });
    }
  }, [impersonationStatus, queryClient]);

  // Buscar dados do usuário atual
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch("/api/user");
      if (!res.ok) throw new Error("Failed to fetch user data");
      return res.json();
    },
  });

  // Buscar dados do provedor atual através da API my-provider
  const { data: provider, isLoading } = useQuery({
    queryKey: ["/api/my-provider"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch("/api/my-provider");
      if (!res.ok) throw new Error("Failed to fetch provider data");
      return res.json();
    },
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      accountType: "individual",
      workingHoursStart: 8,
      workingHoursEnd: 18,
      workingDays: "1,2,3,4,5",
      pixEnabled: false,
      pixKeyType: "",
      pixKey: "",
      pixCompanyName: "",
      pixRequirePayment: false,
      pixPaymentPercentage: 100,
      pixMercadoPagoToken: "",
      pixIdentificationNumber: "",
      whatsappTemplateAppointment: "Caro {cliente}. Seu agendamento para o dia {data} às {hora} foi confirmado.",
    },
  });

  // Atualizar o formulário quando os dados do usuário e provedor forem carregados
  React.useEffect(() => {
    if (provider && user) {
      console.log("Carregando dados do provedor para o formulário:", {
        id: provider.id,
        phone: provider.phone, // Adicionado para depuração
        hasMercadoPagoToken: !!provider.pixMercadoPagoToken,
        hasIdentificationNumber: !!provider.pixIdentificationNumber,
        pixEnabled: provider.pixEnabled,
      });
      
      form.reset({
        accountType: user.accountType || "individual",
        workingHoursStart: provider.workingHoursStart || 8,
        workingHoursEnd: provider.workingHoursEnd || 18,
        workingDays: provider.workingDays || "1,2,3,4,5",
        phone: provider.phone || "",
        // Configurações PIX
        pixEnabled: provider.pixEnabled || false,
        pixKeyType: provider.pixKeyType || "",
        pixKey: provider.pixKey || "",
        pixCompanyName: provider.pixCompanyName || "",
        pixRequirePayment: provider.pixRequirePayment || false,
        pixPaymentPercentage: provider.pixPaymentPercentage || 100,
        // Configurações do Mercado Pago
        pixMercadoPagoToken: provider.pixMercadoPagoToken || "",
        pixIdentificationNumber: provider.pixIdentificationNumber || "",
        // Templates de mensagens WhatsApp
        whatsappTemplateAppointment: provider.whatsappTemplateAppointment || "Caro {cliente}. Seu agendamento para o dia {data} às {hora} foi confirmado.",
      });
    }
  }, [provider, user, form]);

  // Mutation para atualizar as configurações
  const updateSettings = useMutation({
    mutationFn: async (data: SettingsFormValues) => {
      if (!provider || !provider.id || !user) {
        throw new Error("Dados do usuário ou provedor não disponíveis");
      }
      
      console.log(`Atualizando configurações para provider ID ${provider.id}:`, data);
      
      // Primeiro, atualizar o tipo de conta se mudou
      if (data.accountType !== user.accountType) {
        await apiRequest("PATCH", `/api/user/account-type`, { accountType: data.accountType });
      }
      
      // Depois, atualizar as configurações do provider
      return apiRequest("PATCH", `/api/providers/${provider.id}/settings`, data);
    },
    onSuccess: () => {
      toast({
        title: "Configurações atualizadas",
        description: "Suas configurações foram atualizadas com sucesso.",
      });
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Erro ao atualizar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar suas configurações.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  // Mutation específica para horários de trabalho (salvamento automático)
  const updateWorkingHours = useMutation({
    mutationFn: async (data: { workingHoursStart?: number; workingHoursEnd?: number }) => {
      if (!provider || !provider.id) {
        throw new Error("Dados do provedor não disponíveis");
      }
      
      console.log(`Atualizando horários de trabalho para provider ID ${provider.id}:`, data);
      return apiRequest("PATCH", `/api/providers/${provider.id}/settings`, data);
    },
    onSuccess: () => {
      toast({
        title: "Horário atualizado",
        description: "Horário de trabalho salvo automaticamente.",
      });
      // Invalidar queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: ["/api/my-provider"] });
    },
    onError: (error) => {
      console.error("Erro ao atualizar horários:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o horário de trabalho.",
        variant: "destructive",
      });
    },
  });

  // Mutation específica para dias de trabalho (salvamento automático)
  const updateWorkingDays = useMutation({
    mutationFn: async (workingDays: string) => {
      if (!provider || !provider.id) {
        throw new Error("Dados do provedor não disponíveis");
      }
      
      console.log(`Atualizando dias de trabalho para provider ID ${provider.id}:`, workingDays);
      return apiRequest("PATCH", `/api/providers/${provider.id}/settings`, { workingDays });
    },
    onSuccess: () => {
      toast({
        title: "Dias atualizados",
        description: "Dias de trabalho salvos automaticamente.",
      });
      // Invalidar queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: ["/api/my-provider"] });
    },
    onError: (error) => {
      console.error("Erro ao atualizar dias:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar os dias de trabalho.",
        variant: "destructive",
      });
    },
  });

  // Mutation específica para tipo de conta (salvamento automático)
  const updateAccountType = useMutation({
    mutationFn: async (accountType: 'individual' | 'company') => {
      if (!user) {
        throw new Error("Dados do usuário não disponíveis");
      }
      
      console.log(`Atualizando tipo de conta para: ${accountType}`);
      return apiRequest("PATCH", `/api/user/account-type`, { accountType });
    },
    onSuccess: () => {
      toast({
        title: "Tipo de conta atualizado",
        description: "Sua conta foi alterada para empresa com sucesso.",
      });
      // Invalidar queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-provider"] });
    },
    onError: (error) => {
      console.error("Erro ao atualizar tipo de conta:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o tipo de conta.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: SettingsFormValues) => {
    setIsSubmitting(true);
    updateSettings.mutate(data);
  };

  // Gerar opções de horas
  const hourOptions = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerenciar suas preferências e configurações"
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium">Horário de Trabalho</h3>
            <p className="text-sm text-gray-500">
              Defina o horário em que você estará disponível para agendamentos
            </p>
          </div>

          <Separator className="mb-6" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Seção de Tipo de Conta */}
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium">Tipo de Conta</h3>
                  <p className="text-sm text-gray-500">
                    Escolha o tipo de conta adequado para suas necessidades
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormControl>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div 
                            className={`relative cursor-pointer rounded-lg border p-4 hover:bg-gray-50 ${
                              field.value === 'individual' 
                                ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                                : 'border-gray-200'
                            }`}
                            onClick={() => handleAccountTypeChange('individual')}
                          >
                            <div className="flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  type="radio"
                                  checked={field.value === 'individual'}
                                  onChange={() => handleAccountTypeChange('individual')}
                                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                />
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  Conta Individual
                                </div>
                                <div className="text-sm text-gray-500">
                                  Para profissionais autônomos que trabalham sozinhos
                                </div>
                              </div>
                            </div>
                          </div>

                          <div 
                            className={`relative cursor-pointer rounded-lg border p-4 hover:bg-gray-50 ${
                              field.value === 'company' 
                                ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                                : 'border-gray-200'
                            }`}
                            onClick={() => handleAccountTypeChange('company')}
                          >
                            <div className="flex items-start">
                              <div className="flex items-center h-5">
                                <input
                                  type="radio"
                                  checked={field.value === 'company'}
                                  onChange={() => handleAccountTypeChange('company')}
                                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                />
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">
                                  Conta Empresa
                                </div>
                                <div className="text-sm text-gray-500">
                                  Para empresas que gerenciam uma equipe de funcionários
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Seção de Horário de Trabalho */}
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-medium">Horário de Trabalho</h3>
                  <p className="text-sm text-gray-500">
                    Defina o horário em que você estará disponível para agendamentos
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="workingHoursStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de início</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const newValue = parseInt(value);
                          field.onChange(newValue);
                          // Salvar automaticamente
                          updateWorkingHours.mutate({ workingHoursStart: newValue });
                        }}
                        defaultValue={field.value.toString()}
                        value={field.value.toString()}
                        disabled={updateWorkingHours.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-gray-400" />
                              <SelectValue placeholder="Selecione o horário" />
                              {updateWorkingHours.isPending && (
                                <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              )}
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hourOptions.slice(0, 24).map((hour) => (
                            <SelectItem key={hour} value={hour.toString()}>
                              {`${hour.toString().padStart(2, "0")}:00`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Horário que você começa a atender (salvo automaticamente)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workingHoursEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de término</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const newValue = parseInt(value);
                          field.onChange(newValue);
                          // Salvar automaticamente
                          updateWorkingHours.mutate({ workingHoursEnd: newValue });
                        }}
                        defaultValue={field.value.toString()}
                        value={field.value.toString()}
                        disabled={updateWorkingHours.isPending}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-gray-400" />
                              <SelectValue placeholder="Selecione o horário" />
                              {updateWorkingHours.isPending && (
                                <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                              )}
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hourOptions.slice(1).map((hour) => (
                            <SelectItem key={hour} value={hour.toString()}>
                              {`${hour.toString().padStart(2, "0")}:00`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Horário que você termina de atender (salvo automaticamente)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div>
                <FormField
                  control={form.control}
                  name="workingDays"
                  render={({ field }) => {
                    // Converte a string de dias para array de números
                    const selectedDays = field.value ? field.value.split(',').map(day => parseInt(day.trim())) : [];
                    
                    // Função auxiliar para atualizar os dias selecionados
                    const updateSelectedDays = (day: number, checked: boolean) => {
                      const newSelectedDays = checked
                        ? [...selectedDays, day].sort((a, b) => a - b)
                        : selectedDays.filter(d => d !== day);
                      
                      const newWorkingDays = newSelectedDays.join(',');
                      
                      // Atualiza o valor do campo com a nova string de dias
                      field.onChange(newWorkingDays);
                      
                      // Salvar automaticamente
                      updateWorkingDays.mutate(newWorkingDays);
                    };
                    
                    return (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Dias de trabalho</FormLabel>
                          <FormDescription>
                            Selecione os dias da semana em que você trabalha (salvos automaticamente)
                          </FormDescription>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                          {[
                            { value: 1, label: "Segunda" },
                            { value: 2, label: "Terça" },
                            { value: 3, label: "Quarta" },
                            { value: 4, label: "Quinta" },
                            { value: 5, label: "Sexta" },
                            { value: 6, label: "Sábado" },
                            { value: 7, label: "Domingo" }
                          ].map((day) => (
                            <FormItem 
                              key={day.value}
                              className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={selectedDays.includes(day.value)}
                                  onCheckedChange={(checked) => updateSelectedDays(day.value, checked as boolean)}
                                  disabled={updateWorkingDays.isPending}
                                />
                              </FormControl>
                              <div className="flex items-center gap-2">
                                <FormLabel className="font-normal cursor-pointer">
                                  {day.label}
                                </FormLabel>
                                {updateWorkingDays.isPending && (
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                )}
                              </div>
                            </FormItem>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
              </div>

              <div className="mt-8">
                <div className="mb-6">
                  <h3 className="text-lg font-medium">Informações de Contato</h3>
                  <p className="text-sm text-gray-500">
                    Configure suas informações de contato para clientes
                  </p>
                </div>

                <Separator className="mb-6" />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => {
                    // Depurar o valor do campo
                    console.log("Valor do campo phone na renderização:", field.value);
                    
                    return (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center border rounded-md p-3 bg-muted/30">
                            <Phone className="h-4 w-4 mr-3 text-gray-500" />
                            <span className="text-sm">
                              {provider && provider.phone ? (
                                // Usar o número diretamente do provedor para garantir que esteja correto
                                (() => {
                                  const phone = provider.phone;
                                  // Se o número já estiver formatado, exibir como está
                                  if (phone.includes('(') && phone.includes(')')) {
                                    return phone;
                                  }
                                  // Se começar com +55, remover o código do país
                                  if (phone.startsWith('+55')) {
                                    return formatPhoneNumber(phone.substring(3));
                                  }
                                  // Se começar com 55 (sem o +), remover o código do país
                                  if (phone.startsWith('55') && phone.length > 10) {
                                    return formatPhoneNumber(phone.substring(2));
                                  }
                                  // Outros casos, formatar normalmente
                                  return formatPhoneNumber(phone);
                                })()
                              ) : (
                                <span className="text-muted-foreground italic">Não configurado</span>
                              )}
                            </span>
                          </div>
                          <WhatsAppPopup 
                            triggerManually 
                            initialPhone={field.value || ''}
                            onPhoneUpdate={(phone) => {
                              // Atualizar o campo de telefone no formulário quando o número for alterado no popup
                              field.onChange(phone);
                              // Marcar o campo como tocado para que o formulário saiba que foi alterado
                              form.setValue('phone', phone, { shouldDirty: true, shouldTouch: true });
                            }}
                          >
                            <Button 
                              type="button" 
                              variant="outline" 
                              className="flex items-center gap-1"
                              title="Configurar WhatsApp"
                            >
                              <Smartphone className="h-4 w-4" />
                              <span className="hidden md:inline">Configurar WhatsApp</span>
                            </Button>
                          </WhatsAppPopup>
                        </div>
                        <FormDescription>
                          Número de WhatsApp para contato com clientes. Este número será usado para que os clientes
                          possam entrar em contato caso precisem remarcar ou cancelar agendamentos.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <div className="mt-8">
                <div className="mb-6">
                  <h3 className="text-lg font-medium">Templates de Mensagens WhatsApp</h3>
                  <p className="text-sm text-gray-500">
                    Personalize as mensagens enviadas automaticamente para seus clientes
                  </p>
                </div>

                <Separator className="mb-6" />

                <FormField
                  control={form.control}
                  name="whatsappTemplateAppointment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmação de Agendamento</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Mensagem de confirmação de agendamento"
                          {...field}
                          className="font-mono text-sm"
                        />
                      </FormControl>
                      <FormDescription>
                        Mensagem enviada ao cliente quando um agendamento é confirmado. Você pode usar as seguintes variáveis:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                          <li><code className="bg-gray-100 px-1 rounded">{'{cliente}'}</code> - Nome do cliente</li>
                          <li><code className="bg-gray-100 px-1 rounded">{'{data}'}</code> - Data do agendamento</li>
                          <li><code className="bg-gray-100 px-1 rounded">{'{hora}'}</code> - Horário do agendamento</li>
                          <li><code className="bg-gray-100 px-1 rounded">{'{serviço}'}</code> - Nome do serviço</li>
                        </ul>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Seção de Configurações de Pagamento PIX */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Configurações de Pagamento PIX</CardTitle>
          <CardDescription>
            Configure o recebimento de pagamentos via PIX
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="pixEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Habilitar pagamento via PIX</FormLabel>
                      <FormDescription>
                        Ative para permitir que seus clientes paguem via PIX ao agendar
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

              {form.watch("pixEnabled") && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="pixKeyType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Chave PIX</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <div className="flex items-center">
                                  <CreditCard className="h-4 w-4 mr-2 text-gray-400" />
                                  <SelectValue placeholder="Selecione o tipo de chave" />
                                </div>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CPF">CPF</SelectItem>
                              <SelectItem value="CNPJ">CNPJ</SelectItem>
                              <SelectItem value="EMAIL">E-mail</SelectItem>
                              <SelectItem value="TELEFONE">Telefone</SelectItem>
                              <SelectItem value="ALEATORIA">Chave Aleatória</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Selecione o tipo de chave PIX que você utiliza
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="pixKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave PIX</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Informe sua chave PIX"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Chave PIX para recebimento dos pagamentos
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="pixCompanyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome no Recebimento</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Seu nome ou nome da empresa"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Nome que será exibido para o cliente durante o pagamento
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pixRequirePayment"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Exigir pagamento antecipado</FormLabel>
                          <FormDescription>
                            Ative para exigir que o cliente pague ao agendar para garantir a reserva
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
                    control={form.control}
                    name="pixPaymentPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Porcentagem de Pagamento</FormLabel>
                        <div className="flex items-center space-x-4">
                          <FormControl className="flex-1">
                            <div className="relative rounded-md">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Percent className="h-4 w-4 text-gray-400" />
                              </div>
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                placeholder="100"
                                className="pl-10"
                                {...field}
                              />
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-gray-500">%</span>
                              </div>
                            </div>
                          </FormControl>
                        </div>
                        <FormDescription>
                          Porcentagem do valor do serviço que o cliente deve pagar antecipadamente (100% = pagamento total)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator className="my-6" />
                  <h3 className="text-lg font-medium mb-2">Configurações do Mercado Pago</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Configure seu token de acesso do Mercado Pago para processar pagamentos PIX.
                  </p>

                  <FormField
                    control={form.control}
                    name="pixMercadoPagoToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token de Acesso do Mercado Pago</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="APP_USR-0000000000000000-000000-00000000000000000000000000000000-000000000"
                            type="password"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Token de acesso para processar pagamentos (começa com APP_USR-). Obtenha em mercadopago.com.br/developers
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pixIdentificationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF/CNPJ para identificação</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="00000000000"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          CPF ou CNPJ usado para identificação no Mercado Pago (apenas números)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar configurações de PIX"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Seção de Períodos Indisponíveis */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Períodos Indisponíveis</CardTitle>
          <CardDescription>
            Configure horários em que você não estará disponível para atendimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimeExclusionManager />
        </CardContent>
      </Card>

      {/* Seção de notificações com botão de teste */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Som de Notificação</CardTitle>
          <CardDescription>
            Configure e teste o som de notificação para novos agendamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              Quando um novo agendamento for recebido, você ouvirá um som de notificação. 
              Clique no botão abaixo para testar o som.
            </p>
            <div>
              <Button 
                onClick={() => {
                  // Importar dinamicamente o módulo para garantir que está atualizado
                  import('@/lib/notification-sound').then(module => {
                    const success = module.playNotificationSound();
                    if (success) {
                      toast({
                        title: "Som de notificação",
                        description: "O som de notificação foi reproduzido com sucesso",
                      });
                    } else {
                      toast({
                        title: "Erro",
                        description: "Não foi possível reproduzir o som. Verifique se o áudio está habilitado no navegador.",
                        variant: "destructive"
                      });
                    }
                  });
                }}
                variant="outline"
                className="flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
                Testar som de notificação
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Popup de confirmação para mudança para conta empresa */}
      <Dialog open={showCompanyConfirmDialog} onOpenChange={setShowCompanyConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Confirmar Mudança para Conta Empresa
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>
                Você está prestes a alterar sua conta de <strong>Individual</strong> para <strong>Empresa</strong>.
              </p>
              <p className="text-amber-600 font-medium">
                ⚠️ Esta alteração é <u>definitiva e irreversível</u>
              </p>
              <p>
                Após a mudança, você não poderá mais voltar para conta individual e terá acesso às funcionalidades de gestão de equipe.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm font-medium">
                  💼 <strong>Importante:</strong> Contas empresariais possuem planos específicos com preços diferenciados para atender às necessidades de gestão de equipe.
                </p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const phoneNumber = "5511984704925";
                      const message = "Olá. Gostaria de saber mais sobre os planos empresariais do Meu Agendamento PRO.";
                      const encodedMessage = encodeURIComponent(message);
                      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
                      window.open(whatsappUrl, "_blank");
                    }}
                    className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-900 font-medium text-sm underline"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Entre em contato via WhatsApp
                  </button>
                </div>
              </div>
              <p>
                Tem certeza que deseja continuar?
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 pt-4">
            <Button 
              onClick={confirmCompanyAccountChange}
              className="flex-1"
              disabled={updateAccountType.isPending}
            >
              {updateAccountType.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Salvando...
                </div>
              ) : (
                "Sim, alterar para Empresa"
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={cancelCompanyAccountChange}
              className="flex-1"
              disabled={updateAccountType.isPending}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
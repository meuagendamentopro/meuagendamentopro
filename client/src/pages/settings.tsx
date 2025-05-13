import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/layout/page-header";
import { Clock, Calendar, Phone, Smartphone, CreditCard, DollarSign, Percent } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import WhatsAppPopup from "@/components/whatsapp-popup";
import { TimeExclusionManager } from "@/components/time-exclusions/time-exclusion-manager";
import { Switch } from "@/components/ui/switch";

// Schema para validação do formulário
const settingsFormSchema = z.object({
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    },
  });

  // Atualizar o formulário quando os dados do provedor forem carregados
  React.useEffect(() => {
    if (provider) {
      console.log("Carregando dados do provedor para o formulário:", {
        id: provider.id,
        hasMercadoPagoToken: !!provider.pixMercadoPagoToken,
        hasIdentificationNumber: !!provider.pixIdentificationNumber,
        pixEnabled: provider.pixEnabled,
      });
      
      form.reset({
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
      });
    }
  }, [provider, form]);

  // Mutation para atualizar as configurações
  const updateSettings = useMutation({
    mutationFn: async (data: SettingsFormValues) => {
      if (!provider || !provider.id) {
        throw new Error("Dados do provedor não disponíveis");
      }
      
      console.log(`Atualizando configurações para provider ID ${provider.id}:`, data);
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="workingHoursStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de início</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-gray-400" />
                              <SelectValue placeholder="Selecione o horário" />
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
                        Horário que você começa a atender
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
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-gray-400" />
                              <SelectValue placeholder="Selecione o horário" />
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
                        Horário que você termina de atender
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
                      
                      // Atualiza o valor do campo com a nova string de dias
                      field.onChange(newSelectedDays.join(','));
                    };
                    
                    return (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Dias de trabalho</FormLabel>
                          <FormDescription>
                            Selecione os dias da semana em que você trabalha
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
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {day.label}
                              </FormLabel>
                            </FormItem>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
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
                    // Formatar o número de telefone
                    const formatPhone = (value: string) => {
                      // Remove tudo que não for número
                      const numbers = value.replace(/\D/g, '');
                      
                      // Aplica formatação de acordo com o tamanho
                      if (numbers.length <= 2) {
                        return numbers;
                      }
                      if (numbers.length <= 6) {
                        return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
                      }
                      if (numbers.length === 10) {
                        // Para números com 10 dígitos (sem o 9) - formato antigo ou telefone fixo
                        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6, 10)}`;
                      }
                      if (numbers.length >= 11) {
                        // Para números com 11 dígitos (com o 9) - formato celular Brasil
                        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
                      }
                      // Para números incompletos com mais de 6 dígitos
                      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
                    };

                    return (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl className="flex-1">
                            <div className="relative flex items-center">
                              <Phone className="h-4 w-4 absolute left-3 text-gray-400" />
                              <Input 
                                placeholder="(99) 99999-9999"
                                className="pl-10"
                                value={formatPhone(field.value || '')}
                                onChange={(e) => {
                                  field.onChange(e.target.value);
                                }}
                              />
                            </div>
                          </FormControl>
                          <WhatsAppPopup triggerManually>
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
    </div>
  );
};

export default SettingsPage;
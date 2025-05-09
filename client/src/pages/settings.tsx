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
import { Clock, Calendar, Phone, Smartphone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import WhatsAppPopup from "@/components/whatsapp-popup";

// Schema para validação do formulário
const settingsFormSchema = z.object({
  workingHoursStart: z.coerce.number().int().min(0).max(23),
  workingHoursEnd: z.coerce.number().int().min(1).max(24),
  workingDays: z.string(),
  phone: z.string().optional(),
}).refine(data => data.workingHoursEnd > data.workingHoursStart, {
  message: "O horário de término deve ser maior que o horário de início",
  path: ["workingHoursEnd"]
});

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
    },
  });

  // Atualizar o formulário quando os dados do provedor forem carregados
  React.useEffect(() => {
    if (provider) {
      form.reset({
        workingHoursStart: provider.workingHoursStart || 8,
        workingHoursEnd: provider.workingHoursEnd || 18,
        workingDays: provider.workingDays || "1,2,3,4,5",
        phone: provider.phone || "",
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
                      if (numbers.length <= 10) {
                        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
                      }
                      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
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
    </div>
  );
};

export default SettingsPage;
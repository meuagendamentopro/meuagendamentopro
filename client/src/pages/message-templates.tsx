import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, MessageCircle, Save } from "lucide-react";

// Definição do schema para templates de mensagens
const messageTemplateSchema = z.object({
  newAppointmentTemplate: z.string().min(1, { message: "O template de novo agendamento é obrigatório" }),
  reminderTemplate: z.string().min(1, { message: "O template de lembrete é obrigatório" }),
  cancellationTemplate: z.string().min(1, { message: "O template de cancelamento é obrigatório" }),
});

type MessageTemplateFormValues = z.infer<typeof messageTemplateSchema>;

const MessageTemplatesPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("new");
  
  // Buscar templates existentes
  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/message-templates"],
    queryFn: async () => {
      const response = await fetch("/api/message-templates");
      if (!response.ok) {
        throw new Error("Falha ao carregar templates de mensagem");
      }
      return response.json();
    },
  });

  // Formulário com valores padrão
  const form = useForm<MessageTemplateFormValues>({
    resolver: zodResolver(messageTemplateSchema),
    defaultValues: {
      newAppointmentTemplate: templates?.newAppointmentTemplate || "Olá {clientName}, sua reserva para {serviceName} foi confirmada para o dia {appointmentDate} às {appointmentTime}. Agradecemos por agendar conosco! {businessName}",
      reminderTemplate: templates?.reminderTemplate || "Olá {clientName}, estamos enviando este lembrete para o seu agendamento de {serviceName} hoje às {appointmentTime}. Estamos ansiosos para recebê-lo! {businessName}",
      cancellationTemplate: templates?.cancellationTemplate || "Olá {clientName}, informamos que seu agendamento para {serviceName} no dia {appointmentDate} às {appointmentTime} foi cancelado. Entre em contato caso queira reagendar! {businessName}",
    },
    values: templates || undefined,
  });

  // Atualiza os valores do formulário quando os templates são carregados
  React.useEffect(() => {
    if (templates) {
      form.reset(templates);
    }
  }, [templates, form]);

  // Mutação para salvar templates
  const { mutate: saveTemplates, isPending: isSaving } = useMutation({
    mutationFn: async (data: MessageTemplateFormValues) => {
      const response = await apiRequest("POST", "/api/message-templates", data);
      if (!response.ok) {
        throw new Error("Falha ao salvar templates");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Templates salvos",
        description: "Os templates de mensagem foram salvos com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MessageTemplateFormValues) => {
    saveTemplates(data);
  };

  // Lista de variáveis disponíveis
  const availableVariables = [
    { name: "{clientName}", description: "Nome do cliente" },
    { name: "{serviceName}", description: "Nome do serviço" },
    { name: "{appointmentDate}", description: "Data do agendamento" },
    { name: "{appointmentTime}", description: "Horário do agendamento" },
    { name: "{providerName}", description: "Nome do profissional" },
  ];

  return (
    <div className="container mx-auto py-6">
      <PageHeader
        title="Templates de Mensagens"
        description="Configure os modelos de mensagens enviadas via WhatsApp"
        icon={<MessageCircle className="h-6 w-6" />}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Templates de Mensagens WhatsApp</CardTitle>
          <CardDescription>
            Personalize as mensagens enviadas aos seus clientes via WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Variáveis disponíveis</AlertTitle>
            <AlertDescription>
              <p className="mb-2">Use estas variáveis para personalizar suas mensagens:</p>
              <ul className="list-disc pl-5 space-y-1">
                {availableVariables.map((variable) => (
                  <li key={variable.name}>
                    <code className="bg-muted px-1 py-0.5 rounded">{variable.name}</code>: {variable.description}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-3 mb-6">
                  <TabsTrigger value="new">Novo Agendamento</TabsTrigger>
                  <TabsTrigger value="reminder">Lembrete</TabsTrigger>
                  <TabsTrigger value="cancellation">Cancelamento</TabsTrigger>
                </TabsList>
                
                <TabsContent value="new">
                  <FormField
                    control={form.control}
                    name="newAppointmentTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template de Novo Agendamento</FormLabel>
                        <FormDescription>
                          Mensagem enviada quando um novo agendamento é criado
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Digite a mensagem para novos agendamentos"
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="mt-4 p-4 border rounded-md bg-muted/40">
                    <h4 className="font-medium mb-2">Prévia:</h4>
                    <div className="whitespace-pre-line">
                      {form.watch("newAppointmentTemplate")
                        .replace("{clientName}", "Maria")
                        .replace("{serviceName}", "Corte de Cabelo")
                        .replace("{appointmentDate}", "15/05/2025")
                        .replace("{appointmentTime}", "14:30")
                        .replace("{businessName}", "Salão da Beleza")}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="reminder">
                  <FormField
                    control={form.control}
                    name="reminderTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template de Lembrete</FormLabel>
                        <FormDescription>
                          Mensagem enviada como lembrete algumas horas antes do agendamento
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Digite a mensagem de lembrete"
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="mt-4 p-4 border rounded-md bg-muted/40">
                    <h4 className="font-medium mb-2">Prévia:</h4>
                    <div className="whitespace-pre-line">
                      {form.watch("reminderTemplate")
                        .replace("{clientName}", "Maria")
                        .replace("{serviceName}", "Corte de Cabelo")
                        .replace("{appointmentDate}", "15/05/2025")
                        .replace("{appointmentTime}", "14:30")
                        .replace("{businessName}", "Salão da Beleza")}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="cancellation">
                  <FormField
                    control={form.control}
                    name="cancellationTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Template de Cancelamento</FormLabel>
                        <FormDescription>
                          Mensagem enviada quando um agendamento é cancelado
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="Digite a mensagem de cancelamento"
                            className="min-h-[150px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="mt-4 p-4 border rounded-md bg-muted/40">
                    <h4 className="font-medium mb-2">Prévia:</h4>
                    <div className="whitespace-pre-line">
                      {form.watch("cancellationTemplate")
                        .replace("{clientName}", "Maria")
                        .replace("{serviceName}", "Corte de Cabelo")
                        .replace("{appointmentDate}", "15/05/2025")
                        .replace("{appointmentTime}", "14:30")
                        .replace("{businessName}", "Salão da Beleza")}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isSaving ? "Salvando..." : "Salvar Templates"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MessageTemplatesPage;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import PageHeader from "@/components/layout/page-header";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

// Definir esquema de validação
const testMessageSchema = z.object({
  phone: z
    .string()
    .min(10, "Número de telefone deve ter pelo menos 10 dígitos")
    .max(20, "Número de telefone muito longo"),
  message: z
    .string()
    .min(1, "Mensagem não pode estar vazia")
    .max(1600, "Mensagem muito longa (máximo 1600 caracteres)"),
});

type TestMessageValues = z.infer<typeof testMessageSchema>;

export default function WhatsappDirectTestPage() {
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    sid?: string;
  } | null>(null);

  const { toast } = useToast();

  // Configuração do formulário com validação
  const form = useForm<TestMessageValues>({
    resolver: zodResolver(testMessageSchema),
    defaultValues: {
      phone: "",
      message: "Esta é uma mensagem de teste do sistema de agendamento. Se você recebeu, significa que a configuração de WhatsApp está funcionando corretamente.",
    },
  });

  // Mutação para enviar a mensagem de teste
  const sendMessageMutation = useMutation({
    mutationFn: async (data: TestMessageValues) => {
      const response = await apiRequest("POST", "/api/whatsapp/test-send", data);
      return response.json();
    },
    onSuccess: (data) => {
      setSendResult(data);
      
      toast({
        title: "Teste enviado",
        description: data.success
          ? "Mensagem enviada com sucesso. Verifique o celular informado."
          : "Erro ao enviar mensagem. Verifique as configurações do Twilio.",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro no envio",
        description: "Ocorreu um erro ao tentar enviar a mensagem de teste. Verifique as configurações.",
        variant: "destructive",
      });
      
      setSendResult({
        success: false,
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
    },
  });

  // Função de envio do formulário
  const onSubmit = (data: TestMessageValues) => {
    sendMessageMutation.mutate(data);
  };

  return (
    <div className="container py-8">
      <PageHeader
        title="Teste Direto de WhatsApp"
        description="Envie uma mensagem de teste para verificar se suas configurações estão funcionando"
      >
        <Button asChild variant="outline">
          <Link href="/settings">Voltar para Configurações</Link>
        </Button>
      </PageHeader>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Enviar Mensagem de Teste</CardTitle>
          <CardDescription>
            Utilize este recurso para verificar se suas configurações de WhatsApp estão funcionando corretamente.
            O número informado receberá uma mensagem diretamente através do Twilio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Telefone</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Digite o número de telefone (ex: +5511999999999)" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Digite a mensagem a ser enviada" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={sendMessageMutation.isPending}
                className="w-full md:w-auto"
              >
                {sendMessageMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar Mensagem de Teste"
                )}
              </Button>
            </form>
          </Form>

          {sendResult && (
            <div className={`mt-6 p-4 rounded-md ${sendResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <h3 className={`text-lg font-semibold ${sendResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {sendResult.success ? 'Mensagem Enviada com Sucesso' : 'Erro no Envio'}
              </h3>
              <p className={`mt-1 ${sendResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {sendResult.message}
              </p>
              {sendResult.sid && (
                <p className="mt-2 text-sm text-gray-600">
                  ID da mensagem: <code className="px-1 py-0.5 bg-gray-100 rounded">{sendResult.sid}</code>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
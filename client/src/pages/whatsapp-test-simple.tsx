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
import { Link } from "wouter";

// Esquema de validação simples
const testMessageSchema = z.object({
  phone: z.string().min(1, "Número de telefone é obrigatório"),
});

type TestMessageValues = z.infer<typeof testMessageSchema>;

export default function WhatsappSimpleTestPage() {
  const { toast } = useToast();
  const [result, setResult] = useState<any | null>(null);

  // Form
  const form = useForm<TestMessageValues>({
    resolver: zodResolver(testMessageSchema),
    defaultValues: {
      phone: "",
    },
  });

  // Mutation para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async (data: TestMessageValues) => {
      const response = await fetch('/api/notification-settings', {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Erro ao obter configurações');
      }
      
      const settings = await response.json();
      console.log('Configurações obtidas:', settings);
      
      const result = {
        settings,
        enableWhatsApp: settings.enableWhatsApp,
        hasSid: !!settings.accountSid,
        hasToken: !!settings.authToken,
        hasPhone: !!settings.phoneNumber,
        phone: data.phone
      };
      
      return result;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Teste concluído",
        description: "Verificação de configurações realizada com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: `Erro ao realizar teste: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TestMessageValues) => {
    sendMessageMutation.mutate(data);
  };

  return (
    <div className="container py-8">
      <PageHeader
        title="Teste Simples de WhatsApp"
        description="Verificação básica de configurações"
      >
        <Button asChild variant="outline">
          <Link href="/settings">Voltar para Configurações</Link>
        </Button>
      </PageHeader>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Verificar Configurações</CardTitle>
          <CardDescription>
            Esta é uma ferramenta simples para verificar se as configurações do WhatsApp estão ativas.
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
                      <Input placeholder="Ex: +5511999999999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={sendMessageMutation.isPending}
              >
                {sendMessageMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar Configurações"
                )}
              </Button>
            </form>
          </Form>

          {result && (
            <div className="mt-6 p-4 border rounded-md">
              <h3 className="font-medium text-lg mb-2">Resultado da Verificação</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium">WhatsApp Ativado:</div>
                <div>{result.enableWhatsApp ? 'Sim' : 'Não'}</div>
                <div className="font-medium">Account SID:</div>
                <div>{result.hasSid ? 'Configurado' : 'Não configurado'}</div>
                <div className="font-medium">Auth Token:</div>
                <div>{result.hasToken ? 'Configurado' : 'Não configurado'}</div>
                <div className="font-medium">Número Twilio:</div>
                <div>{result.hasPhone ? 'Configurado' : 'Não configurado'}</div>
                <div className="font-medium">Número de Teste:</div>
                <div>{result.phone}</div>
              </div>
              
              <div className="mt-4">
                <p className="text-sm font-medium">Diagnóstico:</p>
                <p className="text-sm mt-1">
                  {result.enableWhatsApp && result.hasSid && result.hasToken && result.hasPhone 
                    ? 'As configurações do WhatsApp parecem estar corretas. O problema pode estar na conta Twilio ou no número do destinatário.' 
                    : 'Há problemas com as configurações do WhatsApp. Verifique se todas as configurações estão corretas.'
                  }
                </p>
                {result.enableWhatsApp && result.hasSid && result.hasToken && result.hasPhone && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                    <p className="font-medium">Para contas Twilio Sandbox (teste/desenvolvimento):</p>
                    <ol className="list-decimal ml-4 mt-1 space-y-1">
                      <li>O cliente precisa enviar "join [palavra-código]" para o número Twilio</li>
                      <li>A palavra-código está disponível no painel do Twilio</li>
                      <li>O cliente só receberá mensagens depois de enviar essa palavra</li>
                      <li>O prazo para envio de mensagens é limitado após o cliente enviar a palavra</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
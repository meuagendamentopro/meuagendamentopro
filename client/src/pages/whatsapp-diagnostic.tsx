import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Redirect, Link } from "wouter";
import PageHeader from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Info,
  AlertTriangle 
} from "lucide-react";

// Schema para validação do formulário
const diagnosticFormSchema = z.object({
  phone: z
    .string()
    .min(10, "Número de telefone deve ter pelo menos 10 dígitos")
    .max(20, "Número de telefone muito longo"),
});

type DiagnosticFormValues = z.infer<typeof diagnosticFormSchema>;

// Interface para resultados do diagnóstico
interface DiagnosticResult {
  success: boolean;
  message: string;
  diagnosticResults: {
    provider: {
      id: number;
      name: string;
      hasPhone: boolean;
    };
    phone: {
      input: string;
      formatted: string;
    };
    settings: {
      enableWhatsApp: boolean;
      hasAccountSid: boolean;
      hasAuthToken: boolean;
      hasPhoneNumber: boolean;
    } | null;
    twilioConnection: boolean;
    messageSent: boolean;
    messageResult: {
      sid: string;
      status: string;
      errorCode: string | null;
      errorMessage: string | null;
    } | null;
    errors: Array<{
      stage: string;
      message: string;
      code?: string;
      statusCode?: number;
      moreInfo?: string;
      details?: any;
    }>;
  };
}

// Componente principal
export default function WhatsAppDiagnosticPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar os dados do provider para o usuário atual
  const {
    data: provider,
    isLoading: isProviderLoading,
  } = useQuery({
    queryKey: ["/api/my-provider"],
    enabled: !!user,
  });

  // Configuração do formulário com validação
  const form = useForm<DiagnosticFormValues>({
    resolver: zodResolver(diagnosticFormSchema),
    defaultValues: {
      phone: "",
    },
  });

  // Função de submissão do formulário
  const onSubmit = async (data: DiagnosticFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/whatsapp/diagnostic", data);
      const result = await response.json();
      
      setDiagnosticResult(result);
      
      toast({
        title: result.success ? "Teste concluído com sucesso" : "Teste concluído com problemas",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error("Erro no diagnóstico:", error);
      toast({
        title: "Erro no diagnóstico",
        description: "Ocorreu um erro ao executar o teste de diagnóstico. Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verifica se está carregando
  if (isAuthLoading || isProviderLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redireciona para login se não estiver autenticado
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // Redireciona para página principal se não for um provider
  if (!provider) {
    return <Redirect to="/" />;
  }

  return (
    <div className="container py-8">
      <PageHeader
        title="Diagnóstico de WhatsApp"
        description="Ferramenta para diagnosticar problemas com o envio de mensagens WhatsApp"
      >
        <Button asChild variant="outline">
          <Link href="/settings">Voltar para Configurações</Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Executar Diagnóstico</CardTitle>
            <CardDescription>
              Esta ferramenta enviará uma mensagem de teste e analisará o resultado para ajudar a identificar problemas na integração com WhatsApp.
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

                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full md:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executando diagnóstico...
                    </>
                  ) : (
                    "Executar Diagnóstico"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {diagnosticResult && (
          <Card className={`border-2 ${diagnosticResult.success ? 'border-green-200' : 'border-red-200'}`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                {diagnosticResult.success ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
                <CardTitle>
                  {diagnosticResult.success ? 'Diagnóstico concluído com sucesso' : 'Diagnóstico concluído com problemas'}
                </CardTitle>
              </div>
              <CardDescription>
                {diagnosticResult.message}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resultado do provedor */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Informações do Provedor</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">ID:</div>
                  <div>{diagnosticResult.diagnosticResults.provider.id}</div>
                  <div className="font-medium">Nome:</div>
                  <div>{diagnosticResult.diagnosticResults.provider.name}</div>
                  <div className="font-medium">Telefone configurado:</div>
                  <div className="flex items-center">
                    {diagnosticResult.diagnosticResults.provider.hasPhone ? (
                      <><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Sim</>
                    ) : (
                      <><XCircle className="h-4 w-4 text-red-500 mr-2" /> Não</>
                    )}
                  </div>
                </div>
              </div>

              {/* Informações do número formatado */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Informações do Número</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Número informado:</div>
                  <div>{diagnosticResult.diagnosticResults.phone.input}</div>
                  <div className="font-medium">Número formatado para WhatsApp:</div>
                  <div>{diagnosticResult.diagnosticResults.phone.formatted}</div>
                </div>
              </div>

              {/* Configurações do WhatsApp */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Configurações do WhatsApp</h3>
                {diagnosticResult.diagnosticResults.settings ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-medium">WhatsApp habilitado:</div>
                    <div className="flex items-center">
                      {diagnosticResult.diagnosticResults.settings.enableWhatsApp ? (
                        <><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Sim</>
                      ) : (
                        <><XCircle className="h-4 w-4 text-red-500 mr-2" /> Não</>
                      )}
                    </div>
                    <div className="font-medium">Twilio Account SID:</div>
                    <div className="flex items-center">
                      {diagnosticResult.diagnosticResults.settings.hasAccountSid ? (
                        <><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Configurado</>
                      ) : (
                        <><XCircle className="h-4 w-4 text-red-500 mr-2" /> Não configurado</>
                      )}
                    </div>
                    <div className="font-medium">Twilio Auth Token:</div>
                    <div className="flex items-center">
                      {diagnosticResult.diagnosticResults.settings.hasAuthToken ? (
                        <><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Configurado</>
                      ) : (
                        <><XCircle className="h-4 w-4 text-red-500 mr-2" /> Não configurado</>
                      )}
                    </div>
                    <div className="font-medium">Número de telefone Twilio:</div>
                    <div className="flex items-center">
                      {diagnosticResult.diagnosticResults.settings.hasPhoneNumber ? (
                        <><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Configurado</>
                      ) : (
                        <><XCircle className="h-4 w-4 text-red-500 mr-2" /> Não configurado</>
                      )}
                    </div>
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Configurações não disponíveis</AlertTitle>
                    <AlertDescription>
                      Não foi possível recuperar as configurações do WhatsApp para este provedor.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Resultado da conexão */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Conexão com o Twilio</h3>
                <div className="flex items-center">
                  {diagnosticResult.diagnosticResults.twilioConnection ? (
                    <><CheckCircle className="h-5 w-5 text-green-500 mr-2" /> Conexão estabelecida com sucesso</>
                  ) : (
                    <><XCircle className="h-5 w-5 text-red-500 mr-2" /> Falha ao conectar com o Twilio</>
                  )}
                </div>
              </div>

              {/* Resultado do envio */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Resultado do Envio</h3>
                <div className="flex items-center">
                  {diagnosticResult.diagnosticResults.messageSent ? (
                    <><CheckCircle className="h-5 w-5 text-green-500 mr-2" /> Mensagem enviada com sucesso</>
                  ) : (
                    <><XCircle className="h-5 w-5 text-red-500 mr-2" /> Falha ao enviar mensagem</>
                  )}
                </div>

                {diagnosticResult.diagnosticResults.messageResult && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="font-medium">ID da mensagem (SID):</div>
                    <div>{diagnosticResult.diagnosticResults.messageResult.sid}</div>
                    <div className="font-medium">Status:</div>
                    <div>{diagnosticResult.diagnosticResults.messageResult.status}</div>
                    {diagnosticResult.diagnosticResults.messageResult.errorCode && (
                      <>
                        <div className="font-medium">Código de erro:</div>
                        <div>{diagnosticResult.diagnosticResults.messageResult.errorCode}</div>
                      </>
                    )}
                    {diagnosticResult.diagnosticResults.messageResult.errorMessage && (
                      <>
                        <div className="font-medium">Mensagem de erro:</div>
                        <div>{diagnosticResult.diagnosticResults.messageResult.errorMessage}</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Erros encontrados */}
              {diagnosticResult.diagnosticResults.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Erros Encontrados</h3>
                  <div className="space-y-3">
                    {diagnosticResult.diagnosticResults.errors.map((error, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Erro durante: {error.stage}</AlertTitle>
                        <AlertDescription className="space-y-1">
                          <p>{error.message}</p>
                          {error.code && <p className="text-xs">Código: {error.code}</p>}
                          {error.statusCode && <p className="text-xs">Status: {error.statusCode}</p>}
                          {error.moreInfo && <p className="text-xs">Mais informações: {error.moreInfo}</p>}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {/* Recomendações */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Recomendações</h3>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Configuração do Twilio (Sandbox)</AlertTitle>
                  <AlertDescription className="space-y-1 text-sm">
                    <p>Para contas de teste (sandbox) do Twilio:</p>
                    <ol className="list-decimal ml-5 space-y-1">
                      <li>Verifique se os números de telefone de destino estão aprovados no Twilio Sandbox.</li>
                      <li>Os destinatários precisam enviar uma mensagem prévia para o número do Twilio com o código "join" indicado na sua conta.</li>
                      <li>A mensagem precisa ser enviada exatamente para o número no formato "whatsapp:+número" (ex: whatsapp:+5511999999999).</li>
                      <li>Contas sandbox só podem usar o número do Twilio (whatsapp:+14155238886) como remetente.</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </div>

              {/* Link para documentação */}
              <Alert variant="default" className="bg-blue-50">
                <AlertTriangle className="h-4 w-4 text-blue-500" />
                <AlertTitle>Recursos úteis</AlertTitle>
                <AlertDescription className="space-y-1">
                  <p>Consulte a <a href="https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">documentação do Twilio para WhatsApp</a> para mais informações.</p>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
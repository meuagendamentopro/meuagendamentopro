import { useAuth } from "@/hooks/use-auth";
import PageHeader from "@/components/layout/page-header";
import TestWhatsAppSend from "@/components/whatsapp/test-whatsapp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useNavigate } from "wouter";
import { useEffect } from "react";

export default function WhatsAppTestPage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Teste de WhatsApp"
        description="Envie uma mensagem de teste para verificar a configuração do WhatsApp"
        backLink="/profile"
        backLinkText="Voltar para perfil"
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Teste de Notificações WhatsApp</CardTitle>
            <CardDescription>
              Envie uma mensagem de teste para verificar a integração com WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TestWhatsAppSend />
            
            <div className="mt-8 p-4 bg-muted rounded-md">
              <h4 className="font-medium mb-2">Informações importantes:</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  Para contas de teste (sandbox) do Twilio, é necessário primeiro enviar a mensagem
                  de ativação para o número do Twilio conforme instruções abaixo.
                </li>
                <li>
                  A mensagem só será entregue se o número de telefone estiver registrado no sandbox do Twilio.
                </li>
                <li>
                  A maioria dos erros de envio ocorre porque o número não está registrado ou as credenciais
                  do Twilio estão incorretas.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
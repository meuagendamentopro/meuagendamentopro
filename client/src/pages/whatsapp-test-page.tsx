import { useAuth } from "@/hooks/use-auth";
import PageHeader from "@/components/layout/page-header";
import TestWhatsAppSend from "@/components/whatsapp/test-whatsapp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function WhatsAppTestPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/auth");
    }
  }, [user, isLoading, setLocation]);

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
      <div className="flex items-center justify-between">
        <PageHeader
          title="Teste de WhatsApp"
          description="Envie uma mensagem de teste para verificar a configuração do WhatsApp"
        />
        <Button variant="outline" onClick={() => setLocation("/profile")}>
          Voltar para perfil
        </Button>
      </div>

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
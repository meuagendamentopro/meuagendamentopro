import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function TestWhatsAppSend() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Esta é uma mensagem de teste do sistema de agendamentos.");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  async function sendTestMessage() {
    if (!phone.trim()) {
      toast({
        title: "Erro",
        description: "Digite um número de telefone",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSending(true);
      const response = await fetch('/api/test-whatsapp-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: phone,
          message: message
        })
      });

      if (response.ok) {
        toast({
          title: "Mensagem enviada",
          description: "A mensagem de teste foi enviada com sucesso!"
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao enviar mensagem");
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao enviar mensagem de teste",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teste de Envio de WhatsApp</CardTitle>
        <CardDescription>
          Envie uma mensagem de teste para verificar a configuração do WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium">
            Número de telefone (com DDD, formato internacional)
          </label>
          <Input
            id="phone"
            placeholder="+5511999999999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Para contas sandbox do Twilio, o número deve estar registrado enviando a mensagem de ativação.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="message" className="text-sm font-medium">
            Mensagem de teste
          </label>
          <Input
            id="message"
            placeholder="Mensagem de teste"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <Button
          onClick={sendTestMessage}
          disabled={isSending || !phone.trim()}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            "Enviar mensagem de teste"
          )}
        </Button>
        
        <div className="mt-4 p-3 bg-primary/10 rounded-md">
          <h4 className="text-sm font-medium mb-2">Instruções para Sandbox do Twilio</h4>
          <ol className="list-decimal list-inside text-xs space-y-1">
            <li>Salve o número Twilio WhatsApp <strong>+14155238886</strong> nos seus contatos</li>
            <li>Envie a mensagem <strong>join flower</strong> para este número no WhatsApp</li>
            <li>Aguarde a confirmação do sandbox</li>
            <li>Agora seu número está registrado e pode receber as mensagens de teste</li>
            <li>Importante: Use o formato exato com código de país (+5511999999999)</li>
          </ol>
          <div className="mt-2 p-2 bg-green-100 rounded text-xs text-green-800">
            <strong>Atualização:</strong> No ambiente Sandbox do Twilio, o sistema sempre usa o número padrão +14155238886 para enviar mensagens WhatsApp, 
            independentemente do número configurado na sua conta do Twilio. Este é o comportamento normal do Sandbox.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
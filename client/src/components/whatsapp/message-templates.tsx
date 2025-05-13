import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, RefreshCcw } from "lucide-react";

// Modelos de mensagens
const DEFAULT_TEMPLATES = {
  confirmation: 
`Olá {name}!

Seu agendamento com {provider} foi confirmado com sucesso.

*Detalhes do agendamento:*
📅 Data: {date}
⏰ Horário: {time}
✨ Serviço: {service}
💰 Valor: {price}

Para cancelar ou reagendar, entre em contato pelo telefone {phone}.

Obrigado por agendar conosco!`,

  reminder: 
`Olá {name}!

{reminderText}

*Detalhes do agendamento:*
📅 Data: {date}
⏰ Horário: {time}
✨ Serviço: {service}

Por favor, confirme sua presença respondendo esta mensagem.
Para reagendar ou cancelar, entre em contato o quanto antes pelo telefone {phone}.

Estamos ansiosos para recebê-lo(a)!`,

  cancellation: 
`Olá {name}!

Seu agendamento foi cancelado.

*Detalhes do agendamento cancelado:*
📅 Data: {date}
⏰ Horário: {time}
✨ Serviço: {service}

{cancellationReason}

Para fazer um novo agendamento, entre em contato pelo telefone {phone}.

Agradecemos sua compreensão.`,

  reschedule: 
`Olá {name}!

Seu agendamento com {provider} foi remarcado.

*Novo horário:*
📅 Data: {newDate}
⏰ Horário: {newTime}

*Horário anterior:*
📅 Data: {oldDate}
⏰ Horário: {oldTime}

✨ Serviço: {service}

Se este novo horário não for adequado para você, por favor entre em contato pelo telefone {phone}.

Obrigado pela compreensão.`
};

interface MessageTemplatesProps {
  providerId?: number;
}

export default function MessageTemplates({ providerId }: MessageTemplatesProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("confirmation");
  
  // Templates ativos (serão carregados do backend eventualmente)
  const [templates, setTemplates] = useState({
    confirmation: DEFAULT_TEMPLATES.confirmation,
    reminder: DEFAULT_TEMPLATES.reminder,
    cancellation: DEFAULT_TEMPLATES.cancellation,
    reschedule: DEFAULT_TEMPLATES.reschedule
  });

  // Função para salvar os templates (mock por enquanto)
  const saveTemplates = async () => {
    setIsLoading(true);
    try {
      // Aqui implementaremos a chamada à API posteriormente
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular latência
      
      toast({
        title: "Templates salvos",
        description: "Os modelos de mensagem foram atualizados com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar templates:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os modelos de mensagem.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para resetar um template para o padrão
  const resetTemplate = (template: string) => {
    setTemplates({
      ...templates,
      [template]: DEFAULT_TEMPLATES[template as keyof typeof DEFAULT_TEMPLATES]
    });
    
    toast({
      title: "Template restaurado",
      description: "O modelo foi restaurado para o padrão.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modelos de Mensagens WhatsApp</CardTitle>
        <CardDescription>
          Personalize os modelos de mensagens enviadas pelo WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            Use os marcadores abaixo nos seus templates. Eles serão substituídos automaticamente 
            pelos dados reais do agendamento.
          </AlertDescription>
        </Alert>
        
        <div className="flex flex-wrap gap-1 mb-4">
          <Badge variant="outline">&#123;name&#125;</Badge>
          <Badge variant="outline">&#123;provider&#125;</Badge>
          <Badge variant="outline">&#123;date&#125;</Badge>
          <Badge variant="outline">&#123;time&#125;</Badge>
          <Badge variant="outline">&#123;service&#125;</Badge>
          <Badge variant="outline">&#123;price&#125;</Badge>
          <Badge variant="outline">&#123;phone&#125;</Badge>
          <Badge variant="outline">&#123;newDate&#125;</Badge>
          <Badge variant="outline">&#123;newTime&#125;</Badge>
          <Badge variant="outline">&#123;oldDate&#125;</Badge>
          <Badge variant="outline">&#123;oldTime&#125;</Badge>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="confirmation">Confirmação</TabsTrigger>
            <TabsTrigger value="reminder">Lembrete</TabsTrigger>
            <TabsTrigger value="cancellation">Cancelamento</TabsTrigger>
            <TabsTrigger value="reschedule">Reagendamento</TabsTrigger>
          </TabsList>
          
          <TabsContent value="confirmation">
            <div className="space-y-4">
              <Textarea 
                className="min-h-[300px] font-mono text-sm" 
                value={templates.confirmation}
                onChange={(e) => setTemplates({...templates, confirmation: e.target.value})}
              />
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => resetTemplate("confirmation")}
                  type="button"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Restaurar Padrão
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="reminder">
            <div className="space-y-4">
              <Textarea 
                className="min-h-[300px] font-mono text-sm" 
                value={templates.reminder}
                onChange={(e) => setTemplates({...templates, reminder: e.target.value})}
              />
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => resetTemplate("reminder")}
                  type="button"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Restaurar Padrão
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="cancellation">
            <div className="space-y-4">
              <Textarea 
                className="min-h-[300px] font-mono text-sm" 
                value={templates.cancellation}
                onChange={(e) => setTemplates({...templates, cancellation: e.target.value})}
              />
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => resetTemplate("cancellation")}
                  type="button"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Restaurar Padrão
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="reschedule">
            <div className="space-y-4">
              <Textarea 
                className="min-h-[300px] font-mono text-sm" 
                value={templates.reschedule}
                onChange={(e) => setTemplates({...templates, reschedule: e.target.value})}
              />
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => resetTemplate("reschedule")}
                  type="button"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Restaurar Padrão
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="mt-6">
          <Button 
            onClick={saveTemplates}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Salvando..." : "Salvar Modelos de Mensagem"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { MessageCircle, Save, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Variáveis disponíveis para inserir nas mensagens
const AVAILABLE_VARIABLES = [
  { name: "{clientName}", description: "Nome do cliente" },
  { name: "{serviceName}", description: "Nome do serviço" },
  { name: "{appointmentDate}", description: "Data do agendamento" },
  { name: "{appointmentTime}", description: "Horário do agendamento" },
  { name: "{providerName}", description: "Nome do profissional" },
  { name: "{providerPhone}", description: "Telefone do profissional" },
  { name: "{cancellationReason}", description: "Motivo do cancelamento (apenas para mensagens de cancelamento)" },
  { name: "{locationLink}", description: "Link de localização do estabelecimento" },
  { name: "{paymentStatus}", description: "Status do pagamento" },
  { name: "{paymentAmount}", description: "Valor do pagamento" },
];

// Templates padrão para cada tipo de mensagem
const DEFAULT_TEMPLATES = {
  newAppointment: `Olá {clientName}, seu agendamento para {serviceName} foi recebido com sucesso! 
  
📅 Data: {appointmentDate}
⏰ Horário: {appointmentTime}

Aguardamos você!
{providerName}`,
  
  appointmentReminder: `Olá {clientName}, passando para lembrar do seu agendamento para hoje!

📅 Data: {appointmentDate}
⏰ Horário: {appointmentTime}
🧩 Serviço: {serviceName}

Estamos aguardando você!
{providerName}`,
  
  appointmentCancellation: `Olá {clientName}, infelizmente precisamos cancelar seu agendamento para {serviceName} agendado para {appointmentDate} às {appointmentTime}.

Motivo: {cancellationReason}

Por favor, entre em contato para reagendar.
{providerName}`,
  
  appointmentChange: `Olá {clientName}, seu agendamento para {serviceName} foi alterado.

📅 Nova data: {appointmentDate}
⏰ Novo horário: {appointmentTime}

Se tiver alguma dúvida, por favor entre em contato.
{providerName}`,
  
  paymentConfirmation: `Olá {clientName}, confirmamos o recebimento do pagamento de R$ {paymentAmount} para o agendamento de {serviceName} em {appointmentDate} às {appointmentTime}.

Agradecemos e esperamos por você!
{providerName}`
};

interface MessageTemplate {
  type: string;
  title: string;
  template: string;
}

const MessageTemplatesPage: React.FC = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Record<string, string>>({
    newAppointment: "",
    appointmentReminder: "",
    appointmentCancellation: "",
    appointmentChange: "",
    paymentConfirmation: ""
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("newAppointment");
  const [previewData, setPreviewData] = useState({
    clientName: "Maria Silva",
    serviceName: "Corte de cabelo",
    appointmentDate: "15/05/2023",
    appointmentTime: "14:30",
    providerName: "João Cabeleireiro",
    providerPhone: "(11) 99999-9999",
    cancellationReason: "Problemas técnicos",
    locationLink: "https://maps.google.com",
    paymentStatus: "Confirmado",
    paymentAmount: "120,00"
  });

  // Carrega os templates salvos
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await apiRequest("GET", "/api/message-templates");
        const data = await response.json();
        
        // Se não tiver templates salvos, usar os padrões
        if (!data || Object.keys(data).length === 0) {
          setTemplates(DEFAULT_TEMPLATES);
        } else {
          setTemplates(data);
        }
      } catch (error) {
        console.error("Erro ao carregar templates:", error);
        // Em caso de erro, carregar os templates padrão
        setTemplates(DEFAULT_TEMPLATES);
      } finally {
        setLoading(false);
      }
    };
    
    loadTemplates();
  }, []);

  const saveTemplates = async () => {
    try {
      setLoading(true);
      
      await apiRequest("POST", "/api/message-templates", templates);
      
      toast({
        title: "Templates salvos",
        description: "Seus templates de mensagem foram salvos com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar templates:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar seus templates.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetTemplate = (type: string) => {
    setTemplates(prev => ({
      ...prev,
      [type]: DEFAULT_TEMPLATES[type as keyof typeof DEFAULT_TEMPLATES]
    }));
    
    toast({
      title: "Template resetado",
      description: "O template foi restaurado para o padrão.",
    });
  };

  const handleTemplateChange = (type: string, value: string) => {
    setTemplates(prev => ({
      ...prev,
      [type]: value
    }));
  };

  // Substitui as variáveis pelos valores para preview
  const formatPreview = (template: string) => {
    let result = template;
    
    Object.entries(previewData).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, "g");
      result = result.replace(regex, value);
    });
    
    return result;
  };

  // Insere a variável selecionada no template ativo
  const insertVariable = (variable: string) => {
    if (!activeTab) return;
    
    const templateText = templates[activeTab] || "";
    const textarea = document.getElementById(`template-${activeTab}`) as HTMLTextAreaElement;
    
    if (textarea) {
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      
      const newText = 
        templateText.substring(0, startPos) + 
        variable + 
        templateText.substring(endPos);
      
      handleTemplateChange(activeTab, newText);
      
      // Após a mudança, reposiciona o cursor após a variável inserida
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(startPos + variable.length, startPos + variable.length);
      }, 0);
    } else {
      // Se não conseguir obter o elemento, apenas adiciona ao final
      handleTemplateChange(
        activeTab, 
        templateText + variable
      );
    }
  };

  return (
    <div className="container py-6 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Templates de Mensagens</h1>
          <p className="text-muted-foreground mt-2">
            Configure os templates de mensagens enviadas por WhatsApp para seus clientes.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Configurar Templates</CardTitle>
                <CardDescription>
                  Personalize as mensagens enviadas automaticamente para seus clientes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="newAppointment" onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-4">
                    <TabsTrigger value="newAppointment">Novo Agendamento</TabsTrigger>
                    <TabsTrigger value="appointmentReminder">Lembrete</TabsTrigger>
                    <TabsTrigger value="appointmentCancellation">Cancelamento</TabsTrigger>
                    <TabsTrigger value="appointmentChange">Alteração</TabsTrigger>
                    <TabsTrigger value="paymentConfirmation">Pagamento</TabsTrigger>
                  </TabsList>
                  
                  {Object.keys(templates).map((type) => (
                    <TabsContent key={type} value={type} className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label htmlFor={`template-${type}`}>Texto da mensagem:</Label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex items-center text-xs" 
                            onClick={() => resetTemplate(type)}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restaurar padrão
                          </Button>
                        </div>
                        <Textarea
                          id={`template-${type}`}
                          value={templates[type] || ""}
                          onChange={(e) => handleTemplateChange(type, e.target.value)}
                          rows={10}
                          placeholder="Escreva seu template aqui..."
                          className="font-mono text-sm"
                        />
                      </div>
                      
                      <div className="pt-4">
                        <h4 className="font-medium mb-2">Prévia da mensagem:</h4>
                        <div className="bg-green-50 border border-green-200 rounded-md p-4 whitespace-pre-wrap">
                          {formatPreview(templates[type] || "")}
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-6">
                <Button variant="outline" onClick={() => window.history.back()}>
                  Cancelar
                </Button>
                <Button onClick={saveTemplates} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Templates
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Variáveis Disponíveis</CardTitle>
                <CardDescription>
                  Use essas variáveis para personalizar suas mensagens.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {AVAILABLE_VARIABLES.map((variable) => (
                    <div key={variable.name} className="border rounded-lg p-2 bg-gray-50">
                      <div className="flex justify-between items-center">
                        <code className="text-sm font-mono">{variable.name}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => insertVariable(variable.name)}
                        >
                          Inserir
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{variable.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Testar variáveis</CardTitle>
                <CardDescription>
                  Modifique os valores para ver como a mensagem ficará.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="clientName">Nome do cliente</Label>
                    <Input 
                      id="clientName" 
                      value={previewData.clientName}
                      onChange={(e) => setPreviewData({...previewData, clientName: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="serviceName">Nome do serviço</Label>
                    <Input 
                      id="serviceName" 
                      value={previewData.serviceName}
                      onChange={(e) => setPreviewData({...previewData, serviceName: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="appointmentDate">Data</Label>
                    <Input 
                      id="appointmentDate" 
                      value={previewData.appointmentDate}
                      onChange={(e) => setPreviewData({...previewData, appointmentDate: e.target.value})}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="appointmentTime">Horário</Label>
                    <Input 
                      id="appointmentTime" 
                      value={previewData.appointmentTime}
                      onChange={(e) => setPreviewData({...previewData, appointmentTime: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Alert className="mt-4">
              <MessageCircle className="h-4 w-4" />
              <AlertTitle>Dica</AlertTitle>
              <AlertDescription>
                Lembre-se que o WhatsApp suporta formatação básica como *negrito*, _itálico_ e ~tachado~.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
  );
};

export default MessageTemplatesPage;
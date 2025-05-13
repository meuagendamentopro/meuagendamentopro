import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { InfoIcon, MessageSquare } from "lucide-react";
import { Link } from "wouter";

// Tipo para as configurações de notificação
interface WhatsAppSettings {
  enableWhatsApp: boolean;
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  enableAppointmentConfirmation: boolean;
  enableAppointmentReminder: boolean;
  enableCancellationNotice: boolean;
}

export default function WhatsAppSettings() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado local para as configurações
  const [settings, setSettings] = useState<WhatsAppSettings>({
    enableWhatsApp: false,
    accountSid: '',
    authToken: '',
    phoneNumber: '',
    enableAppointmentConfirmation: false,
    enableAppointmentReminder: false,
    enableCancellationNotice: false
  });
  
  // Carregar configurações na inicialização
  useEffect(() => {
    loadSettings();
  }, []);
  
  // Função para carregar configurações do servidor
  async function loadSettings() {
    try {
      setIsLoading(true);
      const response = await fetch('/api/notification-settings');
      if (response.ok) {
        const data = await response.json();
        console.log('Configurações carregadas:', data);
        
        // Atualizar o estado local com os dados recebidos
        setSettings({
          enableWhatsApp: data.enableWhatsApp || false,
          accountSid: data.accountSid || '',
          authToken: data.authToken || '',
          phoneNumber: data.phoneNumber || '',
          enableAppointmentConfirmation: data.enableAppointmentConfirmation || false,
          enableAppointmentReminder: data.enableAppointmentReminder || false,
          enableCancellationNotice: data.enableCancellationNotice || false
        });
      } else {
        console.error('Erro ao carregar configurações:', await response.text());
        toast({
          title: "Erro",
          description: "Não foi possível carregar as configurações de notificação",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao carregar as configurações",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  // Função para salvar configurações
  async function saveSettings() {
    try {
      setIsSaving(true);
      console.log('Salvando configurações:', settings);
      
      const response = await fetch('/api/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        toast({
          title: "Configurações salvas",
          description: "Suas configurações de notificação foram atualizadas com sucesso"
        });
        
        // Recarregar configurações após salvar para confirmar que foram atualizadas
        await loadSettings();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar configurações");
      }
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao salvar configurações",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  }
  
  // Função para testar credenciais do Twilio
  async function testTwilioCredentials() {
    try {
      setIsTesting(true);
      
      const credentials = {
        accountSid: settings.accountSid,
        authToken: settings.authToken,
        phoneNumber: settings.phoneNumber
      };
      
      const response = await fetch('/api/test-twilio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });
      
      if (response.ok) {
        toast({
          title: "Credenciais verificadas",
          description: "Suas credenciais do Twilio foram verificadas com sucesso"
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Falha ao testar credenciais do Twilio");
      }
    } catch (err) {
      console.error('Erro ao testar credenciais:', err);
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao testar credenciais",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  }
  
  // Função para atualizar um campo específico
  function updateField(field: string, value: any) {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  }
  
  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <h3 className="text-base font-medium">Ativar notificações WhatsApp</h3>
          <p className="text-sm text-muted-foreground">
            Ative para enviar lembretes e confirmações de agendamento via WhatsApp
          </p>
        </div>
        <Switch
          checked={settings.enableWhatsApp}
          onCheckedChange={(checked) => updateField('enableWhatsApp', checked)}
        />
      </div>
      
      {settings.enableWhatsApp && (
        <div className="space-y-4 border rounded-lg p-4">
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertTitle>Credenciais necessárias</AlertTitle>
            <AlertDescription>
              Você precisará de uma conta no Twilio para enviar mensagens via WhatsApp. 
              <a 
                href="https://www.twilio.com/try-twilio" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline ml-1"
              >
                Clique aqui para criar uma conta
              </a>.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accountSid">Twilio Account SID</Label>
              <Input 
                id="accountSid"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                value={settings.accountSid}
                onChange={(e) => updateField('accountSid', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O identificador da sua conta no Twilio (começa com "AC")
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="authToken">Twilio Auth Token</Label>
              <Input 
                id="authToken"
                type="password" 
                placeholder="••••••••••••••••••••••••" 
                value={settings.authToken}
                onChange={(e) => updateField('authToken', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O token de autenticação da sua conta no Twilio
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Número de Telefone do Twilio</Label>
              <Input 
                id="phoneNumber"
                placeholder="+14155238886" 
                value={settings.phoneNumber}
                onChange={(e) => updateField('phoneNumber', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                O número de telefone do Twilio no formato internacional (ex: +14155238886)
              </p>
            </div>
            
            <Separator className="my-4" />
            
            <h3 className="font-medium text-base mb-3">Tipos de notificação</h3>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between space-y-0 rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Confirmação de agendamento</Label>
                  <p className="text-xs text-muted-foreground">
                    Enviar confirmação quando um cliente agenda um serviço
                  </p>
                </div>
                <Switch
                  checked={settings.enableAppointmentConfirmation}
                  onCheckedChange={(checked) => updateField('enableAppointmentConfirmation', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between space-y-0 rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Lembrete de agendamento</Label>
                  <p className="text-xs text-muted-foreground">
                    Enviar lembrete 24h antes e no dia do agendamento
                  </p>
                </div>
                <Switch
                  checked={settings.enableAppointmentReminder}
                  onCheckedChange={(checked) => updateField('enableAppointmentReminder', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between space-y-0 rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Notificação de cancelamento</Label>
                  <p className="text-xs text-muted-foreground">
                    Enviar notificação quando um agendamento é cancelado ou remarcado
                  </p>
                </div>
                <Switch
                  checked={settings.enableCancellationNotice}
                  onCheckedChange={(checked) => updateField('enableCancellationNotice', checked)}
                />
              </div>
            </div>
            
            <div className="flex space-x-2 mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={testTwilioCredentials}
                disabled={
                  isTesting || 
                  !settings.accountSid ||
                  !settings.authToken ||
                  !settings.phoneNumber
                }
              >
                {isTesting ? (
                  <>
                    <span className="animate-spin h-4 w-4 mr-2 border-2 border-primary border-t-transparent rounded-full" />
                    Testando...
                  </>
                ) : (
                  "Testar Credenciais"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-between space-x-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          asChild
          disabled={!settings.enableWhatsApp}
        >
          <Link href="/whatsapp-templates">
            <MessageSquare className="h-4 w-4 mr-2" />
            Personalizar Modelos de Mensagens
          </Link>
        </Button>
        <Button 
          type="button" 
          onClick={saveSettings}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <span className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
              Salvando...
            </>
          ) : (
            "Salvar Configurações"
          )}
        </Button>
      </div>
    </div>
  );
}
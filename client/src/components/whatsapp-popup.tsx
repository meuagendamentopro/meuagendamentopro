import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { PhoneInput } from './ui/phone-input';

interface WhatsAppPopupProps {
  triggerManually?: boolean;
  children?: React.ReactNode;
  initialPhone?: string;
  onPhoneUpdate?: (phone: string) => void;
}

const WhatsAppPopup = ({ triggerManually = false, children, initialPhone = '', onPhoneUpdate }: WhatsAppPopupProps) => {
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState(initialPhone);
  const [countryCode, setCountryCode] = useState('BR');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Buscar dados do provider
  const { data: provider, isLoading: isLoadingProvider, error } = useQuery({
    queryKey: ['/api/my-provider'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/my-provider');
        if (!res.ok) {
          if (res.status === 404) {
            // Se o perfil de prestador não existir, retornamos um objeto vazio
            // para que o popup possa ser mostrado e o usuário possa configurar o WhatsApp
            return { id: null, phone: '', name: '', email: '' };
          }
          throw new Error('Falha ao buscar dados do provider');
        }
        return res.json();
      } catch (error) {
        console.error("Erro ao buscar dados do provider:", error);
        // Se houver erro, ainda retornamos um objeto para que o popup possa ser mostrado
        return { id: null, phone: '', name: '', email: '' };
      }
    },
    retry: false, // Não tentar novamente se falhar, já retornamos um objeto vazio
  });

  // Mutation para atualizar o número de WhatsApp
  const updateWhatsAppMutation = useMutation({
    mutationFn: async (phone: string) => {
      if (!provider) {
        throw new Error('Dados do provedor não disponíveis');
      }
      
      if (!provider.id) {
        // Se o provider não tem ID, precisamos criar um novo provider para o usuário atual
        console.log("Criando novo perfil de provider");
        // Primeiro busca os dados do usuário atual
        const userResponse = await fetch('/api/user');
        if (!userResponse.ok) {
          throw new Error('Falha ao buscar dados do usuário');
        }
        const user = await userResponse.json();
        
        // Cria um novo provider
        const createProviderResponse = await apiRequest('POST', '/api/providers', {
          userId: user.id,
          name: `${user.name}'s Services`,
          email: user.email,
          phone: phone,
          bookingLink: `/booking/${user.username}`,
          workingHoursStart: 8,
          workingHoursEnd: 18,
          workingDays: "1,2,3,4,5"
        });
        
        if (!createProviderResponse.ok) {
          throw new Error('Falha ao criar perfil de prestador');
        }
        
        return createProviderResponse;
      }
      
      // Se já tem provider, atualiza o telefone
      // Enviar apenas os campos necessários para não interferir com outros campos do objeto provider
      return apiRequest('PATCH', `/api/providers/${provider.id}/settings`, { 
        phone,
        workingHoursStart: provider.workingHoursStart || 8, 
        workingHoursEnd: provider.workingHoursEnd || 18,
        workingDays: provider.workingDays || "1,2,3,4,5"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-provider'] });
      toast({
        title: 'WhatsApp atualizado',
        description: 'Seu número de WhatsApp foi salvo com sucesso.',
      });
      
      // Notificar o componente pai sobre o número salvo
      if (onPhoneUpdate) {
        onPhoneUpdate(whatsapp);
      }
      
      setSaving(false);
      setOpen(false);
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar WhatsApp:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar seu número de WhatsApp.',
        variant: 'destructive',
      });
      setSaving(false);
    }
  });

  const handlePhoneChange = (value: string) => {
    setWhatsapp(value);
    
    // Notificar o componente pai sobre a alteração do número
    if (onPhoneUpdate) {
      onPhoneUpdate(value);
    }
  };
  
  const handleCountryChange = (country: string) => {
    setCountryCode(country);
  };

  const handleSubmit = () => {
    // O número já vem formatado com o código do país do componente PhoneInput
    // Então não precisamos fazer nenhuma formatação adicional
    
    // Inicia o indicador de salvamento
    setSaving(true);
    
    // Executa a mutação com o número completo, incluindo código do país
    updateWhatsAppMutation.mutate(whatsapp);
  };

  // Verificar se deve mostrar o popup
  useEffect(() => {
    // Se temos um initialPhone, usamos ele
    if (initialPhone) {
      setWhatsapp(initialPhone);
      
      // Se o número já tem código de país, extrair o país
      if (initialPhone.startsWith('+')) {
        // Extrair o código do país do número
        const countryCodeFromPhone = initialPhone.substring(0, 3);
        if (countryCodeFromPhone === '+55') {
          setCountryCode('BR');
        } else if (countryCodeFromPhone === '+1') {
          setCountryCode('US');
        } else if (countryCodeFromPhone === '+34') {
          setCountryCode('ES');
        } else if (countryCodeFromPhone === '+35') {
          setCountryCode('PT');
        }
        // Outros países podem ser adicionados conforme necessário
      }
    }
    // Se não temos initialPhone, usamos o telefone do provider
    else if (provider && provider.phone) {
      setWhatsapp(provider.phone);
      
      // Se o número já tem código de país, extrair o país
      if (provider.phone.startsWith('+')) {
        // Extrair o código do país do número
        const countryCodeFromPhone = provider.phone.substring(0, 3);
        if (countryCodeFromPhone === '+55') {
          setCountryCode('BR');
        } else if (countryCodeFromPhone === '+1') {
          setCountryCode('US');
        } else if (countryCodeFromPhone === '+34') {
          setCountryCode('ES');
        } else if (countryCodeFromPhone === '+35') {
          setCountryCode('PT');
        }
        // Outros países podem ser adicionados conforme necessário
      }
    }
    
    // Se não estiver em modo manual e o provider não tem telefone, mostra o popup automaticamente
    if (provider && !triggerManually && (!provider.phone || provider.phone.trim() === '')) {
      console.log('Provider sem WhatsApp configurado, exibindo popup automaticamente');
      setOpen(true);
    }
  }, [provider, triggerManually, initialPhone]);

  return (
    <Dialog open={triggerManually ? undefined : open} onOpenChange={setOpen}>
      {triggerManually && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center mb-2">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-3">
              <svg 
                viewBox="0 0 24 24" 
                className="w-6 h-6 text-white" 
                fill="currentColor"
              >
                <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.3 1.27.48 1.704.629.714.227 1.365.195 1.88.121.574-.091 1.767-.721 2.016-1.426.255-.705.255-1.29.18-1.425-.074-.135-.27-.21-.57-.345m-5.446 7.443h-.016c-1.77 0-3.524-.48-5.055-1.38l-.36-.214-3.75.975 1.005-3.645-.239-.375a9.869 9.869 0 0 1-1.516-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <DialogTitle className="text-xl">Cadastre seu WhatsApp</DialogTitle>
              <DialogDescription className="mt-1">
                Seus clientes usarão este número para contato
              </DialogDescription>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Informe seu número de WhatsApp para que os clientes possam entrar em contato caso precisem remarcar ou cancelar agendamentos.
          </p>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 items-center gap-4">
            <Label htmlFor="whatsapp" className="font-medium">
              Número de WhatsApp
            </Label>
            <PhoneInput
              id="whatsapp"
              placeholder="(99) 99999-9999"
              className="w-full"
              value={whatsapp}
              onChange={handlePhoneChange}
              defaultCountry={countryCode}
              onCountryChange={handleCountryChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            type="submit" 
            onClick={handleSubmit} 
            disabled={saving || isLoadingProvider}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppPopup;
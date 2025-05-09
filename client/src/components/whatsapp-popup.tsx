import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const WhatsAppPopup = () => {
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const { toast } = useToast();

  // Buscar dados do provider
  const { data: provider } = useQuery({
    queryKey: ['/api/my-provider'],
    queryFn: async () => {
      const res = await fetch('/api/my-provider');
      if (!res.ok) throw new Error('Falha ao buscar dados do provider');
      return res.json();
    }
  });

  // Mutation para atualizar o número de WhatsApp
  const updateWhatsAppMutation = useMutation({
    mutationFn: async (phone: string) => {
      return apiRequest('PATCH', `/api/providers/${provider.id}/settings`, { 
        phone 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-provider'] });
      toast({
        title: 'WhatsApp atualizado',
        description: 'Seu número de WhatsApp foi salvo com sucesso.',
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar seu número de WhatsApp.',
        variant: 'destructive',
      });
    }
  });

  // Formatar o número de telefone
  const formatPhone = (phone: string) => {
    // Remove tudo que não for número
    const numbers = phone.replace(/\D/g, '');
    
    // Aplica formatação de acordo com o tamanho
    if (numbers.length <= 2) {
      return numbers;
    }
    if (numbers.length <= 6) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    }
    if (numbers.length <= 10) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
    }
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWhatsapp(formatPhone(e.target.value));
  };

  const handleSubmit = () => {
    // Remove caracteres não numéricos para salvar apenas números
    const phoneNumbers = whatsapp.replace(/\D/g, '');
    updateWhatsAppMutation.mutate(phoneNumbers);
  };

  // Verificar se deve mostrar o popup
  useEffect(() => {
    if (provider && (!provider.phone || provider.phone.trim() === '')) {
      setOpen(true);
    } else if (provider && provider.phone) {
      // Pre-preenche o campo com o telefone atual formatado
      setWhatsapp(formatPhone(provider.phone));
    }
  }, [provider]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Cadastre seu WhatsApp</DialogTitle>
          <DialogDescription>
            Informe seu número de WhatsApp para que os clientes possam entrar em contato caso precisem remarcar ou cancelar agendamentos.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="whatsapp" className="text-right">
              WhatsApp
            </Label>
            <Input
              id="whatsapp"
              placeholder="(99) 99999-9999"
              className="col-span-3"
              value={whatsapp}
              onChange={handleInputChange}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppPopup;
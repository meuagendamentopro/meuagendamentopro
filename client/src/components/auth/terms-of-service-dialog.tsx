import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";

interface TermsOfServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TermsOfServiceDialog: React.FC<TermsOfServiceDialogProps> = ({
  open,
  onOpenChange,
}) => {
  // Buscar configurações do sistema
  const { data: systemSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const response = await fetch('/api/system-settings');
      if (!response.ok) {
        throw new Error('Erro ao buscar configurações do sistema');
      }
      return response.json();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Termos de Serviço</DialogTitle>
          <DialogDescription>
            Última atualização: 16 de maio de 2025
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="mt-4 pr-4 max-h-[60vh]">
          <div className="space-y-4 text-sm">
            <section>
              <h3 className="font-semibold text-base">1. Introdução</h3>
              <p className="mt-2">
                Bem-vindo ao Meu Agendamento PRO. Estes Termos de Serviço regem o uso do nosso sistema de agendamento online, incluindo nosso site, aplicativos e todos os serviços relacionados (coletivamente, o "Serviço"). Ao acessar ou usar o Serviço, você concorda com estes termos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base">2. Descrição do Serviço</h3>
              <p className="mt-2">
                O Meu Agendamento PRO é uma plataforma completa para profissionais que desejam otimizar sua agenda, automatizar confirmações, receber pagamentos e oferecer uma experiência superior aos seus clientes. Nossos recursos incluem:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Controle total sobre sua agenda de atendimentos</li>
                <li>Recebimento de pagamentos via PIX integrado</li>
                <li>Notificações por WhatsApp</li>
                <li>Link personalizado para seus clientes agendarem</li>
                <li>Histórico completo de clientes e atendimentos</li>
                <li>Relatórios financeiros</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base">3. Conta e Registro</h3>
              <p className="mt-2">
                Para utilizar o Serviço, você deve criar uma conta. Você é responsável por manter a confidencialidade de suas credenciais de login e por todas as atividades que ocorrem em sua conta. Você concorda em fornecer informações precisas e completas durante o processo de registro.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base">4. Período de Teste Gratuito</h3>
              <p className="mt-2">
                Oferecemos um período de teste gratuito de {systemSettings?.trialPeriodDays || 3} dias para novos usuários. Após este período, você precisará assinar um de nossos planos para continuar utilizando o Serviço. Você não será cobrado automaticamente após o período de teste; será necessário escolher um plano e fornecer informações de pagamento.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base">5. Pagamentos e Assinaturas</h3>
              <p className="mt-2">
                Após o período de teste, você pode escolher entre nossos planos de assinatura. Os preços e características de cada plano estão disponíveis em nosso site. Você concorda em pagar todas as taxas associadas ao plano escolhido. Podemos alterar os preços a qualquer momento, mas forneceremos aviso prévio antes de qualquer alteração.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base">6. Cancelamento e Reembolso</h3>
              <p className="mt-2">
                Você pode cancelar sua assinatura a qualquer momento. O cancelamento entrará em vigor no final do período de faturamento atual. Não oferecemos reembolsos para períodos parciais de assinatura.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base">7. Privacidade e Dados do Cliente</h3>
              <p className="mt-2">
                Respeitamos sua privacidade e a de seus clientes. Nossa Política de Privacidade descreve como coletamos, usamos e compartilhamos informações. Ao usar o Serviço, você concorda com nossa Política de Privacidade e reconhece que é responsável por obter o consentimento adequado de seus clientes para o processamento de seus dados.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base">8. Uso Aceitável</h3>
              <p className="mt-2">
                Você concorda em usar o Serviço apenas para fins legais e de acordo com estes Termos. Você não deve:
              </p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Usar o Serviço para qualquer atividade ilegal ou fraudulenta</li>
                <li>Violar quaisquer leis ou regulamentos aplicáveis</li>
                <li>Interferir ou tentar interferir na segurança ou integridade do Serviço</li>
                <li>Coletar informações de outros usuários sem seu consentimento</li>
                <li>Usar o Serviço para enviar spam ou mensagens não solicitadas</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-base">9. Propriedade Intelectual</h3>
              <p className="mt-2">
                O Serviço e todo o seu conteúdo, recursos e funcionalidades são de propriedade do Meu Agendamento PRO e estão protegidos por leis de propriedade intelectual. Você não pode copiar, modificar, distribuir, vender ou alugar qualquer parte do Serviço sem nossa permissão expressa por escrito.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base">10. Limitação de Responsabilidade</h3>
              <p className="mt-2">
                O Serviço é fornecido "como está" e "conforme disponível". Não garantimos que o Serviço será ininterrupto, oportuno, seguro ou livre de erros. Em nenhum caso seremos responsáveis por quaisquer danos indiretos, incidentais, especiais, consequenciais ou punitivos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base">11. Alterações nos Termos</h3>
              <p className="mt-2">
                Podemos modificar estes Termos a qualquer momento. Notificaremos você sobre quaisquer alterações significativas. O uso continuado do Serviço após tais modificações constitui sua aceitação dos novos Termos.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-base">12. Contato</h3>
              <p className="mt-2">
                Se você tiver alguma dúvida sobre estes Termos, entre em contato conosco pelo e-mail suporte@meuagendamentopro.com.br.
              </p>
            </section>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TermsOfServiceDialog;

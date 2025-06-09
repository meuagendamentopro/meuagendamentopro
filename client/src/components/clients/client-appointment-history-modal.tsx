import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, DollarSign, FileText, Loader2 } from "lucide-react";
import { formatDate, formatTime } from "@/lib/dates";
import { formatCurrency } from "@/lib/utils";
import { Client, Appointment, Service } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface ClientAppointmentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
}

interface AppointmentWithDetails extends Appointment {
  serviceName?: string;
  servicePrice?: number;
}

const ClientAppointmentHistoryModal: React.FC<ClientAppointmentHistoryModalProps> = ({
  isOpen,
  onClose,
  client,
}) => {
  const { toast } = useToast();
  
  // Buscar todos os agendamentos
  // Buscar agendamentos do provedor logado
  const { data: allAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ['/api/my-appointments', isOpen],
    queryFn: async () => {
      if (!isOpen) return [];
      try {
        const response = await fetch('/api/my-appointments');
        if (!response.ok) {
          throw new Error('Falha ao carregar agendamentos');
        }
        return response.json();
      } catch (error) {
        console.error("Erro ao buscar agendamentos:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os agendamentos.",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: isOpen,
  });
  
  // Buscar todos os serviços do provedor atual
  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ['/api/my-services', isOpen],
    queryFn: async () => {
      if (!isOpen) return [];
      try {
        // Usamos a rota my-services que retorna os serviços do provedor logado
        const response = await fetch('/api/my-services');
        if (!response.ok) {
          throw new Error('Falha ao carregar serviços');
        }
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os serviços.",
          variant: "destructive",
        });
        return [];
      }
    },
    enabled: isOpen,
  });
  
  // Filtrar apenas os agendamentos do cliente selecionado
  const clientAppointments = allAppointments.filter(
    (appointment) => appointment.clientId === client.id
  );
  
  // Mapear serviços por ID para facilitar o acesso
  const servicesMap = services.reduce<Record<number, Service>>((acc, service) => {
    acc[service.id] = service;
    return acc;
  }, {});
  
  // Adicionar detalhes do serviço a cada agendamento
  const appointments = clientAppointments.map((appointment) => {
    // Converter os IDs para números para garantir comparação correta
    const appointmentServiceId = Number(appointment.serviceId);
    
    // Encontrar o serviço correspondente
    const service = services.find((s) => Number(s.id) === appointmentServiceId);
    
    return {
      ...appointment,
      serviceName: service?.name || "Serviço não encontrado",
      servicePrice: service?.price || 0,
    } as AppointmentWithDetails;
  });
  
  // Calcular o total investido pelo cliente (soma dos valores dos serviços)
  const totalInvestido = appointments.reduce((total, appointment) => {
    // Só considera agendamentos confirmados ou concluídos
    if (appointment.status === 'confirmed' || appointment.status === 'completed') {
      return total + (appointment.servicePrice || 0);
    }
    return total;
  }, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-blue-500">Confirmado</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Concluído</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500">Cancelado</Badge>;
      default:
        return <Badge className="bg-yellow-500">Pendente</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Histórico de Atendimentos - {client?.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Carregando histórico...</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum atendimento encontrado</h3>
            <p className="text-gray-500">
              Este cliente ainda não possui histórico de atendimentos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Total Investido: {formatCurrency(totalInvestido)}
              </h3>
              <p className="text-sm text-blue-600 mt-1">
                Valor total considerando apenas agendamentos confirmados e concluídos
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((appointment: AppointmentWithDetails) => (
                  <TableRow key={appointment.id}>
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                        {formatDate(new Date(appointment.date))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-500" />
                        {formatTime(new Date(appointment.date))}
                      </div>
                    </TableCell>
                    <TableCell>{appointment.serviceName || "Serviço não especificado"}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1 text-gray-500" />
                        {appointment.servicePrice 
                          ? formatCurrency(appointment.servicePrice) 
                          : "Não informado"}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center max-w-[200px] truncate">
                        {appointment.notes ? (
                          <>
                            <FileText className="h-4 w-4 mr-1 text-gray-500 flex-shrink-0" />
                            <span className="truncate" title={appointment.notes}>
                              {appointment.notes}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientAppointmentHistoryModal;
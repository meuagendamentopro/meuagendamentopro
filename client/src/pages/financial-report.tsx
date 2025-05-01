import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Appointment as BaseAppointment, Service, Provider } from "@shared/schema";

// Extend the base appointment type with the properties added by our API
interface EnrichedAppointment extends BaseAppointment {
  clientName: string;
  serviceName: string;
  servicePrice: number;
}

export default function FinancialReport() {
  // Usaremos selectedDate para controlar o dia específico selecionado
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedService, setSelectedService] = useState<string>("all");

  // Obter o provider atual 
  const { data: myProvider, isLoading: isLoadingProvider } = useQuery<Provider>({
    queryKey: ["/api/my-provider"],
  });
  
  const providerId = myProvider?.id;

  // Buscar os agendamentos
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<EnrichedAppointment[]>({
    queryKey: ["/api/providers", providerId, "appointments"],
    enabled: !!providerId,
  });
  
  console.log("Dados de agendamentos recebidos:", appointments);

  // Buscar os serviços
  const { data: services, isLoading: isLoadingServices } = useQuery<Service[]>({
    queryKey: ["/api/providers", providerId, "services"],
    enabled: !!providerId,
  });

  if (isLoadingAppointments || isLoadingServices) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filtrar os agendamentos por mês e APENAS status confirmado/concluído
  const filteredAppointments = appointments?.filter((appointment) => {
    // Garantir que a data seja uma string antes de passar para parseISO
    const dateStr = typeof appointment.date === 'string' 
      ? appointment.date 
      : appointment.date.toISOString();
    const appointmentDate = parseISO(dateStr);
    
    // Verificar se estamos filtrando por dia específico ou por mês inteiro
    // Se o usuário selecionar um dia específico no calendário, filtrar apenas esse dia
    const isSameDay = format(appointmentDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
    
    console.log(`Data do agendamento: ${format(appointmentDate, 'dd/MM/yyyy')}, Data selecionada: ${format(selectedDate, 'dd/MM/yyyy')}, É o mesmo dia? ${isSameDay}`);
    
    // Verificamos se a data está dentro do mês selecionado
    const inInterval = isWithinInterval(appointmentDate, {
      start: startOfMonth(selectedDate),
      end: endOfMonth(selectedDate),
    });
    
    // MUITO IMPORTANTE: Incluir APENAS os agendamentos com status "confirmed" ou "completed"
    // Os agendamentos com status "pending" não devem ser contabilizados financeiramente
    // pois eles ainda podem ser cancelados
    const validStatus = ["confirmed", "completed"].includes(appointment.status.toLowerCase());
    console.log(`Status do agendamento: "${appointment.status}" - É válido? ${validStatus}`);
    
    const validService = (selectedService === "all" || appointment.serviceId === parseInt(selectedService));
    
    console.log(`Analisando agendamento #${appointment.id}:`, {
      data: format(appointmentDate, 'dd/MM/yyyy'),
      noIntervalo: inInterval,
      status: appointment.status,
      statusValido: validStatus,
      servicoSelecionado: selectedService,
      idServico: appointment.serviceId,
      servicoValido: validService,
      preco: appointment.servicePrice
    });
    
    // Se uma data específica foi selecionada no calendário, filtramos pelo dia específico
    // Caso contrário, mostramos todos os agendamentos do mês
    const validDate = isSameDay;
    
    return validDate && validStatus && validService;
  });

  // Calcular o total de receitas
  console.log("Agendamentos filtrados:", filteredAppointments);
  
  const totalRevenue = filteredAppointments?.reduce((total, appointment) => {
    // Divisão por 100 para converter de centavos para reais (mostrando o valor sem centavos)
    const price = appointment.servicePrice || 0;
    const priceInReais = price / 100;
    console.log(`Agendamento #${appointment.id}: adicionando R$ ${priceInReais.toFixed(2)} ao total`);
    return total + priceInReais;
  }, 0) || 0;
  
  console.log("Total calculado:", totalRevenue);

  // Agrupar por serviço para o relatório de resumo
  type GroupType = { name: string; count: number; revenue: number };
  const serviceGroups = filteredAppointments?.reduce((groups, appointment) => {
    const key = appointment.serviceId.toString();
    if (!groups[key]) {
      groups[key] = {
        name: appointment.serviceName,
        count: 0,
        revenue: 0,
      };
    }
    groups[key].count += 1;
    groups[key].revenue += (appointment.servicePrice || 0) / 100;
    return groups;
  }, {} as Record<string, GroupType>);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Relatório Financeiro</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Filtros */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Selecione o período e serviço</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Calendário para selecionar o mês */}
            <div>
              <label className="block text-sm font-medium mb-2">Data</label>
              <div className="flex justify-center sm:justify-start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => setSelectedDate(date || new Date())}
                  classNames={{
                    caption_label: "text-sm font-medium",
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse",
                    head_cell: "text-xs font-medium text-center",
                    cell: "text-center text-sm p-0 relative",
                    day: "h-9 w-9 p-0 font-normal",
                    day_selected: "bg-primary text-white hover:bg-primary",
                  }}
                  locale={ptBR}
                />
              </div>
            </div>

            {/* Select para filtrar por serviço */}
            <div>
              <label className="block text-sm font-medium mb-2">Serviço</label>
              <Select
                value={selectedService}
                onValueChange={setSelectedService}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os serviços" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os serviços</SelectItem>
                  {services?.map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Resumo Financeiro */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Resumo Financeiro</CardTitle>
            <CardDescription>
              {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              <div className="mt-2 text-xs text-amber-600 font-medium">
                * Apenas agendamentos confirmados ou concluídos são contabilizados
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-primary">
                R$ {totalRevenue.toFixed(2)}
              </h2>
              <p className="text-gray-500">Receita total</p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Receita por Serviço</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {services && serviceGroups
                  ? Object.values(serviceGroups).map((group, index) => (
                      <div
                        key={index}
                        className="p-4 border rounded-lg flex flex-col"
                      >
                        <span className="font-medium">{group.name}</span>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-gray-500">
                            {group.count} atendimentos
                          </span>
                          <span className="font-semibold">
                            R$ {group.revenue.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  : null}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Transações */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes dos Atendimentos</CardTitle>
          <CardDescription>
            Lista de todos os atendimentos do período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6">  {/* Negative margin to allow overflow */}
            <div className="inline-block min-w-full align-middle px-6"> {/* Add padding back */}
              <Table>
                <TableCaption>
                  {filteredAppointments?.length
                    ? `Total de ${filteredAppointments.length} atendimentos`
                    : "Nenhum atendimento encontrado no período"}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data</TableHead>
                    <TableHead className="whitespace-nowrap">Cliente</TableHead>
                    <TableHead className="whitespace-nowrap">Serviço</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments?.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(
                          parseISO(typeof appointment.date === 'string' 
                            ? appointment.date 
                            : appointment.date.toISOString()), 
                          "dd/MM/yyyy HH:mm"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{appointment.clientName}</TableCell>
                      <TableCell className="whitespace-nowrap">{appointment.serviceName}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {appointment.status.toLowerCase() === "completed"
                          ? "Concluído"
                          : "Confirmado"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        R$ {(appointment.servicePrice / 100).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
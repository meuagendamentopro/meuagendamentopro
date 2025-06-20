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
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMonths, subMonths, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Appointment as BaseAppointment, Service, Provider } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { useAuth } from "@/hooks/use-auth";

// Extend the base appointment type with the properties added by our API
interface EnrichedAppointment extends BaseAppointment {
  clientName: string;
  serviceName: string;
  servicePrice: number;
  employeeName?: string;
  employeeSpecialty?: string;
}

export default function FinancialReport() {
  const { user } = useAuth();
  
  // Estados para diferentes tipos de visualizações
  const [viewType, setViewType] = useState<"day" | "month" | "period">("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addMonths(new Date(), 1)
  });
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

  // Verificar se é conta empresa
  const isCompanyAccount = user?.accountType === "company";

  // Obter o provider atual 
  const { data: myProvider, isLoading: isLoadingProvider } = useQuery<Provider>({
    queryKey: ["/api/my-provider"],
  });
  
  const providerId = myProvider?.id;

  // Get employees for company accounts
  const { data: employees } = useQuery({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
    enabled: isCompanyAccount
  });

  // Buscar os agendamentos
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<EnrichedAppointment[]>({
    queryKey: ["/api/my-appointments"],
    queryFn: async () => {
      const res = await fetch("/api/my-appointments");
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
  });
  
  console.log("Dados de agendamentos recebidos:", appointments);

  // Buscar os serviços
  const { data: services, isLoading: isLoadingServices } = useQuery<Service[]>({
    queryKey: ["/api/my-services"],
    queryFn: async () => {
      const res = await fetch("/api/my-services");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });

  if (isLoadingAppointments || isLoadingServices) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Filtrar os agendamentos com base no tipo de visualização selecionado
  const filteredAppointments = appointments?.filter((appointment) => {
    // Garantir que a data seja uma string antes de passar para parseISO
    const dateStr = typeof appointment.date === 'string' 
      ? appointment.date 
      : appointment.date.toISOString();
    const appointmentDate = parseISO(dateStr);
    
    // MUITO IMPORTANTE: Incluir APENAS os agendamentos com status "confirmed" ou "completed"
    // Os agendamentos com status "pending" não devem ser contabilizados financeiramente
    // pois eles ainda podem ser cancelados
    const validStatus = ["confirmed", "completed"].includes(appointment.status.toLowerCase());
    
    // Filtro de serviço
    const validService = (selectedService === "all" || appointment.serviceId === parseInt(selectedService));
    
    // Filtro de funcionário (apenas para contas empresa)
    const validEmployee = !isCompanyAccount || selectedEmployee === "all" || 
      (appointment.employeeId && appointment.employeeId === parseInt(selectedEmployee)) ||
      (!appointment.employeeId && selectedEmployee === "unassigned");
    
    // Verificar o tipo de filtro de data selecionado
    let validDate = false;
    
    if (viewType === "day") {
      // Filtragem por dia específico
      validDate = format(appointmentDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
      console.log(`Verificando horário: ${appointmentDate.toLocaleString()} - Hora atual: ${selectedDate.toLocaleString()} - É mesmo dia? ${validDate} - É passado? ${appointmentDate < new Date()}`);
    } 
    else if (viewType === "month") {
      // Filtragem por mês
      validDate = isWithinInterval(appointmentDate, {
        start: startOfMonth(selectedMonth),
        end: endOfMonth(selectedMonth),
      });
    } 
    else if (viewType === "period") {
      // Filtragem por período personalizado
      if (dateRange?.from && dateRange?.to) {
        validDate = isWithinInterval(appointmentDate, {
          start: dateRange.from,
          end: dateRange.to,
        });
      }
    }
    
    console.log(`Analisando agendamento #${appointment.id}:`, {
      data: format(appointmentDate, 'dd/MM/yyyy'),
      tipoVisualizacao: viewType,
      status: appointment.status,
      statusValido: validStatus,
      dataValida: validDate,
      servicoSelecionado: selectedService,
      servicoValido: validService,
    });
    
    return validDate && validStatus && validService && validEmployee;
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
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-full">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Relatório Financeiro</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Filtros */}
        <Card className="col-span-1 max-w-full">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Selecione o período e serviço</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
            {/* Tipo de visualização */}
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de Visualização</label>
              <Tabs 
                defaultValue="day" 
                value={viewType}
                onValueChange={(value) => setViewType(value as "day" | "month" | "period")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="day">Dia</TabsTrigger>
                  <TabsTrigger value="month">Mês</TabsTrigger>
                  <TabsTrigger value="period">Período</TabsTrigger>
                </TabsList>
                
                <TabsContent value="day" className="pt-4">
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
                </TabsContent>
                
                <TabsContent value="month" className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
                    >
                      Mês anterior
                    </Button>
                    <span className="text-sm font-medium flex-1 text-center">
                      {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
                    >
                      Próximo mês
                    </Button>
                  </div>
                  <div className="flex justify-center sm:justify-start">
                    <Calendar
                      mode="single"
                      selected={selectedMonth}
                      onSelect={(date) => setSelectedMonth(date || new Date())}
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
                </TabsContent>
                
                <TabsContent value="period" className="pt-4">
                  <div className="grid gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                              </>
                            ) : (
                              format(dateRange.from, "dd/MM/yyyy")
                            )
                          ) : (
                            <span>Selecione um período</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="range"
                          defaultMonth={dateRange?.from}
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </TabsContent>
              </Tabs>
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

            {/* Select para filtrar por funcionário (apenas para contas empresa) */}
            {isCompanyAccount && (
              <div>
                <label className="block text-sm font-medium mb-2">Funcionário</label>
                <Select
                  value={selectedEmployee}
                  onValueChange={setSelectedEmployee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os funcionários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os funcionários</SelectItem>
                    <SelectItem value="unassigned">Sem funcionário atribuído</SelectItem>
                    {employees?.map((employee: any) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.name} - {employee.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo Financeiro */}
        <Card className="col-span-1 lg:col-span-2 max-w-full">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Resumo Financeiro</CardTitle>
            <CardDescription>
              {viewType === "day" && (
                format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
              )}
              {viewType === "month" && (
                format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })
              )}
              {viewType === "period" && dateRange?.from && (
                <>
                  {dateRange.to ? (
                    <>De {format(dateRange.from, "dd/MM/yyyy")} até {format(dateRange.to, "dd/MM/yyyy")}</>
                  ) : (
                    format(dateRange.from, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  )}
                </>
              )}
              <div className="mt-2 text-xs text-amber-600 font-medium">
                * Apenas agendamentos confirmados ou concluídos são contabilizados
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="mb-4 sm:mb-6">
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
      <Card className="max-w-full">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Detalhes dos Atendimentos</CardTitle>
          <CardDescription>
            {viewType === "day" && (
              <>Atendimentos do dia {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}</>
            )}
            {viewType === "month" && (
              <>Atendimentos do mês de {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}</>
            )}
            {viewType === "period" && dateRange?.from && dateRange?.to && (
              <>Atendimentos de {format(dateRange.from, "dd/MM/yyyy")} até {format(dateRange.to, "dd/MM/yyyy")}</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="overflow-x-auto w-full">
            <div className="inline-block w-full align-middle">
              <Table className="w-full border-collapse">
                <TableCaption>
                  {filteredAppointments?.length
                    ? `Total de ${filteredAppointments.length} atendimentos`
                    : "Nenhum atendimento encontrado no período"}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap p-2">Data</TableHead>
                    <TableHead className="whitespace-nowrap p-2">Cliente</TableHead>
                    <TableHead className="whitespace-nowrap p-2 hidden sm:table-cell">Serviço</TableHead>
                    {isCompanyAccount && <TableHead className="whitespace-nowrap p-2 hidden lg:table-cell">Funcionário</TableHead>}
                    <TableHead className="whitespace-nowrap p-2 hidden md:table-cell">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap p-2">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments?.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell className="whitespace-nowrap p-2 text-xs sm:text-sm">
                        {(() => {
                          // Compensar fuso horário para exibição correta
                          const appointmentDate = parseISO(typeof appointment.date === 'string' 
                            ? appointment.date 
                            : appointment.date.toISOString());
                          const adjustedDate = new Date(appointmentDate.getTime() + (3 * 60 * 60 * 1000));
                          return format(adjustedDate, "dd/MM/yyyy HH:mm", { locale: ptBR });
                        })()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap p-2 text-xs sm:text-sm">
                        {appointment.clientName}
                        <div className="text-xs text-gray-500 sm:hidden">
                          {appointment.serviceName}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap p-2 hidden sm:table-cell text-xs sm:text-sm">{appointment.serviceName}</TableCell>
                      {isCompanyAccount && (
                        <TableCell className="whitespace-nowrap p-2 hidden lg:table-cell text-xs sm:text-sm">
                          {appointment.employeeName || "Não atribuído"}
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap p-2 hidden md:table-cell text-xs sm:text-sm">
                        {appointment.status.toLowerCase() === "completed"
                          ? "Concluído"
                          : "Confirmado"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap p-2 text-xs sm:text-sm font-medium">
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
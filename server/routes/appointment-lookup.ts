import { Router } from "express";
import { db } from "../db";
import { appointments as appointmentsTable, services, providers, clients, employees } from "@shared/schema";
import { eq, and, or, gte, desc, lte, sql, like } from "drizzle-orm";
import { Request, Response } from "express";

const router = Router();

// Rota para buscar agendamentos por telefone
router.get("/appointments/lookup", async (req: Request, res: Response) => {
  try {
    const { phone, providerId } = req.query;

    if (!phone || !providerId) {
      return res.status(400).json({ error: "Telefone e Provider ID são obrigatórios" });
    }

    console.log(`Buscando agendamentos para telefone: ${phone}, provider: ${providerId}`);

    // Limpar o telefone para busca
    const cleanPhone = (phone as string).replace(/\D/g, '');
    
    // Criar variações do telefone para busca mais flexível
    const phoneVariations = [
      phone as string, // Telefone original
      cleanPhone, // Apenas números
      `+55${cleanPhone}`, // Com código do país
      cleanPhone.slice(-10), // Últimos 10 dígitos
      cleanPhone.slice(-11), // Últimos 11 dígitos
    ].filter(p => p.length >= 10);

    console.log('Variações de telefone para busca:', phoneVariations);

    // Buscar agendamentos com múltiplas variações de telefone
    const appointments = await db
      .select({
        id: appointmentsTable.id,
        date: appointmentsTable.date,
        endTime: appointmentsTable.endTime,
        status: appointmentsTable.status,
        rescheduleCount: appointmentsTable.rescheduleCount,
        serviceName: services.name,
        servicePrice: services.price,
        serviceDuration: services.duration,
        providerName: providers.name,
        providerId: providers.id,
        clientName: clients.name,
        clientPhone: clients.phone,
        employeeName: employees.name,
        employeeId: appointmentsTable.employeeId,
      })
      .from(appointmentsTable)
      .innerJoin(services, eq(appointmentsTable.serviceId, services.id))
      .innerJoin(providers, eq(appointmentsTable.providerId, providers.id))
      .innerJoin(clients, eq(appointmentsTable.clientId, clients.id))
      .leftJoin(employees, eq(appointmentsTable.employeeId, employees.id))
      .where(
        and(
          eq(appointmentsTable.providerId, parseInt(providerId as string)),
          or(
            ...phoneVariations.map(phoneVar => 
              or(
                eq(clients.phone, phoneVar),
                like(clients.phone, `%${phoneVar}%`),
                like(clients.phone, `%${phoneVar.slice(-10)}%`),
                like(clients.phone, `%${phoneVar.slice(-11)}%`)
              )
            )
          ),
          or(
            eq(appointmentsTable.status, 'confirmed'),
            eq(appointmentsTable.status, 'pending')
          )
        )
      )
      .orderBy(desc(appointmentsTable.date));

    console.log(`Encontrados ${appointments.length} agendamentos`);

    // Ajustar fuso horário (UTC para UTC-3) e converter preço
    const adjustedAppointments = appointments.map(appointment => ({
      ...appointment,
      date: new Date(new Date(appointment.date).getTime() + 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(new Date(appointment.endTime).getTime() + 3 * 60 * 60 * 1000).toISOString(),
      servicePrice: appointment.servicePrice / 100 // Converter centavos para reais
    }));

    res.json(adjustedAppointments);
  } catch (error) {
    console.error("Erro ao buscar agendamentos:", error);
    res.status(500).json({ error: "Erro ao buscar agendamentos" });
  }
});

// Rota para buscar detalhes de um agendamento específico
router.get("/appointments/details/:appointmentId", async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;

    if (!appointmentId) {
      return res.status(400).json({ error: "ID do agendamento é obrigatório" });
    }

    // Buscar detalhes do agendamento
    const appointmentDetails = await db
      .select({
        id: appointmentsTable.id,
        date: appointmentsTable.date,
        endTime: appointmentsTable.endTime,
        status: appointmentsTable.status,
        rescheduleCount: appointmentsTable.rescheduleCount,
        employeeId: appointmentsTable.employeeId,
        serviceId: appointmentsTable.serviceId,
        serviceName: services.name,
        servicePrice: services.price,
        serviceDuration: services.duration,
        providerName: providers.name,
        providerId: providers.id,
        clientName: clients.name,
        clientPhone: clients.phone,
        employeeName: employees.name,
      })
      .from(appointmentsTable)
      .innerJoin(services, eq(appointmentsTable.serviceId, services.id))
      .innerJoin(providers, eq(appointmentsTable.providerId, providers.id))
      .innerJoin(clients, eq(appointmentsTable.clientId, clients.id))
      .leftJoin(employees, eq(appointmentsTable.employeeId, employees.id))
      .where(eq(appointmentsTable.id, parseInt(appointmentId)))
      .limit(1);

    if (appointmentDetails.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    // Ajustar fuso horário para horário local brasileiro (UTC-3) e converter preço
    const appointmentWithLocalTime = {
      ...appointmentDetails[0],
      date: new Date(appointmentDetails[0].date.getTime() + (3 * 60 * 60 * 1000)), // Adicionar 3 horas (UTC para UTC-3)
      endTime: new Date(appointmentDetails[0].endTime.getTime() + (3 * 60 * 60 * 1000)), // Adicionar 3 horas (UTC para UTC-3)
      servicePrice: appointmentDetails[0].servicePrice / 100 // Converter centavos para reais
    };

    res.json(appointmentWithLocalTime);
  } catch (error) {
    console.error("Erro ao buscar detalhes do agendamento:", error);
    res.status(500).json({ error: "Erro ao buscar detalhes do agendamento" });
  }
});

// Rota para buscar disponibilidade para reagendamento
router.get("/appointments/availability", async (req: Request, res: Response) => {
  try {
    const { providerId, date, excludeAppointmentId, employeeId } = req.query;

    if (!providerId || !date) {
      return res.status(400).json({ error: "Provider ID e data são obrigatórios" });
    }

    // Buscar configurações do provider
    const provider = await db
      .select()
      .from(providers)
      .where(eq(providers.id, parseInt(providerId as string)))
      .limit(1);

    if (provider.length === 0) {
      return res.status(404).json({ error: "Provider não encontrado" });
    }

    const providerData = provider[0];
    
    // Criar data local para evitar problemas de fuso horário
    // Se a data vem como "2025-01-13", criar como data local
    const [year, month, day] = (date as string).split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day); // month - 1 porque Date usa 0-11 para meses

    // Verificar se a data é válida
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ error: "Data inválida" });
    }

    // Verificar se é um dia de trabalho
    const dayOfWeek = selectedDate.getDay(); // 0 = domingo, 1 = segunda, etc.
    const weekday = dayOfWeek === 0 ? 7 : dayOfWeek; // Converter domingo (0) para 7
    
    // Verificar dias de trabalho se configurados
    if (providerData.workingDays) {
      const workingDays = providerData.workingDays.split(',').map((d: string) => parseInt(d.trim()));
      
      if (!workingDays.includes(weekday)) {
        return res.json({
          date: date,
          slots: [], // Nenhum slot disponível em dias não úteis
          message: "Dia não útil"
        });
      }
    }

    // Buscar dados do funcionário se fornecido
    let employeeData = null;
    if (employeeId) {
      const employee = await db
        .select()
        .from(employees)
        .where(eq(employees.id, parseInt(employeeId as string)))
        .limit(1);
      
      if (employee.length > 0) {
        employeeData = employee[0];
      }
    }

    // Buscar agendamentos existentes para a data
    // CORREÇÃO: Usar construtor com parâmetros para evitar problemas de timezone
    const [yearAvail, monthAvail, dayAvail] = selectedDate.toISOString().split('T')[0].split('-').map(Number);
    const startOfDay = new Date(yearAvail, monthAvail - 1, dayAvail, 0, 0, 0, 0);
    const endOfDay = new Date(yearAvail, monthAvail - 1, dayAvail, 23, 59, 59, 999);

    let existingAppointmentsQuery = db
      .select({
        date: appointmentsTable.date,
        endTime: appointmentsTable.endTime,
        employeeId: appointmentsTable.employeeId,
      })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.providerId, parseInt(providerId as string)),
          gte(appointmentsTable.date, startOfDay),
          lte(appointmentsTable.date, endOfDay),
          or(
            eq(appointmentsTable.status, 'confirmed'),
            eq(appointmentsTable.status, 'pending')
          )
        )
      );

    // Excluir o agendamento atual se fornecido
    if (excludeAppointmentId) {
      existingAppointmentsQuery = db
        .select({
          date: appointmentsTable.date,
          endTime: appointmentsTable.endTime,
          employeeId: appointmentsTable.employeeId,
        })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.providerId, parseInt(providerId as string)),
            gte(appointmentsTable.date, startOfDay),
            lte(appointmentsTable.date, endOfDay),
            or(
              eq(appointmentsTable.status, 'confirmed'),
              eq(appointmentsTable.status, 'pending')
            ),
            sql`${appointmentsTable.id} != ${parseInt(excludeAppointmentId as string)}`
          )
        );
    }

    const existingAppointments = await existingAppointmentsQuery;

    // Verificar se é conta empresa (tem funcionários)
    const employeesCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(eq(employees.companyUserId, parseInt(providerId as string)));
    
    const isCompanyAccount = employeesCount[0]?.count > 0;
    console.log(`Provider ${providerId} - É conta empresa: ${isCompanyAccount} (${employeesCount[0]?.count} funcionários)`);

    // Configurações de horário de trabalho
    const workingHoursStart = providerData.workingHoursStart || 8;
    const workingHoursEnd = providerData.workingHoursEnd || 18;

    // Gerar slots de 30 minutos
    const slots = [];
    for (let hour = workingHoursStart; hour < workingHoursEnd; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Criar data/hora do slot em UTC para comparar corretamente com agendamentos salvos em UTC
        const slotTime = new Date(Date.UTC(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          hour, minute, 0, 0
        ));
        
        // Verificar se o slot está ocupado por outro agendamento
        const slotTimeInMinutes = hour * 60 + minute;
        
        // Pular horários que já passaram no dia atual
        const now = new Date();
        const isToday = selectedDate.toDateString() === now.toDateString();
        const isPast = isToday && (hour < now.getHours() || (hour === now.getHours() && minute <= now.getMinutes()));
        
        if (isPast) {
          slots.push({
            time: timeString,
            available: false,
          });
          continue;
        }
        
        const isOccupied = existingAppointments.some(appointment => {
          const appointmentStart = new Date(appointment.date);
          const appointmentEnd = new Date(appointment.endTime);
          
          // Verificação robusta de conflitos por funcionário
          if (isCompanyAccount && employeeId && appointment.employeeId) {
            // Conta empresa: Se estamos verificando para um funcionário específico e o agendamento tem funcionário
            if (parseInt(employeeId as string) !== appointment.employeeId) {
              console.log(`Conta empresa: Funcionários diferentes (${employeeId} vs ${appointment.employeeId}), não há conflito`);
              return false; // Funcionários diferentes, não há conflito
            } else {
              console.log(`Conta empresa: Mesmo funcionário (${employeeId}), há conflito`);
            }
          } else if (isCompanyAccount && employeeId && !appointment.employeeId) {
            // Conta empresa: Verificando para funcionário específico, mas agendamento não tem funcionário
            console.log(`Conta empresa: Agendamento geral do provider conflita com funcionário específico ${employeeId}`);
            return true; // Agendamento geral conflita com funcionário específico
          } else if (isCompanyAccount && !employeeId && appointment.employeeId) {
            // Conta empresa: Não especificamos funcionário, mas agendamento tem funcionário
            console.log(`Conta empresa: Agendamento de funcionário ${appointment.employeeId} conflita com agendamento geral`);
            return true; // Funcionário específico conflita com agendamento geral
          } else if (!isCompanyAccount) {
            // Conta individual: Qualquer agendamento conflita
            console.log(`Conta individual: Qualquer agendamento no mesmo horário é conflito`);
          }
          
          // Verificar sobreposição de horários
          // Um slot de 30 minutos está ocupado se há qualquer sobreposição com um agendamento existente
          const slotEnd = new Date(slotTime);
          slotEnd.setMinutes(slotEnd.getMinutes() + 30); // Assumindo slots de 30 minutos
          
          // Há conflito se:
          // - O slot começa antes do agendamento terminar E
          // - O slot termina depois do agendamento começar
          const hasConflict = slotTime < appointmentEnd && slotEnd > appointmentStart;
          
          if (hasConflict) {
            console.log(`Conflito detectado: Slot ${timeString} (UTC: ${slotTime.toISOString()}) conflita com agendamento ${appointmentStart.toISOString()} - ${appointmentEnd.toISOString()}`);
          }
          
          return hasConflict;
        });

        // Verificar se o horário conflita com o horário de almoço do funcionário
        let isLunchTime = false;
        if (employeeData && employeeData.lunchBreakStart && employeeData.lunchBreakEnd) {
          const [lunchStartHour, lunchStartMin] = employeeData.lunchBreakStart.split(':').map(Number);
          const [lunchEndHour, lunchEndMin] = employeeData.lunchBreakEnd.split(':').map(Number);
          
          const lunchStart = lunchStartHour * 60 + lunchStartMin;
          const lunchEnd = lunchEndHour * 60 + lunchEndMin;
          
          // Verificar se o slot está dentro do horário de almoço
          isLunchTime = slotTimeInMinutes >= lunchStart && slotTimeInMinutes < lunchEnd;
        }

        slots.push({
          time: timeString,
          available: !isOccupied && !isLunchTime,
        });
      }
    }

    res.json({
      date: date,
      slots: slots,
    });
  } catch (error) {
    console.error("Erro ao buscar disponibilidade:", error);
    res.status(500).json({ error: "Erro ao buscar disponibilidade" });
  }
});

// Rota para reagendar um agendamento
router.put("/appointments/reschedule/:appointmentId", async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTime } = req.body;

    if (!appointmentId || !newDate || !newTime) {
      return res.status(400).json({ error: "Dados incompletos para reagendamento" });
    }

    // Buscar o agendamento atual
    const currentAppointment = await db
      .select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, parseInt(appointmentId)))
      .limit(1);

    if (currentAppointment.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado" });
    }

    const appointment = currentAppointment[0];

    // Verificar se pode reagendar
    if (appointment.rescheduleCount >= 1) {
      return res.status(400).json({ error: "Este agendamento já foi reagendado o máximo de vezes permitido" });
    }

    if (appointment.status !== 'confirmed' && appointment.status !== 'pending') {
      return res.status(400).json({ error: "Este agendamento não pode ser reagendado" });
    }

    // Buscar duração do serviço
    const service = await db
      .select()
      .from(services)
      .where(eq(services.id, appointment.serviceId))
      .limit(1);

    if (service.length === 0) {
      return res.status(404).json({ error: "Serviço não encontrado" });
    }

    // Calcular nova data e hora de fim
    const [hours, minutes] = newTime.split(':').map(Number);
    // CORREÇÃO: Usar Date.UTC para manter o horário exato selecionado pelo usuário
    const [yearReschedule, monthReschedule, dayReschedule] = newDate.split('-').map(Number);
    const newDateTime = new Date(Date.UTC(yearReschedule, monthReschedule - 1, dayReschedule, hours, minutes, 0, 0));

    const newEndTime = new Date(newDateTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + service[0].duration);

    // Verificar se o novo horário está disponível
    const conflictingAppointments = await db
      .select()
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.providerId, appointment.providerId),
          or(
            eq(appointmentsTable.status, 'confirmed'),
            eq(appointmentsTable.status, 'pending')
          ),
          // Verificar sobreposição de horários usando SQL raw
          sql`(${appointmentsTable.date} < ${newEndTime.toISOString()} AND ${appointmentsTable.endTime} > ${newDateTime.toISOString()})`
        )
      );

    // Filtrar o próprio agendamento
    const realConflicts = conflictingAppointments.filter(a => a.id !== appointment.id);

    if (realConflicts.length > 0) {
      return res.status(400).json({ error: "Horário não disponível" });
    }

    // Atualizar o agendamento
    await db
      .update(appointmentsTable)
      .set({
        date: newDateTime,
        endTime: newEndTime,
        rescheduleCount: appointment.rescheduleCount + 1,
      })
      .where(eq(appointmentsTable.id, parseInt(appointmentId)));

    res.json({ 
      message: "Agendamento reagendado com sucesso",
      newDate: newDateTime,
      newEndTime: newEndTime,
    });
  } catch (error) {
    console.error("Erro ao reagendar agendamento:", error);
    res.status(500).json({ error: "Erro ao reagendar agendamento" });
  }
});

export default router; 
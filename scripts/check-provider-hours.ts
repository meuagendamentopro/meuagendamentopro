import { db, pool } from "../server/db";
import { providers } from "@shared/schema";

async function checkProviderHours() {
  try {
    const allProviders = await db.select().from(providers);
    
    console.log('Providers encontrados:', allProviders.length);
    
    for (const provider of allProviders) {
      console.log(`\nProvider ID ${provider.id} (${provider.name})`);
      console.log(`- Horário de trabalho: ${provider.workingHoursStart}h às ${provider.workingHoursEnd}h`);
      console.log(`- Booking link: ${provider.bookingLink}`);
      console.log(`- Email: ${provider.email}`);
      console.log(`- Especialidades: ${provider.specialties}`);
    }
  } finally {
    await pool.end();
  }
}

checkProviderHours();
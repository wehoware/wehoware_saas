import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  // Count ALL notifications by type
  const all = await p.wehowareNotification.groupBy({
    by: ['type'],
    where: { clientId: 'bbd8a4a6-b5d8-4af9-aa5d-becfdcadc3ba' },
    _count: { id: true },
  });
  console.log('All notification types:', JSON.stringify(all, null, 2));
  
  const total = await p.wehowareNotification.count({
    where: { clientId: 'bbd8a4a6-b5d8-4af9-aa5d-becfdcadc3ba' },
  });
  console.log('Total notifications:', total);
  
  // Check for any cancelled appointments
  const cancelledAppts = await p.wehowareAppointment.findMany({
    where: { 
      clientId: 'bbd8a4a6-b5d8-4af9-aa5d-becfdcadc3ba',
      status: 'Cancelled',
    },
    select: { id: true, guestName: true, status: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });
  console.log('\nCancelled appointments:', JSON.stringify(cancelledAppts, null, 2));
} catch (e) {
  console.error('ERROR:', e.message);
} finally {
  await p.$disconnect();
}

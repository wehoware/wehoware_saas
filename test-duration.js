const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const s = await prisma.wehowareService.create({
      data: {
        clientId: 'b728b2c3-e795-485b-8693-32912d2acab4',
        title: 'Test Service ' + Date.now(),
        slug: 'test-' + Date.now(),
        duration: 'hello',
        categoryId: 'e00fd04d-d85c-489c-95c8-d5c6976da82f',
        fee: 100,
        feeCurrency: 'CAD',
      },
      select: { id: true, duration: true }
    });
    console.log('SUCCESS:', JSON.stringify(s));
    await prisma.wehowareService.delete({ where: { id: s.id } });
    console.log('Cleaned up');
  } catch (err) {
    console.error('ERROR CODE:', err.code);
    console.error('ERROR MESSAGE:', err.message);
  } finally {
    await prisma['$disconnect']();
  }
}
test();

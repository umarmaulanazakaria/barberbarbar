import 'dotenv/config';
import assert from 'node:assert/strict';
assert.ok(process.send, 'Helper hanya untuk fork pengujian');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL ?? '').hostname));
process.env.SCHEDULER_BOOKING_AKTIF = 'false';
await import('../dist/server.js');
process.on('message', async jenis => {
  const error = Object.assign(new Error('E2E_RAHASIA_PROSES'), { body: 'E2E_RAHASIA_PROSES', config: { Authorization: 'E2E_RAHASIA_PROSES' } });
  if (jenis === 'disconnect') {
    const { default: db } = await import('../dist/lib/prisma.js');
    db.$disconnect = async () => { throw error; };
  }
  if (jenis === 'exception') process.emit('uncaughtException', error, 'uncaughtException');
  else process.emit('unhandledRejection', error, Promise.resolve());
});

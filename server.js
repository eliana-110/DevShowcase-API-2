const { openDatabase } = require('./db');
const { createApp } = require('./app');
(async () => { const port = Number(process.env.PORT || 3000); const db = await openDatabase(); const server = createApp(db).listen(port, '0.0.0.0', () => console.log(`DevShowcase API na porta ${port}`)); const stop = () => server.close(async () => { await db.close(); process.exit(0); }); process.on('SIGTERM', stop); process.on('SIGINT', stop); })().catch(error => { console.error('Falha ao iniciar:', error); process.exit(1); });

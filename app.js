const express = require('express');
const { createRepositories } = require('./repositories');
const { createServices } = require('./services');
const { ApiError, id, profileInput, technologyInput, projectInput, feedbackInput, projectQuery } = require('./dto');
const { specification, swaggerHtml } = require('./openapi');

const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
function createApp(db) {
  const app = express(); const services = createServices(createRepositories(db));
  app.disable('x-powered-by'); app.use(express.json({ limit: '100kb' }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api-docs.json', (_req, res) => res.json(specification));
  app.get('/api-docs', (_req, res) => res.type('html').send(swaggerHtml));
  app.post('/api/profiles', asyncRoute(async (req, res) => res.status(201).json(await services.profiles.create(profileInput(req.body)))));
  app.get('/api/profiles/:id', asyncRoute(async (req, res) => res.json(await services.profiles.findById(id(Number(req.params.id))))));
  app.post('/api/technologies', asyncRoute(async (req, res) => res.status(201).json(await services.technologies.create(technologyInput(req.body)))));
  app.get('/api/technologies', asyncRoute(async (_req, res) => res.json(await services.technologies.findAll())));
  app.post('/api/projects', asyncRoute(async (req, res) => res.status(201).json(await services.projects.create(projectInput(req.body)))));
  app.get('/api/projects', asyncRoute(async (req, res) => res.json(await services.projects.list(projectQuery(req.query)))));
  app.post('/api/projects/:id/feedbacks', asyncRoute(async (req, res) => res.status(201).json(await services.projects.feedback(id(Number(req.params.id)), feedbackInput(req.body)))));
  app.put('/api/projects/:id/upvote', asyncRoute(async (req, res) => res.json(await services.projects.upvote(id(Number(req.params.id))))));
  app.use((req, _res, next) => next(new ApiError(404, 'Endpoint não encontrado.')));
  app.use((error, req, res, _next) => { let status = error.status || 500; let message = error.message; if (error.type === 'entity.parse.failed') { status = 400; message = 'JSON inválido.'; } else if (error.code === '23505' || error.code?.includes('SQLITE_CONSTRAINT_UNIQUE')) { status = 409; message = 'Registro já existe.'; } else if (!error.status && status === 500) { console.error(error); message = 'Erro interno do servidor.'; } res.status(status).json({ status, error: status >= 500 ? 'Internal Server Error' : status === 404 ? 'Not Found' : status === 409 ? 'Conflict' : 'Bad Request', message, path: req.originalUrl, timestamp: new Date().toISOString(), ...(error.details && { details: error.details }) }); });
  return app;
}
module.exports = { createApp };

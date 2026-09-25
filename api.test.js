const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/db');
const { createApp } = require('../src/app');

test('fluxo REST completo, regras de negócio e erros globais', async () => {
  const db = await openDatabase(':memory:'); const server = createApp(db).listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); const base = `http://127.0.0.1:${server.address().port}`;
  async function request(method, route, body) { const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, data: await response.json() }; }
  try {
    const profile = await request('POST', '/api/profiles', { name: 'Ana', email: 'ana@example.com' }); assert.equal(profile.status, 201);
    assert.equal((await request('POST', '/api/profiles', { name: 'Ana', email: 'ana@example.com' })).status, 409);
    assert.equal((await request('GET', '/api/profiles/999')).data.message, 'Perfil não encontrado.');
    const node = await request('POST', '/api/technologies', { name: 'Node.js' }); const react = await request('POST', '/api/technologies', { name: 'React' });
    const project = await request('POST', '/api/projects', { profileId: profile.data.id, title: 'Portfólio', technologyIds: [node.data.id] }); assert.equal(project.status, 201); assert.equal(project.data.averageRating, 0); assert.equal(project.data.upvotes, 0);
    await request('POST', '/api/projects', { profileId: profile.data.id, title: 'Frontend', technologyIds: [react.data.id] });
    const page = await request('GET', '/api/projects?technology=Node.js&page=0&size=1'); assert.equal(page.data.content.length, 1); assert.equal(page.data.totalElements, 1); assert.equal(page.data.totalPages, 1);
    assert.equal((await request('GET', '/api/projects?page=-1')).status, 400); assert.equal((await request('GET', '/api/projects?size=101')).status, 400);
    const badFeedback = await request('POST', `/api/projects/${project.data.id}/feedbacks`, { authorName: 'Bia', rating: 6, comment: 'x' }); assert.equal(badFeedback.status, 400);
    let feedback = await request('POST', `/api/projects/${project.data.id}/feedbacks`, { authorName: 'Bia', rating: 5, comment: 'Ótimo' }); assert.equal(feedback.status, 201); assert.equal(feedback.data.project.averageRating, 5);
    feedback = await request('POST', `/api/projects/${project.data.id}/feedbacks`, { authorName: 'Caio', rating: 3, comment: 'Bom' }); assert.equal(feedback.data.project.averageRating, 4); assert.equal(feedback.data.project.feedbacks.length, 2);
    let upvoted = await request('PUT', `/api/projects/${project.data.id}/upvote`); assert.equal(upvoted.data.upvotes, 1); upvoted = await request('PUT', `/api/projects/${project.data.id}/upvote`); assert.equal(upvoted.data.upvotes, 2);
    assert.equal((await request('PUT', '/api/projects/999/upvote')).status, 404); assert.equal((await request('GET', '/inexistente')).status, 404);
    const docs = await request('GET', '/api-docs.json'); assert.equal(docs.data.openapi, '3.0.3'); assert.equal((await request('GET', '/health')).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); await db.close(); }
});

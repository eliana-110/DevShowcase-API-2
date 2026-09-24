# DevShowcase API

API REST em Node.js/Express, com regras de negócio em uma camada de serviço, PostgreSQL em produção e SQLite apenas para desenvolvimento/testes locais.

## Executar e testar

Requer Node.js 22.13+.

```bash
npm install
npm test
npm start
```

Por padrão, a API usa `data/devshowcase.sqlite` e atende em `http://localhost:3000`. Copie `.env.example` para configurar o ambiente (o Node não carrega `.env` automaticamente). Endpoints úteis:

- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`
- Health check: `http://localhost:3000/health`

## Endpoints da etapa final

| Método | Caminho | Descrição |
| --- | --- | --- |
| POST | `/api/projects/:id/feedbacks` | Cadastra `authorName`, `rating` (1–5) e `comment`; recalcula a média em transação |
| PUT | `/api/projects/:id/upvote` | Incrementa atomicamente os upvotes |
| GET | `/api/projects?technology=Node.js&page=0&size=10` | Filtra pelo nome exato da tecnologia e retorna página (máximo 100 itens) |

A página contém `content`, `page`, `size`, `totalElements` e `totalPages`. Erros têm o formato `{ status, error, message, path, timestamp }`, inclusive JSON inválido, validações, recurso/rota inexistente, conflito e falha interna.

Os endpoints anteriores de perfis, tecnologias e criação de projetos permanecem disponíveis. Importe [a coleção Postman](postman/DevShowcase%20API.postman_collection.json) e execute-a na ordem.

## Deploy contínuo no Render + PostgreSQL

1. Envie este diretório a um repositório GitHub.
2. Crie um PostgreSQL no Render (ou projeto no Supabase) e copie a URL de conexão externa.
3. No Render, use **New > Blueprint**, conecte o repositório e selecione `render.yaml`.
4. Cadastre `DATABASE_URL` como variável secreta com a URL PostgreSQL. Não coloque credenciais no Git.
5. Confirme o deploy. Cada push na branch conectada inicia novo deploy; `/health` é usado pelo health check.

O esquema é criado de forma idempotente ao iniciar. Em produção, `NODE_ENV=production` habilita TLS para a conexão PostgreSQL. O plano gratuito e sua disponibilidade podem variar; confira as condições atuais do provedor.

> O `render.yaml` usa `npm install` para que o lockfile seja atualizado no build caso o driver PostgreSQL ainda não esteja no cache local. Recomenda-se executar `npm install` e versionar o `package-lock.json` atualizado antes do primeiro deploy.

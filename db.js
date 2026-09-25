const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const sqliteSchema = `
  CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, bio TEXT, avatar_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS technologies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, repository_url TEXT, demo_url TEXT, upvotes INTEGER NOT NULL DEFAULT 0, average_rating REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS project_technologies (project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, technology_id INTEGER NOT NULL REFERENCES technologies(id) ON DELETE CASCADE, PRIMARY KEY (project_id, technology_id));
  CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, author_name TEXT NOT NULL, rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), comment TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE INDEX IF NOT EXISTS idx_projects_profile ON projects(profile_id);
  CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id);
  CREATE INDEX IF NOT EXISTS idx_project_technologies_technology ON project_technologies(technology_id);
`;
const postgresSchema = sqliteSchema.replaceAll('INTEGER PRIMARY KEY AUTOINCREMENT', 'BIGSERIAL PRIMARY KEY').replaceAll('REAL', 'NUMERIC(3,2)');

function sqliteAdapter(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const raw = new DatabaseSync(filename);
  raw.exec('PRAGMA foreign_keys = ON'); raw.exec(sqliteSchema);
  const projectColumns = new Set(raw.prepare('PRAGMA table_info(projects)').all().map(column => column.name));
  if (!projectColumns.has('upvotes')) raw.exec('ALTER TABLE projects ADD COLUMN upvotes INTEGER NOT NULL DEFAULT 0');
  if (!projectColumns.has('average_rating')) raw.exec('ALTER TABLE projects ADD COLUMN average_rating REAL NOT NULL DEFAULT 0');
  const feedbackColumns = new Set(raw.prepare('PRAGMA table_info(feedback)').all().map(column => column.name));
  if (!feedbackColumns.has('rating')) raw.exec('ALTER TABLE feedback ADD COLUMN rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5)');
  return { dialect: 'sqlite', raw,
    async query(sql, params = []) { const statement = raw.prepare(sql.replace(/\$\d+/g, '?')); if (/^\s*(SELECT|WITH)/i.test(sql) || /RETURNING/i.test(sql)) return { rows: statement.all(...params) }; const result = statement.run(...params); return { rows: [], rowCount: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) }; },
    async transaction(work) { raw.exec('BEGIN'); try { const result = await work(this); raw.exec('COMMIT'); return result; } catch (error) { raw.exec('ROLLBACK'); throw error; } },
    async close() { raw.close(); }
  };
}
async function postgresAdapter(connectionString) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined });
  await pool.query(postgresSchema);
  await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS upvotes INTEGER NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE feedback ADD COLUMN IF NOT EXISTS rating INTEGER NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5)');
  return { dialect: 'postgres', query: (sql, params) => pool.query(sql, params),
    async transaction(work) { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await work({ query: client.query.bind(client), dialect: 'postgres' }); await client.query('COMMIT'); return result; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } },
    close: () => pool.end()
  };
}
async function openDatabase(value = process.env.DATABASE_URL || process.env.DATABASE_PATH || './data/devshowcase.sqlite') { return /^postgres(ql)?:\/\//.test(value) ? postgresAdapter(value) : sqliteAdapter(value); }
module.exports = { openDatabase };

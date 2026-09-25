function mapProfile(row) { return { id: Number(row.id), name: row.name, email: row.email, bio: row.bio, avatarUrl: row.avatar_url, createdAt: row.created_at }; }
function mapTechnology(row) { return { id: Number(row.id), name: row.name, createdAt: row.created_at }; }
function mapFeedback(row) { return { id: Number(row.id), projectId: Number(row.project_id), authorName: row.author_name, rating: Number(row.rating), comment: row.comment, createdAt: row.created_at }; }

function createRepositories(db) {
  const profiles = {
    async create(data) { const result = await db.query('INSERT INTO profiles (name,email,bio,avatar_url) VALUES ($1,$2,$3,$4) RETURNING *', [data.name, data.email, data.bio, data.avatarUrl]); return result.rows[0] ? mapProfile(result.rows[0]) : this.findById(result.lastInsertRowid); },
    async findById(id) { const { rows } = await db.query('SELECT * FROM profiles WHERE id = $1', [id]); return rows[0] ? mapProfile(rows[0]) : null; }
  };
  const technologies = {
    async create(data) { const result = await db.query('INSERT INTO technologies (name) VALUES ($1) RETURNING *', [data.name]); const row = result.rows[0] || (await db.query('SELECT * FROM technologies WHERE id = $1', [result.lastInsertRowid])).rows[0]; return mapTechnology(row); },
    async findById(id) { const { rows } = await db.query('SELECT * FROM technologies WHERE id = $1', [id]); return rows[0] ? mapTechnology(rows[0]) : null; },
    async findAll() { return (await db.query('SELECT * FROM technologies ORDER BY id')).rows.map(mapTechnology); }
  };
  const projects = {
    async create(data) { return db.transaction(async tx => { const result = await tx.query('INSERT INTO projects (profile_id,title,description,repository_url,demo_url) VALUES ($1,$2,$3,$4,$5) RETURNING id', [data.profileId, data.title, data.description, data.repositoryUrl, data.demoUrl]); const projectId = Number(result.rows[0]?.id || result.lastInsertRowid); for (const technologyId of data.technologyIds) await tx.query('INSERT INTO project_technologies (project_id,technology_id) VALUES ($1,$2)', [projectId, technologyId]); return projectId; }); },
    async findById(projectId) { const { rows } = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]); if (!rows[0]) return null; return hydrate(rows[0]); },
    async list({ technology, page, size }) {
      const params = []; let where = '';
      if (technology) { params.push(technology.toLowerCase()); where = 'WHERE EXISTS (SELECT 1 FROM project_technologies fpt JOIN technologies ft ON ft.id=fpt.technology_id WHERE fpt.project_id=p.id AND LOWER(ft.name)= $1)'; }
      const count = Number((await db.query(`SELECT COUNT(*) AS total FROM projects p ${where}`, params)).rows[0].total);
      params.push(size, page * size);
      const { rows } = await db.query(`SELECT p.* FROM projects p ${where} ORDER BY p.id LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
      return { projects: await Promise.all(rows.map(hydrate)), totalElements: count };
    },
    async incrementUpvote(projectId) { const { rows } = await db.query('UPDATE projects SET upvotes=upvotes+1 WHERE id=$1 RETURNING *', [projectId]); if (rows[0]) return hydrate(rows[0]); if (db.dialect === 'sqlite') return this.findById(projectId); return null; },
    async addFeedback(projectId, data) { return db.transaction(async tx => { const inserted = await tx.query('INSERT INTO feedback (project_id,author_name,rating,comment) VALUES ($1,$2,$3,$4) RETURNING *', [projectId, data.authorName, data.rating, data.comment]); const feedback = inserted.rows[0] || (await tx.query('SELECT * FROM feedback WHERE id=$1', [inserted.lastInsertRowid])).rows[0]; await tx.query('UPDATE projects SET average_rating=(SELECT AVG(rating) FROM feedback WHERE project_id=projects.id) WHERE id=$1', [projectId]); return mapFeedback(feedback); }); }
  };
  async function hydrate(row) { const projectId = Number(row.id); const [technologyRows, feedbackRows] = await Promise.all([db.query('SELECT t.* FROM technologies t JOIN project_technologies pt ON pt.technology_id=t.id WHERE pt.project_id=$1 ORDER BY t.id', [projectId]), db.query('SELECT * FROM feedback WHERE project_id=$1 ORDER BY id', [projectId])]); return { id: projectId, profileId: Number(row.profile_id), title: row.title, description: row.description, repositoryUrl: row.repository_url, demoUrl: row.demo_url, upvotes: Number(row.upvotes), averageRating: Number(row.average_rating), createdAt: row.created_at, technologies: technologyRows.rows.map(mapTechnology), feedbacks: feedbackRows.rows.map(mapFeedback) }; }
  return { profiles, technologies, projects };
}
module.exports = { createRepositories };

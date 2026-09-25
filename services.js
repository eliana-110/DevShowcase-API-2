const { ApiError } = require('./dto');
function createServices(repositories) {
  const requireProject = async id => { const project = await repositories.projects.findById(id); if (!project) throw new ApiError(404, 'Projeto não encontrado.'); return project; };
  return {
    profiles: { create: data => repositories.profiles.create(data), async findById(id) { const value = await repositories.profiles.findById(id); if (!value) throw new ApiError(404, 'Perfil não encontrado.'); return value; } },
    technologies: { create: data => repositories.technologies.create(data), findAll: () => repositories.technologies.findAll() },
    projects: {
      async create(data) { if (!await repositories.profiles.findById(data.profileId)) throw new ApiError(404, 'Perfil não encontrado.'); for (const technologyId of data.technologyIds) if (!await repositories.technologies.findById(technologyId)) throw new ApiError(404, `Tecnologia ${technologyId} não encontrada.`); return requireProject(await repositories.projects.create(data)); },
      async list(query) { const result = await repositories.projects.list(query); return { content: result.projects, page: query.page, size: query.size, totalElements: result.totalElements, totalPages: Math.ceil(result.totalElements / query.size) }; },
      async upvote(id) { await requireProject(id); return repositories.projects.incrementUpvote(id); },
      async feedback(id, data) { await requireProject(id); const feedback = await repositories.projects.addFeedback(id, data); return { feedback, project: await requireProject(id) }; }
    }
  };
}
module.exports = { createServices };

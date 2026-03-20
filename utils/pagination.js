const getPagination = (pageQuery, limitQuery) => {
  const currentPage = Math.max(1, Number(pageQuery) || 1);
  const limit = Math.min(50, Math.max(1, Number(limitQuery) || 10));
  const skip = (currentPage - 1) * limit;

  return { currentPage, limit, skip };
};

const buildPaginationMeta = (totalMovies, currentPage, limit) => ({
  totalMovies,
  totalPages: Math.max(1, Math.ceil(totalMovies / limit)),
  currentPage,
});

module.exports = { getPagination, buildPaginationMeta };

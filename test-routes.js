const app = require("./app");
const listEndpoints = (app) => {
  const endpoints = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      endpoints.push(`${Object.keys(middleware.route.methods).join(",").toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const path = middleware.regexp.source
            .replace("^\\", "")
            .replace("\\/?(?=\\/|$)", "")
            .replace("\\/", "/");
          endpoints.push(`${Object.keys(handler.route.methods).join(",").toUpperCase()} ${path}${handler.route.path}`);
        }
      });
    }
  });
  return endpoints;
};

const dashboardRoutes = listEndpoints(app).filter(e => e.includes("dashboard"));
if (dashboardRoutes.length > 0) {
  console.log("Dashboard Routes FOUND:");
  dashboardRoutes.forEach(e => console.log(e));
} else {
  console.log("Dashboard Routes NOT FOUND!");
}
process.exit(0);

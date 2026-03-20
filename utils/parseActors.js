const parseActors = (actorsInput) => {
  if (Array.isArray(actorsInput)) {
    return actorsInput.map((actor) => String(actor).trim()).filter(Boolean);
  }

  if (typeof actorsInput === "string") {
    return actorsInput
      .split(",")
      .map((actor) => actor.trim())
      .filter(Boolean);
  }

  return [];
};

module.exports = { parseActors };

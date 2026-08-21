const planService = require("../services/plan.service");

async function createNutritionPlan(req, res, next) {
  try {
    const userId = req.user.id;
    const { dietaryPreferences, goal } = req.body;

    const result = await planService.generateNutritionPlan({userId, dietaryPreferences, goal});

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function getLatestNutritionPlan(req, res, next) {
  try {
    const userId = req.user.id;

    const result = await planService.getLatestNutritionPlan({ userId });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { createNutritionPlan, getLatestNutritionPlan };
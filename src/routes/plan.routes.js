const express = require("express");
const planController = require("../controllers/plan.controller");
const router = express.Router();

router.post("/plans/nutrition", planController.createNutritionPlan);
router.get("/plans/nutrition/latest", planController.getLatestNutritionPlan);

module.exports = router;
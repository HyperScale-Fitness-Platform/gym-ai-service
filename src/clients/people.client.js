// Mock implementation for local testing
async function getLatestProgress(userId) {
  // Simulating fetched progress and InBody scan data
  return {
    userId,
    weightKg: 78.5,
    heightCm: 178,
    bodyFatPercentage: 18.2,
    skeletalMuscleMassKg: 35.1,
    activityLevel: "moderate (3-4 days/week)",
    lastLoggedDate: new Date().toISOString().split("T")[0]
  };
}

module.exports = { getLatestProgress };
const { Kafka } = require("kafkajs");
const planHistoryModel = require("../models/planHistory.model");

const KAFKA_BROKERS = (
  process.env.KAFKA_BROKERS || "localhost:9092"
).split(",");

const kafka = new Kafka({
  clientId: "gym-ai-service",
  brokers: KAFKA_BROKERS,
});

const consumer = kafka.consumer({
  groupId:
    process.env.PLAN_HISTORY_GROUP_ID ||
    "gym-ai-plan-history-group",
});

async function handleMessage(topic, rawValue) {
  let event;

  try {
    event = JSON.parse(rawValue.toString());
  } catch (error) {
    console.error(
      `Invalid JSON on ${topic}, skipping message`,
    );
    return;
  }

  if (!event || !event.plan) {
    return;
  }

  try {
    if (event.eventType === "delete") {
      await planHistoryModel.deletePlan(
        topic,
        event.plan.id,
      );
      return;
    }

    await planHistoryModel.upsertPlan(topic, event.plan);
  } catch (error) {
    console.error(
      `Failed to apply plan event from ${topic}:`,
      error.message,
    );
  }
}

async function startPlanHistoryConsumer() {
  const topics = [
    process.env.EXERCISE_PLAN_EVENTS_TOPIC ||
      "EXERCISE_PLAN_EVENTS",
    process.env.NUTRITION_PLAN_EVENTS_TOPIC ||
      "NUTRITION_PLAN_EVENTS",
  ];

  try {
    /*
     * Ensure the topics exist before subscribing so a
     * fresh Kafka cluster (or fresh service start order)
     * does not fail with "topic-partition not hosted".
     */
    const admin = kafka.admin();
    await admin.connect();
    await admin.createTopics({
      topics: topics.map((topic) => ({ topic })),
      waitForLeaders: true,
    });
    await admin.disconnect();

    await consumer.subscribe({
      topic: topics[0],
      fromBeginning: true,
    });
    await consumer.subscribe({
      topic: topics[1],
      fromBeginning: true,
    });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        await handleMessage(topic, message.value);
      },
    });

    console.log(
      `AI service consuming plan history from: ${topics.join(", ")}`,
    );
  } catch (error) {
    console.error(
      "Failed to start plan-history consumer, retrying in 10s:",
      error.message,
    );

    setTimeout(startPlanHistoryConsumer, 10000);
  }
}

module.exports = { startPlanHistoryConsumer };

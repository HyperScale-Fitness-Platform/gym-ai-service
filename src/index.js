const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const chatRoutes = require("./routes/chat.routes");
const planRoutes = require("./routes/plan.routes");
const { attachUserFromHeaders } = require("./middleware/auth.middleware");
const { errorHandler } = require("./middleware/errorHandler.middleware");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "ai-service" });
});

app.use(attachUserFromHeaders);
app.use('/ai', chatRoutes);
app.use('/ai', planRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 4006;
app.listen(PORT, () => {
  console.log(`ai-service listening on port ${PORT}`);
});
const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_ACCESS_TOKEN) {
  console.error("Missing Twitch environment variables.");
  process.exit(1);
}

console.log("Twitch environment variables loaded.");

const app = express();
const PORT = 3000;

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");

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

 app.get("/api/streams", async (req, res) => {
  try {
    const response = await axios.get("https://api.twitch.tv/helix/streams", {
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        "Authorization": `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error("Twitch API request failed.");
    res.status(500).json({
      error: "Failed to fetch Twitch streams."
    });
  }
});
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");
const path = require("path");

dotenv.config();

if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_ACCESS_TOKEN) {
  console.error("Missing Twitch environment variables.");
  process.exit(1);
}

console.log("Twitch environment variables loaded.");

const app = express();

app.use(express.static(path.join(__dirname, "..")));

const PORT = 3000;

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

 app.get("/api/streams", async (req, res) => {
  const userLogins = req.query.user_login;

if (!userLogins) {
  return res.status(400).json({
    error: "user_login is required."
  });
}

const logins = Array.isArray(userLogins)
  ? userLogins
  : [userLogins];

  if (logins.length > 60) {
  return res.status(400).json({
    error: "Too many user_login values."
  });
}

for (const login of logins) {
  if (typeof login !== "string") {
    return res.status(400).json({
      error: "user_login must be a string."
    });
  }
  if (login.length > 25) {
  return res.status(400).json({
    error: "user_login is too long."
  });
}

  if (!/^[a-zA-Z0-9_]+$/.test(login)) {
    return res.status(400).json({
      error: "Invalid user_login format."
    });
  }
}

  try {
    const params = new URLSearchParams();

    if (Array.isArray(req.query.user_login)) {
      req.query.user_login.forEach(login => {
        params.append("user_login", login);
      });
    } else if (req.query.user_login) {
      params.append("user_login", req.query.user_login);
    }

    const response = await axios.get(
      `https://api.twitch.tv/helix/streams?${params.toString()}`,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
        }
      }
    );

    res.json(response.data);

  } catch (error) {
    console.error("Twitch API request failed.");

    if (error.response) {
      console.error("Twitch status:", error.response.status);
      console.error("Twitch response:", error.response.data);
    } else {
      console.error("Error:", error.message);
    }

    res.status(500).json({
      error: "Failed to fetch Twitch streams."
    });
  }
});
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
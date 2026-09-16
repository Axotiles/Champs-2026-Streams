const express = require("express");
const dotenv = require("dotenv");
const axios = require("axios");
const path = require("path");
require("dotenv").config();
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const session = require("express-session");
const { doubleCsrf } = require("csrf-csrf");
const cookieParser = require("cookie-parser");

function securityLog(event, details = {}) {
  console.log(
    `[SECURITY] ${new Date().toISOString()} ${event}`,
    details
  );
}

const streamsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  message: {
    error: "Too many requests. Please try again later."
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: {
    error: "Too many login attempts. Please try again later."
  },
  handler: (req, res) => {
    securityLog("LOGIN_RATE_LIMIT", {
      ip: req.ip
    });

    res.status(429).json({
      error: "Too many login attempts. Please try again later."
    });
  }
});

dotenv.config();

if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_ACCESS_TOKEN) {
  console.error("Missing Twitch environment variables.");
  process.exit(1);
}

console.log("Twitch environment variables loaded.");

const app = express();

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax"
    }
  })
);

app.use(cookieParser());

const {
  generateCsrfToken,
  doubleCsrfProtection
} = doubleCsrf(
  {
  getSecret: () => process.env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.session.id,
  cookieName: "csrf-token",
  cookieOptions: {
    httpOnly: false,
    sameSite: "lax",
    secure: false
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"]
});
app.get("/api/csrf-token", (req, res) => {
  res.json({
    csrfToken: generateCsrfToken(req, res)
  });
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: [
          "'self'",
          "https://embed.twitch.tv",
          "'sha256-R8YUeb6GNNhK3FI1JUr/AJqj10YUiqWt9Y/F5VYw6dY='"
        ],

        frameSrc: [
          "'self'",
          "https://player.twitch.tv"
        ]
      }
    }
  })
);

app.use(express.static(path.join(__dirname, "..")));

const PORT = 3000;

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok"
  });
});


app.post("/api/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: "Username and password are required."
    });
  }

  if (username !== process.env.ADMIN_USERNAME) {
    securityLog("LOGIN_FAILURE", {
      username
    });

    return res.status(401).json({
      error: "Invalid username or password."
    });
  }

  const passwordMatches = await bcrypt.compare(
    password,
    process.env.ADMIN_PASSWORD_HASH
  );

  if (!passwordMatches) {
    securityLog("LOGIN_FAILURE", {
      username
    });

    return res.status(401).json({
      error: "Invalid username or password."
    });
  }

  req.session.user = {
    username: process.env.ADMIN_USERNAME
  };

  securityLog("LOGIN_SUCCESS", {
    username: process.env.ADMIN_USERNAME
  });

  res.json({
    message: "Login successful."
  });
});

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  next();
}
app.post("/api/logout", requireAuth, doubleCsrfProtection, (req, res) => {
  const username = req.session.user.username;

  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction failed.");

      return res.status(500).json({
        error: "Logout failed."
      });
    }

    res.clearCookie("connect.sid");

    securityLog("LOGOUT", {
      username
    });

    res.json({
      message: "Logout successful."
    });
  });
});


 app.get("/api/streams", streamsLimiter, requireAuth, async (req, res) => {
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
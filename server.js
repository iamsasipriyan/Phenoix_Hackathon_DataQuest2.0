require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');
const path = require('path');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
// Import Models
const User = require('./models/User');
const Event = require('./models/Event');
// Import Webhook Sender
const { sendToWebhook } = require('./send');
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;
app.use(express.static('public'));

// MongoDB Connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));
}

// Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(session({
  secret: 'calendar-secret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Google Auth Strategy
passport.use(new GoogleStrategy({
  clientID: '430272771846-rchpnm556q6sha2e913k9c9hpojed785.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: 'http://localhost:3000/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  profile.accessToken = accessToken;
  return done(null, profile);
}));

// Routes
app.get('/auth/google',
  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/calendar.readonly'
    ]
  })
);

app.get('/api/chat', (req, res) => {
  res.json({
    reply: "Chat API is running. Send a POST request to chat."
  });
});
// ==========================================
// 💬 CHATBOT API (Weather + Gemini)
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !messages.length) {
      return res.json({ reply: "Hi! How can I help you?" });
    }

    // 👉 Get last user message
    const lastMessage = messages[messages.length - 1].content.toLowerCase();

    // ==================================================
    // 🌦 WEATHER HANDLING (FIRST PRIORITY)
    // ==================================================
    if (lastMessage.includes("weather")) {
      return handleWeather(lastMessage, res);
    }

    // ==================================================
    // 🤖 GEMINI CHAT (ALL OTHER QUESTIONS)
    // ==================================================
    // Map 'assistant' to 'model'
    const chatHistory = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

    // Gemini requires last message separately
    const lastUserMessage = chatHistory.pop();

    // FAILSAFE: Remove ALL leading 'model' messages from history
    // (Gemini crashes if history starts with 'model')
    while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory.shift();
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 500
      },
      systemInstruction: {
        role: "model",
        parts: [{
          text: "You are a helpful AI Assistant for a Calendar & Task Dashboard app. You aim to be helpful and fun. If asked about real-time information you cannot access (like weather, stocks, or news), DO NOT REFUSE. Instead, provide a cheerful, likely guess based on the user's location or season, or a playful fictional answer (e.g. 'It feels like 30°C in the cloud today!'). Always prioritize giving an answer."
        }]
      }
    });

    const result = await chat.sendMessage(
      lastUserMessage.parts[0].text
    );

    const reply = result.response.text();
    res.json({ reply });

  } catch (error) {
    console.error("Chat API Error:", error);

    // Check for Rate Limit (429)
    if (error.message.includes('429') || (error.response && error.response.status === 429)) {
      return res.json({
        reply: "I'm receiving too many messages right now! 🤯 Please give me a minute to cool down."
      });
    }

    res.status(500).json({
      reply: "I'm having trouble connecting. Please try again later."
    });
  }
});

async function handleWeather(text, res) {
  try {
    const match = text.match(/weather in ([a-zA-Z\s]+)/i);
    const city = match ? match[1].trim() : "your area";

    const apiKey = process.env.OPENWEATHER_API_KEY;

    // Fallback if no API key (Simulated "Standard Calm" Report)
    if (!apiKey) {
      const reply = `
🌤 Weather in ${city} (Simulated)
🌡 Temperature: 24°C
☁ Condition: Clear Sky
💧 Humidity: 45%
It looks like a beautiful, calm day!
       `;
      return res.json({ reply });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.cod !== 200) {
      // Also fallback here if city not found, just to be "calm"
      return res.json({ reply: `I couldn't get the exact data for ${city}, but let's assume it's a nice 24°C today!` });
    }

    const reply = `
🌤 Weather in ${data.name}
🌡 Temperature: ${data.main.temp}°C
☁ Condition: ${data.weather[0].description}
💧 Humidity: ${data.main.humidity}%
    `;

    res.json({ reply });

  } catch (err) {
    console.error("Weather Error:", err);
    res.json({ reply: "It feels like a calm 24°C with clear skies today!" });
  }
}
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/dashboard.html')
);

app.get('/user', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({});
  res.json({
    email: req.user.emails[0].value,
    photo: req.user.photos[0].value,
    token: req.user.accessToken
  });
});

/* 🔥 GOOGLE CALENDAR API (Existing Team Work) */
app.get('/calendar/events', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json([]);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: req.user.accessToken });

  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    res.json(result.data.items);
  } catch (e) {
    console.error("Calendar API Error", e);
    res.json([]);
  }
});

app.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// ==========================================
// 🧠 HELPER: Create/Get Database User
// ==========================================
async function getDbUser(req, body = {}) {
  // 1. Try explicit frontend data (Robust)
  if (body.userEmail) {
    const email = body.userEmail;
    const name = body.userName || email.split('@')[0];

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ username: name, email });
      console.log("Created New DB User from Frontend Details:", email);
    } else {
      // Optional: Update name if changed? For now just return.
    }
    return user;
  }

  // 2. Try Passport Session
  if (req.isAuthenticated() && req.user.emails[0].value) {
    const email = req.user.emails[0].value;
    const name = req.user.displayName || email.split('@')[0];

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ username: name, email });
      console.log("Created New DB User from Google Auth Session:", email);
    }
    return user;
  }

  // 3. Fallback to Demo User
  let defaultUser = await User.findOne({ email: 'demo@example.com' });
  if (!defaultUser) {
    defaultUser = await User.create({ username: 'DemoUser', email: 'demo@example.com' });
  }
  console.log("Using Fallback Demo User");
  return defaultUser;
}

// ==========================================
// 🤖 TASK ANALYSIS (WEBHOOK + BASIC SAVE)
// ==========================================
app.post('/api/analyze-task', async (req, res) => {
  try {
    const { taskDescription, userEmail, userName } = req.body;
    if (!taskDescription) return res.status(400).json({ error: 'Task description is required' });

    // 1. Send to n8n Webhook (As requested)
    console.log("Triggering Webhook for:", taskDescription);
    sendToWebhook(taskDescription);

    // 2. Resolve User
    const user = await getDbUser(req, req.body);

    // 3. Save as basic TODO locally (So UI behaves normally)
    const newEvent = await Event.create({
      user: user._id,
      type: 'TODO',
      data: {
        title: taskDescription,
        description: "Forwarded to Webhook",
        priority: 'MEDIUM',
        startTime: null,
        endTime: null
      },
      originalInput: taskDescription
    });

    console.log("Event Saved to DB (TODO):", newEvent._id);

    // Return structure expected by UI
    res.json({
      type: 'TODO',
      data: { title: taskDescription },
      dbId: newEvent._id
    });

  } catch (error) {
    console.error("Task Processing Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ⏰ REMINDER POLLING JOB
// ==========================================
const checkReminders = async () => {
  try {
    const now = new Date();
    const future5Min = new Date(now.getTime() + 5 * 60000);

    // console.log(`[Scanning Reminders...]`);

    const upcomingEvents = await Event.find({
      type: { $in: ['CALENDAR_EVENT', 'REMINDER'] },
      reminderSent: false,
      'data.startTime': { $gte: now, $lte: future5Min }
    });

    for (const event of upcomingEvents) {
      console.log(`\n🔔 ALERT: "${event.data.title}" starting at ${event.data.startTime}`);
      event.reminderSent = true;
      await event.save();
    }
  } catch (error) {
    console.error("Reminder Error:", error);
  }
};
setInterval(checkReminders, 10000); // 10s interval

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
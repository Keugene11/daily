"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const plan_1 = __importDefault(require("./routes/plan"));
const explore_1 = __importDefault(require("./routes/explore"));
const stripe_1 = __importDefault(require("./routes/stripe"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const auth_1 = require("./middleware/auth");
const subscription_1 = require("./middleware/subscription");
const app = (0, express_1.default)();
exports.app = app;
// Middleware
app.use((0, cors_1.default)());
// Stripe webhook needs raw body — mount BEFORE express.json()
app.use('/api/webhooks/stripe', express_1.default.raw({ type: 'application/json' }), webhooks_1.default);
app.use(express_1.default.json());
// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        dedalusConfigured: !!(process.env.DEDALUS_API_KEY && process.env.DEDALUS_API_KEY !== 'your_dedalus_api_key_here'),
        newsApiConfigured: !!(process.env.NEWS_API_KEY && process.env.NEWS_API_KEY !== 'your_newsapi_key_here'),
    });
});
// Privacy policy (served as HTML, no auth required)
app.get('/api/privacy', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — daily</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #e5e5e5; background: #0a0a0a; padding: 2rem 1rem; }
    .container { max-width: 680px; margin: 0 auto; }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.25rem; color: #fff; }
    .updated { color: #737373; font-size: 0.875rem; margin-bottom: 2rem; }
    h2 { font-size: 1.125rem; font-weight: 600; color: #fff; margin-top: 2rem; margin-bottom: 0.5rem; }
    p, li { font-size: 0.9375rem; color: #d4d4d4; margin-bottom: 0.75rem; }
    ul { padding-left: 1.25rem; margin-bottom: 0.75rem; }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: February 19, 2026</p>
    <p>daily ("we", "our", "the app") is an AI-powered day planner. This policy explains what data we collect, how we use it, and your choices.</p>
    <h2>What We Collect</h2>
    <ul>
      <li><strong>Account information</strong> — When you sign in with Google, we receive your name, email address, and profile picture from Google OAuth. We use this solely for authentication.</li>
      <li><strong>Search queries</strong> — The cities and preferences you enter are sent to our server to generate your day plan. We do not store your queries after the response is delivered.</li>
      <li><strong>Local storage</strong> — The app caches geocoding results, media data, and your preferences (theme, last city) in your browser's local storage. This data stays on your device.</li>
    </ul>
    <h2>What We Do Not Collect</h2>
    <ul>
      <li>We do not collect your location automatically. You type in the city you want to explore.</li>
      <li>We do not sell, share, or transfer your personal data to third parties for advertising or marketing.</li>
      <li>We do not track you across other websites or apps.</li>
      <li>We do not collect data from children under 13. The app is not directed at children.</li>
    </ul>
    <h2>Third-Party Services</h2>
    <p>The app uses these external services to function:</p>
    <ul>
      <li><strong>Google OAuth</strong> — for sign-in</li>
      <li><strong>Anthropic (Claude)</strong> — to generate day plans</li>
      <li><strong>OpenStreetMap / Nominatim</strong> — for geocoding places on the map</li>
      <li><strong>Wikipedia / Wikimedia Commons</strong> — for place images</li>
      <li><strong>YouTube</strong> — for place video recommendations</li>
      <li><strong>Vercel</strong> — for hosting</li>
    </ul>
    <h2>Data Retention</h2>
    <p>We do not maintain a database of user queries or generated plans. Browser-side caches (local storage) can be cleared at any time through your browser settings.</p>
    <h2>Your Choices</h2>
    <ul>
      <li>You can use the app without signing in (with limited features).</li>
      <li>You can clear local storage at any time to remove cached data.</li>
      <li>You can revoke Google sign-in access from your Google Account settings.</li>
    </ul>
    <h2>Changes</h2>
    <p>We may update this policy from time to time. Changes will be reflected by the "last updated" date above.</p>
    <h2>Contact</h2>
    <p>Questions about this policy? Reach out at <a href="mailto:dailyplannerapp@gmail.com">dailyplannerapp@gmail.com</a>.</p>
  </div>
</body>
</html>`);
});
// Stripe routes (checkout, portal, subscription status)
app.use('/api', auth_1.requireAuth, subscription_1.checkSubscription, stripe_1.default);
// API routes (usage checks disabled for testing)
app.use('/api', auth_1.requireAuth, plan_1.default);
app.use('/api', auth_1.requireAuth, explore_1.default);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Error handler
app.use((err, _req, res, _next) => {
    console.error('[Error]', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load .env before importing app (local dev only)
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../.env') });
dotenv_1.default.config();
const app_1 = require("./app");
Object.defineProperty(exports, "app", { enumerable: true, get: function () { return app_1.app; } });
const PORT = process.env.PORT || 3000;
app_1.app.listen(PORT, () => {
    console.log(`\n🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🎯 Plan endpoint: http://localhost:${PORT}/api/plan\n`);
    if (!process.env.DEDALUS_API_KEY || process.env.DEDALUS_API_KEY === 'your_dedalus_api_key_here') {
        console.warn('⚠️  Warning: DEDALUS_API_KEY not configured in .env file');
    }
    if (!process.env.NEWS_API_KEY || process.env.NEWS_API_KEY === 'your_newsapi_key_here') {
        console.warn('⚠️  Warning: NEWS_API_KEY not configured (news tool will fail)');
    }
    console.log('');
});

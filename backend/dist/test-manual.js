"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Manual test script for the Dedalus SDK integration
 * Run with: npm test (or tsx src/test-manual.ts)
 */
const dotenv_1 = __importDefault(require("dotenv"));
const dedalus_1 = require("./services/dedalus");
// Load environment variables
dotenv_1.default.config();
async function test() {
    console.log('🧪 Starting manual test of Dedalus SDK integration\n');
    console.log('='.repeat(60));
    const testRequest = {
        city: 'San Francisco',
        interests: ['food', 'culture', 'outdoors']
    };
    console.log('Test Request:', JSON.stringify(testRequest, null, 2));
    console.log('='.repeat(60));
    console.log('\n📡 Streaming events:\n');
    try {
        const stream = (0, dedalus_1.streamPlanGeneration)(testRequest);
        let contentAccumulator = '';
        for await (const event of stream) {
            switch (event.type) {
                case 'tool_call_start':
                    console.log(`\n🔧 [TOOL CALL START] ${event.tool}`);
                    console.log(`   Args: ${JSON.stringify(event.args)}`);
                    break;
                case 'tool_call_result':
                    console.log(`\n✅ [TOOL CALL RESULT] ${event.tool}`);
                    console.log(`   Success: ${event.result?.success}`);
                    if (event.result?.success) {
                        console.log(`   Data: ${JSON.stringify(event.result.data, null, 2)}`);
                    }
                    else {
                        console.log(`   Error: ${event.result?.error}`);
                    }
                    break;
                case 'content_chunk':
                    process.stdout.write(event.content || '');
                    contentAccumulator += event.content || '';
                    break;
                case 'done':
                    console.log('\n\n✨ [DONE] Stream completed successfully');
                    break;
                case 'error':
                    console.error(`\n❌ [ERROR] ${event.error}`);
                    break;
            }
        }
        console.log('\n' + '='.repeat(60));
        console.log('✅ Test completed successfully!');
        console.log('='.repeat(60));
    }
    catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}
// Run the test
test().catch(console.error);

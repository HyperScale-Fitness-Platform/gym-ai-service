jest.mock('axios');

const axios = require('axios');
const { callLLM } = require('../src/config/llm');

describe('callLLM', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-2.0-flash';
    axios.post.mockReset();
  });

  it('maps Gemini generate-content responses into the app contract', async () => {
    axios.post.mockResolvedValue({
      data: {
        candidates: [{
          content: {
            parts: [{ text: 'Hello from Gemini' }],
            role: 'model'
          }
        }],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 8,
          totalTokenCount: 20
        }
      }
    });

    const result = await callLLM({
      messages: [{ role: 'user', content: 'Hi' }],
      systemPrompt: 'You are a helpful assistant.'
    });

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('gemini-2.0-flash:generateContent'),
      expect.objectContaining({
        system_instruction: expect.objectContaining({
          parts: [expect.objectContaining({ text: 'You are a helpful assistant.' })]
        })
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' })
      })
    );

    expect(result).toMatchObject({
      output_text: 'Hello from Gemini',
      usage: { total_tokens: 20 },
      actual_cost_usd: 0
    });
  });
});

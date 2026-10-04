// Safe one-shot check on the VPS. Never prints the configured API key.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { chatWithOpenAI } = require('../dist/backend/src/services/OpenAIService.js');
const { chatWithOllama } = require('../dist/backend/src/services/OllamaService.js');
const backup = process.argv.includes('--backup');
const endpoint = process.argv.includes('--endpoint');
const provider = backup ? 'Ollama' : 'OpenAI';
const call = backup ? chatWithOllama : chatWithOpenAI;

const request = endpoint
  ? fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/assistant/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá, vim entregar uma encomenda.' }] }),
  }).then(async (response) => {
    const data = await response.json();
    if (!response.ok || !data.success || !data.data?.reply) throw new Error(`Endpoint HTTP ${response.status}`);
    return data.data.reply;
  })
  : call([{ role: 'user', content: 'Responda somente: OK' }], 20);

request
  .then((reply) => {
    console.log(endpoint ? `Endpoint OK: ${reply.slice(0, 100)}` : reply.trim() === 'OK' ? `${provider} OK` : `${provider} respondeu: ${reply.slice(0, 80)}`);
  })
  .catch((error) => {
    console.error(`${provider} falhou: ${error.message}`);
    process.exitCode = 1;
  });

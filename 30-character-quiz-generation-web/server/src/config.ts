import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT ?? '43721', 10),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/quiz-generator',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  llamaServerUrl: process.env.LLAMA_SERVER_URL ?? 'http://localhost:8080',
};

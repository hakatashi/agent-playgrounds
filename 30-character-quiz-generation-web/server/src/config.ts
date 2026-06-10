import 'dotenv/config';

const home = process.env.HOME ?? '/root';

export const config = {
  port: parseInt(process.env.PORT ?? '43721', 10),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/quiz-generator',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  llamaServerUrl: process.env.LLAMA_SERVER_URL ?? 'http://127.0.0.1:8080',
  llamaServerBinary: process.env.LLAMA_SERVER_BINARY ?? `${home}/Documents/GitHub/llama.cpp/build/bin/llama-server`,
  // カンマ区切りのGGUFファイルパス一覧
  llamaModelPaths: (process.env.LLAMA_MODEL_PATHS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  llamaGpuLayers: process.env.LLAMA_GPU_LAYERS ?? '-1',
  llamaCtxSize: process.env.LLAMA_CTX_SIZE ?? '8192',
};

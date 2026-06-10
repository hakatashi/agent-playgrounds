import express from 'express';
import cors from 'cors';
import {config} from './config.js';
import {connectDB} from './db/connection.js';
import generateRouter from './routes/generate.js';
import quizzesRouter from './routes/quizzes.js';
import exportRouter from './routes/export.js';
import batchRouter from './routes/batch.js';
import llamaServerRouter from './routes/llama-server.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/generate', generateRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/export', exportRouter);
app.use('/api/batch', batchRouter);
app.use('/api/llama-server', llamaServerRouter);

connectDB().then(() => {
  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}).catch((err) => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

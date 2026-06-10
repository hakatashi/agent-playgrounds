import {Router, type Request, type Response} from 'express';
import {BatchJob} from '../db/models/BatchJob.js';
import {Quiz} from '../db/models/Quiz.js';
import {ollamaService} from '../services/llm/ollama.js';
import {claudeService} from '../services/llm/claude.js';
import {llamaServerService} from '../services/llm/llama-server.js';
import {buildPrompt} from '../services/promptBuilder.js';
import {parseQuizTSV} from '../services/quizParser.js';
import {fetchWikipediaArticle} from '../services/wikipedia.js';
import type {LLMService} from '../services/llm/index.js';

const router = Router();

const activeJobs = new Map<string, AbortController>();

async function runBatchJob(jobId: string) {
  const abortController = activeJobs.get(jobId);
  if (!abortController) return;

  const job = await BatchJob.findById(jobId);
  if (!job) return;

  await BatchJob.findByIdAndUpdate(jobId, {status: 'running'});

  const service: LLMService =
    job.llmBackend === 'claude' ? claudeService :
    job.llmBackend === 'llama-server' ? llamaServerService :
    ollamaService;

  try {
    for (let i = 0; i < job.minorGenres.length; i++) {
      if (abortController.signal.aborted) break;

      const minorGenre = job.minorGenres[i];
      await BatchJob.findByIdAndUpdate(jobId, {currentIndex: i});

      try {
        let wikipediaContext: string | undefined;
        let wikiTitle: string | undefined;

        if (job.useWikipedia) {
          const article = await fetchWikipediaArticle(minorGenre);
          if (article) {
            wikipediaContext = article.extract;
            wikiTitle = article.title;
          }
        }

        const prompt = buildPrompt({
          majorGenre: job.majorGenre,
          minorGenre,
          answerFormat: job.answerFormat,
          wikipediaContext,
        });

        let fullText = '';

        await service.streamGenerate(
          prompt,
          job.modelName,
          (event) => {
            if (event.type === 'chunk') fullText += event.content;
          },
          abortController.signal,
        );

        if (abortController.signal.aborted) break;

        const parsedQuizzes = parseQuizTSV(fullText);

        const savedIds = await Promise.all(
          parsedQuizzes.map(async (q) => {
            const quiz = await Quiz.create({
              question: q.question,
              answer: q.answer,
              charCount: q.charCount,
              majorGenre: job.majorGenre,
              minorGenre,
              answerFormat: job.answerFormat,
              llmBackend: job.llmBackend,
              modelName: job.modelName,
              wikiTitle,
              batchJobId: job._id,
            });
            return quiz._id;
          }),
        );

        await BatchJob.findByIdAndUpdate(jobId, {
          $inc: {completedCount: 1},
          $push: {quizIds: {$each: savedIds}},
        });
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error(`Batch job ${jobId} failed for genre ${minorGenre}:`, err);
        }
      }
    }

    if (!abortController.signal.aborted) {
      await BatchJob.findByIdAndUpdate(jobId, {status: 'completed'});
    } else {
      await BatchJob.findByIdAndUpdate(jobId, {status: 'failed'});
    }
  } catch (err) {
    console.error(`Batch job ${jobId} failed:`, err);
    await BatchJob.findByIdAndUpdate(jobId, {status: 'failed'});
  } finally {
    activeJobs.delete(jobId);
  }
}

router.post('/', async (req: Request, res: Response) => {
  const {majorGenre, answerFormat, minorGenres, llmBackend, modelName, useWikipedia} =
    req.body as {
      majorGenre: string;
      answerFormat: string;
      minorGenres: string[];
      llmBackend: 'ollama' | 'claude' | 'llama-server';
      modelName: string;
      useWikipedia?: boolean;
    };

  if (!majorGenre || !answerFormat || !Array.isArray(minorGenres) || minorGenres.length === 0 || !llmBackend || !modelName) {
    res.status(400).json({error: 'Missing required fields'});
    return;
  }

  const job = await BatchJob.create({
    majorGenre,
    answerFormat,
    minorGenres,
    llmBackend,
    modelName,
    useWikipedia: useWikipedia ?? false,
    totalCount: minorGenres.length,
  });

  const jobId = String(job._id);
  const abortController = new AbortController();
  activeJobs.set(jobId, abortController);

  runBatchJob(jobId).catch(console.error);

  res.status(202).json({jobId});
});

router.get('/', async (_req: Request, res: Response) => {
  const jobs = await BatchJob.find().sort({createdAt: -1}).limit(50).lean();
  res.json({jobs});
});

router.get('/:id', async (req: Request, res: Response) => {
  const job = await BatchJob.findById(req.params.id).lean();
  if (!job) {
    res.status(404).json({error: 'Job not found'});
    return;
  }
  res.json(job);
});

router.get('/:id/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const jobId = req.params.id;

  const sendUpdate = async () => {
    const job = await BatchJob.findById(jobId).lean();
    if (!job) {
      res.write(`event: error\ndata: ${JSON.stringify({error: 'Job not found'})}\n\n`);
      res.end();
      clearInterval(interval);
      return;
    }

    res.write(`event: progress\ndata: ${JSON.stringify({
      status: job.status,
      currentIndex: job.currentIndex,
      totalCount: job.totalCount,
      completedCount: job.completedCount,
    })}\n\n`);

    if (job.status === 'completed' || job.status === 'failed') {
      res.write(`event: done\ndata: ${JSON.stringify({status: job.status})}\n\n`);
      res.end();
      clearInterval(interval);
    }
  };

  const interval = setInterval(sendUpdate, 1000);
  sendUpdate().catch(console.error);

  req.on('close', () => clearInterval(interval));
});

router.delete('/:id', async (req: Request, res: Response) => {
  const jobId = String(req.params.id);

  const controller = activeJobs.get(jobId);
  if (controller) {
    controller.abort();
    activeJobs.delete(jobId);
  }

  await BatchJob.findByIdAndUpdate(jobId, {status: 'failed'});
  res.json({success: true});
});

export default router;

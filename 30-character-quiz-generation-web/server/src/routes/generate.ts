import {Router, type Request, type Response} from 'express';
import {ollamaService} from '../services/llm/ollama.js';
import {claudeService} from '../services/llm/claude.js';
import {buildPrompt} from '../services/promptBuilder.js';
import {parseQuizTSV} from '../services/quizParser.js';
import {fetchWikipediaArticle} from '../services/wikipedia.js';
import {Quiz} from '../db/models/Quiz.js';
import type {LLMService} from '../services/llm/index.js';

const router = Router();

function sendSSE(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.post('/', async (req: Request, res: Response) => {
  const {
    majorGenre,
    minorGenre,
    answerFormat,
    llmBackend,
    modelName,
    useWikipedia,
    wikiTitle,
  } = req.body as {
    majorGenre: string;
    minorGenre: string;
    answerFormat: string;
    llmBackend: 'ollama' | 'claude';
    modelName: string;
    useWikipedia?: boolean;
    wikiTitle?: string;
  };

  if (!majorGenre || !minorGenre || !answerFormat || !llmBackend || !modelName) {
    res.status(400).json({error: 'Missing required fields'});
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

  try {
    let wikipediaContext: string | undefined;
    let resolvedWikiTitle: string | undefined;

    if (useWikipedia) {
      const searchTitle = wikiTitle || minorGenre;
      sendSSE(res, 'status', {message: `Wikipedia記事「${searchTitle}」を取得中...`});
      const article = await fetchWikipediaArticle(searchTitle);
      if (article) {
        wikipediaContext = article.extract;
        resolvedWikiTitle = article.title;
        sendSSE(res, 'status', {message: `Wikipedia記事「${article.title}」を取得しました`});
      } else {
        sendSSE(res, 'status', {message: 'Wikipedia記事が見つかりませんでした。記事なしで続行します'});
      }
    }

    const prompt = buildPrompt({majorGenre, minorGenre, answerFormat, wikipediaContext});

    const service: LLMService = llmBackend === 'claude' ? claudeService : ollamaService;

    let fullText = '';

    await service.streamGenerate(
      prompt,
      modelName,
      (event) => {
        if (event.type === 'chunk') {
          fullText += event.content;
          sendSSE(res, 'chunk', {content: event.content});
        } else if (event.type === 'done') {
          // handled below
        } else if (event.type === 'error') {
          sendSSE(res, 'error', {error: event.error});
        }
      },
      abortController.signal,
    );

    const parsedQuizzes = parseQuizTSV(fullText);

    const savedQuizzes = await Promise.all(
      parsedQuizzes.map((q) =>
        Quiz.create({
          question: q.question,
          answer: q.answer,
          charCount: q.charCount,
          majorGenre,
          minorGenre,
          answerFormat,
          llmBackend,
          modelName,
          wikiTitle: resolvedWikiTitle,
        }),
      ),
    );

    sendSSE(res, 'result', {
      quizzes: savedQuizzes.map((q) => ({
        id: q._id,
        question: q.question,
        answer: q.answer,
        charCount: q.charCount,
      })),
      count: savedQuizzes.length,
    });

    sendSSE(res, 'done', {});
  } catch (err) {
    if (!abortController.signal.aborted) {
      sendSSE(res, 'error', {error: err instanceof Error ? err.message : String(err)});
    }
  } finally {
    res.end();
  }
});

router.get('/models', async (req: Request, res: Response) => {
  const backend = req.query.backend as string;
  try {
    const service: LLMService = backend === 'claude' ? claudeService : ollamaService;
    const models = await service.listModels();
    res.json({models});
  } catch (err) {
    // Ollamaが起動していない場合など、空リストを返してUIを壊さない
    const message = err instanceof Error ? err.message : String(err);
    res.json({models: [], warning: message});
  }
});

export default router;

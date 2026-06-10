import {Router, type Request, type Response} from 'express';
import {Quiz} from '../db/models/Quiz.js';

const router = Router();

router.get('/tsv', async (req: Request, res: Response) => {
  const {majorGenre, minorGenre, from, to, onlyExact} = req.query;

  const filter: Record<string, unknown> = {};
  if (majorGenre) filter.majorGenre = majorGenre;
  if (minorGenre) filter.minorGenre = minorGenre;
  if (from || to) {
    filter.createdAt = {};
    if (from) (filter.createdAt as Record<string, unknown>).$gte = new Date(String(from));
    if (to) (filter.createdAt as Record<string, unknown>).$lte = new Date(String(to));
  }
  if (onlyExact === 'true') filter.charCount = 30;

  const quizzes = await Quiz.find(filter).sort({createdAt: -1}).lean();

  const lines = [
    '問題文\t答え\t大ジャンル\t小ジャンル\t答えの形式\t文字数',
    ...quizzes.map((q) =>
      [q.question, q.answer, q.majorGenre, q.minorGenre, q.answerFormat, q.charCount].join('\t'),
    ),
  ];

  const tsv = lines.join('\n');

  res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="quizzes.tsv"');
  res.send(tsv);
});

export default router;

import {Router, type Request, type Response} from 'express';
import {Quiz} from '../db/models/Quiz.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const {page = '1', limit = '20', majorGenre, minorGenre, from, to} = req.query;

  const pageNum = parseInt(String(page), 10);
  const limitNum = parseInt(String(limit), 10);

  const filter: Record<string, unknown> = {};
  if (majorGenre) filter.majorGenre = majorGenre;
  if (minorGenre) filter.minorGenre = minorGenre;
  if (from || to) {
    filter.createdAt = {};
    if (from) (filter.createdAt as Record<string, unknown>).$gte = new Date(String(from));
    if (to) (filter.createdAt as Record<string, unknown>).$lte = new Date(String(to));
  }

  const [quizzes, total] = await Promise.all([
    Quiz.find(filter)
      .sort({createdAt: -1})
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Quiz.countDocuments(filter),
  ]);

  res.json({quizzes, total, page: pageNum, limit: limitNum});
});

router.delete('/:id', async (req: Request, res: Response) => {
  const {id} = req.params;
  const result = await Quiz.findByIdAndDelete(id);
  if (!result) {
    res.status(404).json({error: 'Quiz not found'});
    return;
  }
  res.json({success: true});
});

export default router;

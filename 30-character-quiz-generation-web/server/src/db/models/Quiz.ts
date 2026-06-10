import mongoose, {type Document, type Types} from 'mongoose';

export interface IQuiz extends Document {
  question: string;
  answer: string;
  majorGenre: string;
  minorGenre: string;
  answerFormat: string;
  llmBackend: 'ollama' | 'claude' | 'llama-server';
  modelName: string;
  wikiTitle?: string;
  batchJobId?: Types.ObjectId;
  charCount: number;
  createdAt: Date;
}

const quizSchema = new mongoose.Schema<IQuiz>({
  question: {type: String, required: true},
  answer: {type: String, required: true},
  majorGenre: {type: String, required: true},
  minorGenre: {type: String, required: true},
  answerFormat: {type: String, required: true},
  llmBackend: {type: String, enum: ['ollama', 'claude', 'llama-server'], required: true},
  modelName: {type: String, required: true},
  wikiTitle: {type: String},
  batchJobId: {type: mongoose.Schema.Types.ObjectId, ref: 'BatchJob'},
  charCount: {type: Number, required: true},
  createdAt: {type: Date, default: Date.now},
});

quizSchema.index({majorGenre: 1, minorGenre: 1});
quizSchema.index({createdAt: -1});
quizSchema.index({batchJobId: 1});

export const Quiz = mongoose.model<IQuiz>('Quiz', quizSchema);

import mongoose, {type Document, type Types} from 'mongoose';

export interface IBatchJob extends Document {
  status: 'pending' | 'running' | 'completed' | 'failed';
  majorGenre: string;
  answerFormat: string;
  minorGenres: string[];
  llmBackend: 'ollama' | 'claude' | 'llama-server';
  modelName: string;
  useWikipedia: boolean;
  currentIndex: number;
  totalCount: number;
  completedCount: number;
  quizIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const batchJobSchema = new mongoose.Schema<IBatchJob>({
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  },
  majorGenre: {type: String, required: true},
  answerFormat: {type: String, required: true},
  minorGenres: [{type: String, required: true}],
  llmBackend: {type: String, enum: ['ollama', 'claude', 'llama-server'], required: true},
  modelName: {type: String, required: true},
  useWikipedia: {type: Boolean, default: false},
  currentIndex: {type: Number, default: 0},
  totalCount: {type: Number, required: true},
  completedCount: {type: Number, default: 0},
  quizIds: [{type: mongoose.Schema.Types.ObjectId, ref: 'Quiz'}],
}, {timestamps: true});

export const BatchJob = mongoose.model<IBatchJob>('BatchJob', batchJobSchema);

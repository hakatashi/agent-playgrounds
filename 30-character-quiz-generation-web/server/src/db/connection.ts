import mongoose from 'mongoose';
import {config} from '../config.js';

export async function connectDB(): Promise<void> {
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');
}

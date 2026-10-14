import mongoose from 'mongoose';

const flashcardSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, maxlength: 240 },
  answer: { type: String, required: true, trim: true, maxlength: 1_000 },
}, { _id: false });

const quizQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, maxlength: 240 },
  options: [{ type: String, required: true, trim: true, maxlength: 240 }],
  correctOptionIndex: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, required: true, trim: true, maxlength: 1_000 },
}, { _id: false });

const studySetSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, immutable: true, index: true },
  type: { type: String, required: true, enum: ['flashcards', 'quiz'] },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  source: {
    sourceType: { type: String, required: true, enum: ['note', 'document'] },
    sourceId: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
  },
  cards: { type: [flashcardSchema], default: undefined },
  questions: { type: [quizQuestionSchema], default: undefined },
}, { timestamps: true, versionKey: false });

studySetSchema.index({ ownerId: 1, type: 1, updatedAt: -1 });

export const StudySet = mongoose.models.StudySet || mongoose.model('StudySet', studySetSchema);

import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, immutable: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  content: { type: String, required: true, maxlength: 50000 },
  folderId: { type: String, default: null, maxlength: 100 },
  tags: { type: [String], default: [] },
  version: { type: Number, default: 0, min: 0 },
}, { timestamps: true, versionKey: false });

noteSchema.index({ ownerId: 1, updatedAt: -1 });
noteSchema.index({ ownerId: 1, title: 'text', content: 'text' });

export const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);

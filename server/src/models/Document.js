import mongoose from 'mongoose';

const extractedPageSchema = new mongoose.Schema({
  pageNumber: { type: Number, required: true, min: 1 },
  text: { type: String, required: true, maxlength: 500_000 },
}, { _id: false });

const documentSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, immutable: true, index: true },
  originalName: { type: String, required: true, trim: true, maxlength: 180 },
  format: { type: String, required: true, enum: ['pdf', 'docx', 'txt', 'md'] },
  mimeType: {
    type: String,
    required: true,
    enum: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ],
  },
  size: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
  cloudinaryPublicId: { type: String, required: true, unique: true },
  processingStatus: { type: String, required: true, enum: ['uploaded', 'processing', 'ready', 'failed', 'deleting'], default: 'uploaded' },
  processingError: { type: String, default: null, maxlength: 300 },
  processingRunId: { type: String, default: null, maxlength: 100 },
  processingAttempts: { type: Number, default: 0, min: 0 },
  processingStartedAt: { type: Date, default: null },
  extractedPages: { type: [extractedPageSchema], default: [] },
  extractedChunkCount: { type: Number, default: 0, min: 0 },
  processedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  folderId: { type: String, default: null, maxlength: 100 },
  tags: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

documentSchema.index({ ownerId: 1, updatedAt: -1 });
documentSchema.index({ processingStatus: 1, processingStartedAt: 1 });

export const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);

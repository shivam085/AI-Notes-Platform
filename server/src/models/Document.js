import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, immutable: true, index: true },
  originalName: { type: String, required: true, trim: true, maxlength: 180 },
  format: { type: String, required: true, enum: ['pdf'] },
  mimeType: { type: String, required: true, enum: ['application/pdf'] },
  size: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
  cloudinaryPublicId: { type: String, required: true, unique: true },
  processingStatus: { type: String, required: true, enum: ['uploaded'], default: 'uploaded' },
  folderId: { type: String, default: null, maxlength: 100 },
  tags: { type: [String], default: [] },
}, { timestamps: true, versionKey: false });

documentSchema.index({ ownerId: 1, updatedAt: -1 });

export const Document = mongoose.models.Document || mongoose.model('Document', documentSchema);

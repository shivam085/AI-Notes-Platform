import mongoose from 'mongoose';

const knowledgeChunkSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, immutable: true, index: true },
  sourceType: { type: String, required: true, enum: ['document', 'note'] },
  sourceId: { type: String, required: true },
  position: { type: Number, required: true, min: 0 },
  pageNumber: { type: Number, default: null, min: 1 },
  text: { type: String, required: true, trim: true, maxlength: 2_000 },
}, { timestamps: true, versionKey: false });

knowledgeChunkSchema.index({ ownerId: 1, sourceType: 1, sourceId: 1, position: 1 }, { unique: true });

export const KnowledgeChunk = mongoose.models.KnowledgeChunk || mongoose.model('KnowledgeChunk', knowledgeChunkSchema);

import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema({
  chunkId: { type: String, required: true },
  sourceType: { type: String, required: true, enum: ['document'] },
  sourceId: { type: String, required: true },
  title: { type: String, required: true, maxlength: 180 },
  pageNumber: { type: Number, default: null, min: 1 },
  position: { type: Number, required: true, min: 0 },
}, { _id: false });

const messageSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, immutable: true, index: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Conversation', index: true },
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: { type: String, required: true, trim: true, maxlength: 12_000 },
  grounded: { type: Boolean, required: true, default: false },
  sources: { type: [sourceSchema], default: [] },
}, { timestamps: true, versionKey: false });

messageSchema.index({ ownerId: 1, conversationId: 1, createdAt: 1 });

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, immutable: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  lastMessageAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true, versionKey: false });

conversationSchema.index({ ownerId: 1, lastMessageAt: -1 });

export const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);

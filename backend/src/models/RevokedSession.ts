import mongoose from 'mongoose';

const revokedSessionSchema = new mongoose.Schema({
  _id: String,
  expiresAt: Date,
});

revokedSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export = mongoose.model('revoked_sessions', revokedSessionSchema);

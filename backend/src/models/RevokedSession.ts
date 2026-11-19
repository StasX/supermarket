import mongoose from 'mongoose';

const revokedSessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, match: /^[a-f\d]{64}$/ },
    // A legacy token without an expiration keeps its revocation record.
    expiresAt: { type: Date, default: null },
  },
  { strict: 'throw' },
);

revokedSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export = mongoose.model('revoked_sessions', revokedSessionSchema);

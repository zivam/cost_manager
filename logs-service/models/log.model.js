const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },
    service: { type: String, required: true },
    type: { type: String, required: true },
    method: { type: String },
    path: { type: String },
    statusCode: { type: Number },
    responseTimeMs: { type: Number },
    message: { type: String },
    meta: { type: Object }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Log', logSchema, 'logs');

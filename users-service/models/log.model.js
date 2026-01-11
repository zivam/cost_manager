const mongoose = require('mongoose');

const logSchema = new mongoose.Schema(
  {
    service: { type: String, required: true },
    method: { type: String, required: true },
    url: { type: String, required: true },
    statusCode: { type: Number, required: true },
    time: { type: Date, required: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Log', logSchema, 'logs');

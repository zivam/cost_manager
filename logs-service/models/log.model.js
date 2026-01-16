const mongoose = require('mongoose');

/**
 * Log schema for storing application logs.
 * This schema is flexible and can store various types of log entries with optional fields.
 */
const logSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },              // Timestamp of the log entry
    service: { type: String, required: true },        // Name of the service that generated the log
    type: { type: String, required: true },          // Type of log (e.g., 'request', 'endpoint')
    method: { type: String },                         // HTTP method (optional, for request logs)
    path: { type: String },                           // Request path (optional, for request logs)
    statusCode: { type: Number },                     // HTTP status code (optional, for request logs)
    responseTimeMs: { type: Number },                 // Response time in milliseconds (optional)
    message: { type: String },                        // Log message (optional)
    meta: { type: Object }                            // Additional metadata object (optional)
  },
  { versionKey: false }  // Disable __v version key
);

module.exports = mongoose.model('Log', logSchema, 'logs');

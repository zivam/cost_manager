const mongoose = require('mongoose');

/**
 * Log schema for storing HTTP request logs.
 * This schema tracks service requests with method, URL, status code, and timestamp.
 */
const logSchema = new mongoose.Schema(
  {
    service: { type: String, required: true },      // Name of the service that made the request
    method: { type: String, required: true },       // HTTP method (GET, POST, etc.)
    url: { type: String, required: true },           // Request URL/path
    statusCode: { type: Number, required: true },   // HTTP response status code
    time: { type: Date, required: true }             // Timestamp of the request
  },
  { versionKey: false }  // Disable __v version key
);

module.exports = mongoose.model('Log', logSchema, 'logs');

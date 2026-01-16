// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pinoHttp = require('pino-http');
const Log = require('./models/log.model');

const app = express();
// Middleware: Parse JSON request bodies
app.use(express.json());
// Middleware: HTTP request logging using pino
app.use(pinoHttp());

// Connect to MongoDB database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected (logs-service)'))
  .catch(e => console.log(e.message));

/**
 * Health check endpoint.
 * Returns the service name and status to verify the service is running.
 */
app.get('/health', (req, res) => {
  res.json({ service: process.env.SERVICE_NAME, status: 'ok' });
});

// Middleware: Track request timing and save logs to database
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // Save log to database asynchronously (fail silently on error)
    new Log({
      ts: new Date(),
      service: process.env.SERVICE_NAME,
      type: 'request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTimeMs: Date.now() - start,
      message: 'request completed'
    }).save().catch(()=>{});
  });
  next();
});

/**
 * POST /api/logs
 * Endpoint for other services to send log entries.
 * Accepts a log document in the request body and saves it to the database.
 */
app.post('/api/logs', async (req, res) => {
  await new Log({
    ts: new Date(),
    ...req.body  // Spread all properties from request body into the log document
  }).save();
  res.json({ ok: true });
});

/**
 * GET /api/logs
 * Retrieves all log entries from the database, sorted by timestamp (newest first).
 */
app.get('/api/logs', async (req, res) => {
  const logs = await Log.find({}, { _id: 0 }).sort({ ts: -1 }).lean();
  res.json(logs);
});

module.exports = app;

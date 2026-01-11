require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pinoHttp = require('pino-http');
const Log = require('./models/log.model');

const app = express();
app.use(express.json());
app.use(pinoHttp());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected (logs-service)'))
  .catch(e => console.log(e.message));

app.get('/health', (req, res) => {
  res.json({ service: process.env.SERVICE_NAME, status: 'ok' });
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
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

app.post('/api/logs', async (req, res) => {
  await new Log({
    ts: new Date(),
    ...req.body
  }).save();
  res.json({ ok: true });
});

app.get('/api/logs', async (req, res) => {
  const logs = await Log.find({}).sort({ ts: -1 }).lean();
  res.json(logs);
});

module.exports = app;

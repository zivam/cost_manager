function pushLog(doc) {
  try {
    if (!process.env.LOGS_SERVICE_URL) return;
    fetch(process.env.LOGS_SERVICE_URL + '/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc)
    }).catch(()=>{});
  } catch(e){}
}
require('dotenv').config();
const express = require('express');
const pinoHttp = require('pino-http');

const app = express();

app.use(express.json());
app.use(pinoHttp());
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    pushLog({
      ts: new Date().toISOString(),
      service: process.env.SERVICE_NAME,
      type: 'request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTimeMs: Date.now() - start,
      message: 'request completed'
    });
  });
  next();
});
function sendError(res, id, message, statusCode) {
  res.status(statusCode || 400).json({ id: id, message: message });
}

app.get('/health', function (req, res) {
  res.json({ service: process.env.SERVICE_NAME, status: 'ok' });
});

/*
  GET /api/about
  Returns the developers team members (first_name + last_name only).
*/
app.get('/api/about', function (req, res) {
  try {
    res.json([
      { first_name: 'Ziv', last_name: 'Amsili' },
      { first_name: 'Oran', last_name: 'Levi' }

    ]);
  } catch (err) {
    return sendError(res, 999, err.message || 'Unknown error', 500);
  }
});

module.exports = app;





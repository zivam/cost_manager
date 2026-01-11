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
const mongoose = require('mongoose');
const pinoHttp = require('pino-http');
const User = require('./models/user.model');
const Log = require('./models/log.model');

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

mongoose.connect(process.env.MONGO_URI)
  .then(function () {
    console.log('MongoDB connected (users-service)');
  })
  .catch(function (err) {
    console.log('MongoDB connection error:', err.message);
  });

app.use(function (req, res, next) {
  res.on('finish', async function () {
    try {
      await new Log({
        service: process.env.SERVICE_NAME,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        time: new Date()
      }).save();
    } catch (e) {}
  });
  next();
});

app.get('/health', function (req, res) {
  res.json({ service: process.env.SERVICE_NAME, status: 'ok' });
});

app.post('/api/add', async function (req, res) {
  try {
    const body = req.body;

    if (body.id === undefined || body.first_name === undefined || body.last_name === undefined || body.birthday === undefined) {
      return sendError(res, 1, 'Missing required fields: id, first_name, last_name, birthday', 400);
    }
    if (typeof body.id !== 'number') {
      return sendError(res, 2, 'id must be a Number', 400);
    }
    if (typeof body.first_name !== 'string' || typeof body.last_name !== 'string') {
      return sendError(res, 3, 'first_name and last_name must be Strings', 400);
    }

    const bday = new Date(body.birthday);
    if (isNaN(bday.getTime())) {
      return sendError(res, 4, 'birthday must be a valid Date', 400);
    }

    const saved = await new User({
      id: body.id,
      first_name: body.first_name,
      last_name: body.last_name,
      birthday: bday
    }).save();

    res.json({
      id: saved.id,
      first_name: saved.first_name,
      last_name: saved.last_name,
      birthday: saved.birthday
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return sendError(res, 5, 'User with this id already exists', 400);
    }
    return sendError(res, 999, err.message || 'Unknown error', 500);
  }
});

app.get('/api/users', async function (req, res) {
  try {
    const users = await User.find({}, { _id: 0 }).lean();
    res.json(users);
  } catch (err) {
    return sendError(res, 999, err.message || 'Unknown error', 500);
  }
});

/*
  GET /api/users/:id
  Returns user details + total costs (sum of all user's costs).
*/
app.get('/api/users/:id', async function (req, res) {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return sendError(res, 6, 'User id in URL must be a Number', 400);
    }

    pushLog({
      ts: new Date().toISOString(),
      service: process.env.SERVICE_NAME,
      type: 'endpoint',
      method: 'GET',
      path: '/api/users/:id',
      message: 'endpoint accessed',
      meta: { id: userId }
    });

    const user = await User.findOne({ id: userId }, { _id: 0 }).lean();
    if (!user) {
      return sendError(res, 7, 'User not found', 404);
    }

    // Sum all costs for this user from the "costs" collection
    const agg = await mongoose.connection.collection('costs').aggregate([
      { $match: { userid: userId } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$sum' } } } }
    ]).toArray();const total = (agg && agg.length > 0 && typeof agg[0].total === 'number') ? agg[0].total : 0;

    res.json({
      first_name: user.first_name,
      last_name: user.last_name,
      id: user.id,
      total: total
    });
  } catch (err) {
    return sendError(res, 999, err.message || 'Unknown error', 500);
  }
});module.exports = app;






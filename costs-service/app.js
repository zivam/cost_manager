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

const Cost = require('./models/cost.model');
const Report = require('./models/report.model');

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

const ALLOWED_CATEGORIES = ['food', 'health', 'housing', 'sports', 'education'];

mongoose.connect(process.env.MONGO_URI)
  .then(function () {
    console.log('MongoDB connected (costs-service)');
  })
  .catch(function (err) {
    console.log('MongoDB connection error:', err.message);
  });

app.get('/health', function (req, res) {
  res.json({ service: process.env.SERVICE_NAME, status: 'ok' });
});

/*
  POST /api/add
  Add a new cost item.
  - If createdAt is not provided, use server time.
  - Server does NOT allow adding costs with dates that belong to the past.
*/
app.post('/api/add', async function (req, res) {
  try {
    const body = req.body;

    if (body.description === undefined || body.category === undefined || body.userid === undefined || body.sum === undefined) {
      return sendError(res, 1, 'Missing required fields: description, category, userid, sum', 400);
    }

    if (typeof body.description !== 'string') {
      return sendError(res, 2, 'description must be a String', 400);
    }

    if (typeof body.category !== 'string' || ALLOWED_CATEGORIES.indexOf(body.category) === -1) {
      return sendError(res, 3, 'category must be one of: food, health, housing, sports, education', 400);
    }

    if (typeof body.userid !== 'number') {
      return sendError(res, 4, 'userid must be a Number', 400);
    }

    if (typeof body.sum !== 'number') {
      return sendError(res, 5, 'sum must be a Number', 400);
    }

    const now = new Date();
    const createdAt = body.createdAt ? new Date(body.createdAt) : now;

    if (isNaN(createdAt.getTime())) {
      return sendError(res, 6, 'createdAt must be a valid Date if provided', 400);
    }

    // Block "past" dates (strict): createdAt < now
    if (createdAt.getTime() < now.getTime()) {
      return sendError(res, 7, 'Cannot add costs with dates in the past', 400);
    }

    const saved = await new Cost({
      description: body.description,
      category: body.category,
      userid: body.userid,
      sum: body.sum,
      createdAt: createdAt
    }).save();

    res.json({
      description: saved.description,
      category: saved.category,
      userid: saved.userid,
      sum: saved.sum,
      createdAt: saved.createdAt
    });
  } catch (err) {
    return sendError(res, 999, err.message || 'Unknown error', 500);
  }
});

/*
  Helper: Build the report JSON in the required format.
*/
function buildReport(userid, year, month, costs) {
  function dayOfMonth(d) {
    return new Date(d).getDate();
  }

  const grouped = {
    food: [],
    education: [],
    health: [],
    housing: [],
    sports: []
  };

  for (let i = 0; i < costs.length; i++) {
    const c = costs[i];
    if (grouped[c.category]) {
      grouped[c.category].push({
        sum: c.sum,
        description: c.description,
        day: dayOfMonth(c.createdAt)
      });
    }
  }

  return {
    userid: userid,
    year: year,
    month: month,
    costs: [
      { food: grouped.food },
      { education: grouped.education },
      { health: grouped.health },
      { housing: grouped.housing },
      { sports: grouped.sports }
    ]
  };
}

/*
  GET /api/report?id=123123&year=2025&month=11
  Computed Design Pattern:
  - If report requested for a past month and cached in DB => return cached.
  - Otherwise compute from costs and (if past) save it.
*/
app.get('/api/report', async function (req, res) {
  try {
    const userid = Number(req.query.id);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (Number.isNaN(userid) || Number.isNaN(year) || Number.isNaN(month)) {
      return sendError(res, 20, 'Query params must be Numbers: id, year, month', 400);
    }

    if (month < 1 || month > 12) {
      return sendError(res, 21, 'month must be between 1 and 12', 400);
    }

    const now = new Date();
    const isPastMonth = (year < now.getFullYear()) || (year === now.getFullYear() && month < (now.getMonth() + 1));

    if (isPastMonth) {
      const cached = await Report.findOne({ userid: userid, year: year, month: month }).lean();
      if (cached && cached.report) {
        return res.json(cached.report);
      }
    }

    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);

    const costs = await Cost.find(
      { userid: userid, createdAt: { $gte: start, $lt: end } },
      { _id: 0, description: 1, category: 1, userid: 1, sum: 1, createdAt: 1 }
    ).lean();

    const report = buildReport(userid, year, month, costs);

    if (isPastMonth) {
      try {
        await new Report({
          userid: userid,
          year: year,
          month: month,
          report: report,
          createdAt: new Date()
        }).save();
      } catch (e) {
        // ignore duplicate cache
      }
    }

    return res.json(report);
  } catch (err) {
    return sendError(res, 999, err.message || 'Unknown error', 500);
  }
});

module.exports = app;





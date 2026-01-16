/**
 * Sends a log document to the logs service asynchronously.
 * This function fails silently if the logs service is unavailable.
 * @param {Object} doc - The log document to send
 */
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

// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const pinoHttp = require('pino-http');

// Import Mongoose models
const Cost = require('./models/cost.model');
const Report = require('./models/report.model');
const Log = require('./models/log.model');

const app = express();

// Middleware: Parse JSON request bodies
app.use(express.json());
// Middleware: HTTP request logging using pino
app.use(pinoHttp());
// Middleware: Track request timing and send logs to logs service
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const logDoc = {
      ts: new Date(),
      service: process.env.SERVICE_NAME,
      type: 'request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTimeMs: Date.now() - start,
      message: 'request completed'
    };
    // Save log to local MongoDB database
    new Log(logDoc).save().catch(() => {});
    // Also send to centralized logs service
    pushLog(logDoc);
  });
  next();
});

/**
 * Helper function to send standardized error responses.
 * @param {Object} res - Express response object
 * @param {number} id - Error ID code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (defaults to 400)
 */
function sendError(res, id, message, statusCode) {
  res.status(statusCode || 400).json({ id: id, message: message });
}

// Valid cost categories that can be used when adding costs
const ALLOWED_CATEGORIES = ['food', 'health', 'housing', 'sports', 'education'];

// Connect to MongoDB database
mongoose.connect(process.env.MONGO_URI)
  .then(function () {
    console.log('MongoDB connected (costs-service)');
  })
  .catch(function (err) {
    console.log('MongoDB connection error:', err.message);
  });

/**
 * Health check endpoint.
 * Returns the service name and status to verify the service is running.
 */
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

    // Verify that the user exists in the users collection before adding a cost
    const userExists = await mongoose.connection.collection('users').findOne({ id: body.userid });
    if (!userExists) {
      return sendError(res, 8, 'User with this userid does not exist', 400);
    }

    // Use current time if createdAt is not provided, otherwise parse the provided date
    const now = new Date();
    const createdAt = body.createdAt ? new Date(body.createdAt) : now;

    // Validate that the date is valid
    if (isNaN(createdAt.getTime())) {
      return sendError(res, 6, 'createdAt must be a valid Date if provided', 400);
    }

    // Business rule: Block "past" dates (strict): createdAt < now
    // Server does NOT allow adding costs with dates that belong to the past
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

/**
 * Helper function: Build the report JSON in the required format.
 * Groups costs by category and extracts the day of month for each cost.
 * @param {number} userid - User ID
 * @param {number} year - Year for the report
 * @param {number} month - Month for the report (1-12)
 * @param {Array} costs - Array of cost documents
 * @returns {Object} Report object with userid, year, month, and grouped costs
 */
function buildReport(userid, year, month, costs) {
  /**
   * Extract the day of month from a date.
   * @param {Date} d - Date object
   * @returns {number} Day of month (1-31)
   */
  function dayOfMonth(d) {
    return new Date(d).getDate();
  }

  // Initialize grouped costs object with all allowed categories
  const grouped = {
    food: [],
    education: [],
    health: [],
    housing: [],
    sports: []
  };

  // Group costs by category and extract day of month
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

    // Determine if the requested month is in the past
    const now = new Date();
    const isPastMonth = (year < now.getFullYear()) || (year === now.getFullYear() && month < (now.getMonth() + 1));

    // Computed Design Pattern: If report requested for a past month and cached in DB => return cached
    if (isPastMonth) {
      const cached = await Report.findOne({ userid: userid, year: year, month: month }).lean();
      if (cached && cached.report) {
        return res.json(cached.report);
      }
    }

    // Calculate the start and end dates for the requested month
    // Start: first day of the month at 00:00:00
    // End: first day of the next month at 00:00:00 (exclusive)
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 1, 0, 0, 0, 0);

    // Query all costs for this user within the specified month
    const costs = await Cost.find(
      { userid: userid, createdAt: { $gte: start, $lt: end } },
      { _id: 0, description: 1, category: 1, userid: 1, sum: 1, createdAt: 1 }
    ).lean();

    // Build the report from the costs
    const report = buildReport(userid, year, month, costs);

    // Computed Design Pattern: If past month, save the computed report to cache for future requests
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
        // Ignore duplicate cache errors (if report already exists)
      }
    }

    return res.json(report);
  } catch (err) {
    return sendError(res, 999, err.message || 'Unknown error', 500);
  }
});

module.exports = app;





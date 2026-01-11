const mongoose = require('mongoose');
require('mongoose-double')(mongoose);

const Double = mongoose.Schema.Types.Double;

/*
  Cost schema for the costs collection.
  Fields required by project:
  - description: String
  - category: String (food/health/housing/sports/education)
  - userid: Number
  - sum: Double
  Extra:
  - createdAt: Date (used to get day/month/year for reports)
*/
const costSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    category: { type: String, required: true },
    userid: { type: Number, required: true },
    sum: { type: Double, required: true },
    createdAt: { type: Date, required: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('Cost', costSchema, 'costs');

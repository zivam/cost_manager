const mongoose = require('mongoose');
// Register mongoose-double plugin to support Double type for precise decimal numbers
require('mongoose-double')(mongoose);

const Double = mongoose.Schema.Types.Double;

/**
 * Cost schema for the costs collection.
 * Fields required by project:
 * - description: String - Description of the cost item
 * - category: String - One of: food, health, housing, sports, education
 * - userid: Number - ID of the user who owns this cost
 * - sum: Double - Cost amount (using Double type for precise decimal handling)
 * Extra:
 * - createdAt: Date - Timestamp when the cost was created (used to get day/month/year for reports)
 */
const costSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },   // Description of the cost item
    category: { type: String, required: true },       // Cost category (must be one of the allowed categories)
    userid: { type: Number, required: true },         // User ID who owns this cost
    sum: { type: Double, required: true },             // Cost amount (Double for decimal precision)
    createdAt: { type: Date, required: true }         // Creation timestamp
  },
  { versionKey: false }  // Disable __v version key
);

module.exports = mongoose.model('Cost', costSchema, 'costs');

const mongoose = require('mongoose');

/*
  Computed Design Pattern:
  We cache reports for past months. If requested again, we return the saved report.
*/
const reportSchema = new mongoose.Schema(
  {
    userid: { type: Number, required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    report: { type: Object, required: true },
    createdAt: { type: Date, required: true }
  },
  { versionKey: false }
);

reportSchema.index({ userid: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema, 'reports');

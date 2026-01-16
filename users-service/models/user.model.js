const mongoose = require('mongoose');

/**
 * User schema for the users collection.
 * IMPORTANT:
 * - 'id' (Number) is NOT MongoDB '_id' (ObjectId). Do not mix them.
 * - The 'id' field is the application-level user identifier and must be unique.
 */
const userSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },  // Application-level user ID (not MongoDB _id)
    first_name: { type: String, required: true },        // User's first name
    last_name: { type: String, required: true },          // User's last name
    birthday: { type: Date, required: true }             // User's birthday date
  },
  { versionKey: false }  // Disable __v version key
);

module.exports = mongoose.model('User', userSchema, 'users');

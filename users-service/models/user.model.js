const mongoose = require('mongoose');

/*
  User schema for the users collection.
  IMPORTANT:
  - 'id' (Number) is NOT MongoDB '_id' (ObjectId). Do not mix them.
*/
const userSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true, unique: true },
    first_name: { type: String, required: true },
    last_name: { type: String, required: true },
    birthday: { type: Date, required: true }
  },
  { versionKey: false }
);

module.exports = mongoose.model('User', userSchema, 'users');

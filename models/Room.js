const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  privacy: { type: String, enum: ['public', 'private'], default: 'public' }, // Public or Private
  password: { type: String, required: false }, // Password for private rooms (if any)
});

module.exports = mongoose.model('Room', RoomSchema);

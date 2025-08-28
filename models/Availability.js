const mongoose = require('mongoose');
const AvailabilitySchema = new mongoose.Schema({
    professor: { type: mongoose.Schema.Types.ObjectId,ref: 'User',required: true },
    date: { type: String, required: true },
    timeSlot: { type: String, required: true },
    isBooked: { type: Boolean, default: false }
});
module.exports = mongoose.model('Availability', AvailabilitySchema);
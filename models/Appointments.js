const mongoose = require('mongoose');
const AppointmentSchema = new mongoose.Schema({
    student:{type:mongoose.Schema.Types.ObjectId,ref:'User', required: true },
    professor: {type:mongoose.Schema.Types.ObjectId,ref:'User', required: true },

    availability: {type: mongoose.Schema.Types.ObjectId,ref: 'Availability', required: true },
    
    date: {type:String, required:true },

    timeSlot: {type: String, required:true },

    status: {type: String, enum:['pending', 'confirmed', 'canceled'], default:'pending' },
});
module.exports = mongoose.model('Appointment', AppointmentSchema);
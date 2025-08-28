const mongoose = require('mongoose');
const UserSchema= new mongoose.Schema({
    name:{type:String, required: true},
    email:{type:String,requires: true, unique:true},
    password: { type: String, required: true },
    role: { type: String, enum: ['student','professor'], required: true },
});
module.exports = mongoose.model('User',UserSchmea);

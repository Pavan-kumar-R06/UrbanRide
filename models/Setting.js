const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, value: mongoose.Schema.Types.Mixed });
module.exports = mongoose.model('Setting', schema);

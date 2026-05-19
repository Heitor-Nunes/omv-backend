const mongoose = require("mongoose");

const accessLogSchema = new mongoose.Schema({
  user:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  email:  { type: String, required: true },
  action: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("AccessLog", accessLogSchema);

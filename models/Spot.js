const mongoose = require("mongoose");

const spotSchema = new mongoose.Schema({
  spotNumber:        { type: Number, required: true, unique: true },
  row:               { type: String, required: true, enum: ["A","B","C","D"] },
  status:            { type: String, enum: ["available","occupied","reserved","preferential"], default: "available" },
  originalStatus:    { type: String, enum: ["available","occupied","preferential"], default: "available" },
  reservedBy:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  activeReservation: { type: mongoose.Schema.Types.ObjectId, ref: "Reservation", default: null },
  sensorOccupied:    { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Spot", spotSchema);

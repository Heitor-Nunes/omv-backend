const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  spot:         { type: mongoose.Schema.Types.ObjectId, ref: "Spot", required: true },
  spotNumber:   { type: Number, required: true },
  startTime:    { type: Date, required: true },
  startTimeStr: { type: String, required: true },
  placa:        { type: String, default: "" },
  modelo:       { type: String, default: "" },
  endTime:      { type: Date, default: null },
  totalSeconds: { type: Number, default: 0 },
  totalPrice:   { type: Number, default: 0 },
  reservationFee:{ type: Number, default: 10 },
  feePaid:      { type: Boolean, default: false },
  feeRefunded:  { type: Boolean, default: false },
  noShowAt:     { type: Date, default: null },
  cancelledAt:  { type: Date, default: null },
  status: {
    type: String,
    enum: ["active", "paid", "cancelled", "no_show"],
    default: "active",
  },
}, { timestamps: true });

module.exports = mongoose.model("Reservation", reservationSchema);

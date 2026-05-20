const express     = require("express");
const Reservation = require("../models/Reservation");
const Spot        = require("../models/Spot");
const AccessLog   = require("../models/AccessLog");
const User        = require("../models/User");
const { protect } = require("../middleware/auth");

const router         = express.Router();
const PRICE_PER_HOUR = 80;

router.get("/mine", protect, async (req, res) => {
  try {
    const r = await Reservation.findOne({ user: req.user._id, status: "active" }).populate("spot");
    res.json(r || null);
  } catch (err) {
    res.status(500).json({ message: "Erro.", error: err.message });
  }
});

router.get("/history", protect, async (req, res) => {
  try {
    const history = await Reservation.find({ user: req.user._id, status: "paid" })
      .sort({ createdAt: -1 }).limit(20);
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: "Erro.", error: err.message });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const { spotId, startTimeStr, startDate, placa, modelo } = req.body;
    if (!spotId || !startTimeStr)
      return res.status(400).json({ message: "spotId e startTimeStr são obrigatórios." });

    const existing = await Reservation.findOne({ user: req.user._id, status: "active" });
    if (existing)
      return res.status(400).json({ message: "Você já possui uma reserva ativa." });

    const spot = await Spot.findById(spotId);
    if (!spot)
      return res.status(404).json({ message: "Vaga não encontrada." });
    if (spot.status !== "available" && spot.status !== "preferential")
      return res.status(400).json({ message: "Esta vaga não está disponível." });

    // Monta a data/hora corretamente usando a data enviada
    let startTime;
    if (startDate) {
      const [y, mo, d] = startDate.split("-").map(Number);
      const [h, m]     = startTimeStr.split(":").map(Number);
      startTime = new Date(y, mo - 1, d, h, m, 0, 0);
    } else {
      const [h, m] = startTimeStr.split(":").map(Number);
      startTime = new Date();
      startTime.setHours(h, m, 0, 0);
    }

    // Se a data/hora for passada, usa o momento atual
    const now = new Date();
    if (startTime < now) startTime = now;

    const reservation = await Reservation.create({
      user: req.user._id, spot: spot._id, spotNumber: spot.spotNumber,
      startTime, startTimeStr,
      placa: placa || "", modelo: modelo || "",
    });

    spot.status            = "reserved";
    spot.reservedBy        = req.user._id;
    spot.activeReservation = reservation._id;
    await spot.save();

    await AccessLog.create({
      user: req.user._id, email: req.user.email,
      action: `Reservou vaga ${spot.spotNumber} às ${startTimeStr}${placa ? ` — Placa: ${placa}` : ""}`,
    });

    res.status(201).json(reservation);
  } catch (err) {
    res.status(500).json({ message: "Erro ao criar reserva.", error: err.message });
  }
});

router.post("/:id/pay", protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate("spot");
    if (!reservation)
      return res.status(404).json({ message: "Reserva não encontrada." });
    if (String(reservation.user) !== String(req.user._id))
      return res.status(403).json({ message: "Sem permissão." });
    if (reservation.status !== "active")
      return res.status(400).json({ message: "Reserva já encerrada." });

    const now         = new Date();
    const elapsedSecs = Math.max(0, Math.floor((now - new Date(reservation.startTime)) / 1000));
    const totalPrice  = parseFloat(((elapsedSecs / 3600) * PRICE_PER_HOUR).toFixed(2));

    reservation.status       = "paid";
    reservation.endTime      = now;
    reservation.totalSeconds = elapsedSecs;
    reservation.totalPrice   = totalPrice;
    await reservation.save();

    const spot = reservation.spot;
    spot.status            = spot.originalStatus === "preferential" ? "preferential" : "available";
    spot.reservedBy        = null;
    spot.activeReservation = null;
    await spot.save();

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalReservas: 1, totalGasto: totalPrice },
    });

    await AccessLog.create({
      user: req.user._id, email: req.user.email,
      action: `Pagou vaga ${spot.spotNumber} — R$${totalPrice.toFixed(2)}`,
    });

    res.json({ reservation, totalPrice });
  } catch (err) {
    res.status(500).json({ message: "Erro ao pagar.", error: err.message });
  }
});

router.post("/:id/cancel", protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate("spot");
    if (!reservation)
      return res.status(404).json({ message: "Reserva não encontrada." });

    const isOwner = String(reservation.user) === String(req.user._id);
    if (!isOwner && !req.user.isAdmin)
      return res.status(403).json({ message: "Sem permissão." });

    reservation.status = "cancelled";
    await reservation.save();

    if (reservation.spot) {
      reservation.spot.status            = reservation.spot.originalStatus === "preferential" ? "preferential" : "available";
      reservation.spot.reservedBy        = null;
      reservation.spot.activeReservation = null;
      await reservation.spot.save();
    }

    await AccessLog.create({
      user: req.user._id, email: req.user.email,
      action: `Cancelou reserva da vaga ${reservation.spotNumber}`,
    });

    res.json({ message: "Reserva cancelada." });
  } catch (err) {
    res.status(500).json({ message: "Erro ao cancelar.", error: err.message });
  }
});

module.exports = router;

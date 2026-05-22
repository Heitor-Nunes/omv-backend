const express     = require("express");
const Reservation = require("../models/Reservation");
const Spot        = require("../models/Spot");
const AccessLog   = require("../models/AccessLog");
const User        = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();

const PRICE_PER_HOUR   = 80;    // R$/hora após início
const RESERVATION_FEE  = 10;    // Taxa fixa de reserva (R$)
const TOLERANCE_MINUTES = 5;    // Minutos de tolerância para chegar
const NO_SHOW_FINE     = 20;    // Multa por não comparecer (R$)

// ── Verifica no-shows a cada minuto (chamado pelo servidor) ──
async function checkNoShows() {
  try {
    const now = new Date();
    const active = await Reservation.find({ status: "active" }).populate("spot");
    for (const res of active) {
      const start     = new Date(res.startTime);
      const deadline  = new Date(start.getTime() + TOLERANCE_MINUTES * 60 * 1000);
      // Passou do horário + tolerância
      if (now > deadline) {
        const spot = res.spot;
        // Se o sensor diz que a vaga está vazia (sensorOccupied = false), é no-show
        if (spot && !spot.sensorOccupied) {
          // Marca como no-show
          res.status    = "no_show";
          res.noShowAt  = now;
          res.totalPrice = NO_SHOW_FINE;
          await res.save();
          // Libera a vaga
          spot.status            = spot.originalStatus === "preferential" ? "preferential" : "available";
          spot.reservedBy        = null;
          spot.activeReservation = null;
          await spot.save();
          // Log
          await AccessLog.create({
            user: res.user, email: "sistema",
            action: `[AUTO] Vaga ${spot.spotNumber} liberada por no-show — multa R$${NO_SHOW_FINE}`,
          });
        }
      }
    }
  } catch (err) {
    console.error("Erro no checkNoShows:", err.message);
  }
}

// Roda a verificação a cada 60 segundos
setInterval(checkNoShows, 60 * 1000);

// GET /api/reservations/mine
router.get("/mine", protect, async (req, res) => {
  try {
    const r = await Reservation.findOne({
      user: req.user._id,
      status: { $in: ["active", "no_show"] },
    }).populate("spot");
    res.json(r || null);
  } catch (err) {
    res.status(500).json({ message: "Erro.", error: err.message });
  }
});

// GET /api/reservations/history
router.get("/history", protect, async (req, res) => {
  try {
    const history = await Reservation.find({
      user: req.user._id,
      status: { $in: ["paid", "no_show", "cancelled"] },
    }).sort({ createdAt: -1 }).limit(20);
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: "Erro.", error: err.message });
  }
});

// GET /api/reservations/config — retorna taxas para o frontend
router.get("/config", (req, res) => {
  res.json({
    pricePerHour:      PRICE_PER_HOUR,
    reservationFee:    RESERVATION_FEE,
    toleranceMinutes:  TOLERANCE_MINUTES,
    noShowFine:        NO_SHOW_FINE,
  });
});

// POST /api/reservations — criar reserva
router.post("/", protect, async (req, res) => {
  try {
    const { spotId, startTimeStr, startDate, placa, modelo } = req.body;
    if (!spotId || !startTimeStr)
      return res.status(400).json({ message: "spotId e startTimeStr são obrigatórios." });

    // Verifica se usuário tem reserva ativa ou no_show pendente
    const existing = await Reservation.findOne({
      user: req.user._id,
      status: { $in: ["active", "no_show"] },
    });
    if (existing)
      return res.status(400).json({ message: "Você já possui uma reserva ativa ou pendência de pagamento." });

    const spot = await Spot.findById(spotId);
    if (!spot)
      return res.status(404).json({ message: "Vaga não encontrada." });
    if (spot.status !== "available" && spot.status !== "preferential")
      return res.status(400).json({ message: "Esta vaga não está disponível." });

    // Monta data/hora
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
    const now = new Date();
    if (startTime < now) startTime = now;

    const reservation = await Reservation.create({
      user: req.user._id, spot: spot._id, spotNumber: spot.spotNumber,
      startTime, startTimeStr,
      placa: placa || "", modelo: modelo || "",
      reservationFee: RESERVATION_FEE,
      feePaid: false,
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

// POST /api/reservations/:id/pay — pagamento normal
router.post("/:id/pay", protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate("spot");
    if (!reservation)
      return res.status(404).json({ message: "Reserva não encontrada." });
    if (String(reservation.user) !== String(req.user._id))
      return res.status(403).json({ message: "Sem permissão." });
    if (!["active", "no_show"].includes(reservation.status))
      return res.status(400).json({ message: "Reserva já encerrada." });

    const now         = new Date();
    let totalPrice;

    if (reservation.status === "no_show") {
      // Pagamento de multa por no-show
      totalPrice = NO_SHOW_FINE;
    } else {
      const elapsedSecs = Math.max(0, Math.floor((now - new Date(reservation.startTime)) / 1000));
      const usagePrice  = parseFloat(((elapsedSecs / 3600) * PRICE_PER_HOUR).toFixed(2));
      totalPrice = usagePrice + RESERVATION_FEE;
      reservation.totalSeconds = elapsedSecs;
      reservation.endTime      = now;
    }

    reservation.status     = "paid";
    reservation.totalPrice = parseFloat(totalPrice.toFixed(2));
    reservation.feePaid    = true;
    await reservation.save();

    const spot = reservation.spot;
    if (spot) {
      spot.status            = spot.originalStatus === "preferential" ? "preferential" : "available";
      spot.reservedBy        = null;
      spot.activeReservation = null;
      await spot.save();
    }

    await User.findByIdAndUpdate(req.user._id, {
      $inc: { totalReservas: 1, totalGasto: totalPrice },
    });

    await AccessLog.create({
      user: req.user._id, email: req.user.email,
      action: `Pagou vaga ${reservation.spotNumber} — R$${totalPrice.toFixed(2)}${reservation.status==="no_show"?" (multa no-show)":""}`,
    });

    res.json({ reservation, totalPrice });
  } catch (err) {
    res.status(500).json({ message: "Erro ao pagar.", error: err.message });
  }
});

// POST /api/reservations/:id/cancel — cancelar
router.post("/:id/cancel", protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate("spot");
    if (!reservation)
      return res.status(404).json({ message: "Reserva não encontrada." });

    const isOwner = String(reservation.user) === String(req.user._id);
    if (!isOwner && !req.user.isAdmin)
      return res.status(403).json({ message: "Sem permissão." });

    if (reservation.status !== "active")
      return res.status(400).json({ message: "Reserva não pode ser cancelada." });

    // Verifica se cancelamento é com antecedência (> 15 min = reembolso da taxa)
    const now         = new Date();
    const start       = new Date(reservation.startTime);
    const minsUntil   = (start - now) / 60000;
    const refundFee   = minsUntil > 15;

    reservation.status        = "cancelled";
    reservation.cancelledAt   = now;
    reservation.feeRefunded   = refundFee;
    reservation.totalPrice    = refundFee ? 0 : RESERVATION_FEE;
    await reservation.save();

    if (reservation.spot) {
      reservation.spot.status            = reservation.spot.originalStatus === "preferential" ? "preferential" : "available";
      reservation.spot.reservedBy        = null;
      reservation.spot.activeReservation = null;
      await reservation.spot.save();
    }

    await AccessLog.create({
      user: req.user._id, email: req.user.email,
      action: `Cancelou reserva da vaga ${reservation.spotNumber}${refundFee ? " (taxa reembolsada)" : " (taxa retida)"}`,
    });

    res.json({
      message:    "Reserva cancelada.",
      feeRefunded: refundFee,
      totalCharge: refundFee ? 0 : RESERVATION_FEE,
    });
  } catch (err) {
    res.status(500).json({ message: "Erro ao cancelar.", error: err.message });
  }
});

module.exports = router;

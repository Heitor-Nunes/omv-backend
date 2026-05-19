const express     = require("express");
const User        = require("../models/User");
const Reservation = require("../models/Reservation");
const AccessLog   = require("../models/AccessLog");
const Spot        = require("../models/Spot");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();
router.use(protect, adminOnly);

router.get("/users", async (req, res) => {
  try { res.json(await User.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ message: "Erro.", error: err.message }); }
});

router.get("/logs", async (req, res) => {
  try { res.json(await AccessLog.find().sort({ createdAt: -1 }).limit(300)); }
  catch (err) { res.status(500).json({ message: "Erro.", error: err.message }); }
});

router.get("/reservations", async (req, res) => {
  try {
    res.json(await Reservation.find()
      .sort({ createdAt: -1 })
      .populate("user", "email username nomeCompleto cpf endereco telefone totalReservas totalGasto ativo")
      .populate("spot", "spotNumber row"));
  } catch (err) { res.status(500).json({ message: "Erro.", error: err.message }); }
});

router.get("/dashboard", async (req, res) => {
  try {
    const [totalUsers, totalRes, paidRes, spots] = await Promise.all([
      User.countDocuments({ isAdmin: false }),
      Reservation.countDocuments(),
      Reservation.countDocuments({ status: "paid" }),
      Spot.find(),
    ]);
    const rev = await Reservation.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const revWeek = await Reservation.aggregate([
      { $match: { status: "paid", updatedAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: "%d/%m", date: "$updatedAt" } }, total: { $sum: "$totalPrice" }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({
      totalUsers, totalReservations: totalRes, paidReservations: paidRes,
      activeReservations: totalRes - paidRes,
      totalRevenue: rev[0]?.total || 0,
      spotsAvailable:    spots.filter(s => s.status === "available").length,
      spotsOccupied:     spots.filter(s => s.status === "occupied" || s.status === "reserved").length,
      spotsPreferential: spots.filter(s => s.status === "preferential").length,
      revenueWeek: revWeek,
    });
  } catch (err) { res.status(500).json({ message: "Erro.", error: err.message }); }
});

router.patch("/users/:id/toggle", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Não encontrado." });
    user.ativo = !user.ativo;
    await user.save();
    res.json({ message: `Usuário ${user.ativo ? "ativado" : "desativado"}.`, user });
  } catch (err) { res.status(500).json({ message: "Erro.", error: err.message }); }
});

router.post("/reservations/:id/cancel", async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate("spot");
    if (!reservation) return res.status(404).json({ message: "Não encontrada." });
    if (reservation.status !== "active") return res.status(400).json({ message: "Já encerrada." });

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
      action: `[ADMIN] Cancelou reserva da vaga ${reservation.spotNumber}`,
    });

    res.json({ message: "Cancelada pelo admin." });
  } catch (err) { res.status(500).json({ message: "Erro.", error: err.message }); }
});

module.exports = router;

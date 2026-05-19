const express = require("express");
const Spot    = require("../models/Spot");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  try {
    const spots = await Spot.find().sort({ spotNumber: 1 });
    res.json(spots);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar vagas.", error: err.message });
  }
});

router.post("/sensor", async (req, res) => {
  const { spotNumber, occupied } = req.body;
  if (spotNumber === undefined || occupied === undefined)
    return res.status(400).json({ message: "spotNumber e occupied são obrigatórios." });

  try {
    const spot = await Spot.findOne({ spotNumber });
    if (!spot) return res.status(404).json({ message: "Vaga não encontrada." });

    spot.sensorOccupied = occupied;
    if (spot.status !== "reserved") {
      spot.status = occupied ? "occupied"
        : spot.originalStatus === "preferential" ? "preferential" : "available";
    }
    await spot.save();
    res.json({ message: "Sensor atualizado.", spot });
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar sensor.", error: err.message });
  }
});

module.exports = router;

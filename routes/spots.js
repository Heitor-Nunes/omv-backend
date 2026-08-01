const express = require("express");
const Spot    = require("../models/Spot");
const { protect, adminOnly } = require("../middleware/auth"); // <-- Adicionado adminOnly aqui

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
// Libera ou ocupa todas as vagas de uma vez
router.post("/reset", protect, adminOnly, async (req, res) => {
  try {
    const { occupied } = req.body;
    const novoStatus = occupied ? "occupied" : "available";

    const spots = await Spot.find();
    for (const spot of spots) {
      // Preferenciais voltam para "preferential" quando liberadas
      if (!occupied && spot.originalStatus === "preferential") {
        spot.status = "preferential";
      } else {
        spot.status = novoStatus;
      }
      spot.sensorOccupied = occupied;
      await spot.save();
    }

    res.json({ message: `Todas as vagas ${occupied ? "ocupadas" : "liberadas"}.` });
  } catch (err) {
    res.status(500).json({ message: "Erro.", error: err.message });
  }
});

module.exports = router;

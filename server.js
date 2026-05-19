require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.includes("vercel.app") || origin.includes("localhost")) {
      return callback(null, true);
    }
    callback(new Error("CORS bloqueado: " + origin));
  },
  credentials: true,
}));

app.use(express.json());

app.use("/api/auth",         require("./routes/auth"));
app.use("/api/spots",        require("./routes/spots"));
app.use("/api/reservations", require("./routes/reservations"));
app.use("/api/admin",        require("./routes/admin"));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", message: "Estacionamento OMV API rodando" })
);

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ Conectado ao MongoDB");
    await require("./utils/seedSpots")();
    app.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ Erro MongoDB:", err.message);
    process.exit(1);
  });

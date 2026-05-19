const express   = require("express");
const jwt       = require("jsonwebtoken");
const User      = require("../models/User");
const AccessLog = require("../models/AccessLog");
const { protect } = require("../middleware/auth");

const router    = express.Router();
const makeToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

router.post("/register", async (req, res) => {
  try {
    const { nomeCompleto, username, cpf, endereco, telefone, email, password } = req.body;

    if (!nomeCompleto || !username || !cpf || !endereco || !email || !password)
      return res.status(400).json({ message: "Preencha todos os campos obrigatórios." });

    const cpfLimpo = cpf.replace(/\D/g, "");
    if (cpfLimpo.length !== 11)
      return res.status(400).json({ message: "CPF inválido." });

    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ message: "Este email já está em uso." });

    if (await User.findOne({ username: username.toLowerCase() }))
      return res.status(400).json({ message: "Este nome de usuário já está em uso." });

    if (await User.findOne({ cpf: cpfLimpo }))
      return res.status(400).json({ message: "Este CPF já está cadastrado." });

    const user = await User.create({
      nomeCompleto, username: username.toLowerCase(),
      cpf: cpfLimpo, endereco,
      telefone: telefone || "", email, password,
    });

    await AccessLog.create({ user: user._id, email: user.email, action: "Conta criada" });
    res.status(201).json({ token: makeToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: "Erro ao criar conta.", error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Preencha todos os campos." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(400).json({ message: "Email não encontrado." });

    if (!user.ativo)
      return res.status(400).json({ message: "Conta desativada. Fale com o suporte." });

    const match = await user.comparePassword(password);
    if (!match)
      return res.status(400).json({ message: "Senha incorreta." });

    await AccessLog.create({ user: user._id, email: user.email, action: "Login realizado" });
    res.json({ token: makeToken(user._id), user });
  } catch (err) {
    res.status(500).json({ message: "Erro ao fazer login.", error: err.message });
  }
});

router.get("/me", protect, (req, res) => res.json({ user: req.user }));

module.exports = router;

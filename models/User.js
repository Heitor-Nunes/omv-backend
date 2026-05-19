const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const userSchema = new mongoose.Schema({
  nomeCompleto: { type: String, required: true, trim: true },
  username:     { type: String, required: true, unique: true, trim: true, lowercase: true },
  cpf:          { type: String, required: true, unique: true, trim: true },
  endereco:     { type: String, required: true, trim: true },
  telefone:     { type: String, default: "", trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 6 },
  isAdmin:      { type: Boolean, default: false },
  ativo:        { type: Boolean, default: true },
  totalReservas:{ type: Number, default: 0 },
  totalGasto:   { type: Number, default: 0 },
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.set("toJSON", {
  transform: (_, obj) => { delete obj.password; return obj; },
});

module.exports = mongoose.model("User", userSchema);

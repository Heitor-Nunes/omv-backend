const Spot = require("../models/Spot");

// 12 vagas — 3 por avenida
// A1-A3 | B4-B6 | C7-C9 | D10-D12 (D = preferenciais)
const SPOTS = [
  { spotNumber:1,  row:"A", originalStatus:"available"    },
  { spotNumber:2,  row:"A", originalStatus:"available"    },
  { spotNumber:3,  row:"A", originalStatus:"available"    },
  { spotNumber:4,  row:"B", originalStatus:"available"    },
  { spotNumber:5,  row:"B", originalStatus:"available"    },
  { spotNumber:6,  row:"B", originalStatus:"available"    },
  { spotNumber:7,  row:"C", originalStatus:"available"    },
  { spotNumber:8,  row:"C", originalStatus:"available"    },
  { spotNumber:9,  row:"C", originalStatus:"available"    },
  { spotNumber:10, row:"D", originalStatus:"preferential" },
  { spotNumber:11, row:"D", originalStatus:"preferential" },
  { spotNumber:12, row:"D", originalStatus:"preferential" },
];

module.exports = async function seedSpots() {
  const count = await Spot.countDocuments();
  if (count > 0) {
    console.log(`ℹ️  Vagas já existem (${count}). Seed ignorado.`);
    return;
  }
  await Spot.insertMany(SPOTS.map(s => ({ ...s, status: s.originalStatus })));
  console.log("🅿️  12 vagas criadas.");
};

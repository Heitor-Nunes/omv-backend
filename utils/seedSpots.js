const Spot = require("../models/Spot");

const SPOTS = [
  { spotNumber:1,  row:"A", originalStatus:"available"    },
  { spotNumber:2,  row:"A", originalStatus:"available"    },
  { spotNumber:3,  row:"A", originalStatus:"available"    },
  { spotNumber:4,  row:"A", originalStatus:"available"    },
  { spotNumber:5,  row:"A", originalStatus:"available"    },
  { spotNumber:6,  row:"B", originalStatus:"available"    },
  { spotNumber:7,  row:"B", originalStatus:"available"    },
  { spotNumber:8,  row:"B", originalStatus:"available"    },
  { spotNumber:9,  row:"B", originalStatus:"available"    },
  { spotNumber:10, row:"B", originalStatus:"available"    },
  { spotNumber:11, row:"C", originalStatus:"available"    },
  { spotNumber:12, row:"C", originalStatus:"available"    },
  { spotNumber:13, row:"C", originalStatus:"available"    },
  { spotNumber:14, row:"C", originalStatus:"available"    },
  { spotNumber:15, row:"C", originalStatus:"available"    },
  { spotNumber:16, row:"D", originalStatus:"preferential" },
  { spotNumber:17, row:"D", originalStatus:"preferential" },
  { spotNumber:18, row:"D", originalStatus:"preferential" },
  { spotNumber:19, row:"D", originalStatus:"preferential" },
  { spotNumber:20, row:"D", originalStatus:"preferential" },
];

module.exports = async function seedSpots() {
  const count = await Spot.countDocuments();
  if (count > 0) {
    console.log(`ℹ️  Vagas já existem (${count}). Seed ignorado.`);
    return;
  }
  await Spot.insertMany(SPOTS.map(s => ({ ...s, status: s.originalStatus })));
  console.log("🅿️  20 vagas criadas.");
};

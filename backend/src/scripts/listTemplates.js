require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const m = require("mongoose");
const T = require("../modules/proposal/models/Template.model");
(async () => {
  await m.connect(process.env.MONGO_URI);
  const t = await T.find().select("_id name type description structure").lean();
  console.log(`Templates: ${t.length}`);
  t.forEach((x) => {
    const cols = x.structure?.columns?.length || 0;
    const rows = x.structure?.rows?.length || 0;
    console.log(` - ${x.name}  type=${x.type}  cols=${cols}  rows=${rows}`);
    if (x.description) console.log(`     "${x.description}"`);
  });
  await m.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

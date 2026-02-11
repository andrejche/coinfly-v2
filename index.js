const express = require("express");
const path = require("path");
require("./fetchPrices");
require("./fetchNews");

const app = express();
const PORT = process.env.PORT || 5050;

app.use(express.static(path.join(__dirname, "public")));

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(PORT, () => {
  console.log(`✅ http://localhost:${PORT}`);
});

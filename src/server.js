const express = require("express");
const executeRoute = require("./routes/execute");
const { JSON_BODY_LIMIT } = require("./config/constants");

const app = express();
app.use(express.json({ limit: JSON_BODY_LIMIT }));

app.use("/execute", executeRoute);

app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      stdout: "",
      stderr: "payload too large",
      exitCode: -1,
      timeMs: 0,
      timedOut: false
    });
  }

  return next(err);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Code execution engine listening on port ${port}`);
});

const express = require("express");
const executeRoute = require("./routes/execute");
const { JSON_BODY_LIMIT } = require("./config/constants");

const app = express();
app.use(express.json({ limit: JSON_BODY_LIMIT }));

// CORS middleware to allow requests from the frontend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

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

app.use((req, res, next) => {
  console.log("api",req.path, "error", err);
  console.log("api",res.statusCode, "error", err);
  res.status(404).json({
    success: false,
    stdout: "",
    stderr: "not found",
    exitCode: -1,
    timeMs: 0,
    timedOut: false
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Code execution engine listening on port ${port}`);
});

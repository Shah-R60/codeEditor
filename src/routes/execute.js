const express = require("express");
const { languages } = require("../config/languages");
const { executeCode } = require("../services/executor");
const { MAX_CODE_SIZE_BYTES } = require("../config/constants");

const router = express.Router();

router.post("/", async (req, res) => {
  const { language, code } = req.body || {};

  if (typeof language !== "string" || typeof code !== "string") {
    return res.status(400).json({
      success: false,
      stdout: "",
      stderr: "language and code are required",
      exitCode: -1,
      timeMs: 0,
      timedOut: false
    });
  }

  if (!languages[language]) {
    return res.status(400).json({
      success: false,
      stdout: "",
      stderr: "unsupported language",
      exitCode: -1,
      timeMs: 0,
      timedOut: false
    });
  }

  if (Buffer.byteLength(code, "utf8") > MAX_CODE_SIZE_BYTES) {
    return res.status(413).json({
      success: false,
      stdout: "",
      stderr: "code payload too large",
      exitCode: -1,
      timeMs: 0,
      timedOut: false
    });
  }

  try {
    const result = await executeCode({ language, code });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      stdout: "",
      stderr: err && err.message ? err.message : "execution failed",
      exitCode: -1,
      timeMs: 0,
      timedOut: false
    });
  }
});

module.exports = router;

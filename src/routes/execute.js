const express = require("express");
const { languages } = require("../config/languages");
const { executeCode } = require("../services/executor");
const { MAX_CODE_SIZE_BYTES } = require("../config/constants");

const router = express.Router();

router.post("/", async (req, res) => {
  const { language, code, testCases } = req.body || {};

  if (typeof language !== "string" || typeof code !== "string") {
    return res.status(400).json({
      success: false,
      results: [],
      totalPassed: 0,
      totalTests: 0,
      error: "language and code are required"
    });
  }

  if (!Array.isArray(testCases) || testCases.length === 0) {
    return res.status(400).json({
      success: false,
      results: [],
      totalPassed: 0,
      totalTests: 0,
      error: "testCases must be a non-empty array"
    });
  }

  const invalidTestCase = testCases.find((testCase) => {
    return (
      !testCase ||
      typeof testCase.input !== "string" ||
      typeof testCase.expectedOutput !== "string"
    );
  });

  if (invalidTestCase) {
    return res.status(400).json({
      success: false,
      results: [],
      totalPassed: 0,
      totalTests: 0,
      error: "each test case must include input and expectedOutput strings"
    });
  }

  if (!languages[language]) {
    return res.status(400).json({
      success: false,
      results: [],
      totalPassed: 0,
      totalTests: 0,
      error: "unsupported language"
    });
  }

  if (Buffer.byteLength(code, "utf8") > MAX_CODE_SIZE_BYTES) {
    return res.status(413).json({
      success: false,
      results: [],
      totalPassed: 0,
      totalTests: 0,
      error: "code payload too large"
    });
  }

  try {
    const result = await executeCode({ language, code, testCases });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      results: [],
      totalPassed: 0,
      totalTests: 0,
      error: err && err.message ? err.message : "execution failed"
    });
  }
});

module.exports = router;

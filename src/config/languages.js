const { WORKDIR } = require("./constants");

const languages = {
  python: {
    image: "python:3.9-alpine",
    fileName: "main.py",
    cmd: ["python", `${WORKDIR}/main.py`]
  },
  javascript: {
    image: "node:18-alpine",
    fileName: "main.js",
    cmd: ["node", `${WORKDIR}/main.js`]
  },
  cpp: {
    image: "gcc:latest",
    fileName: "main.cpp",
    cmd: ["sh", "-lc", `g++ ${WORKDIR}/main.cpp -o ${WORKDIR}/out && ${WORKDIR}/out`]
  }
};

module.exports = { languages };

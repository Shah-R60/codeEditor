const { WORKDIR } = require("./constants");

const languages = {
  python: {
    image: "python:3.9-alpine",
    fileName: "main.py",
    runCmd: `python ${WORKDIR}/main.py`
  },
  javascript: {
    image: "node:18-alpine",
    fileName: "main.js",
    runCmd: `node ${WORKDIR}/main.js`
  },
  cpp: {
    image: "gcc:latest",
    fileName: "main.cpp",
    compileCmd: `g++ ${WORKDIR}/main.cpp -o ${WORKDIR}/out`,
    runCmd: `${WORKDIR}/out`
  }
};

module.exports = { languages };

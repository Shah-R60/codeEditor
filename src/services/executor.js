const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { PassThrough } = require("stream");
const Docker = require("dockerode");
const { languages } = require("../config/languages");
const {
  EXECUTION_TIMEOUT_MS,
  MEMORY_LIMIT_BYTES,
  CPU_PERIOD,
  CPU_QUOTA,
  NETWORK_MODE,
  CAP_DROP,
  PIDS_LIMIT,
  SECURITY_OPT,
  WORKDIR
} = require("../config/constants");

const docker = new Docker();

function waitForStreamEnd(stream) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    stream.on("end", done);
    stream.on("close", done);
    stream.on("error", done);

    if (stream.readableEnded || stream.destroyed) {
      done();
      return;
    }

    setTimeout(done, 200);
  });
}

async function executeCode({ language, code }) {
  const languageConfig = languages[language];
  if (!languageConfig) {
    throw new Error("Unsupported language");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "exec-"));
  const codePath = path.join(tempDir, languageConfig.fileName);

  let container;
  let containerCreated = false;
  let containerStarted = false;
  let stdout = "";
  let stderr = "";
  let exitCode = null;
  let timedOut = false;
  const startTime = Date.now();

  try {
    await fs.writeFile(codePath, code, { encoding: "utf8" });

    const hostConfig = {
      AutoRemove: true,
      Memory: MEMORY_LIMIT_BYTES,
      CpuPeriod: CPU_PERIOD,
      CpuQuota: CPU_QUOTA,
      NetworkMode: NETWORK_MODE,
      CapDrop: CAP_DROP,
      PidsLimit: PIDS_LIMIT,
      SecurityOpt: SECURITY_OPT,
      Binds: [`${tempDir}:${WORKDIR}:rw`]
    };

    container = await docker.createContainer({
      Image: languageConfig.image,
      Cmd: languageConfig.cmd,
      WorkingDir: WORKDIR,
      HostConfig: hostConfig,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false
    });
    containerCreated = true;

    const stream = await container.attach({ stream: true, stdout: true, stderr: true });
    const stdoutStream = new PassThrough();
    const stderrStream = new PassThrough();
    docker.modem.demuxStream(stream, stdoutStream, stderrStream);

    stdoutStream.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    stderrStream.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    await container.start();
    containerStarted = true;

    const waitPromise = container.wait();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        timedOut = true;
        reject(new Error("EXEC_TIMEOUT"));
      }, EXECUTION_TIMEOUT_MS);
    });

    let waitResult = null;
    try {
      waitResult = await Promise.race([waitPromise, timeoutPromise]);
    } catch (err) {
      if (timedOut) {
        try {
          await container.kill();
        } catch (killErr) {
          // Ignore kill errors after timeout.
        }
      } else {
        throw err;
      }
    }

    if (!timedOut && waitResult && typeof waitResult.StatusCode === "number") {
      exitCode = waitResult.StatusCode;
    }

    await waitForStreamEnd(stream);
  } finally {
    if (containerCreated && !containerStarted) {
      try {
        await container.remove({ force: true });
      } catch (removeErr) {
        // Ignore removal errors for unstarted containers.
      }
    }

    await fs.rm(tempDir, { recursive: true, force: true });
  }

  const timeMs = Date.now() - startTime;
  const success = !timedOut && exitCode !== null;

  return {
    success,
    stdout,
    stderr,
    exitCode: exitCode === null ? -1 : exitCode,
    timeMs,
    timedOut
  };
}

module.exports = { executeCode };

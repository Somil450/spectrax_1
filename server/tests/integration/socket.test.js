const fs = require("fs");
const os = require("os");
const path = require("path");
const { io: ioClient } = require("socket.io-client");
const { createServer } = require("../../src/app/createServer");
const { buildSessionFilePath } = require("../../src/shared/utils/paths");

function createLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
}

describe("socket flow", () => {
  it("processes a frame and saves the session on session:end", async () => {
    const sessionPath = path.join(
      os.tmpdir(),
      `spectrax-socket-${Date.now()}.json`,
    );
    const runtime = createServer({
      port: 0,
      sessionPath,
      logger: { info() {}, error() {} },
    });

    await runtime.start();
    const address = runtime.server.address();
    const client = ioClient(`ws://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
    });

    const feedbackPromise = new Promise((resolve, reject) => {
      client.on("feedback", resolve);
      client.on("connect_error", reject);
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });

    const landmarks = createLandmarks();
    [11, 13, 15, 23, 25, 27].forEach((index) => {
      landmarks[index].visibility = 0.95;
    });
    landmarks[23] = { x: 0, y: 0, visibility: 0.95 };
    landmarks[25] = { x: 0, y: 1, visibility: 0.95 };
    landmarks[27] = { x: 1, y: 1, visibility: 0.95 };
    landmarks[11] = { x: 0, y: 0, visibility: 0.95 };
    landmarks[13] = { x: 0, y: 1, visibility: 0.95 };
    landmarks[15] = { x: 1, y: 1, visibility: 0.95 };

    client.emit("frame", {
      landmarks,
      timestamp: 99,
      exercise: "squat",
    });

    const feedback = await feedbackPromise;

    expect(feedback).toEqual({
      angles: {
        knee: 90,
        elbow: 90,
        shoulder: 90,
        bodyLine: 45,
        hipDepth: 100,
      },
      corrections: ["Keep your back straight"],
      status: "yellow",
      feedback: "Keep your back straight",
      timestamp: 99,
    });

    client.emit("session:end");
    // Poll for file existence with timeout
    const sessionFile = buildSessionFilePath(sessionPath, client.id);
    const startTime = Date.now();
    const maxWait = 1000;
    while (!fs.existsSync(sessionFile) && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const saved = JSON.parse(
      fs.readFileSync(buildSessionFilePath(sessionPath, client.id), "utf8"),
    );
    expect(saved.frameCount).toBe(1);
    expect(saved.frames[0].feedback).toBe("Keep your back straight");

    client.close();
    await runtime.shutdown();
  });
});

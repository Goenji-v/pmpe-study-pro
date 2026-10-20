// Preload with node --require to keep local regression tests offline.
// Tests can replace fetch with a mock; an unmocked call fails the whole run.
const net = require("node:net");
const { syncBuiltinESMExports } = require("node:module");
let blocked = 0;
function deny() {
  blocked++;
  process.exitCode = 1;
  throw new Error("OFFLINE_TEST: network access is forbidden; provide a mock");
}
globalThis.fetch = async function () { return deny(); };
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const target = Array.isArray(args[0]) ? args[0][0] : args[0];
  const unixPath = typeof target === "object" && target !== null
    ? target.path
    : typeof target === "string" && target.startsWith("/") ? target : undefined;
  // The compiler can use Unix IPC. All TCP, including localhost, needs a mock.
  if (!unixPath) return deny();
  return originalConnect.apply(this, args);
};
syncBuiltinESMExports();
process.on("exit", () => {
  if (blocked) {
    process.stderr.write(`OFFLINE_TEST blocked attempts: ${blocked}\n`);
    process.exitCode = 1;
  }
});

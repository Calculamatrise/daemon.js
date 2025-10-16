import { platform } from 'os';

if (platform().indexOf('win32') === -1)
	throw new RangeError("daemon.js only supports Windows.");

export { default as Daemon } from "./lib/daemon.js";
export { default as default } from "./lib/daemon.js";
export { default as EventLogger } from "./lib/eventlog.js";
export { default as Utils } from "./lib/binaries.js";
export { default as DaemonManager } from "./lib/manager.js";
export { default as DaemonRegistry } from "./lib/registry.js";
export * from "./lib/enum.js";
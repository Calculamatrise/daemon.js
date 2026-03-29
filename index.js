import { platform } from 'os';

if (platform().indexOf('win32') === -1)
	throw new RangeError("daemon.js only supports Windows.");

export { default as NodeDaemon } from "./lib/daemon/NodeDaemon.js";
export { default as Daemon } from "./lib/daemon/Daemon.js";
export { default as default } from "./lib/daemon/Daemon.js";
export { default as StandaloneService } from "./lib/daemon/StandaloneService.js";
export { default as DaemonManager } from "./lib/manager.js";
export { default as DaemonRegistry } from "./lib/registry.js";
// export { default as DaemonRegistry } from "./lib/registry.old.js";
// export { default as WinSWConfig } from "./lib/winsw/winsw.js";
export * from "./lib/utils/enum.js";
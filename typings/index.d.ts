//#region Classes
declare class DaemonInfo {
	binaryPath: string
	dependencies: Set<string>
	displayName: string
	id: string
	logOnAs: LogOnAsConfig
	pid: number
	serviceExitCode: number
	startType: StartType
	state: State

	readonly binaryExists: boolean
	readonly exitCode: number
	readonly isRunning: boolean

	static from(raw: string): DaemonInfo
}

declare class Daemon extends DaemonInfo {
	constructor(id: string, options?: DaemonOptions)
	constructor(options: DaemonOptions)
	constructor(path: string, options?: DaemonOptions)

	// readonly options: DaemonOptions

	fetch(): Promise<Daemon | null>
	install(password?: string): Promise<void>
	kill(): Promise<void>
	restart(wait?: boolean | true): Promise<void>
	start(wait?: boolean | true): Promise<void>
	stop(wait?: boolean | true): Promise<void>
	uninstall(force: boolean): Promise<void>
	uninstall(info?: DaemonInfo): Promise<void>
}

declare class NodeDaemon extends Daemon {
	constructor(id: string, options?: NodeDaemonOptions)
	constructor(options: NodeDaemonOptions)
	constructor(path: string, options?: NodeDaemonOptions)

	readonly options: NodeDaemonOptions

	static test(id, options: NodeDaemonOptions): boolean
}

declare class DaemonManager {
	static [Symbol.asyncIterator]: AsyncIterableIterator<Daemon>
	static entries(): AsyncIterableIterator<Daemon>
	static get(id: string): Promise<Daemon | null>
	static has(id: string): Promise<boolean>
	static install(id: string, options?: DaemonOptions | NodeDaemonOptions): Promise<Daemon>
	static install(options: DaemonOptions | NodeDaemonOptions): Promise<Daemon>
	static install(path: string, options?: DaemonOptions | NodeDaemonOptions): Promise<Daemon>
	static kill(id: string): Promise<void>
	static list(): Array<Daemon>
	static restart(id: string): Promise<void>
	static start(id: string): Promise<void>
	static stop(id: string): Promise<void>
	static uninstall(id: string): Promise<void>
	static update(id: string, info?: DaemonInfo): Promise<void>
}

declare class DaemonRegistry {
	static [Symbol.asyncIterator]: AsyncIterableIterator<DaemonInfo>
	static config(id: string, info: DaemonInfo): Promise<void>
	static entries(): AsyncIterableIterator<DaemonInfo>
	static get(id: string, state?: boolean | true): Promise<DaemonInfo | null>
	static isRegistered(id: string): Promise<boolean>
	static register(id: string, binary: string, info?: DaemonInfo): Promise<void>
	static unregister(id: string, skipCheck?: boolean | false): Promise<boolean | null>
	static unregister(id: string, options: UnregisterOptions): Promise<boolean | null>
}

//#region Interfaces
declare interface LogOnAsConfig {
	account: AccountType
	domain: string | 'NT AUTHORITY'
	mungeCredentialsAfterInstall?: boolean
	password?: string
}

declare interface DaemonOptions {
	binaryPath: string
	displayName?: string
	id: string
	logOnAs?: LogOnAsConfig
	startType?: StartType
}

declare interface NodeDaemonOptions extends DaemonOptions {
	entry: string
	args: string[]
	execArgv?: string[]
	// maxAttempts?: number | 3
	runtimeExecutable?: string
	winsw?: WinSWOptions
}

declare interface UnregisterOptions {
	skipCheck?: boolean
	purge?: boolean
}

declare interface WinSWOptions {
	allowServiceLogon?: boolean
	env?: string[]
	installDir?: string
	logging: {
		keepFiles?: boolean
		mode: string
		pattern?: string
		sizeThreshold?: number
	}
	logPath?: string
	maxRestarts: number
	maxRetries?: number
	stopParentFirst?: boolean
	stopTimeout: number
	workingDirectory?: string
}

//#region Enumerations
declare enum AccountType {
	LocalService = 'LocalService',
	LocalSystem = 'LocalSystem',
	NetworkService = 'NetworkService'
}

declare enum StartFlag {
	AutoStart = 2,
	DemandStart = 3,
	Disabled = 4
}

declare enum StartType {
	AutoStart = 'auto',
	DelayedAutoStart = 'delayed-auto',
	DemandStart = 'demand',
	Disabled = 'disabled'
}

declare enum State {
	Stopped = 1,
	StartPending = 2,
	StopPending = 3,
	Running = 4,
	ContinuePending = 5,
	PausePending = 6,
	Paused = 7
}

//#region Exports
export { Daemon, DaemonManager, DaemonRegistry, NodeDaemon }
export default Daemon;
export type { DaemonOptions, LogOnAsConfig, WinSWOptions, UnregisterOptions }
export { AccountType, StartFlag, StartType, State }
export * from './winsw'
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
}

declare class Daemon extends DaemonInfo {
	constructor(name: string, options?: DaemonConfig)
	constructor(options: DaemonConfig)
	constructor(path: string, options?: DaemonConfig)

	// readonly options: DaemonConfig

	install(): Promise<void>
	kill(): Promise<void>
	refresh(): Promise<void>
	restart(): Promise<void>
	start(): Promise<boolean>
	stop(): Promise<boolean>
	uninstall(force: boolean): Promise<void>
}

declare class NodeDaemon extends Daemon {
	// constructor(options: DaemonConfig)

	readonly options: DaemonConfig

	createBinary(): Promise<void>
	unlinkBinary(): Promise<void>

	// toXML(): string
}

declare class DaemonManager {
	kill(name: string): Promise<boolean>
	restart(name: string): Promise<void>
	start(name: string): Promise<void>
	stop(name: string): Promise<void>

	create(name: string, config: DaemonConfig): Promise<Daemon>
	delete(name: string, force: boolean): Promise<void>
	static entries(): AsyncIterableIterator<Daemon, void, Daemon>
	static get(name: string): Promise<Daemon>
	static has(name: string): Promise<boolean>
	isRegistered(name: string): Promise<boolean>
	register(name: string, config: DaemonConfig): Promise<Daemon>
	// unlink(name: string): Promise<boolean>
	unregister(name: string, force: boolean): Promise<boolean>
}

declare class DaemonRegistry {
	static get(name: string, state?: boolean | false): Promise<Object>
	static getAll(): Promise<Array<Object>>
	static entries(): AsyncIterableIterator<DaemonInfo, void, DaemonInfo>
	static isRegistered(name: string): Promise<boolean>
}

//#region Interfaces
declare interface LogOnAsConfig {
	account: AccountType
	domain: string | 'NT AUTHORITY'
	mungeCredentialsAfterInstall?: boolean
	password?: string
}

declare interface DaemonConfig {
	execFlags?: string
	logOnAs?: LogOnAsConfig
	script: string
	winsw?: WinSWOptions
	wrap?: boolean
	wrapper?: WrapperOptions
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
	nodeOptions: string
	stopParentFirst?: boolean
	stopTimeout: number
	workingDirectory?: string
}

declare interface WrapperOptions {
	abortOnError: boolean | true
	commandArguments: {
		grow: number | 0.5
		wait: number | 1
	}
	maxRestarts: number | 3
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
export type { DaemonConfig, LogOnAsConfig, WinSWOptions, WrapperOptions }
export { AccountType, StartFlag, StartType, State }
export * from './winsw'
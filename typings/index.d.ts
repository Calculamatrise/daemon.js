//#region Classes

export declare class Daemon {
	binaryPath?: string
	description?: string
	displayName?: string
	logOnAs: LogOnAsConfig
	name: string
	readonly options: DaemonConfig

	constructor(options: DaemonConfig)

	install(): Promise<void>
	kill(): Promise<void>
	restart(): Promise<void>
	start(): Promise<boolean>
	stop(): Promise<boolean>
	uninstall(force: boolean): Promise<void>

	// toXML(): string
}

export declare class DaemonManager {
	kill(name: string): Promise<boolean>
	restart(name: string): Promise<void>
	start(name: string): Promise<void>
	stop(name: string): Promise<void>
}

export declare class DaemonRegistry {
	cache: Map<string, Daemon>

	create(name: string, config: DaemonConfig): Promise<Daemon>
	get(name: string): Promise<Daemon>
	has(name: string): Promise<boolean>
	isRegistered(name: string): Promise<boolean>
	register(name: string, config: DaemonConfig): Promise<Daemon>
	// unlink(name: string): Promise<boolean>
	unregister(name: string, force: boolean): Promise<boolean>
}

//#endregion

//#region Interfaces

export declare interface LogOnAsConfig {
	account: AccountType
	domain: string | 'NT AUTHORITY'
	mungeCredentialsAfterInstall?: boolean
	password?: string
}

export declare interface DaemonConfig {
	execFlags?: string
	logOnAs?: LogOnAsConfig
	script: string
	winsw?: WinSWOptions
	wrap?: boolean
	wrapper?: WrapperOptions
}

export declare interface WinSWOptions {
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

export declare interface WrapperOptions {
	abortOnError?: boolean
	commandArguments?: {
		grow?: number
		wait?: number
	}
	maxRestarts: number
}

//#endregion

//#region Enumerations

export declare enum AccountType {
	LocalService = 'LocalService',
	LocalSystem = 'LocalSystem',
	NetworkService = 'NetworkService'
}

export declare enum StartFlag {
	AutoStart = 2,
	DemandStart = 3,
	Disabled = 4
}

export declare enum StartType {
	AutoStart = 'auto',
	DelayedAutoStart = 'delayed-auto',
	DemandStart = 'demand',
	Disabled = 'disabled'
}

export declare enum State {
	Stopped = 1,
	StartPending = 2,
	StopPending = 3,
	Running = 4,
	ContinuePending = 5,
	PausePending = 6,
	Paused = 7
}

//#endregion
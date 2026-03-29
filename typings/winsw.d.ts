export declare class WinSW {
	config: WinSWConfig

	createBinary(): Promise<void>
	updateConfig(): Promise<void>
	unlinkBinary(): Promise<void>
	toXML(): string

	// static createExe(dest: string): Promise<unknown>
	// static parse(): WinSW
}

export type WinSWServiceAccount =
	| {
		username: string
		password?: string
		allowservicelogon?: boolean
		prompt?: never
	}
	| {
		prompt: 'console' | 'dialog'
		username?: never
		password?: never
		allowservicelogon?: boolean
	}

export interface WinSWExecHook {
	executable: string
	arguments?: string
	stdoutPath?: string
	stderrPath?: string
}

export interface WinSWConfig {
	id: string
	executable: string

	name?: string
	description?: string
	// startmode?: 'Automatic' | 'Manual' | 'Disabled'
	delayedAutoStart?: boolean
	depend?: string[]
	logging?: 'append' | 'reset' | 'ignore' | 'roll'
	logpath?: string
	arguments?: string | string[]
	// stopexecutable?: string
	// stoparguments?: string | string[]
	// prestart?: WinSWExecHook
	// poststart?: WinSWExecHook
	// prestop?: WinSWExecHook
	// poststop?: WinSWExecHook
	// preshutdown?: boolean
	// preshutdownTimeout?: string
	// stoptimeout?: string
	env?: {
		name: string
		value: string
	}[]
	// hidewindow?: boolean
	// interactive?: boolean
	// beeponshutdown?: boolean
	download?: {
		from: string
		to: string
		auth?: 'none' | 'sspi' | 'basic'
		failOnError?: boolean
		proxy?: string
		user?: string
		password?: string
		unsecureAuth?: boolean
	}
	// // log?: boolean
	onfailure?: {
		action: 'restart' | 'reboot' | 'none'
		delay?: string
	}
	// resetfailure?: string
	// securityDescriptor?: unknown
	serviceaccount?: WinSWServiceAccount
	workingdirectory?: string
	priority?: 'idle' | 'belownormal' | 'normal' | 'abovenormal' | 'high' | 'realtime'
	autoRefresh?: boolean
	// sharedDirectoryMapping?: {
	// 	map: {
	// 		label: string
	// 		uncpath: string
	// 	}
	// }
}
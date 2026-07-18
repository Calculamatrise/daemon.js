export const AccountType = {
	LocalService: 'LocalService',
	LocalSystem: 'LocalSystem',
	NetworkService: 'NetworkService'
};

export const StartType = {
	Auto: 'auto',
	DelayedAuto: 'delayed-auto',
	Disabled: 'disabled',
	Manual: 'demand',
	/** @protected */
	Boot: 'boot',
	System: 'system'
};

export const State = {
	Stopped: 1,
	StartPending: 2,
	StopPending: 3,
	Running: 4,
	ContinuePending: 5,
	PausePending: 6,
	Paused: 7
};
export const AccountType = {
	LocalService: 'LocalService',
	LocalSystem: 'LocalSystem',
	NetworkService: 'NetworkService'
};

export const StartFlag = {
	AutoStart: 2,
	DemandStart: 3,
	Disabled: 4
};

export const StartType = {
	AutoStart: 'auto',
	DelayedAutoStart: 'delayed-auto',
	DemandStart: 'demand',
	Disabled: 'disabled'
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
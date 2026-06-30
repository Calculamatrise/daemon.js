import WindowsServiceAdapter from './WindowsServiceAdapter.js';
// import SystemdAdapter from './SystemdAdapter.js'; // For future Linux support
// import LaunchdAdapter from './LaunchdAdapter.js'; // For future macOS support

const { platform } = process;

let OSAdapter;
switch (platform) {
case 'win32':
	OSAdapter = WindowsServiceAdapter;
	// OSAdapter = await import('./WindowsServiceAdapter.js')
	// 	.then(({ default: OSAdapter }) => OSAdapter);
	break;
case 'linux':
	// OSAdapter = SystemdAdapter;
	throw new RangeError('Linux support is not yet implemented.');
default:
	throw new RangeError(`Unsupported OS: ${platform}`);
}

export default OSAdapter;
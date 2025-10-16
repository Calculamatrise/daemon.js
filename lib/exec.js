import { exec as __exec } from 'child_process';
import { promisify } from 'util';
const _exec = promisify(__exec);
import { elevate, isElevated } from "./binaries.js";

export async function execute(cmd, callback) {
	return _exec(cmd, callback)
		.then(({ stderr, stdout }) => {
			if (stderr) throw new Error(stderr);
			try { return stdout.trim() }
			catch { return stdout }
		})
		.catch(err => {
			if (err.code === 1 || err.message.includes('Access is denied.') ||
			err.message.includes('Administrator privileges') ||
			err.code === 'EPERM') return elevate(cmd, callback);
			throw err
		})
}

export async function executeAsAdmin(cmd, callback) {
	if (await isElevated()) return _exec(cmd, callback).then(({ stderr, stdout }) => {
		if (stderr) throw new Error(stderr);
		try { return stdout.trim() }
		catch { return stdout }
	});
	else return elevate(cmd, callback)
}
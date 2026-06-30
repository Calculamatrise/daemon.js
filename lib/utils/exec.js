import { exec as _execCallback } from 'child_process';
import { promisify } from 'util';
import OSAdapter from '../adapters/index.js';

const __exec = promisify(_execCallback);
export const _exec = async c => {
	return __exec(c)
		.then(({ stderr, stdout }) => {
			if (stderr) throw new Error(stderr);
			return stdout.trim()
		})
};

export async function execute(cmd, elevate = false) {
	return (elevate ? OSAdapter.elevate : _exec)(cmd)
		.catch(err => {
			const msg = err.stderr || err.stdout;
			if (err.code === 5 || err.code === 740 || (msg || err.message).includes('Access is denied.')) return OSAdapter.elevate(cmd);
			// if (err.stdout) return err.stdout;
			if (msg) err.message = msg;
			throw err
		})
}
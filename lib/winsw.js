const escape = value => String(value)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&apos;');
const indent = level => '\t'.repeat(level);
export function generateXml(config) {
	if (!config || !config.id || !config.name || !config.script)
		throw new Error("WINSW must be configured with a minimum of id, name and script");

	function tag(name, content, level = 1) {
		if (content == null || content === '') return '';
		if (Array.isArray(content)) {
			return content.map(val => tag(name, val, level)).filter(Boolean).join('\r\n');
		} else if (typeof content === 'object' && '_attr' in content) {
			let attrs = Object.entries(content._attr)
				.map(([k, v]) => `${k}="${escape(v)}"`)
				.join(' ');
			return `${indent(level)}<${name} ${attrs} />`;
		} else if (typeof content === 'object') {
			let children = Object.entries(content)
				.map(([k, v]) => tag(k, v, level + 1))
				.filter(Boolean)
				.join('\r\n');
			return `${indent(level)}<${name}>\r\n${children}\r\n${indent(level)}</${name}>`;
		} else {
			return `${indent(level)}<${name}>${escape(content)}</${name}>`
		}
	}

	function multi(name, input, splitter = ',') {
		if (!input) return '';
		if (!Array.isArray(input)) input = String(input).split(splitter);
		return input
			.map(val => val && val.trim() ? tag(name, val.trim()) : '')
			.filter(Boolean)
			.join('\r\n')
	}

	let xml = [];
	xml.push(tag('id', config.id));
	xml.push(tag('name', config.name));
	xml.push(tag('description', config.description || ''));
	xml.push(tag('executable', config.binaryPath || process.execPath));

	// Wrap all arguments inside <arguments>
	let args = [];
	if (config.nodeOptions) args.push(...(Array.isArray(config.nodeOptions) ? config.nodeOptions : String(config.nodeOptions).split(' ')));
	if (config.script) args.push(config.script.trim());
	if (config.arguments) args.push(...config.arguments.filter(x => x && String(x).trim() !== ''));
	if (args.length > 0)
		xml.push(tag('arguments', args.join(' ')));

	if (config.logging) {
		let logContent = [{ _attr: { mode: config.logging.mode || 'append' } }];
		if (config.logging.mode === 'roll-by-time') {
			logContent.push({ pattern: config.logging.pattern || 'yyyyMMdd' });
		} else if (config.logging.mode === 'roll-by-size') {
			logContent.push({ sizeThreshold: config.logging.sizeThreshold || 10240 });
			logContent.push({ keepFiles: config.logging.keepFiles || 8 });
		}
		xml.push(tag('log', logContent));
	} else {
		xml.push(tag('logmode', 'rotate'));
	}

	if (config.logPath) xml.push(tag('logpath', config.logPath));
	if (typeof config.stopParentFirst === 'boolean') xml.push(tag('stopparentprocessfirst', config.stopParentFirst));
	if (config.stopTimeout != null) xml.push(tag('stoptimeout', `${config.stopTimeout}sec`));
	if (config.dependencies) xml.push(multi('depend', config.dependencies));
	if (config.env) {
		const envArray = Array.isArray(config.env) ? config.env : [config.env];
		for (const { name, value } of envArray) {
			if (name && value != null) xml.push(tag('env', { _attr: { name, value } }));
		}
	}

	if (config.logOnAs) {
		const sa = [tag('username', `${config.logOnAs.domain || 'NT AUTHORITY'}\\${config.logOnAs.account || 'LocalSystem'}`, 2)];
		config.logOnAs.password && sa.push(tag('password', config.logOnAs.password || '', 2));
		if (config.allowServiceLogon) sa.push(tag('allowservicelogon', 'true'));
		xml.push(`${indent(1)}<serviceaccount>\r\n${sa.map(line => indent(2) + line.trim()).join('\r\n')}\r\n${indent(1)}</serviceaccount>`);
	}

	xml.push(tag('workingdirectory', config.workingDirectory || dirname(config.script)));

	return `<service>\r\n${xml.join('\r\n')}\r\n</service>`
}

import { constants, copyFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url)
	, __dirname = dirname(__filename);

export async function createExe(name, dir) {
	dir ||= process.cwd();
	const exeOrigin = join(__dirname, '../bin', 'winsw.exe')
		, exeDest = join(dir, name.replace(/[^\w-]/gi, '').toLowerCase() + '.exe');
	await copyFile(exeOrigin, exeDest, constants.COPYFILE_EXCL);
	return true
}

export * as default from "./winsw.js";
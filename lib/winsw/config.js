import { existsSync } from "fs";
import { basename, dirname, resolve } from "path";

const WINSW_EXE_PATH = resolve(import.meta.dirname, '../../bin/winsw.exe');
if (!existsSync(WINSW_EXE_PATH)) throw new ReferenceError(`WinSW executable not found at "${WINSW_EXE_PATH}"`);

import { execSync } from "child_process";

function getSystemNodePath() {
	const execPath = process.execPath;
	if (basename(execPath) === 'node.exe') return execPath;
	try {
		return execSync('where node', { encoding: 'utf8' }).trim()
	} catch {
		return null
	}
}

const escape = value => String(value)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;')
	.replace(/'/g, '&apos;');
const indent = level => '\t'.repeat(level);

export default class WinSWConfig {
	#tags = null;

	id = null;
	executable = null;

	arguments = [];
	serviceAccount = {
		username: 'NT AUTHORITY\\Local Service'
	};
	workingDirectory = null;

	_normalizeTag(tag) {
		if (!this.#tags) {
			this.#tags = Object.getOwnPropertyNames(this);
		}

		const correspondingTag = this.#tags.find(t => t.toLowerCase() === tag.toLowerCase());
		return correspondingTag || tag
	}

	_parse(str) {
		const lines = str
			.trim()
			.split(/(?<=\>)(?:(?:[\r\n]+)[\s\t]*)?(?=\<)/g);

		const stack = [];
		let current = this;
		let skipNextPush = false; // flag to skip pushing <service> itself

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || /^<\?/.test(trimmed) || /^<!--/.test(trimmed)) continue;

			const selfCloseMatch = trimmed.match(/^<([\w:-]+)([^>]*)\/>$/);
			if (selfCloseMatch) {
				let [, tag, rawAttrs] = selfCloseMatch;
				// tag = this._normalizeTag(tag);
				tag = normalizeTag(current, tag);
				if (tag === 'service') continue; // skip root
				// current[tag] = current[tag] != null
				// 	? [...((Array.isArray(current[tag]) && !(current[tag] instanceof XMLComponent)) ? current[tag] : [current[tag]])]
				// 	: null;
				// const component = new XMLComponent(tag, parseAttributes(rawAttrs));
				// if (current === this && current[tag] == null) current[tag] = component;
				// else current[tag].push(component);
				if (!Object.hasOwn(current, tag)) continue;
				current[tag] = rawAttrs;
				continue;
			}

			// Full tag with content: <tag attr="val">value</tag>
			let fullTagMatch = trimmed.match(/^<([\w:-]+)([^>]*)>([^<]*)<\/\1>$/);
			if (fullTagMatch) {
				let [, tag, rawAttrs, content] = fullTagMatch;
				// tag = this._normalizeTag(tag);
				tag = normalizeTag(current, tag);
				if (tag === 'service') continue; // skip root
				if (!Object.hasOwn(current, tag)) continue;
				switch (tag.toLowerCase()) {
				case 'arguments':
					current[tag].splice(0, current[tag].length, ...content.trim().split(/\s+/g));
					continue;
				}

				current[tag] = content.trim();
				continue;
			}

			// Opening tag: <tag attr="val">
			let openMatch = trimmed.match(/^<([\w:-]+)([^>]*)>$/);
			if (openMatch) {
				let [, tag, rawAttrs] = openMatch;
				// tag = this._normalizeTag(tag);
				tag = normalizeTag(current, tag);
				if (tag === 'service') {
					skipNextPush = true; // root opening, don't push
					continue;
				}
				if (!Object.hasOwn(current, tag)) continue;
				const component = this[tag] || {};
				current[tag] = component;
				if (!skipNextPush) stack.push(current);
				current = component;
				skipNextPush = false;
				continue;
			}

			// Closing tag: </tag>
			let closeMatch = trimmed.match(/^<\/([\w:-]+)>$/);
			if (closeMatch) {
				if (closeMatch[1] === 'service') continue; // skip root
				current = stack.pop() || this;
				continue;
			}
		}
	}

	_patch(data) {
		if (!data || typeof data != 'object') return;
		for (const key in data) {
			switch (key) {
			case 'targetPath':
				this.arguments.splice(0, this.arguments.length, '--harmony', data[key]);
			}
		}
	}

	toXML() {
		let str = '<service>';
		for (const i in this) {
			let item = this[i];
			switch (i) {
			case 'executable':
				if (typeof item == 'string') break;
				item = process.execPath;
				if (!item.includes('node')) {
					item = getSystemNodePath();
				}
			// 	break;
			// case 'workingDirectory':
			// 	if (typeof item == 'string') break;
			// 	item = dirname(this.arguments.at(-1));
			}

			if (item == null) continue;
			switch (i) {
			case 'arguments':
				// if (typeof item == 'string') break;
				item = item.join(' ');
			}

			if (typeof item == 'object') {
				let formatted = '';
				for (const i in item) {
					let v = item[i];
					formatted += `\n\t\t<${i}>${v}</${i}>`;
				}
				item = formatted + '\n\t';
			}

			str += `\n\t<${i}>${item}</${i}>`;
		}
		return str + '\n</service>'
	}

	toString() {
		return this.toXML()
	}

	static _generateXML(config) {
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
		xml.push(tag('executable', config.execPath || process.execPath));

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

	static parse(str) {
		const lines = str
			.trim()
			.split(/(?<=\>)(?:(?:[\r\n]+)[\s\t]*)?(?=\<)/g);

		const svc = new WinSWConfig();
		const stack = [];
		let current = svc;
		let skipNextPush = false; // flag to skip pushing <service> itself

		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || /^<\?/.test(trimmed) || /^<!--/.test(trimmed)) continue;

			const selfCloseMatch = trimmed.match(/^<([\w:-]+)([^>]*)\/>$/);
			if (selfCloseMatch) {
				// const [, tag, rawAttrs] = selfCloseMatch;
				// if (tag === 'service') continue; // skip root
				// current[tag] = current[tag] != null
				// 	? [...((Array.isArray(current[tag]) && !(current[tag] instanceof XMLComponent)) ? current[tag] : [current[tag]])]
				// 	: null;
				// const component = new XMLComponent(tag, parseAttributes(rawAttrs));
				// if (current === svc && current[tag] == null) current[tag] = component;
				// else current[tag].push(component);
				continue;
			}

			// Full tag with content: <tag attr="val">value</tag>
			let fullTagMatch = trimmed.match(/^<([\w:-]+)([^>]*)>([^<]*)<\/\1>$/);
			if (fullTagMatch) {
				const [, tag, rawAttrs, content] = fullTagMatch;
				if (tag === 'service') continue; // skip root
				const val = content.trim();
				// const component = new XMLComponent(tag, parseAttributes(rawAttrs));
				// component.value = val;
				// if (current === svc && current[tag] != null) {
				// 	if (!Array.isArray(current[tag]) || current[tag] instanceof XMLComponent) current[tag] = [current[tag]];
				// 	current[tag].push(component);
				// } else if (current instanceof XMLComponent) {
				// 	current.push(component);
				// } else {
				// 	current[tag] = component;
				// }
				current[tag] = content;
				continue;
			}

			// Opening tag: <tag attr="val">
			let openMatch = trimmed.match(/^<([\w:-]+)([^>]*)>$/);
			if (openMatch) {
				const [, tag, rawAttrs] = openMatch;
				if (tag === 'service') {
					skipNextPush = true; // root opening, don't push
					continue;
				}
				// const component = new XMLComponent(tag, parseAttributes(rawAttrs));
				// if (current === svc && current[tag] != null) {
				// 	if (!Array.isArray(current[tag]) || current[tag] instanceof XMLComponent) current[tag] = [current[tag]];
				// 	current[tag].push(component);
				// } else if (current instanceof XMLComponent) {
				// 	current.push(component);
				// } else {
				// 	current[tag] = component;
				// }
				// if (!skipNextPush) stack.push(current);
				// current = component;
				skipNextPush = false;
				continue;
			}

			// Closing tag: </tag>
			let closeMatch = trimmed.match(/^<\/([\w:-]+)>$/);
			if (closeMatch) {
				if (closeMatch[1] === 'service') continue; // skip root
				current = stack.pop() || svc;
				continue;
			}
		}

		return svc
	}
}

function parseAttributes(raw) {
	const obj = {};
	for (const [, key, value] of raw.matchAll(/([\w:-]+)="([^"]*)"/g)) {
		obj[key] = value;
	}
	return obj
}

function normalizeTag(target, tag) {
	const tags = Object.getOwnPropertyNames(target);
	const correspondingTag = tags.find(t => t.toLowerCase() === tag.toLowerCase());
	return correspondingTag || tag
}
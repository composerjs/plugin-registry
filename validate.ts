import fs from 'fs-extra';
import { RequestResponse } from 'request';
import request from 'request-promise';
import Ajv from 'ajv';
import path from 'path';
import pino from 'pino';

import schema from './schema.json';

const BASE_DIR = path.join(__dirname, 'plugins');
const ajv = new Ajv();
const log = pino({
	name: 'plugin-registry-validator',
	level: 'info'
});

interface PluginJSON {
	name: string;
	repository: string;
	"plugin-type": string;
}

interface PluginJSON {
	"plugin-types": string[];
}

async function main() {
	log.info('validating plugins');
	let dir: string[];
	log.trace('reading plugin directory');
	try {
		dir = await fs.readdir(BASE_DIR);
	} catch(err) {
		throw err;
	}
	log.trace(`plugin directory read. ${dir.length} plugins found.`);
	for(let i=0; i < dir.length; i++) {
		const pluginJSONPath = dir[i];
		const childLog = log.child({
			plugin: pluginJSONPath
		});
		childLog.trace(`getting plugin JSON`);
		let pluginJSON: string;
		try {
			pluginJSON = await fs.readFile(path.join(BASE_DIR, pluginJSONPath)).toString();
		} catch(err) {
			childLog.error({err});
			throw err;
		}
		childLog.trace(`plugin loaded. validating.`);
		let valid: boolean;
		try {
			valid = await ajv.validate(schema, pluginJSON);
		} catch(err) {
			childLog.error({err});
			throw err;
		}
		if (!valid && ajv.errors) {
			childLog.warn(`invalid plugin registry json found.`);
			childLog.error({
				err: ajv.errors.map(error => error.message).join('\n')
			});
		}
		childLog.trace('validating repository field');
		const plugin = <PluginJSON>JSON.parse(pluginJSON);
		let response: RequestResponse;
		try {
			response = await request.get(path.join(plugin.repository, 'blob/master/package.json'));
		} catch(err) {
			childLog.error({err});
			throw err;
		}
		if (!response) {
			childLog.warn({
				repository: plugin.repository
			}, 'invalid plugin. Repository is not valid.');
			throw new Error('invalid plugin');
		}
		childLog.trace('repository validated');
		childLog.info('plugin valid');
	}
	log.info('validation complete');
}

main().catch(err => log.error({err}));

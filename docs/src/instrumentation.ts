import { log } from './lib/logger';

export async function register() {
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		try {
			// Use require directly instead of dynamic import
			const redirectModule = require('@doubletie/logger/redirect-nextjs');

			if (typeof redirectModule === 'function') {
				redirectModule(log);
			} else if (
				redirectModule &&
				typeof redirectModule.redirectNextjsLogger === 'function'
			) {
				redirectModule.redirectNextjsLogger(log);
			} else {
				log.error('Could not find redirectNextjsLogger function');
			}
		} catch (error) {
			log.error('Error loading redirectNextjsLogger:', error);
		}
	}
}

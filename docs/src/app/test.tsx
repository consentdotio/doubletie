'use client';

import { log } from '~/lib/logger';

const Test = () => {
	console.log('Test');
	log.info('Test');
	log.warn('Test');
	log.debug('Test');
	return <div>Test</div>;
};

export default Test;

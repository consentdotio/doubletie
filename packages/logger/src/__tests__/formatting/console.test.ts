import { describe, expect, it } from 'vitest';
import { formatMessage } from '../../formatting/console';

describe('console-formatter', () => {
	describe('formatMessage', () => {
		it('should format a message with timestamp, level, and app name', () => {
			const formattedMessage = formatMessage('error', 'Test message');

			// Verify the message contains the main components
			expect(formattedMessage).toContain('ERROR');
			expect(formattedMessage).toContain('[🪢 doubletie]');
			expect(formattedMessage).toContain('Test message');

			// Verify formatting includes timestamp (ISO format)
			// biome-ignore lint/performance/useTopLevelRegex: its okay its a test
			expect(formattedMessage).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it('should use custom app name when provided', () => {
			const formattedMessage = formatMessage(
				'info',
				'Custom app',
				'custom-app'
			);

			expect(formattedMessage).toContain('[custom-app]');
			expect(formattedMessage).toContain('INFO');
			expect(formattedMessage).toContain('Custom app');
		});
	});
}); 
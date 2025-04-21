// Export main formatter utilities
export {
	formatArgs,
	formatMessage,
	registerFormatter,
	getFormatter,
	type LogFormatter,
} from './formatter';

// Export console-specific formatting
export { formatMessage as formatConsoleMessage } from './console';

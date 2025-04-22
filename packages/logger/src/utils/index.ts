// Export result logging utilities
export {
	logResult,
	logResultAsync,
	logResult as logError,
	logResultAsync as logErrorAsync,
} from './result';

// Export telemetry utilities
export {
	withLogSpan,
	setDefaultTracer,
	setTelemetryDisabled,
	setDefaultAttributes,
} from './telemetry';

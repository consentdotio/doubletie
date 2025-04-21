import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { Span, Tracer } from '@opentelemetry/api';
import type { LogLevel } from '../core/types';

const DEFAULT_TRACER_NAME = '@doubletie/logger';

/**
 * Default tracer instance for log spans.
 */
let defaultTracer: Tracer | undefined;

/**
 * Set a global default tracer for log spans.
 *
 * @param tracer - The OpenTelemetry tracer to use
 */
export const setDefaultTracer = (tracer: Tracer): void => {
	defaultTracer = tracer;
};

/**
 * Whether telemetry is globally disabled.
 */
let telemetryDisabled = false;

/**
 * Disable or enable telemetry globally.
 *
 * @param disabled - Whether to disable telemetry
 */
export const setTelemetryDisabled = (disabled: boolean): void => {
	telemetryDisabled = disabled;
};

/**
 * Default attributes to add to all log spans.
 */
let defaultAttributes: Record<string, string | number | boolean> = {};

/**
 * Set default attributes to add to all log spans.
 *
 * @param attributes - The attributes to add
 */
export const setDefaultAttributes = (
	attributes: Record<string, string | number | boolean>
): void => {
	defaultAttributes = attributes;
};

/**
 * Create a span for a log message and execute a callback function.
 *
 * @param level - The log level
 * @param message - The log message
 * @param args - Additional log arguments
 * @param callback - Function to execute within the span
 * @param tracerOptions - Optional tracer configuration
 * @returns Result of the callback function
 */
export const withLogSpan = async <T>(
	level: LogLevel,
	message: string,
	args: unknown[],
	callback: () => Promise<T> | T,
	tracerOptions?: {
		tracer?: Tracer;
		disabled?: boolean;
		defaultAttributes?: Record<string, string | number | boolean>;
	}
): Promise<T> => {
	// Skip telemetry if globally disabled or specifically disabled for this call
	if (telemetryDisabled || tracerOptions?.disabled) {
		return callback();
	}

	// Use provided tracer, fall back to default tracer, or get a noop tracer
	const tracer =
		tracerOptions?.tracer ||
		defaultTracer ||
		trace.getTracer(DEFAULT_TRACER_NAME);

	// Create a span for this log message
	return tracer.startActiveSpan(
		`log.${level}`,
		async (span: Span): Promise<T> => {
			try {
				// Add context attributes to the span
				span.setAttributes({
					'log.level': level,
					'log.message': message,
					...(tracerOptions?.defaultAttributes || defaultAttributes),
				});

				// If args include an error, record exception info
				const errorArg = args.find((arg) => arg instanceof Error);
				if (errorArg instanceof Error) {
					span.recordException(errorArg);
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: errorArg.message,
					});
				} else if (level === 'error') {
					// If log level is error, mark span as errored even without an Error object
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: message,
					});
				}

				// Execute the callback
				const result = await callback();
				span.end();
				return result;
			} catch (error) {
				// If the callback throws, record the exception and re-throw
				if (error instanceof Error) {
					span.recordException(error);
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: error.message,
					});
				}
				span.end();
				throw error;
			}
		}
	);
};

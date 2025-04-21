import { SpanStatusCode, trace } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withLogSpan, setDefaultTracer, setTelemetryDisabled, setDefaultAttributes } from '../../utils/telemetry';

describe('telemetry', () => {
  // Mock the OpenTelemetry API
  const mockSpan = {
    setAttributes: vi.fn(),
    recordException: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn()
  };

  const mockTracer = {
    startActiveSpan: vi.fn((name, fn) => fn(mockSpan))
  };

  beforeEach(() => {
    // Reset the mocks before each test
    vi.resetAllMocks();
    
    // Mock trace.getTracer to return our mock tracer
    vi.spyOn(trace, 'getTracer').mockReturnValue(mockTracer as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withLogSpan', () => {
    it('should create a span with correct name and attributes', async () => {
      const result = await withLogSpan('info', 'Test message', [], async () => 'result');

      // Verify the span was created with the correct name
      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'log.info',
        expect.any(Function)
      );

      // Verify attributes were set correctly
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'log.level': 'info',
        'log.message': 'Test message'
      });

      // Verify span was ended
      expect(mockSpan.end).toHaveBeenCalled();

      // Verify callback result was returned
      expect(result).toBe('result');
    });

    it('should record exceptions found in args', async () => {
      const testError = new Error('Test error');
      
      await withLogSpan('error', 'Error message', [testError], async () => {});

      // Verify exception was recorded
      expect(mockSpan.recordException).toHaveBeenCalledWith(testError);
      
      // Verify status was set to error
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Test error'
      });
    });

    it('should set error status for error level even without Error object', async () => {
      await withLogSpan('error', 'Error without Error object', [], async () => {});

      // Verify status was set to error
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Error without Error object'
      });
    });

    it('should record exception if callback throws', async () => {
      const testError = new Error('Callback error');
      
      await expect(
        withLogSpan('info', 'Message', [], async () => {
          throw testError;
        })
      ).rejects.toThrow('Callback error');

      // Verify exception was recorded
      expect(mockSpan.recordException).toHaveBeenCalledWith(testError);
      
      // Verify status was set to error
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Callback error'
      });
      
      // Verify span was ended even though there was an error
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should skip tracing when telemetry is disabled', async () => {
      // Disable telemetry
      setTelemetryDisabled(true);
      
      const result = await withLogSpan('info', 'Disabled message', [], async () => 'disabled');
      
      // Verify no span was created
      expect(mockTracer.startActiveSpan).not.toHaveBeenCalled();
      
      // Verify callback was still executed
      expect(result).toBe('disabled');
      
      // Reset for other tests
      setTelemetryDisabled(false);
    });
  });

  describe('configuration functions', () => {
    it('should use default tracer when set', async () => {
      const customTracer = {
        startActiveSpan: vi.fn((name, fn) => fn(mockSpan))
      };
      
      // Set default tracer
      setDefaultTracer(customTracer as any);
      
      await withLogSpan('info', 'Using default tracer', [], async () => {});
      
      // Verify custom tracer was used
      expect(customTracer.startActiveSpan).toHaveBeenCalled();
      expect(trace.getTracer).not.toHaveBeenCalled();
    });

    it('should add default attributes when set', async () => {
      // Set default attributes
      setDefaultAttributes({
        'service.name': 'test-service',
        'environment': 'test'
      });
      
      await withLogSpan('info', 'With default attributes', [], async () => {});
      
      // Verify default attributes were included
      expect(mockSpan.setAttributes).toHaveBeenCalledWith({
        'log.level': 'info',
        'log.message': 'With default attributes',
        'service.name': 'test-service',
        'environment': 'test'
      });
    });
  });
}); 
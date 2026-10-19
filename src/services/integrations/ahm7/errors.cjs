// file: src/services/integrations/ahm7/errors.cjs
//
// Structured error classes for AHM7 integration

class Ahm7Error extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.serviceId = options.serviceId || null;
    this.statusCode = options.statusCode || 500;
    this.isOperational = true;
    if (options.cause) this.cause = options.cause;
  }
}

class Ahm7TimeoutError extends Ahm7Error {
  constructor(message = "Request to AHM7 service timed out", options = {}) {
    super(message, { ...options, statusCode: 504 });
  }
}

class Ahm7RateLimitError extends Ahm7Error {
  constructor(message = "AHM7 service rate limit reached (HTTP 429)", options = {}) {
    super(message, { ...options, statusCode: 429 });
    this.retryAfterMs = options.retryAfterMs || 5000;
  }
}

class Ahm7UpstreamError extends Ahm7Error {
  constructor(message = "AHM7 upstream service returned an error", options = {}) {
    super(message, { ...options, statusCode: options.statusCode || 502 });
  }
}

class Ahm7ValidationError extends Ahm7Error {
  constructor(message = "Invalid parameters for AHM7 request", options = {}) {
    super(message, { ...options, statusCode: 400 });
  }
}

class Ahm7SsrfError extends Ahm7Error {
  constructor(message = "URL blocked by SSRF security policy", options = {}) {
    super(message, { ...options, statusCode: 403 });
  }
}

class Ahm7CircuitBreakerError extends Ahm7Error {
  constructor(message = "AHM7 service is temporarily paused due to consecutive upstream failures", options = {}) {
    super(message, { ...options, statusCode: 503 });
  }
}

module.exports = {
  Ahm7Error,
  Ahm7TimeoutError,
  Ahm7RateLimitError,
  Ahm7UpstreamError,
  Ahm7ValidationError,
  Ahm7SsrfError,
  Ahm7CircuitBreakerError,
};

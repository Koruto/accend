export type ErrorContext = 'login' | 'signup' | 'logout' | 'profile' | 'booking' | 'request' | 'general' | 'dashboard';

function extractRawMessage(error: any): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const direct = error?.message || error?.toString?.();
  if (direct) return String(direct);
  const gqlErrors = (error as any)?.graphQLErrors;
  if (Array.isArray(gqlErrors) && gqlErrors.length > 0) {
    const msg = gqlErrors[0]?.message;
    if (msg) return String(msg);
  }
  const networkMsg = (error as any)?.networkError?.message;
  if (networkMsg) return String(networkMsg);
  return '';
}

export function friendlyMessageFromError(error: any, context: ErrorContext = 'general'): string {
  const raw = extractRawMessage(error);
  const upper = raw.toUpperCase();
  const isNetwork = /NETWORK/i.test(raw) || /FAILED TO FETCH/i.test(raw);

  // Context-specific mappings
  switch (context) {
    case 'login': {
      if (upper.includes('INVALID_CREDENTIALS')) return 'Wrong email or password.';
      if (upper.includes('INVALID_BODY')) return 'Please enter a valid email and password.';
      if (upper.includes('UNAUTHENTICATED') || upper.includes('FORBIDDEN')) return 'You are not authorized to sign in.';
      if (isNetwork) return 'Network error. Please check your connection and try again.';
      return raw || 'Unable to sign in at the moment. Please try again.';
    }
    case 'signup': {
      if (upper.includes('EMAIL_EXISTS')) return 'An account with that email already exists.';
      if (upper.includes('INVALID_BODY')) return 'Please fill in all required fields correctly.';
      if (isNetwork) return 'Network error. Please check your connection and try again.';
      return raw || 'Unable to create your account. Please try again.';
    }
    case 'logout': {
      if (isNetwork) return 'Network error while signing out. Please try again.';
      return raw || 'Sign out failed. Please try again.';
    }
    case 'profile': {
      if (upper.includes('INVALID_NAME')) return 'Please enter at least 2 characters for your name.';
      if (isNetwork) return 'Network error. Please try again.';
      return raw || 'Failed to save your profile.';
    }
    case 'booking': {
      if (upper.includes('INSUFFICIENT_ACCESS')) return 'You need admin approval. A request has been created for you.';
      if (upper.includes('ENV_NOT_FREE')) return 'Environment is not free right now. Please try again later.';
      if (upper.includes('USER_ALREADY_HAS_ACTIVE_BOOKING')) return 'You already have an active booking.';
      if (upper.includes('INVALID_DURATION')) return 'Please choose a valid duration.';
      if (upper.includes('EXTENSION_LIMIT_EXCEEDED')) return 'Cannot extend any further.';
      if (upper.includes('BOOKING_NOT_FOUND')) return 'We could not find this booking.';
      if (upper.includes('NOT_ACTIVE')) return 'This booking is not active.';
      if (isNetwork) return 'Network error. Please try again.';
      return raw || 'Could not complete your booking. Please try again.';
    }
    case 'request': {
      if (upper.includes('RESOURCE_NOT_FOUND')) return 'Selected resource was not found.';
      if (upper.includes('REQUEST_NOT_FOUND')) return 'Request was not found.';
      if (upper.includes('FORBIDDEN')) return 'You are not allowed to perform this action.';
      if (isNetwork) return 'Network error. Please try again.';
      return raw || 'Failed to submit your request.';
    }
    case 'dashboard':
    case 'general':
    default: {
      if (isNetwork) return 'Network error. Please try again.';
      return raw || 'Something went wrong. Please try again.';
    }
  }
} 
export type AuthUiMessage = {
  title: string;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  cooldownSeconds?: number;
};

export function mapAuthError(error: any, context: 'signIn' | 'signUp' | 'resend' | 'forgot' | 'submit'): AuthUiMessage {
  const status = Number(error?.status ?? 0);
  const raw = String(error?.message || '').toLowerCase();

  if (status === 429) {
    return {
      title: 'Please wait a moment',
      message:
        context === 'resend'
          ? 'We sent requests too recently. Please wait about a minute before asking for another verification email.'
          : 'There were too many attempts in a short time. Please wait about a minute and try again.',
      tone: 'warning',
      cooldownSeconds: 60,
    };
  }

  if (raw.includes('invalid login credentials')) {
    return {
      title: 'Sign in details do not match',
      message: 'We could not sign you in with that email and password. Please try again.',
      tone: 'error',
    };
  }

  if (raw.includes('email not confirmed')) {
    return {
      title: 'Please verify your email',
      message: 'Your email address still needs to be verified before you can continue.',
      tone: 'warning',
    };
  }

  if (raw.includes('network')) {
    return {
      title: 'Connection issue',
      message: 'We are having trouble connecting right now. Please try again in a moment.',
      tone: 'error',
    };
  }

  if (context === 'signUp') {
    return {
      title: 'Unable to create account',
      message: error?.message || 'Something went wrong while creating your account.',
      tone: 'error',
    };
  }

  if (context === 'resend') {
    return {
      title: 'Unable to resend email',
      message: error?.message || 'We could not resend the verification email right now.',
      tone: 'error',
    };
  }

  if (context === 'forgot') {
    return {
      title: 'Unable to send reset email',
      message: error?.message || 'We could not send the password reset email right now.',
      tone: 'error',
    };
  }

  return {
    title: 'Something went wrong',
    message: error?.message || 'Please try again.',
    tone: 'error',
  };
}
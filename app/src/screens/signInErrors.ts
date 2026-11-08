import { ApiError } from '../api/types';
import { MESSAGES } from '../api/client';

/** Turns a sign-in failure into words for the coach. */
export function signInErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'AUTH':
      case 'LOCKED':
      case 'BAD_INPUT':
      case 'NETWORK':
        return err.message;
      default:
        return 'Something went wrong in your sheet. Please try again in a minute.';
    }
  }
  return MESSAGES.network;
}

import type { LoginInput, SignupInput } from '../types/contracts';

const idPattern = /^\d{9}$/;
const namePattern =
  /^(?=.{1,150}$)\p{L}[\p{L}\p{M}]*(?:[ '\u2019\u02bc\-\u2010\u2011][\p{L}\p{M}]+)*$/u;
const streetPattern =
  /^(?=.{1,150}$)(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N} '\u2019\u02bc\-\u2010\u2011.,/#]+$/u;

export function validateLogin(body?: LoginInput) {
  const { username, password } = body ?? {};
  if (!isEmail(username) || !isPassword(password)) return null;
  return { username, password };
}

export function validateSignupAvailability(body?: Pick<SignupInput, 'email' | 'id'>) {
  const { email, id } = body ?? {};
  if (!isEmail(email) || typeof id !== 'string' || !idPattern.test(id)) return null;
  return { email, id };
}

export function validateSignup(body?: SignupInput) {
  const { id, firstName, lastName, city, street, email, pass } = body ?? {};
  if (
    !isName(firstName) ||
    !isName(lastName) ||
    !isName(city) ||
    typeof street !== 'string' ||
    !streetPattern.test(street) ||
    !isEmail(email) ||
    !isPassword(pass) ||
    (typeof id !== 'string' && typeof id !== 'number') ||
    !idPattern.test(String(id))
  ) {
    return null;
  }
  return { id: String(id), firstName, lastName, city, street, email, pass };
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && namePattern.test(value);
}

function isPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8;
}

function isEmail(value: unknown): value is string {
  if (typeof value !== 'string' || /\s/.test(value)) return false;

  const at = value.indexOf('@');
  if (at < 1 || value.indexOf('@', at + 1) !== -1) return false;

  // The domain needs a dot with at least one character on either side.
  const dot = value.indexOf('.', at + 2);
  return dot !== -1 && dot < value.length - 1;
}

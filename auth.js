import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { createUser, getUserByEmail, getUserById, verifyUserEmail, updateUserPassword, createVerificationToken, getVerificationToken, deleteVerificationToken } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@readtomelater.com';
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function sendVerificationEmail(email, token) {
  if (!SENDGRID_API_KEY) {
    console.log(`Verification email for ${email}: ${SITE_URL}/auth/verify?token=${token}`);
    return;
  }

  const msg = {
    to: email,
    from: FROM_EMAIL,
    subject: 'Verify your email - Read To Me Later',
    html: `
      <p>Click the link below to verify your email:</p>
      <a href="${SITE_URL}/auth/verify?token=${token}">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

export async function sendPasswordResetEmail(email, token) {
  if (!SENDGRID_API_KEY) {
    console.log(`Password reset email for ${email}: ${SITE_URL}/auth/reset?token=${token}`);
    return;
  }

  const msg = {
    to: email,
    from: FROM_EMAIL,
    subject: 'Reset your password - Read To Me Later',
    html: `
      <p>Click the link below to reset your password:</p>
      <a href="${SITE_URL}/auth/reset?token=${token}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

export async function registerUser(email, password) {
  const existingUser = getUserByEmail(email);
  if (existingUser) {
    throw new Error('User already exists');
  }

  const passwordHash = await hashPassword(password);
  const user = createUser(email, passwordHash);
  
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  createVerificationToken(user.id, token, 'verify', expiresAt.toISOString());
  
  await sendVerificationEmail(email, token);
  
  return { user: { id: user.id, email: user.email }, needsVerification: true };
}

export async function loginUser(email, password) {
  const user = getUserByEmail(email);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  if (!user.email_verified) {
    throw new Error('Please verify your email first');
  }

  const token = generateToken(user.id);
  return { user: { id: user.id, email: user.email }, token };
}

export async function verifyEmailToken(token) {
  const tokenRecord = getVerificationToken(token);
  if (!tokenRecord) {
    throw new Error('Invalid or expired token');
  }

  if (new Date() > new Date(tokenRecord.expires_at)) {
    deleteVerificationToken(token);
    throw new Error('Token expired');
  }

  if (tokenRecord.type !== 'verify') {
    throw new Error('Invalid token type');
  }

  verifyUserEmail(tokenRecord.user_id);
  deleteVerificationToken(token);
  
  const user = getUserById(tokenRecord.user_id);
  const authToken = generateToken(user.id);
  
  return { user: { id: user.id, email: user.email }, token: authToken };
}

export async function forgotPassword(email) {
  const user = getUserByEmail(email);
  if (!user) {
    // Don't reveal if user exists
    return { success: true };
  }

  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  createVerificationToken(user.id, token, 'reset', expiresAt.toISOString());
  
  await sendPasswordResetEmail(email, token);
  
  return { success: true };
}

export async function resetPassword(token, newPassword) {
  const tokenRecord = getVerificationToken(token);
  if (!tokenRecord) {
    throw new Error('Invalid or expired token');
  }

  if (new Date() > new Date(tokenRecord.expires_at)) {
    deleteVerificationToken(token);
    throw new Error('Token expired');
  }

  if (tokenRecord.type !== 'reset') {
    throw new Error('Invalid token type');
  }

  const passwordHash = await hashPassword(newPassword);
  updateUserPassword(tokenRecord.user_id, passwordHash);
  deleteVerificationToken(token);
  
  return { success: true };
}

export function authMiddleware(req) {
  const token = req.headers.get('cookie')?.match(/auth=([^;]+)/)?.[1];
  if (!token) {
    return null;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }

  const user = getUserById(decoded.userId);
  return user;
}

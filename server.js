'use strict';

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const connectPgSimple = require('connect-pg-simple');
const { Pool } = require('pg');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error('Missing required environment variable: ' + name);
  }
  return value.trim();
}

const sessionSecret = requiredEnv('SESSION_SECRET');
if (Buffer.byteLength(sessionSecret, 'utf8') < 32) {
  throw new Error('SESSION_SECRET must be at least 32 bytes long.');
}

const callbackUrl = requiredEnv('GOOGLE_CALLBACK_URL');
const frontendUrl = new URL(requiredEnv('FRONTEND_ORIGIN'));
if (frontendUrl.pathname !== '/' || frontendUrl.search || frontendUrl.hash) {
  throw new Error('FRONTEND_ORIGIN must be an origin without a path, query, or hash.');
}
const frontendOrigin = frontendUrl.origin;
const authorizedEmails = new Set(
  requiredEnv('AUTHORIZED_EMAILS')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
if (authorizedEmails.size === 0) {
  throw new Error('AUTHORIZED_EMAILS must contain at least one email address.');
}

const cookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(cookieSameSite)) {
  throw new Error('SESSION_COOKIE_SAME_SITE must be lax, strict, or none.');
}
const secureCookies = process.env.NODE_ENV === 'production' || cookieSameSite === 'none';
const pool = new Pool({ connectionString: requiredEnv('DATABASE_URL') });
const PgSessionStore = connectPgSimple(session);
const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(session({
  name: 'vider.sid',
  secret: sessionSecret,
  store: new PgSessionStore({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  resave: false,
  saveUninitialized: false,
  proxy: secureCookies,
  cookie: {
    httpOnly: true,
    secure: secureCookies,
    sameSite: cookieSameSite,
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  }
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));
passport.use(new GoogleStrategy({
  clientID: requiredEnv('GOOGLE_CLIENT_ID'),
  clientSecret: requiredEnv('GOOGLE_CLIENT_SECRET'),
  callbackURL: callbackUrl
}, (accessToken, refreshToken, profile, done) => {
  const rawProfile = profile._json || {};
  const email = profile.emails && profile.emails[0] && profile.emails[0].value
    ? profile.emails[0].value.trim().toLowerCase()
    : '';
  const emailIsVerified = rawProfile.email_verified === true || rawProfile.verified_email === true;

  if (!email || !emailIsVerified || !authorizedEmails.has(email)) {
    return done(null, false);
  }

  return done(null, {
    email,
    name: profile.displayName || ''
  });
}));

function requireGoogleUser(req, res, next) {
  if (req.isAuthenticated() && req.user && authorizedEmails.has(req.user.email)) {
    return next();
  }
  return res.status(401).json({ error: 'Google sign-in required.' });
}

function requireFrontendOrigin(req, res, next) {
  if (req.get('origin') !== frontendOrigin) {
    return res.status(403).json({ error: 'Request origin not allowed.' });
  }
  return next();
}

app.get('/', (req, res) => {
  res.json({ status: 'online', system: 'Chat Vider AGI Ecosystem' });
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/auth/google', passport.authenticate('google', {
  scope: ['openid', 'profile', 'email'],
  state: true,
  prompt: 'select_account'
}));

app.get('/auth/google/callback', passport.authenticate('google', {
  failureRedirect: frontendOrigin + '/?auth=failed'
}), (req, res) => {
  res.redirect(frontendOrigin + '/?auth=success');
});

app.get('/api/vider/auth', requireGoogleUser, (req, res) => {
  res.json({
    status: 'success',
    user: { email: req.user.email, name: req.user.name },
    system: 'Chat Vider AGI Ecosystem'
  });
});

app.post('/api/vider/auth', (req, res) => {
  res.status(410).json({
    error: 'Email and access-code login has been removed. Start Google sign-in at /auth/google.'
  });
});

app.post('/api/vider/logout', requireFrontendOrigin, requireGoogleUser, (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) return next(logoutError);
    req.session.destroy((sessionError) => {
      if (sessionError) return next(sessionError);
      res.clearCookie('vider.sid', {
        httpOnly: true,
        secure: secureCookies,
        sameSite: cookieSameSite,
        path: '/'
      });
      return res.status(204).end();
    });
  });
});

app.post('/api/vider/core', requireFrontendOrigin, requireGoogleUser, (req, res) => {
  const prompt = req.body && req.body.prompt;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) {
    return res.status(400).json({ error: 'prompt must be a non-empty string of at most 8000 characters.' });
  }

  return res.json({
    status: 'received',
    responder: 'Chat Vider',
    user: req.user.email,
    message: 'Authenticated request received. Connect a model provider to process prompts.'
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  console.error('Request failed:', err.name || 'Error');
  return res.status(status).json({
    error: status < 500 ? 'Invalid request.' : 'Internal server error.'
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log('Vider Bridge API listening on port ' + port);
});

const path = require('path');

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  SERVER_ORIGIN: process.env.SERVER_ORIGIN || null, // ex: "http://localhost:3000"
  FRONT_ORIGINS: (process.env.FRONT_ORIGINS
    ? process.env.FRONT_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
         /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/,
         /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/,
         /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}:5173$/,
      ]),
  DIRS: {
    AVATAR_DIR: path.join(__dirname, '..', '..', 'storage', 'avatars'),
    BANNER_DIR: path.join(__dirname, '..', '..', 'storage', 'banners'),
  },
};

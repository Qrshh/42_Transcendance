const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  SERVER_ORIGIN: process.env.SERVER_ORIGIN || null, // ex: "http://localhost:3000"
  FRONT_ORIGINS: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  DIRS: {
    AVATAR_DIR: path.join(__dirname, '..', '..', 'storage', 'avatars'),
    BANNER_DIR: path.join(__dirname, '..', '..', 'storage', 'banners'),
  },
};

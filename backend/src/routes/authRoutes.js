const express = require('express');
const { asyncHandler } = require('../lib/asyncHandler');
const { signup } = require('../controllers/authController');
const { validate } = require('../lib/validation');
const { z } = require('../lib/validation');

const router = express.Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

router.post('/signup', asyncHandler(async (req, res) => {
  req.body = validate(signupSchema, req.body);
  return signup(req, res);
}));

module.exports = { authRoutes: router };

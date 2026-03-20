const fetch = global.fetch || require('node-fetch');
const mongoose = require('mongoose');
const crypto = require('crypto');
const env = require('../config/env');
const Purchase = require('../models/purchase.model');

const API_BASE = `http://localhost:${env.port}`;

async function main() {
  console.log('Connecting to Mongo...');
  await mongoose.connect(env.mongoUri, { dbName: 'movieappDB' });

  // register a test user
  const registerRes = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'smoketest', email: `smoketest+${Date.now()}@example.com`, password: 'password123' }),
  });
  const regJson = await registerRes.json();
  if (!regJson.success) {
    console.error('Register failed', regJson);
    process.exit(1);
  }
  const token = regJson.data.token;
  const userId = regJson.data.user.id;
  console.log('Registered user', userId);

  const Movie = require('../models/movie.model');

  // ensure at least one movie exists
  let movie = await Movie.findOne().lean();
  if (!movie) {
    const created = await Movie.create({
      title: 'Smoke Test Movie',
      description: 'Auto-created movie for smoke tests',
      actors: ['Tester'],
      rating: 0,
      price: 499,
      coverImage: { url: 'https://example.com/cover.jpg', publicId: 'cover_test', resourceType: 'image' },
      createdBy: '000000000000000000000001',
    });
    movie = created.toObject();
    console.log('Created test movie', movie._id.toString());
  }

  // create a fake purchase in DB
  const fakeOrderId = `order_fake_${Date.now()}`;
  const fakePaymentId = `pay_fake_${Date.now()}`;
  const amountPaise = 49900; // Rs 499

  const p = await Purchase.create({
    user: userId,
    movie: movie._id,
    amount: amountPaise,
    currency: 'INR',
    razorpayOrderId: fakeOrderId,
    status: 'pending',
  });
  console.log('Inserted purchase', p._id.toString());

  // compute signature
  const signature = crypto.createHmac('sha256', env.razorpayKeySecret).update(`${fakeOrderId}|${fakePaymentId}`).digest('hex');

  // call verify endpoint
  const verifyRes = await fetch(`${API_BASE}/api/payment/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ razorpay_order_id: fakeOrderId, razorpay_payment_id: fakePaymentId, razorpay_signature: signature }),
  });
  const verifyJson = await verifyRes.json();
  console.log('Verify response:', verifyJson);

  // check my-movies
  const moviesRes = await fetch(`${API_BASE}/api/user/my-movies`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const moviesJson = await moviesRes.json();
  console.log('/api/user/my-movies ->', moviesJson);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

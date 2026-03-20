const mongoose = require('mongoose');
require('dotenv').config();

const checkDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'movieappDB' });
    console.log('Connected to MongoDB');

    const Movie = mongoose.model('Movie', new mongoose.Schema({ status: String, title: String }));
    const movies = await Movie.find({});
    console.log('Total movies:', movies.length);
    movies.forEach(m => console.log(`- ${m.title}: ${m.status}`));

    const Purchase = mongoose.model('Purchase', new mongoose.Schema({ status: String, user: mongoose.Schema.Types.ObjectId, movie: mongoose.Schema.Types.ObjectId }));
    const purchases = await Purchase.find({});
    console.log('Total purchases:', purchases.length);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkDb();

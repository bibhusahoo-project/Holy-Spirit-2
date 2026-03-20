const mongoose = require('mongoose');
const Category = require('./models/category.model');

async function addCategories() {
  try {
    await mongoose.connect('mongodb://localhost:27017/movie-rental', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const categories = ['Horror', 'Thriller', 'Adventure', 'Action', 'Popular', 'Trending'];

    for (const name of categories) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existing = await Category.findOne({ name });
      if (!existing) {
        await Category.create({ name, slug });
        console.log(`Created category: ${name}`);
      } else {
        console.log(`Category already exists: ${name}`);
      }
    }

    console.log('Done');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

addCategories();
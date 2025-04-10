const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const productSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Назва товару є обов\'язковою']
  },
  description: {
    type: String,
    required: [true, 'Опис товару є обов\'язковим']
  },
  price: {
    type: Number,
    required: [true, 'Ціна товару є обов\'язковою'],
    min: [0, 'Ціна не може бути негативною'] 
  },
  images: {
    type: [String], 
    required: [true, 'Потрібно хоча б одне зображення'],
    validate: [val => val.length > 0, 'Має бути хоча б одне зображення'] 
  },
  category: {
    type: String,
    required: [true, 'Категорія є обов\'язковою'],
  },
  status: {
    type: String,
    required: [true, 'Статус товару є обов\'язковим'],
    enum: ['В наявності', 'Під замовлення', 'Немає в наявності'] 
  },
  tags: {
    type: [String],
    index: true 
  },
  materials: [String],
  dimensions: {
    width: Number,
    height: Number,
    size_name: String
  },
  colors: [String],
  care_instructions: String,
  creation_time_info: String, 
  isFeatured: {
    type: Boolean,
    default: false 
  },
  ratingSum: { 
    type: Number,
    default: 0
},
ratingCount: {
    type: Number,
    default: 0
},
}, { timestamps: true });

productSchema.virtual('averageRating').get(function() {
  if (this.ratingCount === 0) {
      return 0;
  }
  return Math.round((this.ratingSum / this.ratingCount) * 10) / 10;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });


module.exports = mongoose.model('Product', productSchema);
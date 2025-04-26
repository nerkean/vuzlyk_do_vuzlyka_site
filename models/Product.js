const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const imageSetSchema = new Schema({
  large: { type: String, required: true },
  medium: { type: String, required: true },
  thumb: { type: String, required: true }
}, { _id: false });

const productSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Назва товару є обов\'язковою']
  },
  description: {
    type: String,
    required: [true, 'Опис товару є обов\'язковим']
  },
  metaDescription: {
    type: String,
    trim: true,
    maxlength: [170, 'Meta Description не може перевищувати 170 символів']
  },
  price: { 
    type: Number,
    required: [true, 'Ціна товару є обов\'язковою'],
    min: [0, 'Ціна не може бути негативною']
},
maxPrice: {
  type: Number,
  min: [0, 'Ціна не може бути негативною'],
},
images: {
  type: [imageSetSchema], 
  required: [true, 'Потрібно хоча б одне зображення'],
  validate: [val => Array.isArray(val) && val.length > 0 && val.every(img => img.large && img.medium && img.thumb), 'Має бути хоча б одне зображення з усіма розмірами']
},
  category: {
    type: String,
    required: [true, 'Категорія є обов\'язковою'],
    default: 'Вишивка'
  },
  status: {
    type: String,
    enum: ['Під замовлення', 'В наявності'], 
    default: 'Під замовлення' 
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
  creation_time_info: {
    type: String,
    required: [true, 'Термін виготовлення є обов\'язковим'] 
 },
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
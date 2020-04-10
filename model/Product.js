const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    categorie: String,
    sous_categorie: String,
    title: String,
    reference: String,
    price: String,
    description: String,
    urlImg: String,
    urlImgDetail: String,
    colors: [String],
    sizes: [String],
    urlDetails: String
        // website: String,
        // tags: [String],
        // stock: Number
});

const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;
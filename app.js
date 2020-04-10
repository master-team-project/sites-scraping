const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const Product = require('./model/Product');
const fs = require('fs');

/**
 * Connect to MongoDB Atlas
 */
async function connectToMongoDB() {
    await mongoose.connect(
        "mongodb+srv://logimek:mekibnmekH72@scrapcluster-ho1x5.mongodb.net/shop?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true }
    );
    console.log("Connected to mongoDB database");
}

/**
 * Get the url for the clothe men
 * 
 * @param page CheerioObject 
 * @return string
 */
async function getUrlHommePage(page) {
    try {
        const baseUrl = 'https://www.armandthiery.fr/';
        await page.goto(baseUrl);

        const html = await page.content();
        const $ = cheerio.load(html);

        // Save the html page into a file
        // fs.writeFileSync('./page-armand.html', html);

        // Men menu
        const urlMen = $('#Hover1').children('a').attr('href');

        return urlMen;
    } catch (err) {
        console.error(err);
    }
};

/**
 * Get the different categories of clothe
 * 
 * @param page CheerioObject
 * @param urlMen string
 * 
 * @return array listClotheCategories
 */

async function getProductCategories(page, urlMen) {
    try {
        await page.goto(urlMen);
        const html = await page.content();
        // fs.writeFileSync('./page-armand-men.html', html);
        const $ = cheerio.load(html);

        const listProductCategories = [];
        $('#filtersCollapse_catalog > .menuFilters > ul > li > a').each((index, element) => {
            const title = $(element).attr('title');
            const url = $(element).attr('href');
            listProductCategories.push({ title, url });
        });
        return listProductCategories;
    } catch (err) {
        console.log(err);
    }
}

async function getProductCategoriesAndSubCategories(page, listProductCategories) {
    try {
        for (let index = 0; index < listProductCategories.length; index++) {
            const url = listProductCategories[index].url;

            await page.goto(url);
            const htm = await page.content();
            const $ = cheerio.load(htm);

            const subCategoriesTitle = [];
            const subCategoriesUrl = [];
            $('#filtersCollapse_catalog > .menuFilters > ul > li').children('div').find('a').each((i, e) => {
                const sub_title = $(e).attr('title');
                const sub_url = $(e).attr('href');

                subCategoriesTitle.push(sub_title);
                subCategoriesUrl.push(sub_url);
            })

            listProductCategories[index].sub_titles = subCategoriesTitle;
            listProductCategories[index].sub_urls = subCategoriesUrl;

            await sleep(1000); // 1s
        }
        return listProductCategories;
    } catch (err) {
        console.error(err);
    }
}

async function buildObjectProduct(page, url, categorie, sous_categorie, productsList) {
    await page.goto(url);
    const htm = await page.content();
    const $ = cheerio.load(htm);

    $('.prods.grid-2 > ul.flex_left > li').each((index, element) => {
        const urlImg = ($(element).find('div > a').children('img').attr('data-src')) ? $(element).find('div > a').children('img').attr('data-src') : $(element).find('div > a').children('img').attr('src');
        const urlDetails = $(element).find('div').children('a').attr('href');
        productsList.push({ categorie, sous_categorie, urlImg, urlDetails });
    })
}

async function getProductsList(page, fullListCategories) {
    const productsList = [];
    try {
        for (let index = 0; index < fullListCategories.length; index++) {
            // Only costumes
            // for (let index = 0; index < 1; index++) {
            const category = fullListCategories[index];
            const categoryName = category.title;
            // Il faut traiter le cas où il y a des sous menus
            if (category.sub_urls.length > 0) {
                for (let i = 0; i < category.sub_urls.length; i++) {
                    const url = category.sub_urls[i];
                    const sous_categorie = category.sub_titles[i];
                    await buildObjectProduct(page, url, categoryName, sous_categorie, productsList);
                }
            } else {
                const url = category.url;
                const sous_categorie = 'None';
                await buildObjectProduct(page, url, categoryName, sous_categorie, productsList);
            }
        }

        return productsList;
    } catch (err) {
        console.error(err);
    }
}

async function getProductsWithDetails(page, products) {
    try {
        for (let index = 0; index < products.length; index++) {
            const url = products[index].urlDetails;
            await page.goto(url);
            const htm = await page.content();
            const $ = cheerio.load(htm);

            products[index].colors = [];
            products[index].sizes = [];

            if (products[index].sous_categorie === 'Costumes complets') {
                products[index].urlImgDetail = $('figure > img').attr('src');
                products[index].title = $('h1.kit_name.text-center').text();
                products[index].reference = $('.kit_prod_ref').children('span').first().text();

                let s = 0;
                $('p.kit_prod_price.price span.best').each((i, e) => {
                    s = s + parseFloat($(e).text().replace(',', '.').replace(' €', ''));
                });
                // products[index].price = $('p.kit_prod_price.price span.best').text().replace(',', '.').replace(' €', '');
                products[index].price = s;

                products[index].description = "";


                $('.kit_prods').children('.clearfix.kit_prod').first().find('.trs03 > img').each((i, e) => {
                    // console.log($(e).attr('alt'));
                    products[index].colors.push($(e).attr('alt'));
                });

                $('.kit_prods').children('.clearfix.kit_prod').first().find('ul.attribs.lastAttr.clearfix > li').each((i, e) => {
                    // const sz = $(e).text().replace(/[\t\n]+/g, '').trim();
                    products[index].sizes.push($(e).text().trim());
                });
            } else {
                // All the others
                products[index].urlImgDetail = $('figure > img').attr('src');
                products[index].title = $('header > h1').text();
                products[index].reference = $('header > p').text().replace('Réf. : ', '');
                products[index].price = $('header').find('h2.best.pull-left.no-xs-float').text().replace(',', '.').replace(' €', '');
                products[index].description = $('#prodInfosCollapse_desc > .panel-body').children('p').last().text().trim();

                $('.firstAttr > li').each((k, element) => {
                    products[index].colors.push($(element).find('img').attr('title'));
                });
                $('.lastAttr > li').each((k, element) => {
                    products[index].sizes.push($(element).text().trim());
                });
            }

            // Save into Mongo DataBase
            const ProductModel = new Product(products[index]);
            ProductModel.save();
        }

        return products;
    } catch (err) {
        console.error(err);
    }
}

async function sleep(millisecondes) {
    return new Promise(resolve => setTimeout(resolve, millisecondes));
}

async function main() {
    await connectToMongoDB();
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const urlMen = await getUrlHommePage(page);
    // console.log(urlMen);

    const listProductCategories = await getProductCategories(page, urlMen);
    // console.log(listClotheCategories);

    const fullListProductCategories = await getProductCategoriesAndSubCategories(page, listProductCategories);
    // console.log(fullListProductCategories);

    const products = await getProductsList(page, fullListProductCategories);
    // console.log(products);

    const productsWithDetails = await getProductsWithDetails(page, products);
    console.log(productsWithDetails);
}

main();
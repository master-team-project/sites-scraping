const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

const config = [{
        brand: 'Armand Thierry',
        baseUrl: 'https://www.armandthiery.fr',
        getJQueryToGetUrlMen() {
            return "$('#Hover1').children('a').attr('href')";
        }
    },
    {
        brand: 'Celio',
        baseUrl: 'https://www.celio.com',
        getJQueryToGetUrlMen() {
            return "";
        }
    },

];

const baseUrls = [
    'https://www.armandthiery.fr',
    'https://www.celio.com',
    'https://www.jules.com',
    'https://www2.hm.com',
    'https://www.galerieslafayette.com',
    'https://www.zalando.fr',
    'https://www.citadium.com/',
    'https://www.devred.com/'
];

const getContentPage = async(page, url) => {
    await page.goto(url);
    const html = await page.content();

    return html;
}

async function getUrlMenPageFromHomePage(page) {
    try {
        const $ = cheerio.load(await getContentPage(baseUrls[0]));
        // On cible le menu Homme
        const urlMen = $('#Hover1').children('a').attr('href');

        return urlMen;
    } catch (err) {
        console.error(err);
    }
};

async function getCategoriesTitlesAndUrls(page, urlMen) {
    try {
        const $ = cheerio.load(getContentPage(urlMen));
        // On récupère les différentes catégories de vêtement et les urls associées
        const listCategories = [];
        $('#filtersCollapse_catalog > .menuFilters > ul > li > a').each((index, element) => {
            const title = $(element).attr('title');
            const url = $(element).attr('href');
            listCategories.push({ title, url });
        });

        return listCategories;
    } catch (err) {
        console.log(err);
    }
}

async function getSubMenuByCategories(page, listCategories) {
    try {
        for (let index = 0; index < listCategories.length; index++) {
            const url = listCategories[index].url;

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

            listCategories[index].sub_titles = subCategoriesTitle;
            listCategories[index].sub_urls = subCategoriesUrl;

            await sleep(1000); // 1s
        }
        // console.log(listCategories);
        return listCategories;
    } catch (err) {
        console.error(err);
    }
}

async function getClothes(page, fullListCategories) {
    const productLists = [];
    try {
        for (let index = 0; index < fullListCategories.length; index++) {
            const category = fullListCategories[index];
            // Il faut traiter le cas où il y a des sous menus
            if (category.sub_urls.length > 0) {
                for (let i = 0; i < category.sub_urls.length; i++) {
                    const url = category.sub_urls[i];
                    await page.goto(url);
                    const htm = await page.content();
                    const $ = cheerio.load(htm);

                    $('.prods.grid-2 > ul.flex_left > li').each((index, element) => {
                        const urlImg = ($(element).find('div > a').children('img').attr('data-src')) ? $(element).find('div > a').children('img').attr('data-src') : $(element).find('div > a').children('img').attr('src');
                        const urlDetails = $(element).find('div').children('a').attr('href');
                        // const titleImg = $(element).children('a').attr('title');
                        // const price = $(element).find('span.best').text().trim();
                        const categorie = category.title;
                        const sous_categorie = category.sub_titles[i];
                        const productList = { categorie, sous_categorie, urlImg, urlDetails };
                        productLists.push(productList);
                    })
                }
            } else {
                const url = category.url;
                await page.goto(url);
                const htm = await page.content();
                const $ = cheerio.load(htm);

                $('.prods.grid-2 > ul.flex_left > li').each((i, element) => {
                    const urlImg = ($(element).find('div > a').children('img').attr('data-src')) ? $(element).find('div > a').children('img').attr('data-src') : $(element).find('div > a').children('img').attr('src');
                    const urlDetails = $(element).find('div').children('a').attr('href');
                    const categorie = category.title;
                    const sous_categorie = 'None';
                    const productList = { categorie, sous_categorie, urlImg, urlDetails };
                    productLists.push(productList);
                })
            }
        }
    } catch (err) {
        console.error(err);
    }

    return productLists;
}

async function getClothesWithDetails(page, clothes) {
    try {
        const aT = [];
        for (let index = 0; index < clothes.length; index++) {
            const oT = {};
            // const element = clothes[index];

            const url = clothes[index].urlDetails;
            // console.log(url);
            // await page.goto(url);
            // const htm = await page.content();
            // const $ = cheerio.load(htm);

            const colors = [];
            const sizes = [];

            let urlImgDetail = "";
            let titleProduct = "";
            let referenceProduct = "";
            let productPrice = "";
            let productDescription = "";

            // Les costumes n'obéissent pas à la même logique
            // if (clothes[index].categorie === 'Costumes') {
            if (clothes[index].sous_categorie === 'Costumes complets') {
                await page.goto(url);
                const htm = await page.content();
                const $ = cheerio.load(htm);
                urlImgDetail = $('figure > img').attr('src');
                titleProduct = $('h1.kit_name.text-center').text();
                referenceProduct = $('kit_prod_ref').children('span').text();
                productPrice = $('span.best').text().replace(',', '.').replace(' €', '');
                productDescription = "";

                $('ul.attribs > li').each((k, element) => {
                    colors.push($(element).find('img').attr('alt'));
                })
                $('.lastAttr > li').each((k, element) => {
                    sizes.push($(element).text().trim());
                })

                clothes[index].urlImgDetail = urlImgDetail;
                clothes[index].titleProduct = titleProduct;
                clothes[index].referenceProduct = referenceProduct;
                clothes[index].productPrice = productPrice;
                clothes[index].productDescription = productDescription;
                clothes[index].colors = colors;
                clothes[index].sizes = sizes;
                // test
                oT.categorie = clothes[index].categorie;
                oT.sous_categorie = clothes[index].sous_categorie;
                oT.urlImgDetail = clothes[index].urlImgDetail;
                oT.titleProduct = clothes[index].titleProduct;
                oT.referenceProduct = clothes[index].referenceProduct;
                oT.productPrice = clothes[index].productPrice;
                oT.productDescription = clothes[index].productDescription;
                oT.colors = clothes[index].colors;
                oT.sizes = clothes[index].sizes;
                aT.push(oT);
            } else if (clothes[index].categorie == 'sdsqdqsCostumes') { //'Costumes' 'Chemises' 'Polos & Tee-shirts' 'Pulls & Gilets' 'Pantalons' 'Jeans' 'Parkas & Blousons' 'Manteaux' 'Cravates' 'Accessoires' 'Sous-vêtements & Nuit'
                urlImgDetail = $('figure > img').attr('src');
                titleProduct = $('header > h1').text();
                referenceProduct = $('header > p').text().replace('Réf. : ', '');
                productPrice = $('header').find('h2.best.pull-left.no-xs-float').text().replace(',', '.').replace(' €', '');
                productDescription = $('#prodInfosCollapse_desc > .panel-body').children('p').last().text();
                // const colors = [];
                // const sizes = [];
                $('.firstAttr > li').each((k, element) => {
                    colors.push($(element).find('img').attr('title'));
                })
                $('.lastAttr > li').each((k, element) => {
                    sizes.push($(element).text().trim());
                })

                // clothes[index].urlImgDetail = urlImgDetail;
                // clothes[index].titleProduct = titleProduct;
                // clothes[index].referenceProduct = referenceProduct;
                // clothes[index].productPrice = productPrice;
                // clothes[index].productDescription = productDescription;
                // clothes[index].colors = colors;
                // clothes[index].sizes = sizes;
                // // test
                // oT.categorie = clothes[index].categorie;
                // oT.sous_categorie = clothes[index].sous_categorie;
                // oT.urlImgDetail = clothes[index].urlImgDetail;
                // oT.titleProduct = clothes[index].titleProduct;
                // oT.referenceProduct = clothes[index].referenceProduct;
                // oT.productPrice = clothes[index].productPrice;
                // oT.productDescription = clothes[index].productDescription;
                // oT.colors = clothes[index].colors;
                // oT.sizes = clothes[index].sizes;
                // aT.push(oT);
            }
            // clothes[index].urlImgDetail = urlImgDetail;
            // clothes[index].titleProduct = titleProduct;
            // clothes[index].referenceProduct = referenceProduct;
            // clothes[index].productPrice = productPrice;
            // clothes[index].productDescription = productDescription;
            // clothes[index].colors = colors;
            // clothes[index].sizes = sizes;
            // // test
            // oT.categorie = clothes[index].categorie;
            // oT.sous_categorie = clothes[index].sous_categorie;
            // oT.urlImgDetail = clothes[index].urlImgDetail;
            // oT.titleProduct = clothes[index].titleProduct;
            // oT.referenceProduct = clothes[index].referenceProduct;
            // oT.productPrice = clothes[index].productPrice;
            // oT.productDescription = clothes[index].productDescription;
            // oT.colors = clothes[index].colors;
            // oT.sizes = clothes[index].sizes;
            // aT.push(oT);
        }
        console.log(aT);
        return clothes;
    } catch (err) {
        console.error(err);
    }
}

async function sleep(millisecondes) {
    return new Promise(resolve => setTimeout(resolve, millisecondes));
}

async function main() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const urlMen = await getUrlMenPageFromHomePage(page);

    const listCategories = await getCategoriesTitlesAndUrls(page, urlMen);

    const fullListCategories = await getSubMenuByCategories(page, listCategories);
    // console.log(fullListCategories);

    const clothes = await getClothes(page, fullListCategories);
    // console.log(clothes);

    const clothesWithDetails = await getClothesWithDetails(page, clothes);
    // console.log(clothesWithDetails);
}

main();
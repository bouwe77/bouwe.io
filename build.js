// Waar ik was gebleven:
// 3. Toch maar een ander, simpeler template, dus al die W3Schools meuk eruit slopen...

import path from "path";
import { promises as fs } from "fs";
import shell from "shelljs";
import remark from "remark";
import html from "remark-html";
import report from "vfile-reporter";
import fm from "front-matter";

import { getBlogCategoriesHtml } from "./partials/blogCategories";
import { getBlogsHtml } from "./partials/blogs";

const __dirname = path.resolve();
const blogDirectory = "blog";
const pagesDirectory = "pages";
const staticDirectory = "static";
const buildDirectory = "build";
const templatesDirectory = "pageTemplates";

go();

async function go() {
  shell.rm("-rf", "build");
  shell.mkdir("build");
  shell.mkdir("build/categories");

  // Copy all files from the static folder as-is to the build folder.
  await copyStaticFiles();

  // Get front matter and markdown content for all pages and blogs.
  const pageData = await getPageData();
  const blogData = await getBlogData();

  // Create the HOME page, which is a combination of an HTML template and subtemplates.
  await createHomePage(blogData);

  // Convert all PAGE markdown files with front matter to HTML pages and copy them to the build folder.
  await createPages(pageData);

  // Convert all BLOG markdown files with front matter to HTML pages and copy them to the build folder.
  await createPages(blogData);

  // Create a page for each blog category.
  await createCategoryPages(blogData);

  console.log(" _                                _");
  console.log("| |                              (_)");
  console.log("| |__   ___  _   ___      _____   _  ___");
  console.log("| '_ \\ / _ \\| | | \\ \\ /\\ / / _ \\ | |/ _ \\");
  console.log("| |_) | (_) | |_| |\\ V  V /  __/_| | (_) |");
  console.log("|_.__/ \\___/ \\__,_| \\_/\\_/ \\___(_)_|\\___/");

  console.log("\n✓ Done!\n");
}

async function getBlogData() {
  const blogData = { template: "blog.html", pages: [], categories: [] };

  let blogSubFolders = await fs.readdir(path.join(__dirname, blogDirectory));
  await Promise.all(
    blogSubFolders.map(async (subFolder) => {
      if (subFolder.startsWith(".")) return;
      const subFolderPath = path.join(__dirname, blogDirectory, subFolder);
      let files = await fs.readdir(subFolderPath);
      const filename = files[0];

      let fileContents = await fs.readFile(path.join(subFolderPath, filename));
      const parsedFrontMatterAndMarkdown = fm(String(fileContents));

      parsedFrontMatterAndMarkdown.filename = filename;
      parsedFrontMatterAndMarkdown.slug = filename.replace(".md", "");
      blogData.pages.push(parsedFrontMatterAndMarkdown);

      parsedFrontMatterAndMarkdown.attributes.categories.forEach(
        (categoryName) => {
          var existingCategory = blogData.categories.find(
            (category) => category.name === categoryName
          );
          if (existingCategory) existingCategory.count++;
          else
            blogData.categories.push({
              name: categoryName,
              count: 1,
              slug: createSlug(categoryName),
            });
        }
      );
    })
  );

  // Sort the blogs on date descending.
  blogData.pages = blogData.pages.sort((a, b) =>
    a.attributes.date > b.attributes.date
      ? -1
      : b.attributes.date > a.attributes.date
      ? 1
      : 0
  );

  return blogData;
}

async function getPageData() {
  const pageData = { template: "page.html", pages: [] };

  let pages = await fs.readdir(path.join(__dirname, pagesDirectory));
  await Promise.all(
    pages.map(async (filename) => {
      if (filename.startsWith(".")) return;
      let fileContents = await fs.readFile(
        path.join(__dirname, pagesDirectory, filename)
      );
      const parsedFrontMatterAndMarkdown = fm(String(fileContents));
      parsedFrontMatterAndMarkdown.filename = filename;
      parsedFrontMatterAndMarkdown.slug = filename.replace(".md", "");
      pageData.pages.push(parsedFrontMatterAndMarkdown);
    })
  );

  return pageData;
}

async function copyStaticFiles() {
  let staticFiles = await fs.readdir(path.join(__dirname, staticDirectory));
  await Promise.all(
    staticFiles.map(async (filename) => {
      await fs.copyFile(
        path.join(__dirname, staticDirectory, filename),
        path.join(__dirname, buildDirectory, filename)
      );
      //console.log("›", filename);
    })
  );
}

async function createHomePage(blogData) {
  let html = await readTemplate("home.html");

  html = String(html).replace(
    new RegExp("{{ blogs }}", "g"),
    getBlogsHtml(blogData.pages)
  );

  html = String(html).replace(
    new RegExp("{{ blogCategories }}", "g"),
    getBlogCategoriesHtml(blogData.categories)
  );

  await fs.writeFile(path.join(__dirname, "build", "index.html"), String(html));
  //console.log("›", "index.html");
}

async function createPages(data) {
  const template = await readTemplate(data.template);

  data.pages.forEach(async (page) => {
    const makeHtmlPage = (content) => {
      let htmlPage = String(template);
      htmlPage = htmlPage.replace(
        new RegExp("{{ title }}", "g"),
        page.attributes.title
      );

      if (page.attributes.date)
        htmlPage = htmlPage.replace(
          new RegExp("{{ date }}", "g"),
          formatDate(page.attributes.date)
        );
      htmlPage = htmlPage.replace(new RegExp("{{ content }}", "g"), content);
      htmlPage = htmlPage.replace(new RegExp("{{ slug }}", "g"), page.slug);
      return htmlPage;
    };

    let html = await toHtml(makeHtmlPage, page.body);
    await fs.writeFile(
      path.join(__dirname, "build", page.filename.replace(/\.md$/, ".html")),
      html
    );
    //console.log("›", page.filename);
  });
}

async function createCategoryPages(blogData) {
  const template = await readTemplate("page.html");

  blogData.categories.forEach(async (cat) => {
    const blogsHtml = getBlogsHtml(
      blogData.pages.filter((p) => p.attributes.categories.includes(cat.name))
    );

    const slug = createSlug(cat.name);

    const makeHtmlPage = (content) => {
      let htmlPage = String(template);
      htmlPage = htmlPage.replace(new RegExp("{{ title }}", "g"), cat.name);
      htmlPage = htmlPage.replace(new RegExp("{{ content }}", "g"), content);
      htmlPage = htmlPage.replace(new RegExp("{{ slug }}", "g"), slug);
      return htmlPage;
    };

    let html = await toHtml(makeHtmlPage, blogsHtml);
    await fs.writeFile(
      path.join(__dirname, "build/categories", slug + ".html"),
      html
    );
    //console.log("›", cat.name);
  });
}

async function toHtml(makeHtmlPage, markdown) {
  return new Promise(async (resolve, reject) => {
    // add remark plugins here for syntax highlighting, etc.
    remark()
      .use(html)
      .process(String(markdown), async (err, markup) => {
        if (err) {
          console.error(report(err));
          reject(err);
        }

        const htmlPage = makeHtmlPage(markup);

        resolve(htmlPage);
      });
  });
}

async function readTemplate(templateFile) {
  return await fs.readFile(
    path.join(__dirname, templatesDirectory, templateFile)
  );
}

function createSlug(text) {
  let slug = text
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "");

  return slug;
}

function formatDate(date) {
  const dateSegments = date.split("-");

  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  return `${months[dateSegments[1] - 1]} ${dateSegments[2]}, ${
    dateSegments[0]
  }`;
}

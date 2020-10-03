export function getBlogsHtml(blogs) {
  const template = `
<div class="w3-card-4 w3-margin w3-white">
    <div class="w3-container">
    <h3>
        <b><a href="/{{ slug }}">{{ title }}</a></b>
    </h3>
    </div>
</div>
<hr />`;

  let html = "";
  blogs.forEach((blog) => {
    html += template
      .replace(new RegExp("{{ slug }}", "g"), blog.slug)
      .replace(new RegExp("{{ title }}", "g"), blog.attributes.title)
      .replace(new RegExp("{{ summary }}", "g"), blog.attributes.summary);
  });

  return html;
}

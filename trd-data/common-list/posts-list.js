const dataUrl =
  "https://therealdeal.com/wp-json/wp/v2/dataset/?dataset-tag=53113";

const trdTheme = TrdTheme();

const trdPostList = (options) => {
  const defaults = {
    dataUrl: undefined,
    rootElement: undefined,
  };

  const settings = {
    ...defaults,
    ...options,
  };

  const fn = {
    init: () => {
      trdTheme.init();
      fn.getData(settings.dataUrl)
        .then(fn.renderListItems)
        .catch(console.error);
    },

    getData: async (url) => {
      const response = await fetch(url);
      return response.json();
    },

    renderListItems: (data) => {
      const items = data
        .map((post) => {
          const title = post.title.rendered;
          const sectorIndex = post.class_list.findIndex((item) =>
            item.startsWith("sector-")
          );
          const sector =
            sectorIndex !== -1
              ? post.class_list[sectorIndex]
                  .replace("sector-", "")
                  .replace(/-/g, " ")
              : "";

          return `
            <li class="list-group-item">
              <a href="${helpers.getGamTrackUrl(
                post.link
              )}" class="text-decoration-none text-reset">
                <div class="me-2 text-uppercase">${sector}</div>
                <div class="me-2 fw-bold">${title}</div>
              </a>
            </li>
          `;
        })
        .join("");

      settings.rootElement.innerHTML = items;
    },
  };

  const helpers = {
    getGamTrackUrl: (url) => {
      if (!window.frameElement || !url || url === "") return url;

      const clickUrlUnescaped = window.frameElement.getAttribute(
        "data-click-url-unesc"
      );
      if (
        !clickUrlUnescaped ||
        !clickUrlUnescaped.startsWith("http://") ||
        !clickUrlUnescaped.startsWith("https://")
      ) {
        return url;
      }

      const newUrl = new URL(clickUrlUnescaped);
      if (newUrl.searchParams.has("adurl")) {
        newUrl.searchParams.delete("adurl");
      }
      newUrl.searchParams.append("adurl", url);
      return newUrl.toString();
    },
  };

  fn.init();
};

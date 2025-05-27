const dataUrl =
  "https://therealdeal.com/wp-json/wp/v2/dataset/?dataset-tag=53113";

const trdTheme = TrdTheme();

const trdPostList = (options) => {
  const defaults = {
    dataUrl: undefined,
    rootElement: undefined,
    viewMoreUrl: undefined,
  };

  const settings = {
    ...defaults,
    ...options,
  };

  const queryParams = new URLSearchParams(window.location.search);
  const market = queryParams.get("market");
  const limit = queryParams.get("limit");

  const fn = {
    init: () => {
      trdTheme.init();
      fn.getData(fn.getDataUrl()).then(fn.renderListItems).catch(console.error);
    },

    getDataUrl: () => {
      const url = new URL(settings.dataUrl);
      const params = new URLSearchParams(url.search);
      if (market) {
        params.set("market", helpers.getMarketId(market));
      }
      const perPage = limit ? parseInt(limit) : 10;
      if (perPage > 20) {
        params.set("per_page", 20);
      } else {
        params.set("per_page", perPage);
      }
      url.search = params.toString();
      return url.toString();
    },

    getData: async (url) => {
      const response = await fetch(url);
      return response.json();
    },

    renderListItems: (data) => {
      let items = data
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
              <a href="${post.link}" class="text-decoration-none text-reset" target="_parent">
                <div class="me-2 text-uppercase label">${sector}</div>
                <div class="me-2 title">${title}</div>
              </a>
            </li>
          `;
        })
        .join("");

      if (settings.viewMoreUrl) {
        items += `
            <li class="list-group-item text-center">
              <a href="${settings.viewMoreUrl}" class="btn btn-primary" target="_parent">
                <div class="me-2 text-uppercase label">View More</div>
              </a>
            </li>
          `;
      }

      settings.rootElement.innerHTML = items;
    },
  };

  const helpers = {
    getMarketId: (market) => {
      const marketIdMap = {
        "new-york": 9572,
      };
      return marketIdMap[market] || null;
    },
  };

  fn.init();
};

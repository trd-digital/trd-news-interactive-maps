const TrdLoading = (options) => {
  // Default options
  const defaultOptions = {
    init: false,
    active: false,
    id: "loading",
    className:
      "justify-content-center align-items-center w-100 h-100 position-fixed top-0 start-0 bg-opacity-75 z-3 bg-body",
    activeClass: "d-flex",
    inactiveClass: "d-none",
  };

  // Merge default options with user options
  const settings = { ...defaultOptions, ...options };

  const loading = {
    init: () => {
      const loadingEl = document.createElement("div");
      loadingEl.className = `${settings.className} ${
        settings.active ? settings.activeClass : settings.inactiveClass
      }`;
      loadingEl.id = settings.id;
      loadingEl.innerHTML = `<div class="d-flex flex-column justify-content-center align-items-center">
    <div class="mb-3">
    <img src="https://static.therealdeal.com/logos/trd-data-logo-dark.svg" alt="TRD Data Logo" class="logo-dark" />
    <img src="https://static.therealdeal.com/logos/trd-data-logo-light.svg" alt="TRD Data Logo" class="logo-light" />
    </div>
    <div class="spinner-border" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    </div>`;

      const body = document.querySelector("body");
      body.insertAdjacentElement("afterbegin", loadingEl);
    },

    show: () => {
      const loadingEl = document.querySelector(`#${settings.id}`);
      if (!loadingEl) return;
      loadingEl.classList.remove(settings.inactiveClass);
      loadingEl.classList.add(settings.activeClass);
    },

    hide: () => {
      const loadingEl = document.querySelector(`#${settings.id}`);
      if (!loadingEl) return;
      loadingEl.classList.remove(settings.activeClass);
      loadingEl.classList.add(settings.inactiveClass);
    },
  };
  // Initialize loading screen
  if (settings.init) {
    loading.init();
  }

  return {
    show: loading.show,
    hide: loading.hide,
  };
};

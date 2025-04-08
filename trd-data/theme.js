const trdTheme = {
  prefer: "system",

  init: (callback) => {
    // set the theme based on the user's preference
    trdTheme.set(trdTheme.getUserTheme());

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        if (trdTheme.prefer !== "system") return;
        const newTheme = e.matches ? "dark" : "light";
        trdTheme.changeTheme(newTheme, callback);
      });

    // we are not in an iframe
    if (window.self === window.top) return;

    // listen for messages from the parent window about theme changes
    window.addEventListener("message", (e) => {
      if (e.data && e.data.setTheme) {
        console.log("iframe received message from parent window", e.data);
        const theme = e.data.setTheme === "dark" ? "dark" : "light";
        trdTheme.changeTheme(theme, callback);
      }
    });

    // send a message to the parent window to get the theme
    window.addEventListener("load", () => {
      console.log("iframe load asking parent for theme");
      window.top.postMessage(
        {
          getTheme: true,
        },
        "*"
      );
    });
  },

  getUserTheme: () => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  },

  get: () => {
    return document.querySelector("body").getAttribute("data-bs-theme");
  },

  isDark: () => trdTheme.get() === "dark",

  set: (theme) => {
    document.querySelector("body").setAttribute("data-bs-theme", theme);
  },

  changeTheme: (theme, callback) => {
    trdTheme.set(theme);
    trdTheme.prefer = "user";
    if (typeof callback === "function") {
      callback(theme);
    }
  },

  onToggle: (callback) => {
    const siteTheme = trdTheme.get();
    const newTheme = siteTheme === "light" ? "dark" : "light";
    trdTheme.changeTheme(newTheme, callback);
  },
};

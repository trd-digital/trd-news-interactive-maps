
  (function () {
    tp = window["tp"] || [];

    /* Checkout related */
    /**
     * Event properties
     *
     * chargeAmount - amount of purchase
     * chargeCurrency
     * uid
     * email
     * expires
     * rid
     * startedAt
     * termConversionId
     * termId
     * promotionId
     * token_list
     * cookie_domain
     * user_token
     *
     */

    function populateSensitiveUserData(value) {
      return new Promise(function (resolve, reject) {
        var encoder = new TextEncoder();
        var value_utf8 = encoder.encode(value);
        crypto.subtle
          .digest("SHA-256", value_utf8)
          .then(function (hash_sha256) {
            var hash_array = Array.from(new Uint8Array(hash_sha256));
            resolve(
              hash_array
                .map(function (b) {
                  return b.toString(16).padStart(2, "0");
                })
                .join("")
            );
          })
          .catch(function (error) {
            reject(error);
          });
      });
    }

    function sendSensitiveUserDataToGTM() {
      var userData = tp.pianoId.getUser();
      if (userData && userData && userData.email) {
        populateSensitiveUserData(userData.email)
          .then(function (hash) {
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
              user_data: {
                sha256_email_address: hash,
              },
            });
          })
          .catch(function (error) {
            console.error("TP: Error hashing user data: " + error);
          });
      }
    }

    function onStartCheckout(data) {}
  
    function onCheckoutComplete(data) {}

    function onCheckoutExternalEvent() {}

    function onCheckoutClose(event) {
      if (
        event &&
        ["checkoutCompleted", "alreadyHasAccess"].includes(event.state)
      ) {
        window.location.reload();
      }
    }

    function onCheckoutCancel() {}

    function onCheckoutError() {}

    /* Meter callback */
    function onMeterExpired() {}

    /* Meter callback */
    function onMeterActive() {}

    /* Callback executed when a user must login */
    function onLoginRequired() {
      // this is a reference implementation only
      // your own custom login/registration implementation would
      // need to return the tinypass-compatible userRef inside the callback

      // mysite.showLoginRegistration(function (tinypassUserRef)
      // tp.push(["setUserRef", tinypassUserRef]); // tp.offer.startCheckout(params); // }
      // this will prevent the tinypass error screen from displaying

      return false;
    }

    /* Callback executed after a tinypassAccounts login */
    function onLoginSuccess() {
      sendSensitiveUserDataToGTM();
    }

    function onRegistrationSuccess() {
      sendSensitiveUserDataToGTM();
    }

    /* Callback executed after an experience executed successfully */
    function onExperienceExecute(event) {}

    /* Callback executed if experience execution has been failed */
    function onExperienceExecutionFailed(event) {}

    tp.push(["setAid", "p7sVIGTDn5"]);
    tp.push(["setCxenseSiteId", "1138587180028561559"]);
    tp.push(["setEndpoint", "https://buy.tinypass.com/api/v3"]);
    tp.push(["setUseTinypassAccounts", false]);
    tp.push(["setUsePianoIdUserProvider", true]);

    /* checkout related events */
    tp.push(["addHandler", "startCheckout", onStartCheckout]);
    tp.push(["addHandler", "checkoutComplete", onCheckoutComplete]);
    tp.push(["addHandler", "checkoutClose", onCheckoutClose]);
    tp.push(["addHandler", "checkoutCustomEvent", onCheckoutExternalEvent]);
    tp.push(["addHandler", "checkoutCancel", onCheckoutCancel]);
    tp.push(["addHandler", "checkoutError", onCheckoutError]);

    /* user login events */
    tp.push(["addHandler", "loginRequired", onLoginRequired]);
    tp.push(["addHandler", "loginSuccess", onLoginSuccess]);
    tp.push(["addHandler", "registrationSuccess", onRegistrationSuccess]);

    /* meter related */
    tp.push(["addHandler", "meterExpired", onMeterExpired]);
    tp.push(["addHandler", "meterActive", onMeterActive]);

    tp.push(["addHandler", "experienceExecute", onExperienceExecute]);
    tp.push([
      "addHandler",
      "experienceExecutionFailed",
      onExperienceExecutionFailed,
    ]);

    /**
     * Setting up ez-proxy for education partners
     * @see https://docs.piano.io/faq-article/does-composer-targetting-work-for-ezproxy-ip-addresses/
     */
    var hostname = document.location.hostname;
    if (
      hostname.startsWith("therealdeal-com.") ||
      hostname.startsWith("www-therealdeal-com.")
    ) {
      var newHostname = hostname.replace(
        "www-therealdeal-com.",
        "c2-piano-io."
      );
      newHostname = newHostname.replace("therealdeal-com.", "c2-piano-io.");
      tp.push(["setComposerHost", "https://" + newHostname]);
      tp.push(["setZone", "WebProxy"]);
    }

    tp.push([
      "init",
      function () {
        tp.pianoId.init();
        tp.experience.init();
        sendSensitiveUserDataToGTM();
        var userData = tp.pianoId.getUser();
        tp.setGA4Config({
          measurementId: "G-ZZ9P5863Z4",
          eventParameters: {
            send_page_view: false,
            user_id:
              null !== userData && "uid" in userData ? userData.uid : null,
          },
        });
      },
    ]);
  })();


  // do not change this section
  // |BEGIN INCLUDE TINYPASS JS|
  (function (src) {
    var a = document.createElement("script");
    a.type = "text/javascript";
    a.async = true;
    a.src = src;
    var b = document.getElementsByTagName("script")[0];
    b.parentNode.insertBefore(a, b);
  })("https://cdn.tinypass.com/api/tinypass.min.js");
  // |END   INCLUDE TINYPASS JS|


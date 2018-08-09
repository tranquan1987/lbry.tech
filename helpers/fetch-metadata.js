"use strict";



//  P A C K A G E S

const local = require("app-root-path").require;
const prism = require("prismjs");
const raw = require("nanohtml/raw");
const request = require("request-promise-native");
const stringifyObject = require("stringify-object");

//  V A R I A B L E S

const loadLanguages = require("prismjs/components/");
const logSlackError = local("/helpers/slack");
const uploadImage = local("/helpers/upload-image");

loadLanguages(["json"]);



//  E X P O R T

module.exports = exports = (data, socket) => {
  let dataDetails = "";

  if (data.example === 1 && !data.claim || !data.method) return;
  if (data.example === 2 && !data.data) return;
  if (data.example === 2) dataDetails = data.data; // file upload
  if (data.example === 3 && !data.claim || !data.method) return;

  const allowedMethods = [
    "publish",
    "resolve",
    "wallet_send"
  ];

  const body = {};
  const claimAddress = data.claim;
  const resolveMethod = data.method;

  if (allowedMethods.indexOf(resolveMethod) < 0) return socket.send(JSON.stringify({
    "details": "Unallowed resolve method for tutorial",
    "message": "notification",
    "type": "error"
  }));



  body.access_token = process.env.LBRY_DAEMON_ACCESS_TOKEN;
  body.method = resolveMethod;

  if (resolveMethod === "publish") {
    // body.bid = 0.001; // Hardcoded publish amount
    body.description = dataDetails.description;
    body.file_path = process.env.LBRY_DAEMON_IMAGES_PATH + dataDetails.file_path; // TODO: Fix the internal image path in daemon (original comment, check to see if still true)
    body.language = dataDetails.language;
    body.license = dataDetails.license;
    body.name = dataDetails.name;
    body.nsfw = dataDetails.nsfw;
    body.title = dataDetails.title;

    return uploadImage(body.file_path).then(uploadResponse => {
      if (uploadResponse.status !== "ok") return;

      body.file_path = uploadResponse.filename;
      body.method = resolveMethod;

      // Reference:
      // https://github.com/lbryio/lbry.tech/blob/legacy/content/.vuepress/components/Tour/Step2.vue
      // https://github.com/lbryio/lbry.tech/blob/legacy/server.js

      return new Promise((resolve, reject) => {
        request({
          qs: body,
          url: "http://daemon.lbry.tech/images.php"
        }, (error, response, body) => {
          if (error) reject(error);
          body = JSON.parse(body);
          // console.log(body);
          resolve(body);
        });
      });
    }).catch(uploadError => {
      // component.isLoading = false;
      // component.jsonData = JSON.stringify(uploadError, null, "  ");

      socket.send(JSON.stringify({
        "details": "Image upload failed",
        "message": "notification",
        "type": "error"
      }));

      logSlackError(
        "\n" +
        "> *DAEMON ERROR:* ```" + JSON.parse(JSON.stringify(uploadError)) + "```" + "\n" +
        "> _Cause: Someone attempted to publish a meme via the Tour_\n"
      );

      return;
    });
  }

  if (resolveMethod === "resolve") {
    body.uri = claimAddress;
  }

  if (resolveMethod === "wallet_send") {
    body.amount = "0.001"; // Hardcoded tip amount
    body.claim_id = claimAddress;
  }

  return new Promise((resolve, reject) => { // eslint-disable-line
    request({
      url: "http://daemon.lbry.tech",
      qs: body
    }, (error, response, body) => {
      if (error) {
        logSlackError(
          "\n" +
          "> *DAEMON ERROR:* ```" + JSON.parse(JSON.stringify(error)) + "```" + "\n" +
          "> _Cause: Someone is going through the Tour_\n"
        );

        return resolve(error);
      }

      body = JSON.parse(body);

      if (body.error && typeof body.error !== "undefined") {
        logSlackError(
          "\n" +
          "> *DAEMON ERROR:* ```" + JSON.parse(JSON.stringify(body.error.message)) + "```" + "\n" +
          "> _Cause: Someone is going through the Tour after a response has been parsed_\n"
        );

        return resolve(body.error);
      }

      if (socket) {
        const renderedCode = prism.highlight(stringifyObject(body, { indent: "  ", singleQuotes: false }), prism.languages.json, "json");

        return socket.send(JSON.stringify({
          "html": raw(`
            <h3>Response</h3>
            <pre><code class="language-json">${renderedCode}</code></pre>
          `),
          "message": "updated html",
          "selector": `#example${data.example}-result`
        }));
      }

      return resolve(body.result[Object.keys(body.result)[0]].claim);
    });
  });
};

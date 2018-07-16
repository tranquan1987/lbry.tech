/* global $, ws */ "use strict";



const log = console.log; // eslint-disable-line



ws.onmessage = socket => {
  const data = JSON.parse(socket.data);

  switch (true) {
    case data.message === "updated html":
      $(data.selector).html(data.html);
      break;

    default:
      log(data);
      break;
  }
};

function send(msg) { // eslint-disable-line
  socketReady(ws, () => ws.send(msg));
}

function socketReady(socket, callback) {
  setTimeout(() => {
    if (socket.readyState === 1) {
      if (callback !== undefined) callback();
      return;
    } else {
      log("Waiting for websocket connection to come online");
      socketReady(socket, callback);
    }
  }, 5);
}
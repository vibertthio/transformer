const SERVER_URL = "https://developer.ailabs.tw/ai-music-piano-transformer-service/api/getPianoMidi";
console.log("data", data);

async function postData(url = "", data = {}) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: "POST", // *GET, POST, PUT, DELETE, etc.
    mode: "no-cors", // no-cors, *cors, same-origin
    verify: false,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });
  const d = await response.json();
  console.log('response', d)
  return d
}


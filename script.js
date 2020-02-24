const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
if (isMobile) {
  console.log("[mobile]");
}

const EDIT_LOOP = true;
const BPM = 120;
const INITIAL_DATA_INDEX = 0;
const NUMBER_OF_NOTES = 36;
const NUMBER_OF_BARS = 8;
const NUMBER_OF_INPUT_BARS = 2;
const NOTE_EXTENSION = 15;
const NOTES_PER_BAR = 16;
const SERVER_URL =
  "https://developer.ailabs.tw/ai-music-piano-transformer-service/api/";
const POST_MIDI_URL = SERVER_URL + "getPianoMidi";
const GET_SERVER_STATE_URL = SERVER_URL + "getJobQueueSize";
const GET_MIDI_BY_ID = SERVER_URL + "getGeneratedMidi";

const controlPlayButton = document.getElementById("play-btn");
const playButtonTip = document.getElementById("play-btn-tip");
const controlEditPlayButton = document.getElementById("edit-play-btn");
const historyCurrentIndexElement = document.getElementById(
  "history-current-index"
);
const historyLenghtElement = document.getElementById("history-length");
const history = [];
let historyCurrentIndex = -1;

// events
window.addEventListener("resize", () => {
  const canvas = document.getElementById("play-canvas");
  canvas.width = document.getElementById("canvas-container").clientWidth;
  canvas.height = document.getElementById("canvas-container").clientHeight;
  if (editing) {
    const editCanvasContainer = document.getElementById(
      "edit-canvas-container"
    );
    editCanvas.width = editCanvasContainer.clientWidth;
    editCanvas.height = editCanvasContainer.clientHeight;
    editCanvasRect = editCanvas.getBoundingClientRect();
  }
});
function startEditingMode() {
  const splash = document.getElementById("edit-splash");
  splash.style.display = "block";
  // splash.style.opacity = 0;
  stopMainSequencer();
  setTimeout(() => {
    splash.style.opacity = 1;
    editCanvasRect = editCanvas.getBoundingClientRect();
    // splash.classList.add("show");
    editing = true;
  }, 10);

  const editCanvasContainer = document.getElementById("edit-canvas-container");
  editCanvas.width = editCanvasContainer.clientWidth;
  editCanvas.height = editCanvasContainer.clientHeight;
}
document.getElementById("edit-btn").addEventListener("click", () => {
  startEditingMode();
});
document.getElementById("edit-cancel-btn").addEventListener("click", () => {
  if (waitingForResponse) {
    return;
  }
  stopEditSequencer();
  closeEditSplash();
});
document.getElementById("play-btn").addEventListener("click", () => {
  console.log("audio context state", audioContext.state);
  if (audioContext.state == "suspended") {
    console.log("audioContext.resume");
    audioContext.resume();
  }
  if (sequencer.state === "started") {
    stopMainSequencer();
  } else {
    startMainSequencer();
  }
});
!isMobile &&
  document.getElementById("play-btn").addEventListener("mouseenter", () => {
    // console.log("in");
    playButtonTip.classList.add("show");
  });
!isMobile &&
  document.getElementById("play-btn").addEventListener("mouseleave", () => {
    // console.log("out");
    playButtonTip.classList.remove("show");
  });
document.getElementById("edit-play-btn").addEventListener("click", () => {
  if (waitingForResponse) {
    return;
  }
  if (editSequencer.state === "started") {
    stopEditSequencer();
  } else {
    startEditSequencer();
  }
});
document.getElementById("edit-send-btn").addEventListener("click", async () => {
  if (waitingForResponse) {
    return;
  }
  waitingForResponse = true;
  stopEditSequencer();
  const textElement = document.getElementById("edit-loading-text");
  document.getElementById("edit-loading-text-div").style.display = "flex";
  const timeId = setInterval(() => {
    textElement.textContent += ".";
    if (textElement.textContent.length >= 10) {
      textElement.textContent = "loading";
    }
  }, 300);
  const { data, state } = await sendGetRequest();
  const { average_runtime, num_engine, qsize } = data;
  if (state === "success") {
    const el = document.getElementById("edit-loading-text-server");
    el.style.display = "block";
    el.textContent = `It takes ~${average_runtime} seconds.
		There are ${qsize} tasks in queue on ${num_engine} engines.`;
  }
  const response = await postData(POST_MIDI_URL, {
    pianoroll: inputPianoroll,
    n_bar: 6,
    temperature: 1.2
  });
  clearInterval(timeId);
  waitingForResponse = false;
  // console.log("res", response);

  document.getElementById("edit-loading-text-div").style.display = "none";
  closeEditSplash();

  if (response.state === "success") {
    currentUrlId = response.data.id;
    pianoroll = response.data.pianoroll;
    events = getEventsTimelineFromMatrix(pianoroll);
    pushHistory();
  } else {
    console.error("something wrong with the server");
  }
});
document.getElementById("previous-btn").addEventListener("click", () => {
  if (historyCurrentIndex > 0) {
    traverseHistory(historyCurrentIndex - 1);
  }
});
document.getElementById("next-btn").addEventListener("click", () => {
  if (historyCurrentIndex < history.length - 1) {
    traverseHistory(historyCurrentIndex + 1);
  }
});
document.getElementById("canvas-wrapper").addEventListener("click", () => {
  if (sequencer.state === "started") {
    stopMainSequencer();
  } else {
    startMainSequencer();
  }
});
document.getElementById("canvas-text-left").addEventListener("click", e => {
  e.stopPropagation();
  startEditingMode();
});
document.getElementById("edit-clear-btn").addEventListener("click", () => {
  if (waitingForResponse) {
    return;
  }
  inputPianoroll = inputPianoroll.map(c => c.map(e => 0));
  inputEvents = getEventsTimelineFromMatrix(inputPianoroll);
});
document
  .getElementById("edit-splash-container")
  .addEventListener("mousemove", e => {
    if (waitingForResponse) {
      return;
    }
    const { clientX, clientY } = e;
    const { width, height } = editCanvas;
    const wUnit = width / (NUMBER_OF_INPUT_BARS * NOTES_PER_BAR);
    const hUnit = height / NUMBER_OF_NOTES;

    mousePosition.x = clientX - editCanvasRect.left;
    mousePosition.y = clientY - editCanvasRect.top;
    // const x = Math.floor(mousePosition.x / wUnit);
    // const y = Math.floor(mousePosition.y / hUnit);
    const x = Math.floor(mousePosition.x / wUnit - 0.5);
    const y = Math.floor(mousePosition.y / hUnit - 0.5);

    // console.log(`[x]${x} [y]${y}`);

    if (mouseEditing && (x !== mouseEditIndex.x || y !== mouseEditIndex.y)) {
      const row = NUMBER_OF_NOTES - y - 1;
      if (
        x < inputPianoroll.length &&
        x >= 0 &&
        row >= 0 &&
        row < inputPianoroll[0].length
      ) {
        inputPianoroll[x][row] = 1 - inputPianoroll[x][row];
      }
    }
    mouseEditIndex.x = x;
    mouseEditIndex.y = y;
  });
document
  .getElementById("edit-splash-container")
  .addEventListener("mousedown", e => {
    if (waitingForResponse) {
      return;
    }
    mouseEditing = true;
    const { width, height } = editCanvas;
    const wUnit = width / (NUMBER_OF_INPUT_BARS * NOTES_PER_BAR);
    const hUnit = height / NUMBER_OF_NOTES;

    const { clientX, clientY } = e;
    mousePosition.x = clientX - editCanvasRect.left;
    mousePosition.y = clientY - editCanvasRect.top;
    const x = Math.floor(mousePosition.x / wUnit - 0.5);
    const y = Math.floor(mousePosition.y / hUnit - 0.5);

    const row = NUMBER_OF_NOTES - y - 1;

    if (
      x < inputPianoroll.length &&
      x >= 0 &&
      row >= 0 &&
      row < inputPianoroll[0].length
    ) {
      inputPianoroll[x][row] = 1 - inputPianoroll[x][row];
    }

    mouseEditIndex.x = x;
    mouseEditIndex.y = y;

    // console.log(`mouse down: x ${mouseEditIndex.x} y ${mouseEditIndex.y}`);
  });
document
  .getElementById("edit-splash-container")
  .addEventListener("mouseup", e => {
    if (waitingForResponse) {
      return;
    }
    mouseEditing = false;
    const { width, height } = editCanvas;
    const wUnit = width / (NUMBER_OF_INPUT_BARS * NOTES_PER_BAR);
    const hUnit = height / NUMBER_OF_NOTES;

    const { clientX, clientY } = e;
    mousePosition.x = clientX - editCanvasRect.left;
    mousePosition.y = clientY - editCanvasRect.top;
    // mouseEditIndex.x = Math.floor(mousePosition.x / wUnit);
    // mouseEditIndex.y = Math.floor(mousePosition.y / hUnit);
    // console.log(`mouse up: x ${mouseEditIndex.x} y ${mouseEditIndex.y}`);
    inputEvents = getEventsTimelineFromMatrix(inputPianoroll);
  });
document.getElementById("preset-select").addEventListener("change", e => {
  const index = e.target.value;
  updateEditPianorollAndEvents(data[index].input.pianoroll);
});
document.getElementById("share-link").addEventListener("click", e => {
  var range = document.createRange();
  var selection = window.getSelection();
  range.selectNodeContents(e.target);

  selection.removeAllRanges();
  selection.addRange(range);
});

// methods
function midi(m) {
  return Tone.Frequency(m, "midi");
}
function toDb(value) {
  return 20 * Math.log(1 - value);
}
function getUrlShareId() {
  // console.log("window.location.href", window.location.href);
  const url = new URL(window.location.href);
  const id = url.searchParams.get("id");
  // console.log("id", id);
  return id;
}
async function postData(url = "", data = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });
  const d = await response.json();
  // console.log("response", d);
  return d;
}
async function sendGetRequest(url = GET_SERVER_STATE_URL) {
  const response = await fetch(url);
  const d = await response.json();
  return d;
}
async function getGeneratedMidiById(
  url = GET_MIDI_BY_ID,
  id = "9269e648-5179-11ea-b4ea-4e2c2ef0cf37"
) {
  const response = await fetch(`${url}?id=${id}`);
  const d = await response.json();
  console.log("response", d);
  return d;
  // return data[1].output;
}
function closeEditSplash() {
  const splash = document.getElementById("edit-splash");
  // splash.classList.remove("show");
  splash.style.opacity = 0;
  editing = false;
  setTimeout(() => {
    splash.style.display = "none";
  }, 500);
}
function getEventsTimelineFromMatrix(p) {
  const playingNotes = {};
  const result = [];
  for (let col = 0; col <= p.length; col++) {
    if (col === p.length) {
      for (let row = 0; row < p[0].length; row++) {
        if (playingNotes[row] !== undefined) {
          result[playingNotes[row]].push({
            note: row,
            length: col - playingNotes[row] + NOTE_EXTENSION
          });
        }
      }
    } else {
      for (let row = 0; row < p[0].length; row++) {
        if (p[col][row] === 1 && playingNotes[row] === undefined) {
          result[col] = [];
          playingNotes[row] = col;
        } else if (p[col][row] === 0 && playingNotes[row] !== undefined) {
          result[playingNotes[row]].push({
            note: row,
            length: col - playingNotes[row]
          });
          playingNotes[row] = undefined;
        }
      }
    }
  }
  return result;
}
function updateEditPianorollAndEvents(p) {
  inputPianoroll = p;
  inputEvents = getEventsTimelineFromMatrix(inputPianoroll);
}
function drawPianoroll(ctx, events) {
  const { width, height } = ctx.canvas;
  const wUnit = width / (NUMBER_OF_BARS * NOTES_PER_BAR);
  const hUnit = height / NUMBER_OF_NOTES;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(230, 230, 230, 1)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(0, 0, 200, 0.6)";
  ctx.fillRect(
    wUnit * NUMBER_OF_INPUT_BARS * NOTES_PER_BAR - wUnit,
    0,
    wUnit,
    height
  );
  ctx.fillStyle = "rgba(0, 0, 200, 0.3)";
  ctx.fillRect(0, 0, wUnit * NUMBER_OF_INPUT_BARS * NOTES_PER_BAR, height);

  if (sequencer.state === "started") {
    ctx.fillStyle = "rgb(0, 200, 0)";
    // ctx.fillRect(width * sequencer.progress - wUnit, 0, wUnit, height);
    ctx.fillRect(beat * wUnit, 0, wUnit, height);
  }

  for (let col = 0; col < events.length; col++) {
    if (!events[col]) {
      continue;
    }
    for (let i = 0; i < events[col].length; i++) {
      const { note, length } = events[col][i];
      ctx.save();
      ctx.translate(col * wUnit, height - (note + 1) * hUnit);
      if (sequencer.state === "started" && beat >= col && beat < col + length) {
        ctx.fillStyle = "rgb(0, 150, 0)";
      } else {
        ctx.fillStyle = "rgb(50, 60, 60)";
      }
      ctx.fillRect(0, 0, length * wUnit, hUnit);
      ctx.restore();
    }
  }
}
function drawEditingPianoroll(ctx, events, matrix) {
  const { width, height } = ctx.canvas;
  const wUnit = width / (NUMBER_OF_INPUT_BARS * NOTES_PER_BAR);
  const hUnit = height / NUMBER_OF_NOTES;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(230, 230, 230, 1)";
  ctx.fillRect(0, 0, width, height);

  for (let col = 0; col < NUMBER_OF_INPUT_BARS * NOTES_PER_BAR; col++) {
    ctx.beginPath();
    if (col % 4 === 0) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    } else {
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    }
    ctx.moveTo(col * wUnit, 0);
    ctx.lineTo(col * wUnit, height);
    ctx.stroke();
  }

  for (let row = 0; row < NUMBER_OF_NOTES; row++) {
    // ctx.save();
    ctx.beginPath();
    if (row % 12 === 0) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    } else {
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    }
    ctx.moveTo(0, row * hUnit);
    ctx.lineTo(width, row * hUnit);
    ctx.stroke();
    // ctx.restore();
  }

  ctx.fillStyle = "rgba(0, 0, 200, 0.5)";
  ctx.fillRect(width - wUnit, 0, wUnit, height);
  ctx.fillStyle = "rgba(0, 0, 200, 0.2)";
  ctx.fillRect(0, 0, wUnit * NUMBER_OF_INPUT_BARS * NOTES_PER_BAR, height);

  if (editSequencer.state === "started") {
    ctx.fillStyle = "rgb(0, 200, 0)";
    // ctx.fillRect(width * editSequencer.progress, 0, wUnit * 0.3, height);
    ctx.fillRect(beat * wUnit, 0, wUnit * 0.2, height);
  }

  if (!mouseEditing) {
    for (let col = 0; col < events.length; col++) {
      if (!events[col]) {
        continue;
      }
      for (let i = 0; i < events[col].length; i++) {
        const { note, length } = events[col][i];
        ctx.save();
        ctx.translate(col * wUnit, height - (note + 1) * hUnit);
        if (
          editSequencer.state === "started" &&
          beat >= col &&
          beat < col + length
        ) {
          ctx.fillStyle = "rgb(0, 150, 0)";
        } else {
          ctx.fillStyle = "rgb(50, 60, 60)";
        }
        ctx.fillRect(0, 0, length * wUnit, hUnit);

        if (waitingForResponse) {
          const opacity =
            (Math.sin(Date.now() * 0.005 + col * 0.1 + i * 0.2) * 0.5 + 0.5) *
            1.0;
          ctx.fillStyle = `rgba(255, 0, 255, ${opacity})`;
          ctx.fillRect(0, 0, length * wUnit, hUnit);
        }
        ctx.restore();
      }
    }
  } else {
    for (let col = 0; col < matrix.length; col++) {
      for (let row = 0; row < matrix[0].length; row++) {
        if (matrix[col][row] === 1) {
          ctx.save();
          ctx.translate(col * wUnit, height - (row + 1) * hUnit);
          ctx.fillStyle = "rgb(50, 60, 60)";
          ctx.fillRect(0, 0, wUnit, hUnit);
          ctx.restore();
        }
      }
    }
  }

  // ctx.beginPath();
  // const mr = Math.floor(mousePosition.x / wUnit);
  // const mc = Math.floor(mousePosition.y / hUnit);
  const mr = mouseEditIndex.x;
  const mc = mouseEditIndex.y;
  ctx.fillStyle = "rgba(0, 255, 0, 0.3)";
  ctx.fillRect(mr * wUnit, mc * hUnit, wUnit, hUnit);
  // ctx.arc(mousePosition.x, mousePosition.y, 20, 0, 2 * Math.PI);
  // ctx.fill();

  if (waitingForResponse) {
    const opacity = (Math.sin(Date.now() * 0.005) * 0.5 + 0.5) * 0.5;
    ctx.fillStyle = `rgba(0, 255, 255, ${opacity})`;
    ctx.fillRect(0, 0, width, height);
  }
}
function setup() {
  Tone.Transport.start();
  Tone.Transport.bpm.value = BPM;
  // startMainSequencer();
}
function draw() {
  // do things
  if (!editing) {
    let ctx = canvas.getContext("2d");
    if (events) {
      drawPianoroll(ctx, events);
    }
  } else {
    let ctx = editCanvas.getContext("2d");
    if (inputEvents) {
      drawEditingPianoroll(ctx, inputEvents, inputPianoroll);
    }
  }

  requestAnimationFrame(() => {
    draw();
  });
}
function stopMainSequencer(cancelEnvelopes = true) {
  controlPlayButton.textContent = "► play";
  beat = -1;
  sequencer.stop();
  sequencer.cancel(audioContext.now());
  if (cancelEnvelopes) {
    piano.volume.rampTo(-100, 0.5);
    piano.releaseAll(audioContext.now());
  } else {
    // piano.volume.rampTo(-100, 5);
  }
}
function startMainSequencer() {
  console.log("start time", audioContext.now());
  piano.releaseAll(audioContext.now());
  // piano.releaseAll();
  controlPlayButton.textContent = "stop";
  piano.volume.rampTo(0, 0);
  sequencer.start(audioContext.now());
  // sequencer.start();
}
function stopEditSequencer(cancelEnvelopes = true) {
  controlEditPlayButton.textContent = "► play";
  beat = -1;
  editSequencer.stop();
  editSequencer.cancel(audioContext.now());
  if (cancelEnvelopes) {
    piano.volume.rampTo(-100, 0.5);
    piano.releaseAll();
  } else {
    // piano.volume.rampTo(-100, 5);
  }
}
function startEditSequencer() {
  piano.releaseAll(audioContext.now());
  controlEditPlayButton.textContent = "stop";
  piano.volume.rampTo(0, 0);
  editSequencer.start(audioContext.now());
}
function pushHistory() {
  history.push({
    input: {
      pianoroll: inputPianoroll,
      events: inputEvents
    },
    output: {
      id: currentUrlId,
      pianoroll: pianoroll,
      events: events
    }
  });
  historyCurrentIndex = history.length - 1;
  historyCurrentIndexElement.textContent = `${historyCurrentIndex + 1}`;
  historyLenghtElement.textContent = `${history.length}`;

  traverseHistory(historyCurrentIndex);
}
function traverseHistory(index) {
  if (index < 0 || index >= history.length) {
    return;
  }
  historyCurrentIndexElement.textContent = `${index + 1}`;
  historyCurrentIndex = index;
  currentUrlId = history[index].output.id;
  pianoroll = history[index].output.pianoroll;
  events = history[index].output.events;
  inputPianoroll = history[index].input.pianoroll;
  inputEvents = history[index].input.events;

  const pb = document.getElementById("previous-btn");
  const nb = document.getElementById("next-btn");
  if (index === 0) {
    pb.classList.add("disabled");
  } else {
    pb.classList.remove("disabled");
  }
  if (index === history.length - 1) {
    nb.classList.add("disabled");
  } else {
    nb.classList.remove("disabled");
  }
  updateShareLink();
}
function updateShareLink() {
  document.getElementById(
    "share-link"
  ).textContent = `${location.protocol}//${location.host}${location.pathname}?id=${currentUrlId}`;
}

// audio
// const audioContext = new Tone.Context();
// const AudioContextFunc = window.AudioContext || window.webkitAudioContext;
// const audioContext = new AudioContextFunc();
const audioContext = Tone.context;
let editing = false;
let waitingForResponse = false;
// UnmuteButton({
//   container: document.querySelector("#wrapper"),
//   title: "Web Audio",
//   mute: false,
//   context: Tone.context
// });
let currentUrlId;
let pianoroll;
let events;
let inputPianoroll;
let inputEvents;
const initialUrlId = getUrlShareId();
let pianoLoading = true;

const play = (time = 0, pitch = 55, length = 8, vol = 0.3) => {
  // console.log("time", time);
  // console.log("play currentTime", audioContext.now());
  // console.log("pitch", pitch);
  piano.triggerAttackRelease(
    Tone.Frequency(pitch, "midi"),
    length * 0.5,
    time,
    vol
  );
};

let beat = -1;
const sequencer = new Tone.Sequence(
  (time, b) => {
    // console.log(`b[${b}], time: ${time}`);
    beat = b;
    const es = events[b];
    if (es) {
      es.forEach(({ note, length }) => {
        play(time, note + NUMBER_OF_NOTES, length * 0.2);
      });
    }
    if (b >= NUMBER_OF_BARS * NOTES_PER_BAR - 1) {
      // console.log(`b[${b}]: stop`);
      stopMainSequencer(false);
      beat = -1;
    }
  },
  Array(NUMBER_OF_BARS * NOTES_PER_BAR)
    .fill(null)
    .map((_, i) => i),
  "16n"
);

// let editBeat = -1;
const editSequencer = new Tone.Sequence(
  (time, b) => {
    beat = b;
    const es = inputEvents[b];
    if (es) {
      es.forEach(({ note, length }) => {
        const env = play(time, note + NUMBER_OF_NOTES, length * 0.2);
      });
    }
    if (EDIT_LOOP) {
      if (b >= NUMBER_OF_INPUT_BARS * NOTES_PER_BAR - 1) {
        console.log(`b[${NUMBER_OF_INPUT_BARS * NOTES_PER_BAR - 1}]: stop`);
        stopEditSequencer(false);
        beat = -1;
      }
    }
  },
  Array(NUMBER_OF_INPUT_BARS * NOTES_PER_BAR)
    .fill(null)
    .map((_, i) => i),
  "16n"
);

// canvas
const editCanvas = document.getElementById("edit-canvas");
let editCanvasRect = editCanvas.getBoundingClientRect();
let mouseEditing = false;
let mousePosition = { x: 0, y: 0 };
let mouseEditIndex = {};

const canvas = document.getElementById("play-canvas");
canvas.width = document.getElementById("canvas-container").clientWidth;
canvas.height = document.getElementById("canvas-container").clientHeight;

if (!canvas.getContext) {
  console.log("<canvas> not supported.");
}

document
  .getElementById("splash-play-btn")
  .addEventListener("click", async e => {
    if (audioContext.state == "suspended") {
      console.log("audioContext.resume");
      audioContext.resume();
    }

    if (pianoLoading) {
      return;
    }

    e.target.textContent = "loading..";
    if (
      initialUrlId === null ||
      initialUrlId === "0" ||
      initialUrlId === "1" ||
      initialUrlId === "2"
    ) {
      // console.log("load preset");
      currentUrlId = data[INITIAL_DATA_INDEX].output.data.id;
      pianoroll = data[INITIAL_DATA_INDEX].output.data.pianoroll;
      events = getEventsTimelineFromMatrix(pianoroll);
      inputPianoroll = data[INITIAL_DATA_INDEX].input.pianoroll;
      inputEvents = getEventsTimelineFromMatrix(inputPianoroll);
    } else {
      currentUrlId = initialUrlId;
      const d = await getGeneratedMidiById(GET_MIDI_BY_ID, initialUrlId);
      if (d.state !== "success") {
        // console.log("(wrong id) load preset");
        currentUrlId = data[INITIAL_DATA_INDEX].output.data.id;
        pianoroll = data[INITIAL_DATA_INDEX].output.data.pianoroll;
        events = getEventsTimelineFromMatrix(pianoroll);
        inputPianoroll = data[INITIAL_DATA_INDEX].input.pianoroll;
        inputEvents = getEventsTimelineFromMatrix(inputPianoroll);
      } else {
        // console.log("load from server");
        pianoroll = d.data.pianoroll;
        events = getEventsTimelineFromMatrix(pianoroll);
        inputPianoroll = pianoroll.slice(
          0,
          NUMBER_OF_INPUT_BARS * NOTES_PER_BAR
        );
        inputEvents = getEventsTimelineFromMatrix(inputPianoroll);
      }
    }
    pushHistory();

    document.getElementById("wrapper").style.visibility = "visible";
    const splash = document.getElementById("splash");
    splash.style.opacity = 0;
    setTimeout(() => {
      splash.style.display = "none";
    }, 300);

    setup();
    draw();
  });
// StartAudioContext(audioContext, "#splash-play-btn", async () => {
//   console.log("audio context started");
// });

var piano = SampleLibrary.load({
  instruments: "piano"
});
Tone.Buffer.on("load", function() {
  // piano.sync();
  const reverb = new Tone.JCReverb(0.5).toMaster();
  piano.connect(reverb);
  pianoLoading = false;
  document.getElementById("splash-play-btn").classList.add("activated");
  console.log("Samples loaded");
});

console.log("Vibert 2020-02-19 12:54");

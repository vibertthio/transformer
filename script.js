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

const controlPlayButton = document.getElementById("play-btn");
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
document.getElementById("splash-play-btn").addEventListener("click", () => {
  const splash = document.getElementById("splash");
  splash.style.opacity = 0;
  setTimeout(() => {
    splash.style.display = "none";
  }, 300);
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
  if (sequencer.state === "started") {
    stopMainSequencer();
  } else {
    startMainSequencer();
  }
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
  const { average_runtime, num_engine, qsize, state } = await sendGetRequest();
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

// methods
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
    ctx.fillRect(width * sequencer.progress, 0, wUnit, height);
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

  if (sequencer.state === "started") {
    ctx.fillStyle = "rgb(0, 200, 0)";
    ctx.fillRect(width * sequencer.progress, 0, wUnit, height);
  }

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
    ctx.fillRect(width * editSequencer.progress, 0, wUnit * 0.3, height);
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
    drawPianoroll(ctx, events);
  } else {
    let ctx = editCanvas.getContext("2d");
    drawEditingPianoroll(ctx, inputEvents, inputPianoroll);
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
    envelopes.forEach(e => e.envelope.cancel());
  }
  envelopes = [];
}
function startMainSequencer() {
  controlPlayButton.textContent = "stop";
  sequencer.start(audioContext.now());
  // sequencer.start();
}
function stopEditSequencer(cancelEnvelopes = true) {
  controlEditPlayButton.textContent = "► play";
  beat = -1;
  editSequencer.stop();
  editSequencer.cancel(audioContext.now());
  if (cancelEnvelopes) {
    envelopes.forEach(e => e.envelope.cancel());
  }
  envelopes = [];
}
function startEditSequencer() {
  controlEditPlayButton.textContent = "stop";
  editSequencer.start(audioContext.now());
}
function pushHistory() {
  history.push({
    input: {
      pianoroll: inputPianoroll,
      events: inputEvents
    },
    output: {
      pianoroll: pianoroll,
      events: events
    }
  });
  historyCurrentIndex = history.length - 1;
  historyCurrentIndexElement.textContent = `${historyCurrentIndex + 1}`;
  historyLenghtElement.textContent = `${history.length}`;
}
function traverseHistory(index) {
  if (index < 0 || index >= history.length) {
    return;
  }
  historyCurrentIndexElement.textContent = `${index + 1}`;
  historyCurrentIndex = index;
  pianoroll = history[index].output.pianoroll;
  events = history[index].output.events;
  inputPianoroll = history[index].input.pianoroll;
  inputEvents = history[index].input.events;
}

// audio
const audioContext = new Tone.Context();
// Tone.context = audioContext;
let editing = false;
let waitingForResponse = false;

let pianoroll = data[INITIAL_DATA_INDEX].output.data.pianoroll;
let events = getEventsTimelineFromMatrix(pianoroll);
let inputPianoroll = data[INITIAL_DATA_INDEX].input.pianoroll;
let inputEvents = getEventsTimelineFromMatrix(inputPianoroll);
pushHistory();

// web soundfont
const player = new WebAudioFontPlayer();
player.adjustPreset(audioContext, _tone_0000_JCLive_sf2_file);
const play = (time = 0, pitch = 55, length = 8, vol = 0.3) => {
  return player.queueWaveTable(
    audioContext,
    audioContext.destination,
    _tone_0000_JCLive_sf2_file,
    time,
    pitch,
    length,
    vol
  );
};
let beat = -1;
let envelopes = [];

const continuousArray = Array(NUMBER_OF_BARS * NOTES_PER_BAR)
  .fill(null)
  .map((_, i) => i);
const sequencer = new Tone.Sequence(
  (time, b) => {
    // console.log(`b[${b}]`);
    envelopes = envelopes.filter(env => env.end >= b);
    beat = b;
    const es = events[b];
    if (es) {
      es.forEach(({ note, length }) => {
        const env = play(time, note + NUMBER_OF_NOTES, length * 0.2);
        envelopes.push({
          end: b + length,
          envelope: env
        });
      });
    }
    if (b >= NUMBER_OF_BARS * NOTES_PER_BAR - 1) {
      console.log(`b[${b}]: stop`);
      stopMainSequencer(false);
      // sequencer.stop();
      // sequencer.cancel(time);
      beat = -1;
    }
  },
  continuousArray,
  "16n"
);

// let editBeat = -1;
// let editEnvelopes = [];
const editSequencer = new Tone.Sequence(
  (time, b) => {
    envelopes = envelopes.filter(env => env.end >= b);
    beat = b;
    const es = inputEvents[b];
    if (es) {
      es.forEach(({ note, length }) => {
        const env = play(time, note + NUMBER_OF_NOTES, length * 0.2);
        envelopes.push({
          end: b + length,
          envelope: env
        });
      });
    }
    if (EDIT_LOOP) {
      if (b >= NUMBER_OF_INPUT_BARS * NOTES_PER_BAR - 1) {
        console.log(`b[${NUMBER_OF_INPUT_BARS * NOTES_PER_BAR}]: stop`);
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

StartAudioContext(audioContext, "#splash-play-btn", () => {
  setup();
  draw();
  // startMainSequencer();
});

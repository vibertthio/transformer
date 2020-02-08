const INITIAL_DATA_INDEX = 2;
const NUMBER_OF_NOTES = 36;
const NUMBER_OF_BARS = 8;
const NUMBER_OF_INPUT_BARS = 2;
const NOTE_EXTENSION = 15;
const NOTES_PER_BAR = 16;
const SERVER_URL =
  "https://developer.ailabs.tw/ai-music-piano-transformer-service/api/getPianoMidi";

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
  }, 1000);
});
document.getElementById("edit-btn").addEventListener("click", () => {
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
});
document.getElementById("edit-finish-btn").addEventListener("click", () => {
  const splash = document.getElementById("edit-splash");
  // splash.classList.remove("show");
  splash.style.opacity = 0;
  editing = false;
  setTimeout(() => {
    splash.style.display = "none";
  }, 500);
});
document.getElementById("play-btn").addEventListener("click", () => {
  console.log("state", sequencer.state);
  if (sequencer.state === "started") {
    stopMainSequencer();
  } else {
    startMainSequencer();
  }
});
document.getElementById("edit-canvas").addEventListener("mousemove", e => {
  const { clientX, clientY } = e;
  const { width, height } = editCanvas;
  const wUnit = width / (NUMBER_OF_INPUT_BARS * NOTES_PER_BAR);
  const hUnit = height / NUMBER_OF_NOTES;

  mousePosition.x = clientX - editCanvasRect.left;
  mousePosition.y = clientY - editCanvasRect.top;
  const x = Math.floor(mousePosition.x / wUnit);
  const y = Math.floor(mousePosition.y / hUnit);

  if (mouseEditing && (x !== mouseEditIndex.x || y !== mouseEditIndex.y)) {
    const row = NUMBER_OF_NOTES - y - 1;
    inputPianoroll[x][row] = 1 - inputPianoroll[x][row];
  }
  mouseEditIndex.x = x;
  mouseEditIndex.y = y;
});
document.getElementById("edit-canvas").addEventListener("mousedown", e => {
  mouseEditing = true;
  const { width, height } = editCanvas;
  const wUnit = width / (NUMBER_OF_INPUT_BARS * NOTES_PER_BAR);
  const hUnit = height / NUMBER_OF_NOTES;

  const { clientX, clientY } = e;
  mousePosition.x = clientX - editCanvasRect.left;
  mousePosition.y = clientY - editCanvasRect.top;
  const x = Math.floor(mousePosition.x / wUnit);
  const y = Math.floor(mousePosition.y / hUnit);

  const row = NUMBER_OF_NOTES - y - 1;
  inputPianoroll[x][row] = 1 - inputPianoroll[x][row];

  mouseEditIndex.x = x;
  mouseEditIndex.y = y;

  console.log(`mouse down: x ${mouseEditIndex.x} y ${mouseEditIndex.y}`);
});
document.getElementById("edit-canvas").addEventListener("mouseup", e => {
  mouseEditing = false;
  const { width, height } = editCanvas;
  const wUnit = width / (NUMBER_OF_INPUT_BARS * NOTES_PER_BAR);
  const hUnit = height / NUMBER_OF_NOTES;

  const { clientX, clientY } = e;
  mousePosition.x = clientX - editCanvasRect.left;
  mousePosition.y = clientY - editCanvasRect.top;
  // mouseEditIndex.x = Math.floor(mousePosition.x / wUnit);
  // mouseEditIndex.y = Math.floor(mousePosition.y / hUnit);
  console.log(`mouse up: x ${mouseEditIndex.x} y ${mouseEditIndex.y}`);
  inputEvents = getEventsTimelineFromMatrix(inputPianoroll);
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
  console.log("response", d);
  return d;
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
function drawPianoroll(ctx, events) {
  const { width, height } = ctx.canvas;
  const wUnit = width / (NUMBER_OF_BARS * NOTES_PER_BAR);
  const hUnit = height / NUMBER_OF_NOTES;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(230, 230, 230, 1)";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(0, 0, 200, 0.9)";
  ctx.fillRect(wUnit * NUMBER_OF_INPUT_BARS * NOTES_PER_BAR, 0, wUnit, height);
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
          sequencer.state === "started" &&
          beat >= col &&
          beat < col + length
        ) {
          ctx.fillStyle = "rgb(0, 150, 0)";
        } else {
          ctx.fillStyle = "rgb(50, 60, 60)";
        }
        ctx.fillRect(0, 0, length * wUnit, hUnit);
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
  const mr = Math.floor(mousePosition.x / wUnit);
  const mc = Math.floor(mousePosition.y / hUnit);
  ctx.fillStyle = "rgb(0, 200, 0)";
  ctx.fillRect(mr * wUnit, mc * hUnit, wUnit, hUnit);
  // ctx.arc(mousePosition.x, mousePosition.y, 20, 0, 2 * Math.PI);
  // ctx.fill();
}
function setup() {
  Tone.Transport.start();
  Tone.Transport.bpm.value = 120;
  startMainSequencer();
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
function stopMainSequencer() {
  console.log("envs", envs);
  sequencer.stop();
  // sequencer.cancel();
  envs.forEach(e => e.envelope.cancel());
  envs = [];
}
function startMainSequencer() {
  console.log("start now.");
  // sequencer.start(audioContext.now());
  sequencer.start();
}

// audio
const audioContext = new Tone.Context();
let sequencer;
let editing = false;
let envs = [];
let beat = 0;
let inputPianoroll = data[INITIAL_DATA_INDEX].input.pianoroll;
let pianoroll = data[INITIAL_DATA_INDEX].output.data.pianoroll;
let events = getEventsTimelineFromMatrix(pianoroll);
let inputEvents = getEventsTimelineFromMatrix(inputPianoroll);

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

sequencer = new Tone.Sequence(
  (time, b) => {
    envs = envs.filter(env => env.end >= b);
    beat = b;
    const es = events[b];
    if (es) {
      es.forEach(({ note, length }) => {
        const env = play(time, note + NUMBER_OF_NOTES, length * 0.2);
        envs.push({
          end: b + length,
          envelope: env
        });
      });
    }
    if (b >= 127) {
      console.log("b -> 127: stop");
      // stopMainSequencer();
      sequencer.stop();
      sequencer.cancel(time);
      beat = -1;
    }
  },
  Array(NUMBER_OF_BARS * NOTES_PER_BAR)
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

StartAudioContext(audioContext, "#play-btn", () => {
  setup();
  draw();
  // startMainSequencer();
});
postData(SERVER_URL, data[INITIAL_DATA_INDEX].input);

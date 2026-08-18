const PINK = '#ff007f';
const INK = '#090006';

export class AboutCanvasSelection {
  constructor({ canvas, textRuns }) {
    this.canvas = canvas;
    this.context = canvas?.getContext('2d') ?? null;
    this.runs = prepareRuns(this.context, textRuns ?? []);
    this.baseCanvas = cloneCanvas(canvas);
    this.englishCanvas = createEnglishCanvas(canvas);
    this.dragging = false;
    this.startIndex = 0;
    this.endIndex = 0;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);

    this.canvas?.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove, { passive: false });
    window.addEventListener('pointerup', this.handlePointerUp, { passive: true });
  }

  handlePointerDown(event) {
    if (event.button !== 0 || !this.context) return;
    const point = this.toCanvasPoint(event);
    const position = findTextPosition(this.runs, point.x, point.y);
    if (!position || point.x < 650) {
      this.clear();
      return;
    }
    event.preventDefault();
    this.dragging = true;
    this.startIndex = position.index;
    this.endIndex = position.index;
    this.canvas.setPointerCapture?.(event.pointerId);
    this.render();
  }

  handlePointerMove(event) {
    if (!this.dragging) return;
    event.preventDefault();
    const point = this.toCanvasPoint(event);
    const position = findTextPosition(this.runs, point.x, point.y);
    if (!position) return;
    this.endIndex = position.index;
    this.render();
  }

  handlePointerUp() {
    this.dragging = false;
  }

  toCanvasPoint(event) {
    const bounds = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * this.canvas.width,
      y: ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * this.canvas.height,
    };
  }

  render() {
    if (!this.context || !this.baseCanvas || !this.englishCanvas) return;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(this.baseCanvas, 0, 0);
    const rectangles = createSelectionRectangles(
      this.runs,
      Math.min(this.startIndex, this.endIndex),
      Math.max(this.startIndex, this.endIndex),
    );
    if (!rectangles.length) return;

    this.context.fillStyle = PINK;
    for (const rect of rectangles) {
      this.context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    this.context.save();
    this.context.beginPath();
    for (const rect of rectangles) this.context.rect(rect.x, rect.y, rect.width, rect.height);
    this.context.clip();
    this.context.drawImage(this.englishCanvas, 0, 0);
    this.context.restore();
  }

  clear() {
    this.dragging = false;
    this.startIndex = 0;
    this.endIndex = 0;
    if (!this.context || !this.baseCanvas) return;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(this.baseCanvas, 0, 0);
  }

  dispose() {
    this.canvas?.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
  }
}

function prepareRuns(context, textRuns) {
  if (!context) return [];
  let cursor = 0;
  return textRuns.map((run) => {
    context.font = run.font;
    const characters = Array.from(run.text);
    const offsets = [0];
    for (let index = 1; index <= characters.length; index += 1) {
      offsets.push(context.measureText(characters.slice(0, index).join('')).width);
    }
    const prepared = {
      ...run,
      characters,
      offsets,
      start: cursor,
      end: cursor + characters.length,
      top: run.baseline - run.ascent - 4,
      height: run.ascent + run.descent + 9,
    };
    cursor = prepared.end + 1;
    return prepared;
  });
}

function findTextPosition(runs, x, y) {
  if (!runs.length) return null;
  let run = runs[0];
  let nearestDistance = Infinity;
  for (const candidate of runs) {
    const centerY = candidate.top + candidate.height * 0.5;
    const verticalDistance = Math.abs(y - centerY);
    if (verticalDistance < nearestDistance) {
      nearestDistance = verticalDistance;
      run = candidate;
    }
  }

  let characterIndex = 0;
  let characterDistance = Infinity;
  for (let index = 0; index < run.offsets.length; index += 1) {
    const distance = Math.abs(x - (run.x + run.offsets[index]));
    if (distance < characterDistance) {
      characterDistance = distance;
      characterIndex = index;
    }
  }
  return { index: run.start + characterIndex };
}

function createSelectionRectangles(runs, selectionStart, selectionEnd) {
  if (selectionStart === selectionEnd) return [];
  const rectangles = [];
  for (const run of runs) {
    const start = Math.max(0, selectionStart - run.start);
    const end = Math.min(run.characters.length, selectionEnd - run.start);
    if (end <= start) continue;
    rectangles.push({
      x: run.x + run.offsets[start] - 2,
      y: run.top,
      width: run.offsets[end] - run.offsets[start] + 4,
      height: run.height,
    });
  }
  return rectangles;
}

function cloneCanvas(source) {
  if (!(source instanceof HTMLCanvasElement)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d')?.drawImage(source, 0, 0);
  return canvas;
}

function createEnglishCanvas(source) {
  if (!(source instanceof HTMLCanvasElement)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  const x = 688;
  drawEnglishRun(context, 'ABOUT', x, 108, '700 76px "Syne", sans-serif');
  drawEnglishRun(
    context,
    'CREATIVE DIRECTION / DESIGN / DEVELOPMENT',
    x,
    178,
    '600 20px "Syne", sans-serif',
  );
  const lines = [
    ['JUNKBRANDING IS A CREATIVE TEAM', 235],
    ['WORKING ACROSS DESIGN AND TECHNOLOGY,', 273],
    ['TURNING BRAND CHARACTER INTO DIGITAL EXPERIENCES.', 311],
    ['FROM PLANNING, DESIGN, MOTION AND INTERACTION', 367],
    ['TO FRONT-END DEVELOPMENT.', 405],
    ['WE UNITE EXPRESSION AND IMPLEMENTATION', 443],
    ['TO CREATE EXPERIENCES ONLY THAT BRAND CAN OWN.', 481],
    ['BEAUTIFUL IS NOT ENOUGH.', 537],
    ['WE CREATE WEBSITES THAT LEAVE SOMETHING', 575],
    ['THE MOMENT YOU SEE OR TOUCH THEM.', 613],
  ];
  lines.forEach(([line, baseline]) => {
    drawEnglishRun(
      context,
      line,
      x,
      baseline,
      '500 22px "Syne", sans-serif',
    );
  });
  return canvas;
}

function drawEnglishRun(context, text, x, baseline, font) {
  context.fillStyle = INK;
  context.font = font;
  context.fillText(text, x, baseline);
}

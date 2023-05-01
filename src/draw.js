import svgpath from "svgpath";

const ADDITIONAL_SUFFIX = "-ADDITIONAL_";

const GAMEBOY_SIZE = {
  width: -1,
  height: -1,
};

const GAMEBOY_PATHS = {
  l: "",
  r: "",

  BODY: "",
  SCREEN: "",

  a: "",
  b: "",
  start: "",
  select: "",
  up: "",
  right: "",
  down: "",
  left: "",
};

(async () => {
  const response = await fetch("/game-boy-advance-sp.svg");
  const parser = new DOMParser();
  const doc = parser.parseFromString(await response.text(), "image/svg+xml");

  const [x, y, width, height] = doc.children[0]
    .getAttribute("viewBox")
    .split(" ")
    .map((i) => Number(i));

  GAMEBOY_SIZE.x = x;
  GAMEBOY_SIZE.y = y;
  GAMEBOY_SIZE.width = width;
  GAMEBOY_SIZE.height = height;

  function parseSvgNode(element, key, isAddtional = false) {
    const nodeName = element.nodeName.toLocaleLowerCase();

    if (nodeName === "g") {
      for (let i = 0; i < element.children.length; i += 1) {
        parseSvgNode(element.children[i], `${key}_${i}`, isAddtional);
      }

      return;
    }

    const attribStrokeWidth = element.getAttribute("stroke-width");

    let lineWidth = parseInt(attribStrokeWidth);
    if (isNaN(lineWidth)) {
      lineWidth = 0;
    }

    let fill;
    if (isAddtional) {
      fill = element.getAttribute("fill");
      if (fill === "none") {
        fill = undefined;
      }
    }

    if (nodeName === "path") {
      GAMEBOY_PATHS[key] = {
        type: "path",
        d: element.getAttribute("d"),
        lineWidth,
        fill,
      };
    } else if (nodeName === "circle") {
      GAMEBOY_PATHS[key] = {
        type: "circle",
        x: element.getAttribute("cx"),
        y: element.getAttribute("cy"),
        r: element.getAttribute("r"),
        lineWidth,
        fill,
      };
    }
  }

  Object.keys(GAMEBOY_PATHS).forEach((key) => {
    const element = doc.getElementById(key.toLocaleUpperCase());
    if (!element) {
      return;
    }

    parseSvgNode(element, key);

    let additionalIndex = 0;
    let hasAdditional = true;

    while (hasAdditional) {
      const additionalKey = `${key.toLocaleUpperCase()}${ADDITIONAL_SUFFIX}${additionalIndex}`;
      const additional = doc.getElementById(additionalKey);

      if (!additional) {
        hasAdditional = false;
        break;
      }

      parseSvgNode(additional, additionalKey, true);
      additionalIndex += 1;
    }
  });
})();

export function draw(context, buttons, videoBackground = "#00ff00") {
  const {
    canvas: { width, height },
  } = context;

  const foreground = "#000";
  const background = "#fff";

  context.fillStyle = videoBackground;
  if (videoBackground !== "transparent") {
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }
  context.textBaseline = "hanging";

  context.fillStyle = foreground;

  const ratio = Math.min(
    width / GAMEBOY_SIZE.width,
    height / GAMEBOY_SIZE.height
  );

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const halfGameBoyWidth = GAMEBOY_SIZE.width / 2;
  const halfGameBoyHeight = GAMEBOY_SIZE.height / 2;

  context.save();

  const newX = halfWidth - halfGameBoyWidth * ratio;
  const newY = halfHeight - halfGameBoyHeight * ratio;

  context.translate(newX > width ? 0 : newX, newY > height ? 0 : newY);

  Object.keys(GAMEBOY_PATHS).forEach((key) => {
    const pathInfo = GAMEBOY_PATHS[key];
    if (pathInfo) {
      let fill = false;
      let stroke = false;

      const lineWidth = pathInfo.lineWidth * ratio;
      context.lineWidth = lineWidth;

      if (lineWidth > 0) {
        stroke = true;
      }

      let path;

      if (pathInfo.type === "path") {
        path = new Path2D(svgpath(pathInfo.d).scale(ratio));
      } else if (pathInfo.type === "circle") {
        path = new Path2D();
        const { x, y, r } = pathInfo;
        path.arc(x * ratio, y * ratio, r * ratio, 0, 2 * Math.PI);
      }

      if (pathInfo.fill) {
        fill = true;
        context.fillStyle = pathInfo.fill;
      }

      if (key === "BODY" || key === "l" || key === "r") {
        fill = true;
        context.fillStyle = background;
      }

      if (buttons[key]) {
        fill = true;
        context.fillStyle = foreground;
      }

      if (fill) {
        context.fill(path);
      }

      if (stroke) {
        context.stroke(path);
      }
    }
  });

  context.restore();
}

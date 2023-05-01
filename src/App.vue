<template>
  <canvas
    ref="canvas"
    :width="width"
    :height="height"
    style="max-width: 100%; display: "
  ></canvas>

  <div style="display: flex; justify-content: space-between;">
    <button
      :disabled="loading || generatingFrames || transcoding"
      @click="generateVideo"
    >
      Generate Video
    </button>

    <select
      v-model="resolution"
      :disabled="loading || generatingFrames || transcoding"
    >
      <optgroup
        v-for="(formatGroup, formatGroupKey) in formats"
        :key="formatGroupKey"
        :label="formatGroupKey"
      >
        <option
          v-for="(format, formatKey) in formatGroup"
          :key="formatKey"
          :value="formatKey"
          >{{ format[0] }} × {{ format[1] }}, {{ formatKey }}</option
        >
      </optgroup>
    </select>

    <label
      >Framerate:
      <input
        type="number"
        v-model="framerate"
        :disabled="loading || generatingFrames || transcoding"
    /></label>

    <div
      v-if="!done"
      style="
        display: flex;
        align-items: center;
      "
    >
      <pre v-if="generatingFrames">Generating Frames…</pre>
      <pre v-if="transcoding">Transcoding… eta: {{ eta }}</pre>
      <progress id="file" max="100" :value="progress * 100"
        >{{ progress * 100 }}%</progress
      >
    </div>
  </div>

  <hr />

  <video
    ref="outputVideo"
    controls
    v-show="done"
    :width="width"
    :height="height"
    style="width: 100%; "
  ></video>

  <pre v-if="error">{{ error }}</pre>

  <table style="display: none;">
    <tbody>
      <tr>
        <th>time</th>
        <th>input</th>
        <th>buttons</th>
      </tr>
      <tr
        v-for="([cycle, input], index) in inputLog"
        :key="cycle"
        :class="{ 'current-action': index === actionIndex }"
        @mouseover="mouseOver(getButtons(input))"
        @mouseout="mouseOver({})"
      >
        <td>{{ (cycle / 4096).toFixed(4) }}</td>
        <td>0x{{ hex(input) }}</td>
        <td>{{ printButtons(getButtons(input)).join(" ") }}</td>
      </tr>
    </tbody>
  </table>
</template>

<script>
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg/dist/ffmpeg.min.js";
import inputLog from "./input-log";
import { getButtons } from "./get-buttons";
import { draw } from "./draw";
import { millisecondsToStr } from "./millisecondsToStr";

export default {
  name: "App",
  data() {
    return {
      inputLog,
      context: null,
      ffmpegWorker: null,
      actionIndex: -1,
      generatingFrames: false,
      transcoding: false,
      progress: 0,
      loading: true,
      done: false,
      error: "",
      background: "#0f0",
      resolution: "720p",
      framerate: 30,
      timeStarted: undefined,
      formats: {
        "16:9": {
          "240p": [426, 240],
          "360p": [640, 360],
          "480p": [854, 480],
          "720p": [1280, 720],
          "1080p": [1920, 1080],
          // "1440p": [2560, 1440],
          // "2160p": [3840, 2160],
        },
        "4:3": {
          "0.05M3": [256, 192],
          QVGA: [320, 240],
          VGA: [640, 480],
          SVGA: [800, 600],
          "0.69M3": [960, 720],
          XGA: [1024, 768],
          "SXGA-": [1280, 960],
          // "SXGA+": [1400, 1050],
          // "1.56M3": [1440, 1080],
          // UXGA: [1600, 1200],
          // "2.58M3": [1856, 1392],
          // "2.76M3": [1920, 1440],
          // QXGA: [2048, 1536],
        },
      },
    };
  },

  async created() {
    this.ffmpegWorker = createFFmpeg({ log: true });
    await this.ffmpegWorker.load();
    // await this.ffmpegWorker.run("-pix_fmts");
    this.loading = false;
    this.ffmpegWorker.setProgress(({ ratio }) => {
      this.progress = ratio; // 0 - 1
    });
  },

  mounted() {
    this.context = this.$refs.canvas.getContext("2d", {
      desynchronized: true,
    });

    setTimeout(() => {
      this.draw(this.context, {});
    }, 200);
  },

  computed: {
    eta() {
      const eta =
        (Date.now() - this.timeStarted) / Math.max(0, this.progress) -
        (Date.now() - this.timeStarted);

      if (eta === Infinity) {
        return "starting";
      }

      return millisecondsToStr(eta);
    },

    allFormats() {
      return { ...this.formats["16:9"], ...this.formats["4:3"] };
    },

    width() {
      return this.allFormats[this.resolution][0];
    },

    height() {
      return this.allFormats[this.resolution][1];
    },
  },

  methods: {
    getButtons,
    millisecondsToStr,
    draw,

    printButtons(value) {
      return Object.entries(value)
        .filter(([, value]) => value)
        .map(([key]) => key.toLocaleUpperCase());
    },

    hex: (d) =>
      Number(d)
        .toString(16)
        .padStart(4, "0"),

    mouseOver(buttons) {
      this.draw(this.context, buttons, this.background);
    },

    async generateVideo() {
      this.draw(this.context, {}, this.background);

      const { framerate } = this;
      const frameTime = 1 / framerate;
      let currentFrame = 0;
      let actionIndex = -1;

      const endTime = this.inputLog[this.inputLog.length - 1][0] / 4096;

      const numFrames = framerate * endTime;

      let fetchedFile;

      let raf;

      this.generatingFrames = true;

      const filelist = [];
      const buttonStates = new Set();
      let currentButtons = 0;

      while (currentFrame < numFrames + 1) {
        if (raf) {
          cancelAnimationFrame(raf);
        }
        raf = requestAnimationFrame(() => {
          this.progress = currentFrame / (numFrames + 1);
        });

        const time = currentFrame * frameTime;

        framgenerator: if (
          actionIndex + 1 < this.inputLog.length &&
          this.inputLog[actionIndex + 1][0] / 4096 <= time
        ) {
          actionIndex += 1;

          const buttons = actionIndex > -1 ? this.inputLog[actionIndex][1] : 0;
          currentButtons = buttons;

          if (buttonStates.has(buttons)) {
            break framgenerator;
          }

          this.draw(
            this.context,
            getButtons(this.inputLog[actionIndex][1]),
            this.background
          );

          const base64Url = this.$refs.canvas.toDataURL("image/png", 1);
          fetchedFile = await fetchFile(base64Url);

          await this.ffmpegWorker.FS(
            "writeFile",
            `${currentButtons}.png`,
            fetchedFile
          );

          buttonStates.add(currentButtons);
        }

        filelist.push(`${currentButtons}.png`);

        currentFrame += 1;
      }

      const dataUri =
        "data:text/plain;base64," +
        btoa(
          filelist
            .map((t) => `file '${t}'\nduration ${1 / framerate}`)
            .join("\n")
        );

      await this.ffmpegWorker.FS(
        "writeFile",
        `input.txt`,
        await fetchFile(dataUri)
      );

      this.generatingFrames = false;

      // -framerate ${fps} -i /data/%d.jpg -c:v libx264 -pix_fmt yuv420p out.mp4

      this.transcoding = true;
      this.done = false;
      this.$nextTick(async () => {
        this.timeStarted = Date.now();

        try {
          await this.ffmpegWorker.run(
            "-f",
            "concat",
            "-i",
            "input.txt",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv444p", //"rgba"
            "out.mp4" // "out.webm"
          );
        } catch (e) {
          this.error = e.message;
          this.done = true;
          this.transcoding = false;
          this.timeStarted = undefined;
          this.progress = 0;
        }

        buttonStates.forEach((i) => this.ffmpegWorker.FS("unlink", `${i}.png`));
        this.ffmpegWorker.FS("unlink", "input.txt");

        const data = this.ffmpegWorker.FS("readFile", "out.mp4");

        const video = this.$refs.outputVideo;
        video.src = URL.createObjectURL(
          new Blob([data.buffer], { type: "video/mp4" })
        );

        this.done = true;
        this.transcoding = false;
        this.timeStarted = undefined;
        this.progress = 0;
      });
    },
  },

  watch: {
    width() {
      this.$nextTick(() => {
        this.draw(this.context, {});
      });
    },

    height() {
      this.$nextTick(() => {
        this.draw(this.context, {});
      });
    },
  },
};
</script>

<style>
#app,
pre {
  font-family: "Input", monospace;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

pre {
  margin: 0;
  margin-right: 1em;
}

tr:nth-child(odd) {
  background-color: rgba(0, 0, 0, 0.1);
}

tr:hover td,
tr.current-action td {
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
}

td {
  padding: 0.35em;
}
</style>

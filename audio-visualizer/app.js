/**
 * Functions
 */

/**
 * map
 *
 * ある範囲から別の範囲に数値を再マップする
 *
 * @param  {number} value  変換される値
 * @param  {number} start1 現在の値の範囲の下限
 * @param  {number} stop1  現在の値の範囲の上限
 * @param  {number} start2 再マップしたい値の範囲の下限
 * @param  {number} stop2  再マップしたい値の範囲の上限
 *
 * @return {number}        再マップされた数値
 *
 * @example
 *   map(50, 0, 100, 0, 200)
 *   returns 100
 */
function map(value, start1, stop1, start2, stop2) {
  return (value - start1) / (stop1 - start1) * (stop2 - start2) + start2;
}

//---------------------------------------------------------------------

/**
 * Classes
 */

/**
 * Sound
 *
 * 音声の再生、波形の取得などを管理するクラス
 *
 * @param {Object} audioCtx オーディオコンテキスト
 * @param {Object} buffer 音声ファイルデータ（バッファ）
 * @param {number} smoothing smoothingTimeConstantの設定値
 */
class Sound {
  constructor({ audioCtx, buffer, smoothing = 0.8 }) {
    /**
     * AudioBufferSourceNodeを生成
     */
    this.souce = audioCtx.createBufferSource();

    /**
     * 音声データ（バッファ）を音源に指定
     */
    this.souce.buffer = buffer;

    /**
     * 音量を調整するGainNodeを生成する
     */
    this.gain = audioCtx.createGain();

    /**
     * 音声の時間と周波数を解析するAnalyserNodeを生成
     */
    this.analyser = audioCtx.createAnalyser();

    /**
     * スペクトラムデータの動きの速さを設定
     * 0~1の範囲で設定でき、1に近いほど毎時取得できるデータの差が小さくなるため
     * 描画が滑らかになる
     */
    this.analyser.smoothingTimeConstant = smoothing;

    /**
     * FFTサイズ
     */
    this.fftSize = this.analyser.frequencyBinCount;

    /**
     * 周波数領域の波形データを格納する配列を生成する
     * this.analyser.frequencyBinCountのデフォルトは1024のため
     * 1024個のインデックスを持った配列が生成される
     */
    this.freqs = new Uint8Array(this.analyser.frequencyBinCount);

    /**
     * 時間領域の波形データを格納する配列を生成する
     * this.analyser.frequencyBinCountのデフォルトは1024のため
     * 1024個のインデックスを持った配列が生成される
     */
    this.times = new Uint8Array(this.analyser.frequencyBinCount);

    /**
     * GainNodeにAudioBufferSourceNodeを接続
     */
    this.souce.connect(this.gain);

    /**
     * AnalyserNodeにGainNodeを接続
     */
    this.gain.connect(this.analyser);

    /*
     * audioCtxにAnalyserNodeを接続
     */
    this.analyser.connect(audioCtx.destination);
  }

  /**
   * 再生を開始する
   */
  start() {
    this.souce.start(0);
  }

  /**
   * 接続を解除する
   */
  disconnect() {
    this.souce.disconnect();
  }

  /**
   * 音量を変更する
   * @param {number} volume 音量 0~1まで指定可能
   */
  setVolume(volume) {
    this.gain.gain.value = volume;
  }

  /**
   * 周波数領域の平均値より高い波形データを返す
   * @return {array} freqs 周波数領域の波形データ
   */
  AboveAverageFrequencySpectrum() {
    /**
     * 周波数領域の波形データを引数の配列freqsに格納する
     * analyser.fftSize / 2のインデックス数の値がthis.freqsに格納される
     */
    this.analyser.getByteFrequencyData(this.freqs);

    const average =
      this.freqs.reduce((sum, value) => sum + value, 0) / this.fftSize;

    return this.freqs
      .filter(value => value > average)
      .map(value => value - average);
  }

  /**
   * 時間領域の波形データの二乗平均平方根を返す
   */
  amplitudeLevel() {
    /**
     * 時間領域の波形データを引数の配列freqsに格納する
     * analyser.fftSize / 2のインデックス数の値がthis.freqsに格納される
     */
    this.analyser.getByteTimeDomainData(this.times);

    return Math.sqrt(
      this.times.map(value => value * value).reduce((sum, value) => sum + value)
    );
  }
}

/**
 * canvasのセットアップ
 */
const c = document.getElementById('canvas');
let cw = 0;
let ch = 0;
c.width = cw = window.innerWidth;
c.height = ch = window.innerHeight;
const ctx = c.getContext('2d');

window.onresize = () => {
  c.width = cw = window.innerWidth;
  c.height = ch = window.innerHeight;
};

/**
 * audioのセットアップ
 */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/**
 * Soundクラスのインスタンス
 */
let sound = null;

/**
 * 描画に利用する角度と速度
 */
let degree = [];
let velocity = [];

/**
 * 描画をチューニングするための累乗
 */
const tuningValue = Math.pow(1.1, 3);

/**
 * バッファサイズ
 */
const bufferSize = 1024;

/**
 * setup
 *
 * 描画の準備をする
 */
function setup(buffer) {
  for (let i = 0; i < bufferSize; i += 1) {
    degree[i] = 0;
    velocity[i] = 0;
  }

  if (sound) {
    sound.disconnect();
    sound = null;
  }

  sound = new Sound({
    audioCtx,
    buffer,
    smoothing: 0.5,
  });

  sound.setVolume(0.2);
  sound.start();
}

/**
 * draw
 *
 * 描画をする
 */
function draw() {
  requestAnimationFrame(draw);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(0, 0, cw, ch);

  const amplitudeLevel = sound.amplitudeLevel();
  const spectrum = sound.AboveAverageFrequencySpectrum(tuningValue);
  const spectrumLength = spectrum.length;

  ctx.save();
  ctx.globalAlpha = 0.8;

  spectrum.forEach((value, index) => {
    const hue = map(index, 0, spectrumLength, 0, 360);
    const maxX =
      window.innerWidth > window.innerHeight
        ? window.innerWidth / 8
        : window.innerHeight / 8;
    const x = map(
      index,
      0,
      spectrumLength,
      0,
      maxX + map(amplitudeLevel, 0, 255, 0, 200)
    );

    const maxRadius = 25;
    const radius = map(value, 0, 255, 0, maxRadius) * tuningValue;

    velocity[index] += map(value, 0, 255, 0, 0.03);

    if (velocity[index] > 5) {
      velocity[index] = 0;
    }

    degree[index] += velocity[index];

    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(degree[index] * Math.PI / 180);
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.beginPath();
    ctx.arc(x, 0, radius, 0, Math.PI * 2, false);
    ctx.fill();
    ctx.restore();
  });

  ctx.restore();
}

const fileReader = new FileReader();
fileReader.onload = () => {
  audioCtx.decodeAudioData(fileReader.result, buffer => {
    if (!buffer) {
      console.log('decode error');
    }

    setup(buffer);
    draw();
  });
};
document.getElementById('file').addEventListener('change', e => {
  fileReader.readAsArrayBuffer(e.target.files[0]);
});

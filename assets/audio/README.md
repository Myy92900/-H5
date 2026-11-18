# 真人录音放置说明

把两岸田野采集的音频放在这个目录。

推荐格式：`.mp3` 或 `.m4a`，单词 + 一句生活短句，保留适度环境音，48kHz / 24bit 源文件。

命名建议：

- `taiyang-cn-1.mp3` / `taiyang-tw-1.mp3`
- `puguang-cn-1.mp3` / `puguang-tw-1.mp3`
- `shuxi-cn-1.mp3` / `shuxi-tw-1.mp3`
- `keren-cn-1.mp3` / `keren-tw-1.mp3`
- `ganmao-cn-1.mp3` / `ganmao-tw-1.mp3`
- `guoding-cn-1.mp3` / `guoding-tw-1.mp3`

然后在 `../js/data.js` 对应 voice 的 `audio` 字段填写相对路径，例如：

```js
audio: "assets/audio/taiyang-cn-1.mp3"
```

没有填写或加载失败时，页面会回退到浏览器语音合成，并在「关于」中标注为声音样带。

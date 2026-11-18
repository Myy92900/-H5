/* =========================================================
   同源共响 · 交互逻辑
   无依赖；音频优先读取 data.js 中的 audio 路径，
   没有录音时使用浏览器语音合成作为“声音样带”。
   ========================================================= */
(function () {
  "use strict";

  const DATA = window.SAME_ORIGIN;
  if (!DATA || !Array.isArray(DATA.pairs)) return;

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SIDES = ["mainland", "taiwan"];
  const SIDE_LABEL = { mainland: "大陆", taiwan: "台湾" };
  const OTHER = { mainland: "taiwan", taiwan: "mainland" };

  const state = {
    started: false,
    pairIndex: 0,
    voiceIndex: { mainland: 0, taiwan: 0 },
    activeSide: null,
    playingSide: null,
    played: { mainland: false, taiwan: false },
    merged: false,
    muted: false,
    carousel: false,
    carouselIndex: 0,
    carouselTimer: null,
    timers: [],
    playToken: 0,
    voiceToken: 0,
    audio: null,
    audioContext: null,
    speechWatchdog: null,
    timerStart: 0,
    timerFrame: null,
    timerDone: false,
    toastTimer: null,
    activeModal: null,
    lastFocus: null,
    ambientFrame: null,
    ambientParticles: [],
    ambientSize: { w: 0, h: 0 },
    voices: [],
    pendingHash: false,
  };

  const el = {};
  let toastEl;
  let liveEl;

  function currentPair() {
    return DATA.pairs[state.pairIndex];
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function cacheElements() {
    el.intro = $("#intro");
    el.experience = $("#experience");
    el.startBtn = $("#startBtn");
    el.brandHome = $("#brandHome");
    el.aboutBtn = $("#aboutBtn");
    el.introDetailBtn = $("#introDetailBtn");
    el.soundToggle = $("#soundToggle");
    el.soundLabel = $("#soundLabel");
    el.pairList = $("#pairList");
    el.pairIndex = $("#pairIndex");
    el.pairNavLabel = $("#pairNavLabel");
    el.prevPair = $("#prevPair");
    el.nextPair = $("#nextPair");
    el.journey = $("#journey");
    el.journeyBar = $("#journeyBar");
    el.timerValue = $("#timerValue");
    el.cnScript = $("#cnScript");
    el.cnWord = $("#cnWord");
    el.cnPinyin = $("#cnPinyin");
    el.cnListen = $("#cnListen");
    el.cnVoice = $("#cnVoice");
    el.cnDots = $("#cnDots");
    el.cnStory = $("#cnStory");
    el.cnAvatar = $("#cnAvatar");
    el.cnTag = $("#cnTag");
    el.cnPlace = $("#cnPlace");
    el.cnQuote = $("#cnQuote");
    el.twScript = $("#twScript");
    el.twWord = $("#twWord");
    el.twPinyin = $("#twPinyin");
    el.twListen = $("#twListen");
    el.twVoice = $("#twVoice");
    el.twDots = $("#twDots");
    el.twStory = $("#twStory");
    el.twAvatar = $("#twAvatar");
    el.twTag = $("#twTag");
    el.twPlace = $("#twPlace");
    el.twQuote = $("#twQuote");
    el.cardMainland = $("#cardMainland");
    el.cardTaiwan = $("#cardTaiwan");
    el.stage = $("#stage");
    el.stageType = $("#stageType");
    el.sourceChar = $("#sourceChar");
    el.ghostLeft = $("#ghostLeft");
    el.ghostRight = $("#ghostRight");
    el.stageHint = $("#stageHint");
    el.stageNote = $("#stageNote");
    el.stageStat = $("#stageStat");
    el.ripples = $("#ripples");
    el.listenOtherBtn = $("#listenOtherBtn");
    el.detailBtn = $("#detailBtn");
    el.carouselBtn = $("#carouselBtn");
    el.footHint = $("#footHint");
    el.shareBtn = $("#shareBtn");
    el.voiceDock = $("#voiceDock");
    el.dockRegion = $("#dockRegion");
    el.dockTag = $("#dockTag");
    el.dockQuote = $("#dockQuote");
    el.dockSwitch = $("#dockSwitch");
    el.dockOther = $("#dockOther");
    el.dockDetail = $("#dockDetail");
    el.detailModal = $("#detailModal");
    el.shareModal = $("#shareModal");
    el.aboutModal = $("#aboutModal");
    el.buildModal = $("#buildModal");
    el.detailType = $("#detailType");
    el.detailTitle = $("#detailTitle");
    el.detailSub = $("#detailSub");
    el.detailWords = $("#detailWords");
    el.detailSource = $("#detailSource");
    el.detailRoute = $("#detailRoute");
    el.detailStories = $("#detailStories");
    el.detailCitations = $("#detailCitations");
    el.detailShare = $("#detailShare");
    el.buildBtn = $("#buildBtn");
    el.buildNotify = $("#buildNotify");
    el.poster = $("#posterCanvas");
    el.downloadPoster = $("#downloadPoster");
    el.shareNative = $("#shareNative");
    el.copyLink = $("#copyLink");
    el.toast = $("#toast");
    el.live = $("#live");
    toastEl = el.toast;
    liveEl = el.live;
  }

  /* ---------------------------------------------------------
     渲染与状态
     --------------------------------------------------------- */
  function renderPairList() {
    el.pairList.innerHTML = DATA.pairs
      .map((pair, index) => {
        const selected = index === state.pairIndex;
        return (
          '<button class="pair-chip' + (selected ? " is-active" : "") + '" type="button" role="tab" aria-selected="' +
          selected + '" tabindex="' + (selected ? "0" : "-1") + '" data-index="' + index + '">' +
          '<span class="chip-no">' + escapeHTML(pair.no) + "</span>" +
          "<span>" + escapeHTML(pair.mainland.display) + "</span>" +
          '<span class="chip-sep">/</span>' +
          "<span>" + escapeHTML(pair.taiwan.display) + "</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function updatePairList() {
    const chips = $$(".pair-chip", el.pairList);
    chips.forEach((chip, index) => {
      const active = index === state.pairIndex;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-selected", String(active));
      chip.tabIndex = active ? 0 : -1;
    });
    const activeChip = chips[state.pairIndex];
    if (activeChip && el.pairList) {
      const target = activeChip.offsetLeft - el.pairList.clientWidth / 2 + activeChip.clientWidth / 2;
      el.pairList.scrollTo({ left: Math.max(0, target), behavior: reducedMotion ? "auto" : "smooth" });
    }
  }

  function setStageType(pair) {
    el.stageType.textContent = pair.type;
    el.stageType.className = "stage-type type-" + pair.typeKey;
  }

  function setStoryPlaceholder(side) {
    const isCn = side === "mainland";
    const avatar = isCn ? el.cnAvatar : el.twAvatar;
    const tag = isCn ? el.cnTag : el.twTag;
    const place = isCn ? el.cnPlace : el.twPlace;
    const quote = isCn ? el.cnQuote : el.twQuote;
    const story = isCn ? el.cnStory : el.twStory;
    avatar.textContent = "声";
    tag.textContent = "等待发声";
    place.textContent = isCn ? "普通话" : "国语";
    quote.textContent = "点按词卡，听这一岸的声音。";
    story.classList.add("is-empty");
  }

  function renderStory(side) {
    const pair = currentPair();
    const voice = pair[side].voices[state.voiceIndex[side]];
    if (!voice) return;
    const isCn = side === "mainland";
    const avatar = isCn ? el.cnAvatar : el.twAvatar;
    const tag = isCn ? el.cnTag : el.twTag;
    const place = isCn ? el.cnPlace : el.twPlace;
    const quote = isCn ? el.cnQuote : el.twQuote;
    const story = isCn ? el.cnStory : el.twStory;
    avatar.textContent = voice.avatar;
    tag.textContent = voice.tag;
    place.textContent = voice.place;
    quote.textContent = voice.quote;
    story.classList.remove("is-empty");
  }

  function renderVoiceMeta(side) {
    const pair = currentPair();
    const voice = pair[side].voices[state.voiceIndex[side]];
    const isCn = side === "mainland";
    const voiceEl = isCn ? el.cnVoice : el.twVoice;
    const dotsEl = isCn ? el.cnDots : el.twDots;
    const listen = isCn ? el.cnListen : el.twListen;
    if (!voice) return;
    const total = pair[side].voices.length;
    voiceEl.textContent = "声音 " + (state.voiceIndex[side] + 1) + " / " + total + (voice.audio ? "" : " · 样带");
    voiceEl.setAttribute("title", voice.audio ? "真人录音" : "当前为语音样带，正式版替换真人录音");
    dotsEl.innerHTML = pair[side].voices
      .map((_, index) => '<i class="' + (index === state.voiceIndex[side] ? "is-on" : "") + '"></i>')
      .join("");
    if (!state.playingSide) {
      listen.textContent = state.played[side] ? "再听一次" : "点击听音";
    }
  }

  function renderDock() {
    const side = state.activeSide;
    if (!side) {
      el.dockRegion.textContent = "等待发声";
      el.dockRegion.className = "dock-region";
      el.dockTag.textContent = "点一张词卡";
      el.dockQuote.textContent = "点一张词卡，先听听这一岸的声音。";
      el.dockSwitch.textContent = "换声音";
      el.dockOther.textContent = "听另一岸";
      return;
    }
    const pair = currentPair();
    const voice = pair[side].voices[state.voiceIndex[side]];
    el.dockRegion.textContent = SIDE_LABEL[side];
    el.dockRegion.className = "dock-region" + (side === "mainland" ? " is-mainland" : "");
    el.dockTag.textContent = voice.tag + " · " + voice.place;
    el.dockQuote.textContent = voice.quote;
    el.dockSwitch.textContent = "换声音";
    el.dockOther.textContent = "听" + SIDE_LABEL[OTHER[side]];
    el.dockDetail.textContent = "完整故事";
  }

  function updateCardContent(side) {
    const pair = currentPair();
    const isCn = side === "mainland";
    const data = pair[side];
    const scriptEl = isCn ? el.cnScript : el.twScript;
    const wordEl = isCn ? el.cnWord : el.twWord;
    const pinyinEl = isCn ? el.cnPinyin : el.twPinyin;
    const card = isCn ? el.cardMainland : el.cardTaiwan;
    scriptEl.textContent = data.script;
    wordEl.textContent = data.display;
    pinyinEl.textContent = data.pinyin;
    card.dataset.watermark = pair.sourceChar;
    card.setAttribute("aria-label", "播放" + SIDE_LABEL[side] + "发音：" + data.display);
    renderVoiceMeta(side);
  }

  function applyPair(index, options) {
    const opts = options || {};
    const total = DATA.pairs.length;
    const nextIndex = ((index % total) + total) % total;
    stopAudio();
    stopCarousel(true);
    clearTimers();
    state.pairIndex = nextIndex;
    state.activeSide = null;
    state.playingSide = null;
    state.played = { mainland: false, taiwan: false };
    state.merged = false;
    state.voiceIndex = { mainland: 0, taiwan: 0 };
    state.carouselIndex = 0;
    const pair = currentPair();

    updateCardContent("mainland");
    updateCardContent("taiwan");
    setStoryPlaceholder("mainland");
    setStoryPlaceholder("taiwan");
    renderDock();

    el.pairIndex.textContent = pair.no;
    el.pairNavLabel.textContent = pair.mainland.display + " / " + pair.taiwan.display;
    el.stage.dataset.state = "idle";
    el.sourceChar.textContent = pair.sourceChar;
    el.ghostLeft.textContent = pair.mainland.display;
    el.ghostRight.textContent = pair.taiwan.display;
    setStageType(pair);
    el.stageHint.textContent = "点一张词卡，听见它的来路";
    el.stageNote.textContent = pair.typeNote;
    el.stageStat.textContent = "0 / 2 个声音";
    el.listenOtherBtn.disabled = true;
    el.listenOtherBtn.textContent = "听另一岸";
    el.detailBtn.disabled = true;
    el.footHint.textContent = "先点任意一张词卡";
    el.cardMainland.classList.remove("is-playing");
    el.cardTaiwan.classList.remove("is-playing");
    el.voiceDock.classList.remove("is-live");
    el.shareBtn.classList.remove("is-nudge");
    setJourney("listen");
    updatePairList();

    if (state.started) {
      document.title = DATA.title + " · " + pair.mainland.display + " / " + pair.taiwan.display;
      if (!opts.silentHash) setHash(pair.id);
    }
    if (!opts.keepLive) {
      el.live.textContent = "已选择：" + pair.mainland.display + " / " + pair.taiwan.display + "。" + pair.typeNote;
    }
    if (!opts.silentHash && !state.started) setHash(pair.id);
  }

  function setHash(id) {
    if (!id) return;
    try {
      history.replaceState(null, "", "#" + id);
    } catch (error) {
      location.hash = id;
    }
  }

  function setJourney(step) {
    const order = ["listen", "trace", "echo"];
    const index = order.indexOf(step);
    $$(".journey-step", el.journey).forEach((node, nodeIndex) => {
      node.classList.toggle("is-active", nodeIndex === index);
      node.classList.toggle("is-done", nodeIndex < index);
    });
  }

  function updateStageCount() {
    const count = Number(state.played.mainland) + Number(state.played.taiwan);
    el.stageStat.textContent = count + " / 2 个声音";
  }

  function setActiveSideUI(side) {
    [el.cardMainland, el.cardTaiwan].forEach((card) => {
      const isThis = card === (side === "mainland" ? el.cardMainland : el.cardTaiwan);
      card.classList.toggle("is-playing", isThis);
    });
    const activeListen = side === "mainland" ? el.cnListen : el.twListen;
    const otherListen = side === "mainland" ? el.twListen : el.cnListen;
    activeListen.textContent = state.muted ? "声音已关闭" : "正在播放";
    otherListen.textContent = state.played[OTHER[side]] ? "再听一次" : "点击听音";
  }

  function finishPlayback(side) {
    if (state.playingSide !== side) return;
    state.playingSide = null;
    el.cardMainland.classList.remove("is-playing");
    el.cardTaiwan.classList.remove("is-playing");
    el.cnListen.textContent = state.played.mainland ? "再听一次" : "点击听音";
    el.twListen.textContent = state.played.taiwan ? "再听一次" : "点击听音";
  }

  /* ---------------------------------------------------------
     播放
     --------------------------------------------------------- */
  function initAudioContext() {
    if (!state.audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return null;
      try {
        state.audioContext = new Context();
      } catch (error) {
        return null;
      }
    }
    if (state.audioContext.state === "suspended") {
      state.audioContext.resume().catch(function () {});
    }
    return state.audioContext;
  }

  function playChime() {
    if (state.muted) return;
    const context = initAudioContext();
    if (!context) return;
    const now = context.currentTime;
    [196, 293.66, 392].forEach(function (frequency, index) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.035 / (index + 1), now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15 + index * 0.18);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 1.5 + index * 0.18);
    });
  }

  function pickVoice(side) {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    if (!state.voices.length) {
      try {
        state.voices = synth.getVoices();
      } catch (error) {
        state.voices = [];
      }
    }
    const wanted = side === "taiwan" ? ["zh-tw", "zh-hant", "zh"] : ["zh-cn", "zh-hans", "zh"];
    for (let i = 0; i < wanted.length; i += 1) {
      const match = state.voices.find(function (voice) {
        return String(voice.lang || "").toLowerCase().indexOf(wanted[i]) === 0;
      });
      if (match) return match;
    }
    if (side === "taiwan") {
      return state.voices.find(function (voice) {
        return /taiwan|yating|台灣|台湾/i.test(String(voice.name || "") + " " + String(voice.lang || ""));
      }) || null;
    }
    return state.voices.find(function (voice) {
      return /huihui|xiaoxiao|mandarin|普通话|國語|国语/i.test(String(voice.name || ""));
    }) || null;
  }

  function speak(text, side) {
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === "undefined") {
      showToast("此浏览器不支持语音样带，故事文字已展开。");
      finishPlayback(side);
      return;
    }
    const token = ++state.voiceToken;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text || ""));
    const voice = pickVoice(side);
    utterance.lang = side === "taiwan" ? "zh-TW" : "zh-CN";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.83;
    utterance.pitch = 1;
    utterance.volume = state.muted ? 0 : 0.92;
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      if (token !== state.voiceToken) return;
      clearTimeout(state.speechWatchdog);
      state.speechWatchdog = null;
      finishPlayback(side);
    }
    utterance.onend = finish;
    utterance.onerror = finish;
    try {
      synth.speak(utterance);
    } catch (error) {
      finish();
      return;
    }
    clearTimeout(state.speechWatchdog);
    state.speechWatchdog = setTimeout(finish, Math.max(2800, String(text || "").length * 520));
  }

  function playVoice(pair, side, voiceIndex, playToken) {
    const voice = pair[side].voices[voiceIndex];
    if (!voice) return;
    if (state.muted) {
      showToast("声音已关闭，点右上角开启。");
      setTimeout(function () {
        if (state.playToken === playToken) finishPlayback(side);
      }, 900);
      return;
    }
    if (voice.audio) {
      const audio = new Audio(voice.audio);
      state.audio = audio;
      audio.preload = "auto";
      audio.volume = 0.96;
      const finish = function () {
        if (state.audio === audio) state.audio = null;
        if (state.playToken === playToken) finishPlayback(side);
      };
      audio.onended = finish;
      audio.onerror = function () {
        if (state.audio === audio) state.audio = null;
        if (state.playToken === playToken) speak(voice.ttsText || voice.text, side);
      };
      audio.play().catch(function () {
        if (state.audio === audio) state.audio = null;
        if (state.playToken === playToken) speak(voice.ttsText || voice.text, side);
      });
      return;
    }
    speak(voice.ttsText || voice.text, side);
  }

  function stopAudio() {
    state.voiceToken += 1;
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (error) {}
    }
    if (state.audio) {
      try {
        state.audio.pause();
        state.audio.currentTime = 0;
      } catch (error) {}
      state.audio = null;
    }
    clearTimeout(state.speechWatchdog);
    state.speechWatchdog = null;
    if (state.playingSide) finishPlayback(state.playingSide);
  }

  /* ---------------------------------------------------------
     播放流程与词源动效
     --------------------------------------------------------- */
  function clearTimers() {
    state.timers.forEach(function (timer) {
      clearTimeout(timer);
    });
    state.timers = [];
  }

  function later(fn, delay) {
    const timer = setTimeout(fn, delay);
    state.timers.push(timer);
    return timer;
  }

  function traceStage() {
    if (!state.started || !state.activeSide) return;
    const pair = currentPair();
    el.stage.dataset.state = "tracing";
    el.stageHint.textContent = "两个字，正在回到共同的源头";
    el.stageNote.textContent = pair.shared + "。沿着各自的口音往回走，它们会在同一个字形里相遇。";
    setJourney("trace");
    el.live.textContent = "开始溯源：" + pair.shared;
  }

  function mergeStage() {
    if (!state.started) return;
    const pair = currentPair();
    state.merged = true;
    el.stage.dataset.state = "merged";
    el.stageHint.textContent = "同源，在此共鸣";
    el.stageNote.textContent = pair.sourceNote;
    setJourney("echo");
    updateStageCount();
    el.detailBtn.disabled = false;
    el.footHint.textContent = "换一个声音，或把这张同源卡分享出去";
    el.shareBtn.classList.add("is-nudge");
    triggerRipples();
    playChime();
    if (!reducedMotion && navigator.vibrate && navigator.userActivation && navigator.userActivation.isActive) {
      try {
        navigator.vibrate([16, 42, 24]);
      } catch (error) {}
    }
    el.live.textContent = "同源共鸣：" + pair.shared + "。" + pair.sourceNote;
  }

  function triggerRipples() {
    el.ripples.classList.remove("is-pulsing");
    void el.ripples.offsetWidth;
    el.ripples.classList.add("is-pulsing");
    setTimeout(function () {
      el.ripples.classList.remove("is-pulsing");
    }, 2300);
  }

  function playSide(side, options) {
    const opts = options || {};
    if (!state.started) return;
    if (!opts.fromCarousel && state.carousel) stopCarousel(true);
    if (!opts.keepTimers) clearTimers();
    initAudioContext();
    stopAudio();
    const token = ++state.playToken;
    const pair = currentPair();
    const other = OTHER[side];
    const voice = pair[side].voices[state.voiceIndex[side]];
    state.activeSide = side;
    state.played[side] = true;
    state.playingSide = side;
    setActiveSideUI(side);
    renderStory(side);
    renderVoiceMeta(side);
    renderDock();
    updateStageCount();
    el.stage.dataset.state = "listening";
    el.stageHint.textContent = "正在听：" + SIDE_LABEL[side] + " · " + pair[side].display;
    el.stageNote.textContent = state.played[other]
      ? "两种声音都到了。让它们回到同一个源头。"
      : "再听一听" + SIDE_LABEL[other] + "，同一个词，会有另一种日常。";
    el.listenOtherBtn.disabled = false;
    el.listenOtherBtn.textContent = state.played[other] ? "再听" + SIDE_LABEL[other] : "听" + SIDE_LABEL[other];
    el.footHint.textContent = "听另一岸，或换一个声音";
    el.shareBtn.classList.remove("is-nudge");
    el.live.textContent = "正在播放" + SIDE_LABEL[side] + "，" + (voice ? voice.tag : "") + "。";

    if (!opts.silent) playVoice(pair, side, state.voiceIndex[side], token);

    later(function () {
      if (state.playToken !== token) return;
      traceStage();
    }, 1000);
    later(function () {
      if (state.playToken !== token) return;
      mergeStage();
    }, state.played[other] ? 1850 : 2850);
  }

  function cycleVoice(side) {
    if (!state.started) return;
    const pair = currentPair();
    const total = pair[side].voices.length;
    if (total < 2) {
      showToast("这一岸暂时只有一个声音。");
      return;
    }
    state.voiceIndex[side] = (state.voiceIndex[side] + 1) % total;
    renderVoiceMeta(side);
    renderStory(side);
    renderDock();
    playSide(side);
  }

  function listenOther() {
    if (!state.started) return;
    const side = state.activeSide ? OTHER[state.activeSide] : "taiwan";
    playSide(side);
  }

  /* ---------------------------------------------------------
     多声轮播
     --------------------------------------------------------- */
  function stopCarousel(silent) {
    const wasOn = state.carousel;
    state.carousel = false;
    clearInterval(state.carouselTimer);
    state.carouselTimer = null;
    if (el.carouselBtn) {
      el.carouselBtn.setAttribute("aria-pressed", "false");
      el.carouselBtn.innerHTML = '<span class="carousel-dot" aria-hidden="true"></span> 多声轮播';
    }
    if (wasOn && !silent) showToast("已停止多声轮播。");
  }

  function carouselNext() {
    if (!state.carousel) return;
    const sequence = [
      { side: "mainland", voice: 0 },
      { side: "taiwan", voice: 0 },
      { side: "mainland", voice: 1 },
      { side: "taiwan", voice: 1 },
    ];
    const item = sequence[state.carouselIndex % sequence.length];
    state.carouselIndex += 1;
    const pair = currentPair();
    state.voiceIndex[item.side] = Math.min(item.voice, pair[item.side].voices.length - 1);
    renderVoiceMeta(item.side);
    renderStory(item.side);
    renderDock();
    playSide(item.side, { fromCarousel: true });
  }

  function toggleCarousel() {
    if (!state.started) return;
    if (state.carousel) {
      stopCarousel(false);
      return;
    }
    if (state.muted) setMuted(false, true);
    state.carousel = true;
    state.carouselIndex = 0;
    el.carouselBtn.setAttribute("aria-pressed", "true");
    el.carouselBtn.innerHTML = '<span class="carousel-dot" aria-hidden="true"></span> 正在轮播';
    showToast("多声轮播：大陆、台湾、两种声音，依次响起。");
    carouselNext();
    state.carouselTimer = setInterval(carouselNext, 6800);
  }

  /* ---------------------------------------------------------
     计时与体验切换
     --------------------------------------------------------- */
  function tick(now) {
    if (!state.started) return;
    const elapsed = Math.min(30, (now - state.timerStart) / 1000);
    const remaining = Math.max(0, 30 - Math.floor(elapsed));
    el.timerValue.textContent = remaining < 10 ? "0" + remaining : String(remaining);
    el.journeyBar.style.width = Math.min(100, (elapsed / 30) * 100) + "%";
    if (elapsed >= 30) {
      el.timerValue.textContent = "00";
      el.timerValue.parentElement.classList.add("is-over");
      if (!state.timerDone) {
        state.timerDone = true;
        el.shareBtn.classList.add("is-nudge");
        el.footHint.textContent = "30 秒到。故事还可以继续。";
        showToast("30 秒到。换一个声音，或把这条来路分享出去。");
      }
      return;
    }
    state.timerFrame = requestAnimationFrame(tick);
  }

  function startExperience() {
    if (state.started) return;
    state.started = true;
    initAudioContext();
    document.body.classList.add("experience-mode");
    el.intro.classList.remove("is-active");
    el.experience.classList.add("is-active");
    state.timerStart = performance.now();
    state.timerDone = false;
    el.timerValue.textContent = "30";
    el.timerValue.parentElement.classList.remove("is-over");
    el.journeyBar.style.width = "0%";
    setJourney("listen");
    setHash(currentPair().id);
    document.title = DATA.title + " · " + currentPair().mainland.display + " / " + currentPair().taiwan.display;
    cancelAnimationFrame(state.timerFrame);
    state.timerFrame = requestAnimationFrame(tick);
  }

  function goHome() {
    stopAudio();
    stopCarousel(true);
    clearTimers();
    closeAllModals();
    state.started = false;
    state.playingSide = null;
    state.carousel = false;
    cancelAnimationFrame(state.timerFrame);
    document.body.classList.remove("experience-mode");
    el.experience.classList.remove("is-active");
    el.intro.classList.add("is-active");
    el.timerValue.textContent = "30";
    el.timerValue.parentElement.classList.remove("is-over");
    el.journeyBar.style.width = "0%";
    applyPair(state.pairIndex, { silentHash: true, keepLive: true });
    document.title = DATA.title + " · " + DATA.subtitle;
    setTimeout(function () {
      el.startBtn.focus({ preventScroll: true });
    }, 420);
  }

  function setMuted(muted, silent) {
    state.muted = Boolean(muted);
    el.soundToggle.classList.toggle("is-muted", state.muted);
    el.soundToggle.setAttribute("aria-pressed", String(!state.muted));
    el.soundToggle.setAttribute("aria-label", state.muted ? "开启声音" : "关闭声音");
    el.soundLabel.textContent = state.muted ? "静音" : "声音";
    if (state.muted) {
      stopAudio();
      if (!silent) showToast("声音已关闭，文字与动效继续。");
    } else if (!silent) {
      initAudioContext();
      showToast("声音已开启。");
    }
  }

  /* ---------------------------------------------------------
     声音档案 / 词源详情
     --------------------------------------------------------- */
  function openDetail() {
    const pair = currentPair();
    stopAudio();
    stopCarousel(true);
    el.detailType.textContent = pair.type;
    el.detailType.className = "detail-type type-" + pair.typeKey;
    el.detailTitle.textContent = pair.mainland.display + " / " + pair.taiwan.display;
    el.detailSub.textContent = pair.typeNote;
    el.detailWords.innerHTML =
      '<div class="detail-word mainland"><small>大陆 · 普通话</small><b>' + escapeHTML(pair.mainland.display) + "</b><i>" + escapeHTML(pair.mainland.pinyin) + "</i></div>" +
      '<div class="detail-source-mark"><span>' + escapeHTML(pair.sourceChar) + "</span><small>" + escapeHTML(pair.shared) + "</small></div>" +
      '<div class="detail-word taiwan"><small>台湾 · 国语</small><b>' + escapeHTML(pair.taiwan.display) + "</b><i>" + escapeHTML(pair.taiwan.pinyin) + "</i></div>";
    el.detailSource.textContent = pair.sourceNote;
    el.detailRoute.textContent = pair.route;
    el.detailCitations.innerHTML = pair.citations.map(function (citation) {
      return "<li>" + escapeHTML(citation) + "</li>";
    }).join("");
    el.detailStories.innerHTML = SIDES.map(function (side) {
      return pair[side].voices.map(function (voice) {
        return '<div class="story-archive ' + side + '">' +
          '<div class="archive-head"><b>' + SIDE_LABEL[side] + "</b><span>" + escapeHTML(voice.tag) + "</span><span>" + escapeHTML(voice.place) + "</span></div>" +
          "<p>" + escapeHTML(voice.story) + "</p>" +
          "</div>";
      }).join("");
    }).join("");
    openModal("detailModal");
  }

  /* ---------------------------------------------------------
     弹层
     --------------------------------------------------------- */
  function focusable(panel) {
    return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', panel).filter(function (node) {
      return !node.disabled && node.offsetParent !== null;
    });
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    closeAllModals(true);
    state.lastFocus = document.activeElement;
    state.activeModal = id;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    const panel = $(".modal-panel", modal);
    setTimeout(function () {
      if (panel) panel.focus({ preventScroll: true });
    }, 40);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (state.activeModal === id) state.activeModal = null;
    if (!$$(".modal.is-open").length) document.body.classList.remove("modal-open");
    if (state.lastFocus && document.contains(state.lastFocus)) {
      try {
        state.lastFocus.focus({ preventScroll: true });
      } catch (error) {}
    }
    state.lastFocus = null;
  }

  function closeAllModals(silent) {
    $$(".modal.is-open").forEach(function (modal) {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
    });
    state.activeModal = null;
    if (!silent) document.body.classList.remove("modal-open");
  }

  function trapFocus(event) {
    if (!state.activeModal || event.key !== "Tab") return;
    const modal = document.getElementById(state.activeModal);
    const panel = modal ? $(".modal-panel", modal) : null;
    if (!panel) return;
    const nodes = focusable(panel);
    if (!nodes.length) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ---------------------------------------------------------
     同源卡
     --------------------------------------------------------- */
  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawSpaced(ctx, text, x, y, spacing, align) {
    const chars = String(text).split("");
    const widths = chars.map(function (char) { return ctx.measureText(char).width; });
    const total = widths.reduce(function (sum, width) { return sum + width; }, 0) + spacing * (chars.length - 1);
    let cursor = align === "center" ? x - total / 2 : x;
    ctx.save();
    ctx.textAlign = "left";
    chars.forEach(function (char, index) {
      ctx.fillText(char, cursor, y);
      cursor += widths[index] + spacing;
    });
    ctx.restore();
    return total;
  }

  function wrapCanvasText(ctx, text, maxWidth, maxLines) {
    const chars = String(text).split("");
    const lines = [];
    let line = "";
    chars.forEach(function (char) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        if (/[，。；、！？：”]/.test(char)) {
          lines.push(line + char);
          line = "";
        } else if (/[“「]$/.test(line) && line.length > 1) {
          const opener = line.slice(-1);
          lines.push(line.slice(0, -1));
          line = opener + char;
        } else {
          lines.push(line);
          line = char;
        }
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const clipped = lines.slice(0, maxLines);
      clipped[maxLines - 1] = clipped[maxLines - 1].replace(/[，。；、]$/, "") + "……";
      return clipped;
    }
    return lines;
  }

  function drawPoster() {
    const canvas = el.poster;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pair = currentPair();
    const side = state.activeSide || "mainland";
    const voice = pair[side].voices[state.voiceIndex[side]] || pair.mainland.voices[0];
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f4ecdd";
    ctx.fillRect(0, 0, W, H);

    let seed = 41;
    function random() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }
    ctx.save();
    for (let i = 0; i < 1500; i += 1) {
      const x = random() * W;
      const y = random() * H;
      ctx.fillStyle = random() > 0.5 ? "rgba(87, 64, 38, 0.045)" : "rgba(255, 255, 255, 0.42)";
      ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(32, 42, 39, 0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(56, 56, W - 112, H - 112);
    ctx.strokeStyle = "rgba(181, 135, 73, 0.28)";
    ctx.strokeRect(66, 66, W - 132, H - 132);

    // 顶部品牌
    ctx.save();
    ctx.translate(88, 92);
    ctx.rotate(-0.05);
    roundRect(ctx, 0, 0, 54, 54, 7);
    ctx.fillStyle = "#a63d31";
    ctx.fill();
    ctx.fillStyle = "#fbf7ee";
    ctx.font = '500 32px "Songti SC", "STSong", "SimSun", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("源", 27, 29);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#202a27";
    ctx.font = '500 42px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText("同源共响", 158, 112);
    ctx.fillStyle = "#68706a";
    ctx.font = '400 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("两岸同源词汇 · 声音叙事", 160, 148);
    ctx.textAlign = "right";
    ctx.fillStyle = "#8b8e84";
    ctx.font = '400 14px "SFMono-Regular", "Cascadia Code", monospace';
    ctx.fillText("SHARED ORIGIN / SHARED VOICE", W - 92, 116);

    ctx.strokeStyle = "rgba(32, 42, 39, 0.16)";
    ctx.beginPath();
    ctx.moveTo(88, 204);
    ctx.lineTo(W - 88, 204);
    ctx.stroke();

    // 词对
    ctx.textAlign = "center";
    ctx.fillStyle = "#68706a";
    ctx.font = '400 15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("大陆 · 普通话", 246, 286);
    ctx.fillText("台湾 · 国语", 834, 286);

    ctx.fillStyle = "#2e6a62";
    ctx.font = '500 98px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText(pair.mainland.display, 246, 408);
    ctx.fillStyle = "#a63d31";
    ctx.fillText(pair.taiwan.display, 834, 408);

    ctx.fillStyle = "#68706a";
    ctx.font = '400 19px "SFMono-Regular", "Cascadia Code", monospace';
    ctx.fillText(pair.mainland.pinyin, 246, 472);
    ctx.fillText(pair.taiwan.pinyin, 834, 472);

    // 共同源头
    ctx.fillStyle = "#8b8e84";
    ctx.font = '400 14px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("共同源头", 540, 276);
    ctx.save();
    ctx.translate(540, 390);
    ctx.strokeStyle = "rgba(181, 135, 73, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 94, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#a63d31";
    ctx.beginPath();
    ctx.arc(0, 0, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fbf7ee";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '500 58px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText(pair.sourceChar, 0, 2);
    ctx.restore();

    ctx.strokeStyle = "rgba(181, 135, 73, 0.34)";
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(354, 390);
    ctx.lineTo(452, 390);
    ctx.moveTo(628, 390);
    ctx.lineTo(726, 390);
    ctx.stroke();
    ctx.setLineDash([]);

    // 类型标签
    ctx.font = '500 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    const badgeWidth = ctx.measureText(pair.type).width + 40;
    roundRect(ctx, 540 - badgeWidth / 2, 510, badgeWidth, 36, 18);
    ctx.fillStyle = "rgba(255, 252, 244, 0.5)";
    ctx.fill();
    ctx.strokeStyle = pair.typeKey === "sound" ? "rgba(181, 135, 73, 0.45)" : pair.typeKey === "meaning" ? "rgba(166, 61, 49, 0.35)" : "rgba(46, 106, 98, 0.3)";
    ctx.stroke();
    ctx.fillStyle = pair.typeKey === "sound" ? "#b58749" : pair.typeKey === "meaning" ? "#a63d31" : "#2e6a62";
    ctx.textAlign = "center";
    ctx.fillText(pair.type, 540, 529);

    ctx.strokeStyle = "rgba(32, 42, 39, 0.14)";
    ctx.beginPath();
    ctx.moveTo(88, 590);
    ctx.lineTo(W - 88, 590);
    ctx.stroke();

    // 引语
    const quote = "“" + String(voice.quote).replace(/^[“”]+|[“”]+$/g, "") + "”";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(166, 61, 49, 0.13)";
    ctx.font = '600 128px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText("“", 94, 720);
    ctx.fillStyle = "#3c4843";
    ctx.font = '400 30px "Songti SC", "STSong", "SimSun", serif';
    ctx.textBaseline = "top";
    const lines = wrapCanvasText(ctx, quote, 820, 4);
    lines.forEach(function (line, index) {
      ctx.fillText(line, 146, 656 + index * 50);
    });
    const quoteBottom = 656 + lines.length * 50;
    ctx.fillStyle = "#68706a";
    ctx.font = '400 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText("— " + SIDE_LABEL[side] + " · " + voice.tag + " · " + voice.place, 146, quoteBottom + 18);

    // 一句词源
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#68706a";
    ctx.font = '400 19px "Songti SC", "STSong", "SimSun", serif';
    const noteLines = wrapCanvasText(ctx, pair.sourceNote, 780, 3);
    noteLines.forEach(function (line, index) {
      ctx.fillText(line, 540, 862 + index * 31);
    });

    // 同源说明
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#b58749";
    ctx.font = '400 16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(pair.shared, 540, 1002);
    ctx.fillStyle = "#202a27";
    ctx.font = '500 30px "Songti SC", "STSong", "SimSun", serif';
    drawSpaced(ctx, "同根 · 分流 · 汇流", 540, 1060, 7, "center");

    // 底部
    ctx.strokeStyle = "rgba(32, 42, 39, 0.14)";
    ctx.beginPath();
    ctx.moveTo(88, 1262);
    ctx.lineTo(W - 88, 1262);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#8b8e84";
    ctx.font = '400 14px "SFMono-Regular", "Cascadia Code", monospace';
    ctx.fillText("同源共响 · 互动 H5", 90, 1312);
    ctx.textAlign = "right";
    const displayHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(location.host) ? "SHARED ORIGIN" : (location.host || "SHARED ORIGIN");
    ctx.fillText(displayHost, W - 90, 1312);

    // 印章
    ctx.save();
    ctx.translate(906, 1140);
    ctx.rotate(-0.08);
    ctx.strokeStyle = "#a63d31";
    ctx.lineWidth = 3;
    ctx.strokeRect(-52, -52, 104, 104);
    ctx.strokeRect(-44, -44, 88, 88);
    ctx.fillStyle = "#a63d31";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '500 30px "Songti SC", "STSong", "SimSun", serif';
    ctx.fillText("同", 0, -22);
    ctx.fillText("源", 0, 22);
    ctx.restore();
  }

  function openShare() {
    stopAudio();
    stopCarousel(true);
    openModal("shareModal");
    state.lastFocus = el.shareBtn;
    requestAnimationFrame(function () {
      drawPoster();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (state.activeModal === "shareModal") drawPoster();
      });
    }
    el.shareBtn.classList.remove("is-nudge");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function posterFileName() {
    return "同源共响-" + currentPair().id + ".png";
  }

  function downloadPoster() {
    if (!el.poster) return;
    el.poster.toBlob(function (blob) {
      if (!blob) {
        showToast("图片生成失败，请重试。");
        return;
      }
      downloadBlob(blob, posterFileName());
      showToast("同源卡已保存到你的设备。");
    }, "image/png");
  }

  function pairUrl() {
    const base = location.href.split("#")[0];
    return base + "#" + currentPair().id;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        textarea.remove();
      }
    });
  }

  function copyLink() {
    copyText(pairUrl()).then(function () {
      showToast("链接已复制。");
    }).catch(function () {
      showToast("复制失败，请手动复制地址栏链接。");
    });
  }

  function shareNative() {
    if (!el.poster) return;
    const text = "一个词，两种口音，一条共同的来路。";
    const shareData = {
      title: "同源共响 · " + currentPair().mainland.display + " / " + currentPair().taiwan.display,
      text: text,
      url: pairUrl(),
    };
    if (!navigator.share) {
      showToast("当前浏览器不支持系统分享，请保存图片。");
      return;
    }
    el.poster.toBlob(function (blob) {
      const file = blob && typeof File !== "undefined" ? new File([blob], posterFileName(), { type: "image/png" }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: shareData.title, text: text }).catch(function () {});
      } else {
        navigator.share(shareData).catch(function () {});
      }
    }, "image/png");
  }

  /* ---------------------------------------------------------
     提示与事件
     --------------------------------------------------------- */
  function showToast(message) {
    if (!toastEl) return;
    clearTimeout(state.toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    state.toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2800);
  }

  function bindEvents() {
    el.startBtn.addEventListener("click", startExperience);
    el.brandHome.addEventListener("click", goHome);
    el.aboutBtn.addEventListener("click", function () {
      stopAudio();
      stopCarousel(true);
      openModal("aboutModal");
    });
    el.introDetailBtn.addEventListener("click", openDetail);
    el.soundToggle.addEventListener("click", function () {
      setMuted(!state.muted);
    });
    el.prevPair.addEventListener("click", function () {
      applyPair(state.pairIndex - 1);
    });
    el.nextPair.addEventListener("click", function () {
      applyPair(state.pairIndex + 1);
    });
    el.cardMainland.addEventListener("click", function () {
      playSide("mainland");
    });
    el.cardTaiwan.addEventListener("click", function () {
      playSide("taiwan");
    });
    $$(".voice-cycle").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        cycleVoice(button.dataset.voiceSide);
      });
    });
    $$("[data-detail-side]").forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        openDetail();
      });
    });
    el.listenOtherBtn.addEventListener("click", listenOther);
    el.detailBtn.addEventListener("click", openDetail);
    el.carouselBtn.addEventListener("click", toggleCarousel);
    el.shareBtn.addEventListener("click", openShare);
    el.detailShare.addEventListener("click", function () {
      closeAllModals(true);
      openShare();
    });
    el.buildBtn.addEventListener("click", function () {
      closeAllModals(true);
      openModal("buildModal");
    });
    el.buildNotify.addEventListener("click", function () {
      try {
        localStorage.setItem("same-origin-build-intent", new Date().toISOString());
      } catch (error) {}
      showToast("已记下你的共建意向。演示版不收集个人信息。");
      closeModal("buildModal");
    });
    el.dockSwitch.addEventListener("click", function () {
      cycleVoice(state.activeSide || "mainland");
    });
    el.dockOther.addEventListener("click", listenOther);
    el.dockDetail.addEventListener("click", openDetail);
    el.downloadPoster.addEventListener("click", downloadPoster);
    el.shareNative.addEventListener("click", shareNative);
    el.copyLink.addEventListener("click", copyLink);

    el.pairList.addEventListener("click", function (event) {
      const chip = event.target.closest(".pair-chip");
      if (!chip) return;
      const index = Number(chip.dataset.index);
      if (Number.isNaN(index) || index === state.pairIndex) return;
      applyPair(index);
    });
    el.pairList.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const next = (state.pairIndex + delta + DATA.pairs.length) % DATA.pairs.length;
      applyPair(next);
      const chip = $('.pair-chip[data-index="' + next + '"]', el.pairList);
      if (chip) chip.focus();
    });

    document.addEventListener("click", function (event) {
      const close = event.target.closest("[data-close]");
      if (close) closeModal(close.dataset.close);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.activeModal) {
        closeModal(state.activeModal);
        return;
      }
      trapFocus(event);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopAudio();
        stopCarousel(true);
      }
    });
    window.addEventListener("hashchange", function () {
      const id = location.hash.replace("#", "");
      const index = DATA.pairs.findIndex(function (pair) { return pair.id === id; });
      if (index >= 0 && index !== state.pairIndex) {
        applyPair(index, { silentHash: true });
        if (!state.started) {
          showToast("已载入「" + DATA.pairs[index].mainland.display + " / " + DATA.pairs[index].taiwan.display + "」");
        }
      }
    });
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = function () {
        try {
          state.voices = window.speechSynthesis.getVoices();
        } catch (error) {}
      };
    }
  }

  /* ---------------------------------------------------------
     背景粒子
     --------------------------------------------------------- */
  function initAmbient() {
    const canvas = document.getElementById("ambient");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const colors = ["rgba(46,106,98,", "rgba(166,61,49,", "rgba(181,135,73,"];
    state.ambientParticles = Array.from({ length: 38 }, function (_, index) {
      return {
        x: Math.random(),
        y: Math.random(),
        radius: 0.6 + Math.random() * 1.7,
        speed: 0.004 + Math.random() * 0.012,
        phase: Math.random() * Math.PI * 2,
        color: colors[index % colors.length],
        alpha: 0.16 + Math.random() * 0.24,
      };
    });
    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      state.ambientSize.w = window.innerWidth;
      state.ambientSize.h = window.innerHeight;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function draw(time) {
      const w = state.ambientSize.w;
      const h = state.ambientSize.h;
      ctx.clearRect(0, 0, w, h);
      state.ambientParticles.forEach(function (particle, index) {
        const drift = (time * particle.speed + particle.phase) % (Math.PI * 2);
        const x = ((particle.x + Math.sin(drift) * 0.035) % 1) * w;
        const y = ((particle.y - (time * particle.speed * 0.018) + 1) % 1) * h;
        ctx.beginPath();
        ctx.fillStyle = particle.color + particle.alpha + ")";
        ctx.arc(x, y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
        if (index % 7 === 0) {
          ctx.beginPath();
          ctx.strokeStyle = particle.color + "0.05)";
          ctx.arc(x, y, particle.radius * 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
      if (!reducedMotion) state.ambientFrame = requestAnimationFrame(draw);
    }
    resize();
    window.addEventListener("resize", resize);
    if (reducedMotion) {
      draw(0);
    } else {
      state.ambientFrame = requestAnimationFrame(draw);
    }
  }

  /* ---------------------------------------------------------
     初始化
     --------------------------------------------------------- */
  function init() {
    cacheElements();
    renderPairList();
    const hash = location.hash.replace("#", "");
    const initialIndex = DATA.pairs.findIndex(function (pair) { return pair.id === hash; });
    state.pendingHash = initialIndex >= 0;
    state.pairIndex = initialIndex >= 0 ? initialIndex : 0;
    applyPair(state.pairIndex, { silentHash: initialIndex < 0, keepLive: true });
    bindEvents();
    initAmbient();
    document.title = DATA.title + " · " + DATA.subtitle;
    if (initialIndex >= 0) {
      el.startBtn.querySelector("span").textContent = "继续聆听";
    }

    const params = new URLSearchParams(location.search);
    if (params.get("start") === "1") {
      startExperience();
    }
    if (params.get("preview") === "detail") {
      setTimeout(openDetail, 500);
    }
    if (params.get("preview") === "merged") {
      startExperience();
      setTimeout(function () {
        playSide("mainland", { silent: true });
        setTimeout(function () {
          playSide("taiwan", { silent: true });
          setTimeout(mergeStage, 250);
        }, 300);
      }, 650);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

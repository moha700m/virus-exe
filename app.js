/* ================= VIRUS.EXE engine ================= */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var stage = $("#stage");
  var startBtn = $("#startBtn"), startBtn2 = $("#startBtn2");
  var shell = $("#shell");
  var termBody = $("#termBody");
  var loaderWin = $("#loaderWin");
  var telemetry = $("#telemetry");
  var popLayer = $("#popLayer");
  var cracks = $("#cracks");
  var bsod = $("#bsod");
  var poweroff = $("#poweroff");
  var reboot = $("#reboot");
  var timers = [], intervals = [], running = false, soundOn = true, audio = null;

  $("#year").textContent = new Date().getFullYear();

  /* ---------------- Matrix rain ---------------- */
  function rain() {
    var c = $("#matrix");
    if (!c) return;
    var ctx = c.getContext("2d"), cols = 0, drops = [], chars = "01AB#%-+<>/=\u0623\u0628\u062A";
    function size() {
      c.width = c.offsetWidth; c.height = c.offsetHeight;
      cols = Math.floor(c.width / 16);
      drops = [];
      for (var i = 0; i < cols; i++) drops[i] = Math.random() * -50;
    }
    size();
    window.addEventListener("resize", size);
    setInterval(function () {
      ctx.fillStyle = "rgba(5,6,10,0.09)";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = "14px monospace";
      for (var i = 0; i < cols; i++) {
        var t = chars.charAt(Math.floor(Math.random() * chars.length));
        ctx.fillStyle = Math.random() > .96 ? "#baffdf" : "#1f8f60";
        ctx.fillText(t, i * 16, drops[i] * 16);
        if (drops[i] * 16 > c.height && Math.random() > .975) drops[i] = 0;
        drops[i]++;
      }
    }, 70);
  }
  rain();

  /* ---------------- Audio ---------------- */
  function ensureAudio() {
    if (audio) return audio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audio = new AC(); } catch (e) { audio = null; }
    return audio;
  }
  function beep(freq, dur, type, gain, slideTo) {
    if (!soundOn) return;
    var ac = ensureAudio(); if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
    g.gain.value = gain == null ? .05 : gain;
    g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur + .02);
  }
  function noise(dur, gain) {
    if (!soundOn) return;
    var ac = ensureAudio(); if (!ac) return;
    var n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ac.createBufferSource(); src.buffer = buf;
    var g = ac.createGain(); g.gain.value = gain || .12;
    src.connect(g); g.connect(ac.destination); src.start();
  }
  var fanOsc = null, fanGain = null;
  function fanStart() {
    if (!soundOn) return;
    var ac = ensureAudio(); if (!ac) return;
    if (ac.state === "suspended") ac.resume();
    if (fanOsc) return;
    fanOsc = ac.createOscillator(); fanGain = ac.createGain();
    fanOsc.type = "sawtooth"; fanOsc.frequency.value = 58;
    fanGain.gain.value = .022;
    var lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 620;
    fanOsc.connect(lp); lp.connect(fanGain); fanGain.connect(ac.destination); fanOsc.start();
  }
  function fanTo(v) { if (fanOsc) fanOsc.frequency.setTargetAtTime(v, audio.currentTime, .3); }
  function fanStop() {
    if (!fanOsc) return;
    try { fanGain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .6); fanOsc.stop(audio.currentTime + .7); } catch (e) {}
    fanOsc = null;
  }
  $("#soundToggle").addEventListener("click", function () {
    soundOn = !soundOn;
    this.setAttribute("aria-pressed", String(soundOn));
    if (soundOn) { beep(660, .08, "sine", .06); fanStart(); } else { fanStop(); }
  });

  /* ---------------- Terminal ---------------- */
  var cur = null;
  function line(txt, cls) {
    if (cur) cur.parentNode.removeChild(cur);
    var d = document.createElement("div");
    d.className = "ln " + (cls || "");
    d.textContent = txt;
    termBody.appendChild(d);
    while (termBody.children.length > 11) termBody.removeChild(termBody.firstChild);
    cur = document.createElement("span");
    cur.className = "cursor";
    cur.textContent = " ";
    if (termBody.lastChild) termBody.lastChild.appendChild(cur);
    termBody.scrollTop = termBody.scrollHeight;
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function every(fn, ms) { var id = setInterval(fn, ms); intervals.push(id); return id; }

  /* ---------------- Telemetry ---------------- */
  var T = { temp: 42, cpu: 7, ram: 18, fan: 1200, disk: 100 };
  function paint() {
    $("#vTemp").textContent = Math.round(T.temp);
    $("#vCpu").textContent = Math.round(T.cpu);
    $("#vRam").textContent = Math.round(T.ram);
    $("#vFan").textContent = Math.round(T.fan);
    $("#vDisk").textContent = Math.round(T.disk);
    $("#bTemp").style.width = Math.min(100, T.temp / 1.25) + "%";
    $("#bCpu").style.width = Math.min(100, T.cpu) + "%";
    $("#bRam").style.width = Math.min(100, T.ram) + "%";
    $("#bFan").style.width = Math.min(100, T.fan / 60) + "%";
    $("#bDisk").style.width = Math.max(0, T.disk) + "%";
    document.querySelectorAll(".tel")[0].classList.toggle("hot", T.temp > 95);
    document.querySelectorAll(".tel")[3].classList.toggle("hot", T.fan > 4200);
    fanTo(40 + T.fan / 34);
  }

  /* ---------------- Popups ---------------- */
  var POPUPS = [
    ["\u26a0\ufe0f", "Windows — تحذير", "المعالج وصل حرارة حرجة. تم تخفيض الأداء مؤقتًا.", "warn"],
    ["\ud83d\udcbe", "أخطاء قراءة", "تعذرت قراءة قطاعات من القرص C: — جاري إعادة المحاولة.", "warn"],
    ["\ud83e\udde0", "نقص موارد", "الذاكرة ممتلئة بنسبة 97%، بدأ تبديل على القرص."],
    ["\ud83c\udf21\ufe0f", "المراوح", "فشل مستشعر المروحة #2، السرعة غير مستقرة.", "warn"],
    ["\u26a1", "انقطاع داخلي", "جهد التغذية خارج النطاق الآمن (11.4V).", "warn"],
    ["\ud83d\udcbb", "برنامج التشغيل", "توقف استجابة مشغل العرض، استعادة تلقائية…"]
  ];
  function popup() {
    var p = POPUPS[Math.floor(Math.random() * POPUPS.length)];
    var el = document.createElement("div");
    el.className = "pop " + (p[3] || "");
    el.style.top = (6 + Math.random() * 58) + "%";
    el.style.left = (4 + Math.random() * 48) + "%";
    el.innerHTML = '<div class="pbar"><span>' + (p[1] || "") + '</span><span>\u00d7</span></div>' +
      '<div class="pbody"><span class="pico">' + p[0] + '</span><span>' + p[2] + '</span></div>' +
      '<div class="pbtns"><span class="pbtn">لاحقًا</span><span class="pbtn pri">موافق</span></div>';
    popLayer.appendChild(el);
    beep(880, .05, "square", .04);
    later(function () { el.style.transition = "opacity .4s"; el.style.opacity = "0"; later(function () { el.remove(); }, 420); }, 2600 + Math.random() * 1400);
  }

  /* ---------------- Cracks ---------------- */
  function drawCracks() {
    var w = window.innerWidth, h = window.innerHeight;
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    var cx = w * (.35 + Math.random() * .3), cy = h * (.35 + Math.random() * .3);
    for (var i = 0; i < 12; i++) {
      var a = (Math.PI * 2 / 12) * i + Math.random() * .5;
      var len = Math.max(w, h) * (.35 + Math.random() * .55);
      var p = document.createElementNS(ns, "path");
      var x1 = cx, y1 = cy, d = "M" + cx + " " + cy;
      for (var s = 1; s <= 4; s++) {
        var r = len * (s / 4);
        x1 = cx + Math.cos(a + (Math.random() - .5) * .35) * r;
        y1 = cy + Math.sin(a + (Math.random() - .5) * .35) * r;
        d += " L" + x1.toFixed(0) + " " + y1.toFixed(0);
      }
      p.setAttribute("d", d);
      p.setAttribute("stroke-width", (1 + Math.random() * 1.8).toFixed(1));
      var total = Math.max(w, h);
      p.style.strokeDasharray = total; p.style.strokeDashoffset = total;
      p.style.transition = "stroke-dashoffset .5s ease-out";
      svg.appendChild(p);
      (function (node) { later(function () { node.style.strokeDashoffset = "0"; }, i * 55); })(p);
    }
    cracks.appendChild(svg);
    noise(.24, .16);
  }

  /* ---------------- QR وهمي ---------------- */
  function fakeQR() {
    var n = 21, path = $("#qrPath"), d = "";
    function finder(x, y) {
      d += "M" + x + " " + y + "h7v7h-7z";
      d += "M" + (x + 1) + " " + (y + 1) + "v5h5v-5z";
      d += "M" + (x + 2) + " " + (y + 2) + "h3v3h-3z";
    }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if ((x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9)) continue;
      if (Math.random() > .48) d += "M" + x + " " + y + "h1v1h-1z";
    }
    path.setAttribute("d", d);
  }

  /* ---------------- التسلسل ---------------- */
  function reset() {
    timers.forEach(clearTimeout); intervals.forEach(clearInterval);
    timers = []; intervals = []; cur = null;
    termBody.innerHTML = ""; popLayer.innerHTML = ""; cracks.innerHTML = "";
    T = { temp: 42, cpu: 7, ram: 18, fan: 1200, disk: 100 };
    paint();
    bsod.hidden = true; poweroff.hidden = true; reboot.hidden = true; loaderWin.hidden = false;
    $("#dlFill").style.width = "0%"; $("#dlPct").textContent = "0%"; $("#dlSize").textContent = "0.0";
    document.body.classList.remove("shake", "hue");
    stage.style.filter = "";
  }

  function exit() {
    running = false;
    timers.forEach(clearTimeout); intervals.forEach(clearInterval);
    timers = []; intervals = [];
    stage.hidden = true; shell.hidden = false;
    document.body.classList.remove("shake", "hue");
    document.body.style.cursor = "";
    fanStop();
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    window.scrollTo(0, 0);
  }

  function start() {
    if (running) return;
    running = true;
    reset();
    shell.hidden = true; stage.hidden = false;
    document.body.style.cursor = "none";
    fakeQR();
    var el = document.documentElement;
    var fs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (fs) { try { fs.call(el).catch(function () {}); } catch (e) {} }
    if (soundOn) { ensureAudio(); beep(160, .18, "sawtooth", .07); fanStart(); }

    /* 1) التحميل */
    var pct = 0, size = 0;
    var dl = every(function () {
      pct = Math.min(100, pct + 3 + Math.random() * 9);
      size = Math.min(4.2, size + 4.2 * .07);
      $("#dlFill").style.width = pct + "%";
      $("#dlPct").textContent = Math.round(pct) + "%";
      $("#dlSize").textContent = size.toFixed(1);
      $("#dlSpeed").textContent = Math.round(220 + Math.random() * 640) + " كيلوبايت/ث";
      if (pct >= 100) {
        clearInterval(dl);
        $("#dlSpeed").textContent = "مكتمل";
        later(function () { loaderWin.style.transition = "opacity .3s"; loaderWin.style.opacity = "0"; later(function () { loaderWin.hidden = true; }, 320); }, 380);
      }
    }, 130);

    /* 2) طرفية */
    var script = [
      ["C:\\Users\\you\\Downloads> virus.exe", "dim"],
      ["[+] تهيئة المحاكي…", "ok"],
      ["[+] الاتصال بوحدة التحكم بالعتاد (SMBIOS)", "ok"],
      ["[i] المعالج: 8 أنوية · الذاكرة: 16 جيجا", "dim"],
      ["[+] بدء قراءة الحرارة والجهد…", "ok"],
      ["[!] الحرارة: 68C — تصعيد ترددات", "warn"],
      ["[!] المروحة تحت الحمل: 3900 RPM", "warn"],
      ["[x] تجاوز حد الجهد الآمن", "bad"],
      ["[x] فشل اختبار قطاعات القرص C:", "bad"],
      ["[!] الحرارة: 96C — خطر", "bad"],
      ["[x] توقف مؤشر المروحة #2", "bad"],
      ["[!] 111C — طمر حراري وشيك", "bad"],
      ["[x] فقدان اتصال بأرصفة الذاكرة", "bad"],
      ["[!] الكتابة على القرص... تعذر", "bad"],
      ["[!!] HARDWARE_OVERHEAT_FATAL", "bad"]
    ];
    script.forEach(function (l, i) { later(function () { line(l[0], l[1]); beep(300 + i * 22, .03, "square", .022); }, 420 + i * 640); });

    /* 3) القياسات */
    later(function () {
      var t = every(function () {
        T.temp = Math.min(124, T.temp + 1.6 + Math.random() * 3.4);
        T.cpu = Math.min(100, T.cpu + 3 + Math.random() * 7);
        T.ram = Math.min(99, T.ram + 3.2 + Math.random() * 5);
        T.fan = Math.min(5400, T.fan + 120 + Math.random() * 320);
        T.disk = Math.max(0, T.disk - .7 - Math.random() * 2.2);
        paint();
      }, 210);

      /* نوافذ وأصوات */
      later(function () { popup(); }, 1600);
      every(function () { popup(); }, 1900);
      later(function () { document.body.classList.add("shake"); }, 5200);
      later(function () { noise(.5, .1); }, 6400);
      later(function () { document.body.classList.add("hue"); }, 8000);
      later(function () { drawCracks(); }, 8600);
      later(function () { drawCracks(); }, 10800);
      later(function () { stage.style.filter = "blur(.6px) saturate(1.7) contrast(1.15)"; }, 11200);
    }, 2400);

    /* 4) الموت */
    later(function () {
      intervals.forEach(clearInterval); intervals = [];
      popLayer.innerHTML = "";
      document.body.classList.remove("shake", "hue");
      stage.style.filter = "";
      stage.style.background = "#0572c9";
      fanTo(6000);
      bsod.hidden = false;
      beep(90, .6, "sine", .12, 40);
      var p = 0;
      var q = every(function () {
        p = Math.min(100, p + 1 + Math.random() * 3);
        $("#bsodPct").textContent = Math.round(p);
        if (p >= 100) {
          clearInterval(q);
          later(function () {
            fanStop();
            poweroff.hidden = false;
            noise(.9, .18);
            later(function () { bsod.hidden = true; }, 1200);
            later(function () {
              poweroff.hidden = true;
              document.body.style.cursor = "";
              reboot.hidden = false;
              stage.style.background = "#05070c";
              beep(520, .08, "sine", .05);
            }, 2600);
          }, 900);
        }
      }, 105);
    }, 13600);
  }

  /* ---------------- أحداث ---------------- */
  startBtn.addEventListener("click", start);
  startBtn2.addEventListener("click", start);
  $("#againBtn").addEventListener("click", function () { running = false; start(); });
  $("#backBtn").addEventListener("click", exit);
  $("#exitHint").addEventListener("click", exit);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && running) exit();
  });
  var lastTap = 0;
  stage.addEventListener("click", function (e) {
    if (e.target.closest("button")) return;
    var now = Date.now();
    if (now - lastTap < 400 && running) { lastTap = 0; exit(); return; }
    lastTap = now;
  });

  paint();
})();

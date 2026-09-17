/* Streakly - vanilla habit tracker */
(function () {
  "use strict";

  var STORE_KEY = "streakly.habits.v2";
  var PALETTE = ["#7c5cff", "#22d3ee", "#f472b6", "#34d399", "#f59e0b"];
  var REMEMBER_KEY = "streakly.accent";

  var grid = document.getElementById("habit-grid");
  var emptyState = document.getElementById("empty-state");
  var form = document.getElementById("habit-form");
  var input = document.getElementById("habit-input");
  var swatchBox = document.getElementById("swatches");
  var todayLabel = document.getElementById("today-label");

  var accent = localStorage.getItem(REMEMBER_KEY) || PALETTE[0];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function keyOf(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function todayKey() { return keyOf(new Date()); }

  function shiftDays(days) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d;
  }

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch (err) {
      return [];
    }
  }

  function save(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (err) { /* storage blocked */ }
  }

  function streakOf(days) {
    var cursor = days[todayKey()] ? 0 : -1;
    var streak = 0;
    while (days[keyOf(shiftDays(cursor))]) {
      streak += 1;
      cursor -= 1;
    }
    return streak;
  }

  function weekRate(days) {
    var hit = 0;
    for (var i = 0; i < 7; i += 1) {
      if (days[keyOf(shiftDays(-i))]) { hit += 1; }
    }
    return Math.round((hit / 7) * 100);
  }

  function buildSwatches() {
    swatchBox.innerHTML = "";
    PALETTE.forEach(function (color) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.style.background = color;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", "Accent colour " + color);
      b.setAttribute("aria-checked", color === accent ? "true" : "false");
      b.addEventListener("click", function () {
        accent = color;
        localStorage.setItem(REMEMBER_KEY, color);
        buildSwatches();
      });
      swatchBox.appendChild(b);
    });
  }

  function makeHabitNode(habit, index) {
    var card = document.createElement("article");
    card.className = "habit";
    card.style.setProperty("--accent", habit.color);
    card.style.animationDelay = (index * 45) + "ms";

    var days = habit.days || {};
    var streak = streakOf(days);
    var rate = weekRate(days);
    var doneToday = Boolean(days[todayKey()]);

    var top = document.createElement("div");
    top.className = "habit-top";

    var circumference = 2 * Math.PI * 22;
    var offset = circumference - (rate / 100) * circumference;
    top.innerHTML =
      '<svg class="ring" viewBox="0 0 54 54" aria-hidden="true">' +
      '<circle class="track" cx="27" cy="27" r="22"></circle>' +
      '<circle class="value" cx="27" cy="27" r="22" stroke-dasharray="' + circumference.toFixed(1) +
      '" stroke-dashoffset="' + offset.toFixed(1) + '"></circle>' +
      "</svg>";

    var meta = document.createElement("div");
    meta.className = "habit-meta";
    var name = document.createElement("h3");
    name.className = "habit-name";
    name.textContent = habit.name;
    var sub = document.createElement("p");
    sub.className = "habit-sub";
    sub.textContent = rate + "% this week";
    meta.appendChild(name);
    meta.appendChild(sub);

    var del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn";
    del.textContent = "x";
    del.setAttribute("aria-label", "Delete habit " + habit.name);
    del.addEventListener("click", function () {
      save(load().filter(function (h) { return h.id !== habit.id; }));
      render();
    });

    top.appendChild(meta);
    top.appendChild(del);
    card.appendChild(top);

    var heat = document.createElement("div");
    heat.className = "heatmap";
    heat.setAttribute("aria-label", "Last five weeks for " + habit.name);
    for (var i = 34; i >= 0; i -= 1) {
      var cell = document.createElement("span");
      var k = keyOf(shiftDays(-i));
      cell.className = "cell" + (days[k] ? " on" : "");
      cell.title = k + (days[k] ? " complete" : " missed");
      heat.appendChild(cell);
    }
    card.appendChild(heat);

    var actions = document.createElement("div");
    actions.className = "habit-actions";

    var mark = document.createElement("button");
    mark.type = "button";
    mark.className = "mark-btn" + (doneToday ? " done" : "");
    mark.textContent = doneToday ? "Done today" : "Mark today";
    mark.setAttribute("aria-pressed", doneToday ? "true" : "false");
    mark.addEventListener("click", function () { toggle(habit.id); });

    var chip = document.createElement("span");
    chip.className = "streak-chip";
    chip.textContent = streak > 0 ? streak + " day streak" : "no streak yet";

    actions.appendChild(mark);
    actions.appendChild(chip);
    card.appendChild(actions);

    return card;
  }

  function toggle(id) {
    var t = todayKey();
    var list = load();
    list.forEach(function (h) {
      if (h.id !== id) { return; }
      h.days = h.days || {};
      if (h.days[t]) { delete h.days[t]; } else { h.days[t] = true; }
    });
    save(list);
    render();
  }

  function seedDays(run, gap) {
    var out = {};
    for (var i = gap; i < gap + run; i += 1) { out[keyOf(shiftDays(-i))] = true; }
    return out;
  }

  function render() {
    var list = load();
    grid.innerHTML = "";

    if (!list.length) {
      emptyState.classList.remove("hide");
    } else {
      emptyState.classList.add("hide");
      list.forEach(function (habit, i) { grid.appendChild(makeHabitNode(habit, i)); });
    }

    var totalChecks = 0;
    var best = 0;
    var doneTodayCount = 0;
    var hits = 0;
    var slots = 0;

    list.forEach(function (h) {
      var days = h.days || {};
      totalChecks += Object.keys(days).length;
      var s = streakOf(days);
      if (s > best) { best = s; }
      if (days[todayKey()]) { doneTodayCount += 1; }
      for (var i = 0; i < 7; i += 1) {
        slots += 1;
        if (days[keyOf(shiftDays(-i))]) { hits += 1; }
      }
    });

    var day = todayKey();
    var perfect = 0;
    if (list.length) {
      for (var i = 0; i < 35; i += 1) {
        var k = keyOf(shiftDays(-i));
        var all = true;
        for (var j = 0; j < list.length; j += 1) {
          if (!(list[j].days || {})[k]) { all = false; break; }
        }
        if (all) { perfect += 1; }
      }
    }

    var todayPct = list.length ? Math.round((doneTodayCount / list.length) * 100) : 0;
    var rate = slots ? Math.round((hits / slots) * 100) : 0;

    document.getElementById("stat-habits").textContent = String(list.length);
    document.getElementById("stat-best").textContent = String(best);
    document.getElementById("stat-today").textContent = todayPct + "%";

    setInsight("insight-rate", rate + "%", "bar-rate", rate);
    setInsight("insight-perfect", String(perfect), "bar-perfect", Math.min(100, perfect * 10));
    setInsight("insight-total", String(totalChecks), "bar-total", Math.min(100, totalChecks * 2));

    var pretty = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    todayLabel.textContent = pretty + " - " + doneTodayCount + " of " + list.length + " complete";
    void day;
  }

  function setInsight(valueId, text, barId, pct) {
    document.getElementById(valueId).textContent = text;
    document.getElementById(barId).style.width = Math.max(0, Math.min(100, pct)) + "%";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = input.value.trim();
    if (!value) { return; }
    var list = load();
    list.push({
      id: "h" + Date.now() + Math.random().toString(16).slice(2, 6),
      name: value,
      color: accent,
      days: {}
    });
    save(list);
    input.value = "";
    render();
  });

  if (!localStorage.getItem(STORE_KEY)) {
    save([
      { id: "seed1", name: "Drink 3L water", color: PALETTE[1], days: seedDays(6, 0) },
      { id: "seed2", name: "Deep work 90 min", color: PALETTE[0], days: seedDays(4, 2) },
      { id: "seed3", name: "Evening walk", color: PALETTE[3], days: seedDays(3, 5) }
    ]);
  }

  buildSwatches();
  render();
})();

const taskForm = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const filterCategory = document.getElementById("filterCategory");
const filterStatus = document.getElementById("filterStatus");
const summaryProgress = document.getElementById("summaryProgress");
const summaryOverdue = document.getElementById("summaryOverdue");
const summaryReview = document.getElementById("summaryReview");
const taskRowTemplate = document.getElementById("taskRowTemplate");
const setupForm = document.getElementById("setupForm");
const setupMessage = document.getElementById("setupMessage");

const storageKey = "closing-tasks";

const defaultTasks = [
  {
    id: crypto.randomUUID(),
    title: "残高試算表の確定",
    category: "月次",
    owner: "経理部 佐藤",
    due: getDateOffset(2),
    priority: "高",
    status: "進行中",
    note: "各部門からの証憑を確認中",
  },
  {
    id: crypto.randomUUID(),
    title: "固定資産の減価償却計算",
    category: "年次",
    owner: "経理部 山田",
    due: getDateOffset(7),
    priority: "中",
    status: "未着手",
    note: "資料は総務から入手",
  },
  {
    id: crypto.randomUUID(),
    title: "監査法人への質問回答",
    category: "監査対応",
    owner: "経理部 鈴木",
    due: getDateOffset(-1),
    priority: "高",
    status: "要レビュー",
    note: "回答内容を部長確認待ち",
  },
];

let tasks = loadTasks();

function getDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function loadTasks() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    localStorage.setItem(storageKey, JSON.stringify(defaultTasks));
    return [...defaultTasks];
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("タスクの読み込みに失敗しました", error);
    return [...defaultTasks];
  }
}

function saveTasks() {
  localStorage.setItem(storageKey, JSON.stringify(tasks));
}

function formatPriority(priority) {
  const classMap = {
    高: "badge--alert",
    中: "badge--warning",
    低: "badge--ok",
  };
  return `<span class="badge ${classMap[priority] || "badge--ok"}">${priority}</span>`;
}

function formatStatus(status, dueDate) {
  const isOverdue = isPastDue(dueDate) && status !== "完了";
  if (isOverdue) {
    return '<span class="badge badge--alert">期限超過</span>';
  }
  if (status === "完了") {
    return '<span class="badge badge--ok">完了</span>';
  }
  if (status === "要レビュー") {
    return '<span class="badge badge--warning">要レビュー</span>';
  }
  return `<span class="badge">${status}</span>`;
}

function isPastDue(due) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(due) < today;
}

function renderTasks() {
  taskList.innerHTML = "";
  const filteredTasks = tasks.filter((task) => {
    const categoryMatch =
      filterCategory.value === "all" || task.category === filterCategory.value;
    const statusMatch =
      filterStatus.value === "all" || task.status === filterStatus.value;
    return categoryMatch && statusMatch;
  });

  filteredTasks.forEach((task) => {
    const row = taskRowTemplate.content.cloneNode(true);
    row.querySelector(".cell--title").textContent = task.title;
    row.querySelector(".cell--category").textContent = task.category;
    row.querySelector(".cell--owner").textContent = task.owner;
    row.querySelector(".cell--due").textContent = task.due;
    row.querySelector(".cell--priority").innerHTML = formatPriority(task.priority);
    row.querySelector(".cell--status").innerHTML = formatStatus(task.status, task.due);

    const actions = row.querySelector(".cell--actions");
    actions.querySelector('[data-action="toggle"]').textContent =
      task.status === "完了" ? "未完了に戻す" : "完了にする";
    actions.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const action = target.dataset.action;
      if (action === "toggle") {
        toggleTask(task.id);
      }
      if (action === "delete") {
        deleteTask(task.id);
      }
    });

    taskList.appendChild(row);
  });

  updateSummary();
}

function updateSummary() {
  if (tasks.length === 0) {
    summaryProgress.textContent = "0%";
    summaryOverdue.textContent = "0件";
    summaryReview.textContent = "0件";
    return;
  }

  const completed = tasks.filter((task) => task.status === "完了").length;
  const overdue = tasks.filter((task) => isPastDue(task.due) && task.status !== "完了").length;
  const review = tasks.filter((task) => task.status === "要レビュー").length;

  summaryProgress.textContent = `${Math.round((completed / tasks.length) * 100)}%`;
  summaryOverdue.textContent = `${overdue}件`;
  summaryReview.textContent = `${review}件`;
}

function createTask({
  title,
  category,
  owner,
  dueOffset,
  priority = "中",
  status = "未着手",
  note,
}) {
  return {
    id: crypto.randomUUID(),
    title,
    category,
    owner,
    due: getDateOffset(dueOffset),
    priority,
    status,
    note,
  };
}

function shouldInclude(scope, target) {
  if (scope === "フル") {
    return true;
  }
  return scope === target;
}

function buildTasksFromAnswers({ fiscalMonth, taxStatus, closingScope, audit, owner }) {
  const baseNote = `決算月: ${fiscalMonth}月 / 消費税区分: ${taxStatus}`;
  const taskOwner = owner.trim() === "" ? "未設定" : owner.trim();
  const generated = [];

  if (shouldInclude(closingScope, "月次")) {
    generated.push(
      createTask({
        title: "月次締め仕訳の確認",
        category: "月次",
        owner: taskOwner,
        dueOffset: 7,
        priority: "高",
        note: `${baseNote} / 月次締めの証憑回収を確認`,
      }),
      createTask({
        title: "売掛・買掛残高の突合",
        category: "月次",
        owner: taskOwner,
        dueOffset: 9,
        priority: "中",
        note: `${baseNote} / 請求書と入金の差異を確認`,
      })
    );
  }

  if (shouldInclude(closingScope, "四半期")) {
    generated.push(
      createTask({
        title: "四半期決算レビュー資料の作成",
        category: "四半期",
        owner: taskOwner,
        dueOffset: 14,
        priority: "中",
        note: `${baseNote} / 管理資料をまとめる`,
      }),
      createTask({
        title: "四半期の予実差異分析",
        category: "四半期",
        owner: taskOwner,
        dueOffset: 16,
        priority: "中",
        note: `${baseNote} / 主要科目の差異要因を記載`,
      })
    );
  }

  if (shouldInclude(closingScope, "年次")) {
    generated.push(
      createTask({
        title: "決算整理仕訳の計上",
        category: "年次",
        owner: taskOwner,
        dueOffset: 25,
        priority: "高",
        note: `${baseNote} / 未払費用・引当金の検討`,
      }),
      createTask({
        title: "決算報告書・注記の作成",
        category: "年次",
        owner: taskOwner,
        dueOffset: 28,
        priority: "高",
        note: `${baseNote} / 事業報告のドラフト作成`,
      }),
      createTask({
        title: "法人税申告書のドラフト作成",
        category: "年次",
        owner: taskOwner,
        dueOffset: 30,
        priority: "高",
        note: `${baseNote} / 税理士との確認事項を整理`,
      })
    );
  }

  if (taxStatus !== "免税事業者") {
    generated.push(
      createTask({
        title: "消費税申告の資料準備",
        category: "年次",
        owner: taskOwner,
        dueOffset: 27,
        priority: "中",
        note: `${baseNote} / 課税売上と仕入税額控除の確認`,
      })
    );
  }

  if (audit === "あり") {
    generated.push(
      createTask({
        title: "監査法人からの質問対応",
        category: "監査対応",
        owner: taskOwner,
        dueOffset: 20,
        priority: "高",
        note: `${baseNote} / 資料の準備と回答整理`,
      })
    );
  }

  return generated;
}

function handleSetupSubmit(event) {
  event.preventDefault();
  const formData = new FormData(setupForm);
  const answers = {
    fiscalMonth: formData.get("fiscalMonth").toString(),
    taxStatus: formData.get("taxStatus").toString(),
    closingScope: formData.get("closingScope").toString(),
    audit: formData.get("audit").toString(),
    owner: formData.get("defaultOwner").toString(),
  };
  const generatedTasks = buildTasksFromAnswers(answers);
  if (generatedTasks.length === 0) {
    setupMessage.textContent = "生成できるタスクがありません。";
    return;
  }
  tasks = [...generatedTasks, ...tasks];
  saveTasks();
  renderTasks();
  setupMessage.textContent = `${generatedTasks.length}件のタスクを追加しました。`;
}

function addTask(event) {
  event.preventDefault();
  const formData = new FormData(taskForm);
  const newTask = {
    id: crypto.randomUUID(),
    title: formData.get("title").toString(),
    category: formData.get("category").toString(),
    owner: formData.get("owner").toString(),
    due: formData.get("due").toString(),
    priority: formData.get("priority").toString(),
    status: formData.get("status").toString(),
    note: formData.get("note").toString(),
  };

  tasks = [newTask, ...tasks];
  saveTasks();
  taskForm.reset();
  renderTasks();
}

function toggleTask(id) {
  tasks = tasks.map((task) => {
    if (task.id !== id) {
      return task;
    }
    return {
      ...task,
      status: task.status === "完了" ? "進行中" : "完了",
    };
  });
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  saveTasks();
  renderTasks();
}

setupForm.addEventListener("submit", handleSetupSubmit);
taskForm.addEventListener("submit", addTask);
filterCategory.addEventListener("change", renderTasks);
filterStatus.addEventListener("change", renderTasks);

renderTasks();

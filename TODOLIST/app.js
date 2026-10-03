    (() => {
      const STORAGE_KEY = "daymark-lists-v1";
      const LEGACY_STORAGE_KEY = "daymark-tasks-v1";
      const taskList = document.querySelector("#task-list");
      const taskInput = document.querySelector("#task-input");
      const listNameInput = document.querySelector("#list-name-input");
      const listSpaces = document.querySelector("#list-spaces");
      const taskListSelect = document.querySelector("#task-list-select");
      const listTitle = document.querySelector("#list-title");
      const viewTabs = document.querySelector(".view-tabs");
      const inputPanel = document.querySelector("#input-panel");
      const listPanel = document.querySelector("#list-panel");
      const countLabel = document.querySelector("#remaining-count");
      const progressTrack = document.querySelector(".progress-track");
      const progressFill = document.querySelector("#progress-fill");
      const completedActions = document.querySelector("#completed-actions");
      const filters = document.querySelector(".filters");
      let selectedFilter = "all";
      let lists = loadLists();
      let activeListId = lists[0].id;
      let tasks = activeList().tasks;

      document.querySelector("#today-date").textContent = new Intl.DateTimeFormat("ko-KR", {
        year: "numeric", month: "long", day: "numeric", weekday: "long"
      }).format(new Date());

      function setActiveView(view) {
        const showInput = view === "input";
        inputPanel.hidden = !showInput;
        listPanel.hidden = showInput;
        for (const button of viewTabs.querySelectorAll("button[data-view]")) {
          button.setAttribute("aria-pressed", String(button.dataset.view === view));
        }
        if (showInput) taskInput.focus();
      }

      function normalizeTasks(value) {
        if (!Array.isArray(value)) return [];
        return value.filter((task) => task && typeof task.id === "string" && typeof task.title === "string" && typeof task.completed === "boolean");
      }

      function loadLists() {
        try {
          const storedLists = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
          if (Array.isArray(storedLists)) {
            const validLists = storedLists.filter((list) => list && typeof list.id === "string" && typeof list.name === "string").map((list) => ({
              id: list.id,
              name: list.name,
              tasks: normalizeTasks(list.tasks)
            }));
            if (validLists.length) return validLists;
          }
          const oldTasks = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
          return [{ id: `${Date.now()}-default`, name: "내 할 일", tasks: normalizeTasks(oldTasks) }];
        } catch {
          return [{ id: `${Date.now()}-default`, name: "내 할 일", tasks: [] }];
        }
      }

      function saveTasks() {
        try {
          activeList().tasks = tasks;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
        } catch {
          countLabel.textContent = "저장 공간을 사용할 수 없어 변경 사항이 저장되지 않았어요.";
        }
      }

      function activeList() {
        return lists.find((list) => list.id === activeListId) || lists[0];
      }

      function renderListSpaces() {
        listSpaces.replaceChildren();
        for (const list of lists) {
          const space = document.createElement("div");
          space.className = "list-space";
          space.setAttribute("aria-current", String(list.id === activeListId));

          const select = document.createElement("button");
          select.className = "list-space-select";
          select.type = "button";
          select.textContent = list.name;
          select.setAttribute("aria-label", `${list.name} 목록 열기`);
          select.dataset.listId = list.id;
          select.dataset.action = "select-list";

          const remove = makeButton(
            "list-space-delete",
            `${list.name} 목록 삭제`,
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7m-7.5 0 1 13h8l1-13M10 10.5v6m4-6v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          );
          remove.dataset.action = "delete-list";
          remove.dataset.listId = list.id;
          remove.disabled = lists.length === 1;
          remove.title = lists.length === 1 ? "마지막 목록은 삭제할 수 없어요" : "목록 삭제";

          space.append(select, remove);
          listSpaces.append(space);
        }
        taskListSelect.replaceChildren();
        for (const list of lists) {
          const option = document.createElement("option");
          option.value = list.id;
          option.textContent = list.name;
          taskListSelect.append(option);
        }
        taskListSelect.value = activeListId;
        listTitle.textContent = activeList().name;
      }

      function makeButton(className, label, icon, attributes = {}) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.setAttribute("aria-label", label);
        for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value);
        button.innerHTML = icon;
        return button;
      }

      function render() {
        renderListSpaces();
        const completedCount = tasks.filter((task) => task.completed).length;
        const remaining = tasks.length - completedCount;
        countLabel.innerHTML = `남은 할 일 <strong>${remaining}</strong>개`;
        completedActions.hidden = completedCount === 0;

        const percent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
        progressFill.style.width = `${percent}%`;
        progressTrack.setAttribute("aria-valuenow", String(percent));

        for (const button of filters.querySelectorAll("button")) {
          button.setAttribute("aria-pressed", String(button.dataset.filter === selectedFilter));
        }

        const visibleTasks = tasks.filter((task) => {
          if (selectedFilter === "active") return !task.completed;
          if (selectedFilter === "completed") return task.completed;
          return true;
        });
        taskList.replaceChildren();

        if (visibleTasks.length === 0) {
          const empty = document.createElement("li");
          empty.className = "empty-state";
          const title = tasks.length === 0
            ? "아직 할 일이 없어요"
            : selectedFilter === "active" ? "진행 중인 일이 없어요" : "완료한 일이 없어요";
          const hint = tasks.length === 0 ? "위에서 오늘의 첫 할 일을 추가해 보세요." : "다른 목록도 살펴보세요.";
          empty.innerHTML = `<span class="empty-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.3 4.3L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><p class="empty-title"></p><p class="empty-hint"></p>`;
          empty.querySelector(".empty-title").textContent = title;
          empty.querySelector(".empty-hint").textContent = hint;
          taskList.append(empty);
          return;
        }

        for (const [visibleIndex, task] of visibleTasks.entries()) {
          const row = document.createElement("li");
          row.className = `task-row${task.completed ? " is-complete" : ""}`;

          const moveUp = makeButton(
            "move-up-button",
            `${task.title} 우선순위 한 칸 올리기`,
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 14 6-6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          );
          moveUp.dataset.action = "move-up";
          moveUp.dataset.id = task.id;
          moveUp.disabled = visibleIndex === 0;
          moveUp.title = visibleIndex === 0 ? "이미 첫 번째 항목입니다" : "우선순위 한 칸 올리기";

          const title = document.createElement("button");
          title.type = "button";
          title.className = "task-text";
          title.setAttribute("aria-label", task.completed ? `완료 취소: ${task.title}` : `완료로 표시: ${task.title}`);
          title.setAttribute("aria-pressed", String(task.completed));
          title.dataset.action = "toggle";
          title.dataset.id = task.id;
          title.textContent = task.title;

          const remove = makeButton(
            "delete-button",
            `${task.title} 삭제`,
            '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7m-7.5 0 1 13h8l1-13M10 10.5v6m4-6v6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
          );
          remove.dataset.action = "delete";
          remove.dataset.id = task.id;

          row.append(moveUp, title, remove);
          taskList.append(row);
        }
      }

      document.querySelector("#add-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const title = taskInput.value.trim();
        if (!title) return;
        tasks.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title, completed: false });
        selectedFilter = "all";
        saveTasks();
        render();
        taskInput.value = "";
        setActiveView("lists");
      });

      viewTabs.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-view]");
        if (!button) return;
        setActiveView(button.dataset.view);
      });

      taskListSelect.addEventListener("change", () => {
        const list = lists.find((item) => item.id === taskListSelect.value);
        if (!list) return;
        activeListId = list.id;
        tasks = list.tasks;
        selectedFilter = "all";
        render();
      });

      document.querySelector("#list-create-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const name = listNameInput.value.trim();
        if (!name) return;
        const list = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name, tasks: [] };
        lists.push(list);
        activeListId = list.id;
        tasks = list.tasks;
        selectedFilter = "all";
        saveTasks();
        render();
        listNameInput.value = "";
        taskInput.focus();
      });

      listSpaces.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const list = lists.find((item) => item.id === button.dataset.listId);
        if (!list) return;
        if (button.dataset.action === "select-list") {
          activeListId = list.id;
          tasks = list.tasks;
          selectedFilter = "all";
        } else if (button.dataset.action === "delete-list" && lists.length > 1) {
          if (!window.confirm(`'${list.name}' 목록과 안의 할 일을 삭제할까요?`)) return;
          lists = lists.filter((item) => item.id !== list.id);
          if (activeListId === list.id) {
            activeListId = lists[0].id;
            tasks = activeList().tasks;
          }
          selectedFilter = "all";
          saveTasks();
        } else return;
        render();
      });

      taskList.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const task = tasks.find((item) => item.id === button.dataset.id);
        if (!task) return;
        if (button.dataset.action === "move-up") {
          const previousRow = button.closest("li").previousElementSibling;
          const previousTitle = previousRow?.querySelector(".task-text");
          if (!previousTitle) return;
          const taskIndex = tasks.findIndex((item) => item.id === task.id);
          const previousIndex = tasks.findIndex((item) => item.id === previousTitle.dataset.id);
          if (taskIndex < 0 || previousIndex < 0) return;
          [tasks[previousIndex], tasks[taskIndex]] = [tasks[taskIndex], tasks[previousIndex]];
        } else if (button.dataset.action === "toggle") task.completed = !task.completed;
        else if (button.dataset.action === "delete") tasks = tasks.filter((item) => item.id !== task.id);
        else return;
        saveTasks();
        render();
      });

      filters.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-filter]");
        if (!button) return;
        selectedFilter = button.dataset.filter;
        render();
      });

      completedActions.addEventListener("click", () => {
        tasks = tasks.filter((task) => !task.completed);
        saveTasks();
        render();
      });

      render();
    })();

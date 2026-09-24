$(function () {
    "use strict";
    const API = "/api";
    const state = {
        token:
            localStorage.getItem(
                "ideas_access_token"
            ) || "",
        ideas: [],
        currentIdeaId: null,
        deleteIdeaId: null,
        refreshing: false,
    };

    function escapeHtml(value) {
        return $("<div>").text(value ?? "").html();
    }

    function showModal(selector) {
        $(selector).addClass("is-open").attr("aria-hidden", "false");
        $("body").addClass("modal-open");
    }

    function closeModal(selector) {
        $(selector).removeClass("is-open").attr("aria-hidden", "true");

        if (!$(".modal.is-open").length) {
            $("body").removeClass("modal-open");
        }
    }

    function setAuthenticated(authenticated) {
        $("#appHeader, #appContent").prop("hidden", !authenticated);

        if (authenticated) {
            closeModal("#loginModal");
        } else {
            $("#appHeader, #appContent").prop("hidden", true);
            showModal("#loginModal");
        }
    }

    function saveToken(token) {
        state.token = token || "";
        if (state.token) {
            localStorage.setItem("ideas_access_token", state.token);
        } else {
            localStorage.removeItem("ideas_access_token");
        }
    }

    function getErrorMessage(xhr) {
        return (xhr?.responseJSON?.errors?.[0] || xhr?.responseJSON?.message || "Произошла ошибка");
    }

    function request(options) {
        const ajaxOptions = {
            url: `${API}${options.url}`,
            method: options.method || "GET",
            contentType: options.contentType === false ? false : "application/json",
            processData: options.processData === false ? false : true,
            xhrFields: { withCredentials: true },
            headers: {},
        };

        if (options.data !== undefined) {
            ajaxOptions.data = ajaxOptions.contentType === "application/json" ? JSON.stringify(options.data) : options.data;
        }

        if (state.token && options.auth !== false) {
            ajaxOptions.headers.Authorization = `Bearer ${state.token}`;
        }

        return $.ajax(ajaxOptions);
    }

    function refreshAccessToken() {
        return request({
            url: "/user/refresh",
            method: "POST",
            auth: false,
        }).then(function (response) {
            const token = response?.data?.token;
            if (!token) {
                return $.Deferred().reject().promise();
            }

            saveToken(token);
            return token;
        });
    }

    function authorizedRequest(options) {
        return request(options).catch(
            function (xhr) {
                if (xhr.status !== 401) {
                    return $.Deferred().reject(xhr).promise();
                }
                return refreshAccessToken().then(function () {
                    return request(options);
                }).catch(function () {
                    saveToken("");
                    setAuthenticated(false);
                    return $.Deferred().reject(xhr).promise();
                });
            }
        );
    }

    $("#loginForm").on("submit", function (event) {
        event.preventDefault();
        $("#loginError").text("");

        const payload = {
            name: $("#loginName").val().trim(),
            password: $("#loginPassword").val(),
        };
        request({
            url: "/user/login",
            method: "POST",
            auth: false,
            data: payload,
        }).then(function (response) {
            const token = response?.data?.token;
            if (!token) throw new Error("Token missing");

            saveToken(token);
            setAuthenticated(true);
            $("#loginForm")[0].reset();
            loadIdeas();
        }).catch(function (xhr) {
            $("#loginError").text(getErrorMessage(xhr));
        });
    });

    $("#logoutBtn").on("click", function () {
        request({
            url: "/user/logout",
            method: "POST",
            auth: false,
        }).always(function () {
            saveToken("");
            state.ideas = [];
            $("#ideasGrid").empty();
            setAuthenticated(false);
        });
    });

    function loadIdeas() {
        const search = $("#searchInput").val().trim();
        const location = $("#locationFilter").val().trim();
        const difficulty = $("#difficultyFilter").val();
        const params = new URLSearchParams();
        params.set("limit", "100");

        if (search) {
            params.set("search", search);
        }

        if (location) {
            params.set("location", location);
        }
        if (difficulty) {
            params.set("difficulty", difficulty);
        }

        authorizedRequest({
            url: `/idea/get?${params.toString()}`,
            method: "GET",
        }).then(function (response) {
            state.ideas = response.objects || [];
            renderIdeas();
        }).catch(function (xhr) {
            if (xhr.status !== 401) {
                console.error(getErrorMessage(xhr));
            }
        });
    }

    function renderIdeas() {
        const $grid = $("#ideasGrid");
        $grid.empty();
        $("#emptyState").prop("hidden", state.ideas.length !== 0);

        state.ideas.forEach(
            function (idea) {
                const $card = $("<article>", { class: "idea-card" });
                const $media = $("<div>", { class: "idea-card__media" });

                if (idea.url) {
                    const $iframe = $("<iframe>", {
                        src: idea.url,
                        title: idea.title || "Video reference",
                        loading: "lazy",
                        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
                        allowfullscreen: "allowfullscreen",
                    });

                    $media.append($iframe);
                } else {
                    $media.html(`<div class="idea-card__placeholder"><div class="idea-card__placeholder-icon">▶</div><div>Без референса</div></div>`);
                }

                const $body = $("<div>", { class: "idea-card__body", });
                const $title = $("<h2>", { class: "idea-card__title", }).text(idea.title || "Без названия");
                const $button = $("<button>", { class: "button button--primary", type: "button", text: "Подробнее", }).attr("data-idea-id", idea._id);

                $body.append($title, $button);
                $card.append($media, $body);
                $grid.append($card);
            }
        );
    }

    function createScriptEditor(script = {}, index = 0) {
        const $block = $("<div>", { class: "script-editor" });
        $block.html(`
            <div class="script-editor__header">
                <div class="script-editor__title">
                    Сценарий ${index + 1}
                </div>
                <button type="button" class="remove-script">
                    Удалить сценарий
                </button>
            </div>
            <div class="form-field">
                <label>
                    Сценарий
                </label>
                <textarea
                    data-field="scenario"
                    required
                    placeholder="Полный текст сценария..."
                ></textarea>
            </div>
            <div class="script-fields-grid">
    <div class="form-field">
        <label>
            Инвентарь
        </label>
        <input
            type="text"
            data-field="equipment"
            placeholder="Маска, машина..."
        >
    </div>
    <div class="form-field">
        <label>
            Актёры
        </label>
        <input
            type="text"
            data-field="actors"
            placeholder="1 мужчина, 1 девушка..."
        >
    </div>
    <div class="form-field">
        <label>
            Устройство
        </label>
        <input
            type="text"
            data-field="device"
            placeholder="iPhone, Sony..."
        >
    </div>
    <div class="form-field">
        <label>
            Локация
        </label>
        <input
            type="text"
            data-field="location"
            placeholder="Улица, офис, студия..."
        >
    </div>
    <div class="form-field">
        <label>
            Сложность
        </label>
        <select
            data-field="difficulty"
        >
            <option value="">
                Не указана
            </option>
            <option value="low">
                Low
            </option>
            <option value="mid">
                Mid
            </option>
            <option value="high">
                High
            </option>
        </select>
    </div>
</div>
        `);

        $block.find('[data-field="scenario"]').val(script.scenario || "");
        $block.find('[data-field="equipment"]').val(script.equipment || "");
        $block.find('[data-field="actors"]').val(script.actors || "");
        $block.find('[data-field="device"]').val(script.device || "");
        $block.find('[data-field="location"]').val(script.location || "");
        $block.find('[data-field="difficulty"]').val(script.difficulty || "");

        return $block;
    }

    function renumberScripts($editor) {
        $editor.find(".script-editor").each(function (index) {
            $(this).find(".script-editor__title").text(`Сценарий ${index + 1}`);
        });
    }

    function addScript($editor, script = {}) {
        const index = $editor.find(".script-editor").length;
        $editor.append(createScriptEditor(script, index));
    }

    function collectScripts($editor) {
        const scripts = [];
        $editor.find(".script-editor").each(function () {
            const $block = $(this);
            const scenario = $block.find('[data-field="scenario"]').val().trim();
            const equipment = $block.find('[data-field="equipment"]').val().trim();
            const actors = $block.find('[data-field="actors"]').val().trim();
            const device = $block.find('[data-field="device"]').val().trim();
            const location = $block.find('[data-field="location"]').val().trim();
            const difficulty = $block.find('[data-field="difficulty"]').val();
            if (scenario || equipment || actors || device || location || difficulty) {
                scripts.push({
                    scenario,
                    equipment,
                    actors,
                    device,
                    location,
                    difficulty,
                });
            }
        });

        return scripts;
    }

    $(document).on("click", ".add-script", function () {
        const $editor = $(this).closest("form").find("[data-scripts-editor]");
        addScript($editor);
    });

    $(document).on("click", ".remove-script", function () {
        const $editor = $(this).closest("[data-scripts-editor]");
        $(this).closest(".script-editor").remove();
        renumberScripts($editor);
    });

    function openCreateIdea() {
        const $form = $("#createIdeaForm");
        $form[0].reset();
        $("#createIdeaError").text("");
        const $editor = $form.find("[data-scripts-editor]");
        $editor.empty();
        addScript($editor);
        showModal("#ideaModal");
    }

    $("#addIdeaBtn, #emptyAddBtn").on("click", openCreateIdea);
    $("#createIdeaForm").on("submit", function (event) {
        event.preventDefault();
        const $form = $(this);
        const payload = {
            title: $form.find('[name="title"]').val().trim(),
            url: $form.find('[name="url"]').val().trim(),
            scripts: collectScripts($form.find("[data-scripts-editor]")),
        };
        $("#createIdeaError").text("");
        authorizedRequest({
            url: "/idea/create",
            method: "POST",
            data: payload,
        }).then(function () {
            closeModal("#ideaModal");
            loadIdeas();
        }).catch(function (xhr) {
            $("#createIdeaError").text(getErrorMessage(xhr));
        });
    });

    function findIdea(id) {
        return state.ideas.find((idea) => idea._id === id);
    }

    $(document).on("click", "[data-idea-id]", function () {
        const id = $(this).attr("data-idea-id");
        openIdeaDetails(id);
    });

    function openIdeaDetails(id) {
        const idea = findIdea(id);
        if (!idea) return;
        state.currentIdeaId = idea._id;
        $("#ideaEditView").prop("hidden", true).empty();
        $("#ideaDetailsView").prop("hidden", false);
        renderIdeaDetails(idea);
        showModal("#detailsModal");
    }

    function renderIdeaDetails(idea) {
        const scripts = idea.scripts || [];
        let videoHtml = `<div class="idea-details__no-video">Референс не добавлен</div>`;

        if (idea.url) {
            const originButton = idea.url_origin ? `<a href="${escapeHtml(idea.url_origin)}" target="_blank" rel="noopener noreferrer" class="original-link">Открыть оригинал ↗</a>` : "";
            videoHtml = `<div class="idea-details__video"><iframe src="${escapeHtml(idea.url)}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe></div><div class="idea-details__video-actions">${originButton}</div>`;
        }

        let scriptsHtml = "";
        if (!scripts.length) {
            scriptsHtml = `<p style="color:var(--text-soft)">Сценарии ещё не добавлены.</p>`;
        } else {
            scriptsHtml = scripts.map((script, index) => `
                    <div class="scenario">
                        <button type="button" class="scenario__header">
                            <span>
                                Сценарий ${index + 1}
                            </span>
                            <span class="scenario__arrow">
                                ↓
                            </span>
                        </button>
                        <div class="scenario__body">
                            <p>${escapeHtml(script.scenario || "")}</p>
                            <div class="scenario-meta">
                                <div class="scenario-meta__item">
                                    <span class="scenario-meta__label">
                                        Инвентарь
                                    </span>
                                    <span class="scenario-meta__value">
                                        ${escapeHtml(script.equipment || "—")}
                                    </span>
                                </div>
                                <div class="scenario-meta__item">
                                    <span class="scenario-meta__label">
                                        Актёры
                                    </span>
                                    <span class="scenario-meta__value">
                                        ${escapeHtml(script.actors || "—")}
                                    </span>
                                </div>
                                <div class="scenario-meta__item">
                                    <span class="scenario-meta__label">
                                        Устройство
                                    </span>
                                    <span class="scenario-meta__value">
                                        ${escapeHtml(script.device || "—")}
                                    </span>
                                </div>
                                <div class="scenario-meta__item">
                                    <span class="scenario-meta__label">
                                        Локация
                                    </span>
                                    <span class="scenario-meta__value">
                                        ${escapeHtml(script.location || "—")}
                                    </span>
                                </div>
                                <div class="scenario-meta__item">
                                    <span class="scenario-meta__label">
                                        Сложность
                                    </span>
                                    <span class="difficulty-badge difficulty-badge--${escapeHtml(script.difficulty || "none")}">
                                        ${escapeHtml(script.difficulty || "—")}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>`
            ).join("");
        }
        $("#ideaDetailsView").html(`
                <h2 class="modal__title">
                    ${escapeHtml(idea.title)}
                </h2>
                ${videoHtml}
                <div class="scripts-section">
                    <h3>
                        Сценарии
                    </h3>
                    <div class="scenarios-list">
                        ${scriptsHtml}
                    </div>
                </div>
                <div class="idea-details__actions">
                    <button
                        type="button"
                        class="button button--danger"
                        id="deleteIdeaBtn"
                    >
                        Удалить
                    </button>
                    <button
                        type="button"
                        class="button button--primary"
                        id="editIdeaBtn"
                    >
                        Редактировать
                    </button>
                </div>`
        );
    }

    $(document).on("click", ".scenario__header", function () {
        const $scenario = $(this).closest(".scenario");
        $scenario.toggleClass("is-open");
        $scenario.find(".scenario__body").stop(true, true).slideToggle(180);
    });

    $(document).on("click", "#editIdeaBtn", function () {
        const idea = findIdea(state.currentIdeaId);
        if (!idea) return;
        renderEditIdea(idea);
    });

    function renderEditIdea(idea) {
        const $edit = $("#ideaEditView");
        $("#ideaDetailsView").prop("hidden", true);
        $edit.prop("hidden", false).html(`
                <h2 class="modal__title">
                    Редактирование
                </h2>
                <form id="editIdeaForm">
                    <div class="form-field">
                        <label>
                            Название идеи
                        </label>
                        <input
                            name="title"
                            type="text"
                            required
                        >
                    </div>
                    <div class="form-field">
                        <label>
                            Ссылка на референс
                        </label>
                        <input
                            name="url"
                            type="url"
                            placeholder="Instagram, TikTok или YouTube"
                        >
                    </div>
                    <div class="scripts-section">
                        <div class="scripts-section__header">
                            <div>
                                <h3>
                                    Сценарии
                                </h3>
                                <p>
                                    Добавляй и удаляй сценарии.
                                </p>
                            </div>
                            <button
                                type="button"
                                class="button button--outline button--small add-script"
                            >
                                + Сценарий
                            </button>
                        </div>
                        <div
                            data-scripts-editor
                            class="scripts-editor"
                        ></div>
                    </div>
                    <div
                        class="form-error"
                        id="editIdeaError"
                    ></div>
                    <div class="modal__footer">
                        <button
                            type="button"
                            class="button button--secondary"
                            id="cancelEditBtn"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            class="button button--primary"
                        >
                            Обновить
                        </button>
                    </div>
                </form>
            `
        );
        const $form = $("#editIdeaForm");
        $form.find('[name="title"]').val(idea.title || "");
        $form.find('[name="url"]').val(idea.url_origin || idea.url || "");
        const $editor = $form.find("[data-scripts-editor]");
        $editor.empty();
        (idea.scripts || []).forEach(function (script) { addScript($editor, script); });
        if (!(idea.scripts || []).length) {
            addScript($editor);
        }
    }

    $(document).on("click", "#cancelEditBtn", function () {
        const idea = findIdea(state.currentIdeaId);
        if (!idea) return;
        $("#ideaEditView").prop("hidden", true).empty();
        $("#ideaDetailsView").prop("hidden", false);
        renderIdeaDetails(idea);
    });

    $(document).on("submit", "#editIdeaForm", function (event) {
        event.preventDefault();
        const id = state.currentIdeaId;
        const $form = $(this);
        const payload = {
            title: $form.find('[name="title"]').val().trim(),
            url_origin: $form.find('[name="url"]').val().trim(),
            scripts: collectScripts($form.find("[data-scripts-editor]")),
        };
        $("#editIdeaError").text("");

        authorizedRequest({
            url: `/idea/update/${id}`,
            method: "PATCH",
            data: payload,
        }).then(function (updatedIdea) {
            const index = state.ideas.findIndex((item) => item._id === id);
            if (index !== -1) {
                state.ideas[index] = updatedIdea;
            }
            renderIdeas();
            $("#ideaEditView").prop("hidden", true).empty();
            $("#ideaDetailsView").prop("hidden", false);
            renderIdeaDetails(updatedIdea);
        }).catch(function (xhr) {
            $("#editIdeaError").text(getErrorMessage(xhr));
        });
    });

    $(document).on("click", "#deleteIdeaBtn", function () {
        state.deleteIdeaId = state.currentIdeaId;
        showModal("#deleteModal");
    });

    $("#cancelDeleteBtn").on("click", function () {
        state.deleteIdeaId = null;
        closeModal("#deleteModal");
    });

    $("#confirmDeleteBtn").on("click", function () {
        const id = state.deleteIdeaId;
        if (!id) return;
        const $button = $(this);
        $button.prop("disabled", true).text("Удаляем...");

        authorizedRequest({
            url: `/idea/delete/${id}`,
            method: "DELETE",
        }).then(function () {
            state.ideas = state.ideas.filter((item) => item._id !== id);
            state.deleteIdeaId = null;
            state.currentIdeaId = null;
            closeModal("#deleteModal");
            closeModal("#detailsModal");
            renderIdeas();
        }).catch(function (xhr) {
            alert(getErrorMessage(xhr));
        }).always(function () {
            $button.prop("disabled", false).text("Удалить");
        });
    });

    $(document).on("click", "[data-close-modal]", function () {
        const $modal = $(this).closest(".modal");
        if ($modal.hasClass("modal--locked")) {
            return;
        }
        closeModal(`#${$modal.attr("id")}`);
    });

    $(document).on("keydown", function (event) {
        if (event.key !== "Escape") {
            return;
        }
        const $modal = $(".modal.is-open").last();
        if (!$modal.length || $modal.hasClass("modal--locked")) {
            return;
        }
        closeModal(`#${$modal.attr("id")}`);
    });

    let filtersTimeout;
    function applyFiltersDelayed() {
        clearTimeout(filtersTimeout);
        filtersTimeout = setTimeout(function () {
            loadIdeas();
        }, 300);
    }

    $("#searchInput").on("input", applyFiltersDelayed);
    $("#locationFilter").on("input", applyFiltersDelayed);
    $("#difficultyFilter").on("change", function () { loadIdeas(); });
    $("#resetFilters").on("click", function () {
        $("#searchInput").val("");
        $("#locationFilter").val("");
        $("#difficultyFilter").val("");
        loadIdeas();
    });

    function initialize() {
        if (!state.token) {
            refreshAccessToken().then(function () {
                setAuthenticated(true);
                loadIdeas();
            }).catch(function () {
                saveToken("");
                setAuthenticated(false);
            });
            return;
        }
        setAuthenticated(true);
        loadIdeas();
    }
    
    initialize();
});
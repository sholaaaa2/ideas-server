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
        refreshPromise: null,
        page: Math.max(1, Number(localStorage.getItem("ideas_page")) || 1),
        limit: 12,
        totalIdeas: 0,
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

    function closeAllModals() {
        $(".modal.is-open")
            .removeClass("is-open")
            .attr("aria-hidden", "true");
        $("body").removeClass("modal-open");
    }

    function forceLogin() {
        saveToken("");
        state.ideas = [];
        state.currentIdeaId = null;
        state.deleteIdeaId = null;
        closeAllModals();
        $("#ideasGrid").empty();
        setAuthenticated(false);
    }

    function normalizeText(value) {
        return String(value ?? "").trim();
    }

    function savePage(page) {
        state.page = Math.max(1, Number(page) || 1);
        localStorage.setItem("ideas_page", String(state.page));
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
        return (
            xhr?.responseJSON?.errors?.[0] ||
            xhr?.responseJSON?.message ||
            "Сталася помилка"
        );
    }

    function request(options) {
        const ajaxOptions = {
            url: `${API}${options.url}`,
            method: options.method || "GET",
            contentType:
                options.contentType === false
                    ? false
                    : "application/json",
            processData:
                options.processData === false
                    ? false
                    : true,
            xhrFields: {
                withCredentials: true
            },
            headers: {},
        };

        if (options.data !== undefined) {
            ajaxOptions.data =
                ajaxOptions.contentType === "application/json"
                    ? JSON.stringify(options.data)
                    : options.data;
        }

        if (state.token && options.auth !== false) {
            ajaxOptions.headers.Authorization = `Bearer ${state.token}`;
        }

        return $.ajax(ajaxOptions);
    }

    function refreshAccessToken() {
        if (state.refreshPromise) {
            return state.refreshPromise;
        }

        const deferred = $.Deferred();
        state.refreshPromise = deferred.promise();

        request({
            url: "/user/refresh",
            method: "POST",
            auth: false,
        })
            .then(function (response) {
                const token = response?.data?.token;

                if (!token) {
                    deferred.reject({ status: 401 });
                    return;
                }

                saveToken(token);
                deferred.resolve(token);
            })
            .catch(function (xhr) {
                deferred.reject(xhr);
            })
            .always(function () {
                state.refreshPromise = null;
            });

        return deferred.promise();
    }

    function authorizedRequest(options) {
        const requestOptions = $.extend(true, {}, options);

        return request(requestOptions).catch(function (xhr) {
            if (xhr.status !== 401 || requestOptions._retried) {
                return $.Deferred().reject(xhr).promise();
            }

            requestOptions._retried = true;

            return refreshAccessToken().then(
                function () {
                    return request(requestOptions).catch(function (retryXhr) {
                        if (retryXhr.status === 401) {
                            forceLogin();
                        }

                        return $.Deferred().reject(retryXhr).promise();
                    });
                },
                function (refreshError) {
                    forceLogin();
                    return $.Deferred().reject(refreshError || xhr).promise();
                }
            );
        });
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
        })
            .then(function (response) {
                const token = response?.data?.token;

                if (!token) {
                    throw new Error("Token missing");
                }

                saveToken(token);
                setAuthenticated(true);

                $("#loginForm")[0].reset();

                loadIdeas();
            })
            .catch(function (xhr) {
                $("#loginError").text(getErrorMessage(xhr));
            });
    });

    $("#logoutBtn").on("click", function () {
        request({
            url: "/user/logout",
            method: "POST",
            auth: false,
        }).always(function () {
            forceLogin();
        });
    });

    function loadIdeas() {
        const search = $("#searchInput").val().trim();
        const location = $("#locationFilter").val().trim();
        const difficulty = $("#difficultyFilter").val();

        const params = new URLSearchParams();

        params.set("page", String(state.page));
        params.set("limit", String(state.limit));

        if (search) {
            params.set("search", search);
        }

        if (location) {
            params.set("location", location);
        }

        if (difficulty) {
            params.set("difficulty", difficulty);
        }

        return authorizedRequest({
            url: `/idea/get?${params.toString()}`,
            method: "GET",
        })
            .then(function (response) {
                state.totalIdeas = Number(response.total) || 0;

                const totalPages = Math.max(1, Math.ceil(state.totalIdeas / state.limit));
                if (state.page > totalPages && state.totalIdeas > 0) {
                    savePage(totalPages);
                    return loadIdeas();
                }

                state.ideas = response.objects || [];
                renderIdeas();
                renderPagination();
                renderIdeasCount();
            })
            .catch(function (xhr) {
                if (xhr.status !== 401) {
                    console.error(getErrorMessage(xhr));
                }
            });
    }

    function renderIdeas() {
        const $grid = $("#ideasGrid");

        $grid.empty();

        $("#emptyState").prop(
            "hidden",
            state.ideas.length !== 0
        );

        state.ideas.forEach(function (idea) {
            const $card = $("<article>", {
                class: "idea-card"
            });

            const $media = $("<div>", {
                class: "idea-card__media"
            });

            if (idea.url) {
                const $iframe = $("<iframe>", {
                    src: idea.url,
                    title:
                        idea.title ||
                        "Відеореференс",
                    loading: "lazy",
                    allow:
                        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
                    allowfullscreen:
                        "allowfullscreen",
                });

                $media.append($iframe);
            } else {
                $media.html(`
                    <div class="idea-card__placeholder">
                        <div class="idea-card__placeholder-icon">▶</div>
                        <div>Без референсу</div>
                    </div>
                `);
            }

            const $body = $("<div>", {
                class: "idea-card__body",
            });

            const $title = $("<h2>", {
                class: "idea-card__title",
            }).text(
                idea.title || "Без назви"
            );

            const scenariosCount = Array.isArray(idea.scripts)
                ? idea.scripts.length
                : 0;

            const $meta = $("<div>", {
                class: "idea-card__meta",
            }).append(
                $("<span>", {
                    class: "idea-card__scenario-label",
                    text: "Сценарії",
                }),
                $("<span>", {
                    class: "idea-card__scenario-count",
                    text: scenariosCount,
                    title: `Сценаріїв: ${scenariosCount}`,
                    "aria-label": `Сценаріїв: ${scenariosCount}`,
                })
            );

            const $button = $("<button>", {
                class: "button button--primary",
                type: "button",
                text: "Детальніше",
            }).attr(
                "data-idea-id",
                idea._id
            );

            $body.append(
                $title,
                $meta,
                $button
            );

            $card.append(
                $media,
                $body
            );

            $grid.append($card);
        });
    }

    function renderIdeasCount() {
        $("#ideasCount").text(`Усього ідей: ${state.totalIdeas}`);
    }

    function renderPagination() {
        const $pagination = $("#ideasPagination");
        const totalPages = Math.ceil(state.totalIdeas / state.limit);

        $pagination.empty().prop("hidden", totalPages <= 1);

        if (totalPages <= 1) {
            return;
        }

        const addButton = function (label, page, options = {}) {
            const $button = $("<button>", {
                type: "button",
                class: `pagination__button${options.active ? " is-active" : ""}`,
                text: label,
                disabled: Boolean(options.disabled),
            });

            if (!options.disabled && !options.active) {
                $button.attr("data-page", page);
            }

            $pagination.append($button);
        };

        addButton("←", state.page - 1, { disabled: state.page <= 1 });

        const visiblePages = new Set([1, totalPages, state.page - 1, state.page, state.page + 1]);
        let previousPage = 0;

        [...visiblePages]
            .filter((page) => page >= 1 && page <= totalPages)
            .sort((a, b) => a - b)
            .forEach(function (page) {
                if (previousPage && page - previousPage > 1) {
                    $pagination.append($("<span>", {
                        class: "pagination__ellipsis",
                        text: "…",
                    }));
                }

                addButton(String(page), page, { active: page === state.page });
                previousPage = page;
            });

        addButton("→", state.page + 1, { disabled: state.page >= totalPages });
    }

    $(document).on("click", "[data-page]", function () {
        const page = Number($(this).attr("data-page"));
        if (!page || page === state.page) {
            return;
        }

        savePage(page);
        loadIdeas().then(function () {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    function createScriptEditor(script = {}, index = 0) {
        const $block = $("<div>", {
            class: "script-editor"
        });

        $block.html(`
            <div class="script-editor__header">
                <div class="script-editor__title">
                    Сценарій ${index + 1}
                </div>

                <button type="button" class="remove-script">
                    Видалити сценарій
                </button>
            </div>

            <div class="form-field">
                <label>
                    Сценарій
                </label>

                <textarea
                    data-field="scenario"
                    required
                    placeholder="Повний текст сценарію..."
                ></textarea>
            </div>

            <div class="script-fields-grid">
                <div class="form-field">
                    <label>
                        Інвентар
                    </label>

                    <input
                        type="text"
                        data-field="equipment"
                        placeholder="Маска, машина..."
                    >
                </div>

                <div class="form-field">
                    <label>
                        Актори
                    </label>

                    <input
                        type="text"
                        data-field="actors"
                        placeholder="1 чоловік, 1 дівчина..."
                    >
                </div>

                <div class="form-field">
                    <label>
                        Пристрій
                    </label>

                    <input
                        type="text"
                        data-field="device"
                        placeholder="iPhone, Sony..."
                    >
                </div>

                <div class="form-field">
                    <label>
                        Локація
                    </label>

                    <input
                        type="text"
                        data-field="location"
                        placeholder="Вулиця, офіс, студія..."
                    >
                </div>

                <div class="form-field">
                    <label>
                        Складність
                    </label>

                    <select data-field="difficulty">
                        <option value="">
                            Не вказана
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

        $block
            .find('[data-field="scenario"]')
            .val(normalizeText(script.scenario));

        $block
            .find('[data-field="equipment"]')
            .val(normalizeText(script.equipment));

        $block
            .find('[data-field="actors"]')
            .val(normalizeText(script.actors));

        $block
            .find('[data-field="device"]')
            .val(normalizeText(script.device));

        $block
            .find('[data-field="location"]')
            .val(normalizeText(script.location));

        $block
            .find('[data-field="difficulty"]')
            .val(script.difficulty || "");

        return $block;
    }

    function renumberScripts($editor) {
        $editor
            .find(".script-editor")
            .each(function (index) {
                $(this)
                    .find(".script-editor__title")
                    .text(
                        `Сценарій ${index + 1}`
                    );
            });
    }

    function addScript($editor, script = {}) {
        const index =
            $editor.find(
                ".script-editor"
            ).length;

        $editor.append(
            createScriptEditor(
                script,
                index
            )
        );
    }

    function collectScripts($editor) {
        const scripts = [];

        $editor
            .find(".script-editor")
            .each(function () {
                const $block = $(this);

                const scenario =
                    $block
                        .find(
                            '[data-field="scenario"]'
                        )
                        .val()
                        .trim();

                const equipment =
                    $block
                        .find(
                            '[data-field="equipment"]'
                        )
                        .val()
                        .trim();

                const actors =
                    $block
                        .find(
                            '[data-field="actors"]'
                        )
                        .val()
                        .trim();

                const device =
                    $block
                        .find(
                            '[data-field="device"]'
                        )
                        .val()
                        .trim();

                const location =
                    $block
                        .find(
                            '[data-field="location"]'
                        )
                        .val()
                        .trim();

                const difficulty =
                    $block
                        .find(
                            '[data-field="difficulty"]'
                        )
                        .val();

                if (
                    scenario ||
                    equipment ||
                    actors ||
                    device ||
                    location ||
                    difficulty
                ) {
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

    $(document).on(
        "click",
        ".add-script",
        function () {
            const $editor =
                $(this)
                    .closest("form")
                    .find(
                        "[data-scripts-editor]"
                    );

            addScript($editor);
        }
    );

    $(document).on(
        "click",
        ".remove-script",
        function () {
            const $editor =
                $(this)
                    .closest(
                        "[data-scripts-editor]"
                    );

            $(this)
                .closest(".script-editor")
                .remove();

            renumberScripts($editor);
        }
    );

    function openCreateIdea() {
        const $form =
            $("#createIdeaForm");

        $form[0].reset();

        $("#createIdeaError").text("");

        const $editor =
            $form.find(
                "[data-scripts-editor]"
            );

        $editor.empty();

        addScript($editor);

        showModal("#ideaModal");
    }

    $("#addIdeaBtn, #emptyAddBtn").on(
        "click",
        openCreateIdea
    );

    $("#createIdeaForm").on(
        "submit",
        function (event) {
            event.preventDefault();

            const $form = $(this);

            const payload = {
                title:
                    $form
                        .find(
                            '[name="title"]'
                        )
                        .val()
                        .trim(),

                url:
                    $form
                        .find(
                            '[name="url"]'
                        )
                        .val()
                        .trim(),

                scripts:
                    collectScripts(
                        $form.find(
                            "[data-scripts-editor]"
                        )
                    ),
            };

            $("#createIdeaError").text("");

            authorizedRequest({
                url: "/idea/create",
                method: "POST",
                data: payload,
            })
                .then(function () {
                    closeModal(
                        "#ideaModal"
                    );

                    savePage(1);
                    loadIdeas();
                })
                .catch(function (xhr) {
                    $("#createIdeaError").text(
                        getErrorMessage(xhr)
                    );
                });
        }
    );

    function findIdea(id) {
        return state.ideas.find(
            (idea) => idea._id === id
        );
    }

    $(document).on(
        "click",
        "[data-idea-id]",
        function () {
            const id =
                $(this).attr(
                    "data-idea-id"
                );

            openIdeaDetails(id);
        }
    );

    function openIdeaDetails(id) {
        const idea = findIdea(id);

        if (!idea) {
            return;
        }

        state.currentIdeaId =
            idea._id;

        $("#ideaEditView")
            .prop(
                "hidden",
                true
            )
            .empty();

        $("#ideaDetailsView").prop(
            "hidden",
            false
        );

        renderIdeaDetails(idea);

        showModal(
            "#detailsModal"
        );
    }

    function renderIdeaDetails(idea) {
        const scripts =
            idea.scripts || [];

        let videoHtml = `
            <div class="idea-details__no-video">
                Референс не додано
            </div>
        `;

        if (idea.url) {
            const originButton =
                idea.url_origin
                    ? `
                        <a
                            href="${escapeHtml(idea.url_origin)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="original-link"
                        >
                            Відкрити оригінал ↗
                        </a>
                    `
                    : "";

            videoHtml = `
                <div class="idea-details__video">
                    <iframe
                        src="${escapeHtml(idea.url)}"
                        frameborder="0"
                        allowfullscreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    ></iframe>
                </div>

                <div class="idea-details__video-actions">
                    ${originButton}
                </div>
            `;
        }

        let scriptsHtml = "";

        if (!scripts.length) {
            scriptsHtml = `
                <p style="color:var(--text-soft)">
                    Сценарії ще не додані.
                </p>
            `;
        } else {
            scriptsHtml = scripts
                .map(
                    (script, index) => `
                        <div class="scenario">
                            <button
                                type="button"
                                class="scenario__header"
                            >
                                <span>
                                    Сценарій ${index + 1}
                                </span>

                                <span class="scenario__arrow">
                                    ↓
                                </span>
                            </button>

                            <div class="scenario__body">
                                <p>${escapeHtml(normalizeText(script.scenario))}</p>
                                <div class="scenario-meta">
                                    <div class="scenario-meta__item">
                                        <span class="scenario-meta__label">
                                            Інвентар
                                        </span>

                                        <span class="scenario-meta__value">
                                            ${escapeHtml(normalizeText(script.equipment) || "—")}
                                        </span>
                                    </div>

                                    <div class="scenario-meta__item">
                                        <span class="scenario-meta__label">
                                            Актори
                                        </span>

                                        <span class="scenario-meta__value">
                                            ${escapeHtml(normalizeText(script.actors) || "—")}
                                        </span>
                                    </div>

                                    <div class="scenario-meta__item">
                                        <span class="scenario-meta__label">
                                            Пристрій
                                        </span>

                                        <span class="scenario-meta__value">
                                            ${escapeHtml(normalizeText(script.device) || "—")}
                                        </span>
                                    </div>

                                    <div class="scenario-meta__item">
                                        <span class="scenario-meta__label">
                                            Локація
                                        </span>

                                        <span class="scenario-meta__value">
                                            ${escapeHtml(normalizeText(script.location) || "—")}
                                        </span>
                                    </div>

                                    <div class="scenario-meta__item">
                                        <span class="scenario-meta__label">
                                            Складність
                                        </span>

                                        <span
                                            class="difficulty-badge difficulty-badge--${escapeHtml(script.difficulty || "none")}"
                                        >
                                            ${escapeHtml(script.difficulty || "—")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `
                )
                .join("");
        }

        $("#ideaDetailsView").html(`
            <h2 class="modal__title">
                ${escapeHtml(idea.title)}
            </h2>

            ${videoHtml}

            <div class="scripts-section">
                <h3>
                    Сценарії
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
                    Видалити
                </button>

                <button
                    type="button"
                    class="button button--primary"
                    id="editIdeaBtn"
                >
                    Редагувати
                </button>
            </div>
        `);
    }

    $(document).on(
        "click",
        ".scenario__header",
        function () {
            const $scenario =
                $(this).closest(
                    ".scenario"
                );

            $scenario.toggleClass(
                "is-open"
            );

            $scenario
                .find(
                    ".scenario__body"
                )
                .stop(true, true)
                .slideToggle(180);
        }
    );

    $(document).on(
        "click",
        "#editIdeaBtn",
        function () {
            const idea =
                findIdea(
                    state.currentIdeaId
                );

            if (!idea) {
                return;
            }

            renderEditIdea(idea);
        }
    );

    function renderEditIdea(idea) {
        const $edit =
            $("#ideaEditView");

        $("#ideaDetailsView").prop(
            "hidden",
            true
        );

        $edit
            .prop(
                "hidden",
                false
            )
            .html(`
                <h2 class="modal__title">
                    Редагування
                </h2>

                <form id="editIdeaForm">
                    <div class="form-field">
                        <label>
                            Назва ідеї
                        </label>

                        <input
                            name="title"
                            type="text"
                            required
                        >
                    </div>

                    <div class="form-field">
                        <label>
                            Посилання на референс
                        </label>

                        <input
                            name="url"
                            type="url"
                            placeholder="Instagram, TikTok або YouTube"
                        >
                    </div>

                    <div class="scripts-section">
                        <div class="scripts-section__header">
                            <div>
                                <h3>
                                    Сценарії
                                </h3>

                                <p>
                                    Додавай і видаляй сценарії.
                                </p>
                            </div>

                            <button
                                type="button"
                                class="button button--outline button--small add-script"
                            >
                                + Сценарій
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
                            Скасувати
                        </button>

                        <button
                            type="submit"
                            class="button button--primary"
                        >
                            Оновити
                        </button>
                    </div>
                </form>
            `);

        const $form =
            $("#editIdeaForm");

        $form
            .find('[name="title"]')
            .val(
                idea.title || ""
            );

        $form
            .find('[name="url"]')
            .val(
                idea.url_origin ||
                idea.url ||
                ""
            );

        const $editor =
            $form.find(
                "[data-scripts-editor]"
            );

        $editor.empty();

        (idea.scripts || []).forEach(
            function (script) {
                addScript(
                    $editor,
                    script
                );
            }
        );

        if (!(idea.scripts || []).length) {
            addScript($editor);
        }
    }

    $(document).on(
        "click",
        "#cancelEditBtn",
        function () {
            const idea =
                findIdea(
                    state.currentIdeaId
                );

            if (!idea) {
                return;
            }

            $("#ideaEditView")
                .prop(
                    "hidden",
                    true
                )
                .empty();

            $("#ideaDetailsView").prop(
                "hidden",
                false
            );

            renderIdeaDetails(idea);
        }
    );

    $(document).on(
        "submit",
        "#editIdeaForm",
        function (event) {
            event.preventDefault();

            const id =
                state.currentIdeaId;

            const $form =
                $(this);

            const payload = {
                title:
                    $form
                        .find(
                            '[name="title"]'
                        )
                        .val()
                        .trim(),

                url_origin:
                    $form
                        .find(
                            '[name="url"]'
                        )
                        .val()
                        .trim(),

                scripts:
                    collectScripts(
                        $form.find(
                            "[data-scripts-editor]"
                        )
                    ),
            };

            $("#editIdeaError").text("");

            authorizedRequest({
                url:
                    `/idea/update/${id}`,
                method: "PATCH",
                data: payload,
            })
                .then(function (updatedIdea) {
                    const index =
                        state.ideas.findIndex(
                            (item) =>
                                item._id === id
                        );

                    if (index !== -1) {
                        state.ideas[index] =
                            updatedIdea;
                    }

                    renderIdeas();

                    $("#ideaEditView")
                        .prop(
                            "hidden",
                            true
                        )
                        .empty();

                    $("#ideaDetailsView").prop(
                        "hidden",
                        false
                    );

                    renderIdeaDetails(
                        updatedIdea
                    );
                })
                .catch(function (xhr) {
                    $("#editIdeaError").text(
                        getErrorMessage(xhr)
                    );
                });
        }
    );

    $(document).on(
        "click",
        "#deleteIdeaBtn",
        function () {
            state.deleteIdeaId =
                state.currentIdeaId;

            showModal(
                "#deleteModal"
            );
        }
    );

    $("#cancelDeleteBtn").on(
        "click",
        function () {
            state.deleteIdeaId =
                null;

            closeModal(
                "#deleteModal"
            );
        }
    );

    $("#confirmDeleteBtn").on(
        "click",
        function () {
            const id =
                state.deleteIdeaId;

            if (!id) {
                return;
            }

            const $button =
                $(this);

            $button
                .prop(
                    "disabled",
                    true
                )
                .text(
                    "Видаляємо..."
                );

            authorizedRequest({
                url:
                    `/idea/delete/${id}`,
                method:
                    "DELETE",
            })
                .then(function () {
                    state.deleteIdeaId = null;
                    state.currentIdeaId = null;

                    closeModal("#deleteModal");
                    closeModal("#detailsModal");

                    loadIdeas();
                })
                .catch(function (xhr) {
                    alert(
                        getErrorMessage(xhr)
                    );
                })
                .always(function () {
                    $button
                        .prop(
                            "disabled",
                            false
                        )
                        .text(
                            "Видалити"
                        );
                });
        }
    );

    $(document).on(
        "click",
        "[data-close-modal]",
        function () {
            const $modal =
                $(this).closest(
                    ".modal"
                );

            if (
                $modal.hasClass(
                    "modal--locked"
                )
            ) {
                return;
            }

            closeModal(
                `#${$modal.attr("id")}`
            );
        }
    );

    $(document).on(
        "keydown",
        function (event) {
            if (
                event.key !==
                "Escape"
            ) {
                return;
            }

            const $modal =
                $(".modal.is-open").last();

            if (
                !$modal.length ||
                $modal.hasClass(
                    "modal--locked"
                )
            ) {
                return;
            }

            closeModal(
                `#${$modal.attr("id")}`
            );
        }
    );

    let filtersTimeout;

    function applyFiltersDelayed() {
        clearTimeout(
            filtersTimeout
        );

        filtersTimeout =
            setTimeout(
                function () {
                    savePage(1);
                    loadIdeas();
                },
                300
            );
    }

    $("#searchInput").on(
        "input",
        applyFiltersDelayed
    );

    $("#locationFilter").on(
        "input",
        applyFiltersDelayed
    );

    $("#difficultyFilter").on(
        "change",
        function () {
            savePage(1);
            loadIdeas();
        }
    );

    $("#resetFilters").on(
        "click",
        function () {
            $("#searchInput").val("");
            $("#locationFilter").val("");
            $("#difficultyFilter").val("");

            savePage(1);
            loadIdeas();
        }
    );

    function initialize() {
        if (!state.token) {
            refreshAccessToken()
                .then(function () {
                    setAuthenticated(true);

                    loadIdeas();
                })
                .catch(function () {
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
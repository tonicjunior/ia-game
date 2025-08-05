class NightfallChroniclesGame {
  constructor() {
    this.GEMINI_API_KEY = "";
    this.GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";
    this.IMAGE_API_URL =
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
    this.IMAGE_API_KEY = "";
    this.BACKEND_API_URL =
      "https://fb05fddf-1e8a-4db5-8264-adf2befca76c-00-2u8qvkim4bvx1.janeway.replit.dev";
    this.MIN_API_RESPONSE_TIME = 4000;
    this.RETRY_DELAY = 4000;
    this.MAX_RETRIES = 5;
    this.MAX_TITLE_LENGTH = 40;
    this.MAX_DESCRIPTION_LENGTH = 150;
    this.chatHistory = [];
    this.gameSystemInstruction = `
    Você é um mestre de RPG de texto altamente criativo, responsável por conduzir uma história interativa no estilo "{theme}".
    Seu papel é criar uma narrativa imersiva e profissional, onde o jogador toma decisões que impactam o rumo da história.

    **Instrução Inicial - Criação de Personagem:**
    Na sua primeira resposta, você receberá um prompt para criar 4 opções de personagens.
    Sua tarefa é criar uma cena introdutória e 4 personagens distintos como as 4 primeiras opções de escolha para o jogador.
    A narrativa deve descrever o cenário e o momento da escolha. A história principal começará *após* o jogador escolher um desses personagens.

    **Estrutura obrigatória da história:**
    - A história deve conter no mínimo 2 cenas sequenciais após a escolha do personagem, cada uma oferecendo exatamente 4 opções de ação.
    - A história pode ter no máximo 5 cenas no total. Após 5 escolhas, ela deve ser finalizada.
    - Nenhum final pode ocorrer antes da 2ª cena.
    - As opções apresentadas ao usuário nunca devem revelar o que acontecerá.

    **Requisitos obrigatórios para cada cena:**
    1. A descrição deve ser imersiva e rica em detalhes.
    2. O texto deve ser coeso, fluido e de qualidade literária.
    3. Cada cena deve apresentar exatamente 4 opções de ação distintas e relevantes.
    4. As escolhas do jogador devem influenciar diretamente o rumo da narrativa.
    5. É altamente recomendável incluir pelo menos um plot twist criativo.
    6. Finais devem ser completos e impactantes.
    7. O conteúdo da história pode conter temas adultos e violentos para um público 18+.
    8. Use como inspiração a estrutura de escolhas e ramificações de Detroit: Become Human.

    Seu formato de resposta DEVE ser APENAS um objeto JSON, sem nenhum texto extra. O formato é:
    {
      "narrative": "A descrição detalhada da cena.",
      "options": [
        { "text": "Primeira opção de ação.", "action": "ação-1" },
        { "text": "Segunda opção de ação.", "action": "ação-2" },
        { "text": "Terceira opção de ação.", "action": "ação-3" },
        { "text": "Quarta opção de ação.", "action": "ação-4" }
      ],
      "is_end": false
    }`;
    this.currentTheme = null;
    this.currentStory = null;
    this.currentStoryTitles = new Set();
    this.sceneCounter = 1;
    this.isTyping = false;
    this.isApiCallInProgress = false;
    this.typewriterSpeed = 15;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.initBackgroundParticles();
    await this.startLoadingSequence();
  }

  initBackgroundParticles() {
    const container = document.getElementById("background-particle-container");
    if (!container) return;
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement("div");
      particle.classList.add("bg-particle");
      const x = Math.random() * 100;
      const duration = Math.random() * 15 + 10;
      const delay = Math.random() * 15;
      const size = Math.random() * 2 + 1;
      particle.style.left = `${x}vw`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.animationDuration = `${duration}s`;
      particle.style.animationDelay = `${delay}s`;
      container.appendChild(particle);
    }
  }

  async _loadApiKeys() {
    try {
      const [chatiaKeyResponse, imgKeyResponse] = await Promise.all([
        fetch(`${this.BACKEND_API_URL}/get-chat-key`),
        fetch(`${this.BACKEND_API_URL}/get-img-key`),
      ]);
      const chatiaKeyJson = await chatiaKeyResponse.json();
      const imgKeyJson = await imgKeyResponse.json();
      this.GEMINI_API_KEY = chatiaKeyJson.key;
      this.IMAGE_API_KEY = imgKeyJson.key;
      this.GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL_NAME}:generateContent?key=${this.GEMINI_API_KEY}`;
    } catch (error) {
      const loadingText = document.getElementById("loading-text");
      loadingText.textContent =
        "Erro ao conectar com o servidor. Tente recarregar a página.";
      loadingText.style.color = "var(--horror-accent)";
    }
  }

  setupEventListeners() {
    document.querySelectorAll(".theme-card").forEach((card) => {
      card.addEventListener("click", (e) =>
        this.selectTheme(e.currentTarget.dataset.theme)
      );
    });
    document
      .getElementById("back-to-themes")
      .addEventListener("click", () => this.showScreen("theme-selection"));
    document
      .getElementById("back-to-stories")
      .addEventListener("click", () => this.showScreen("story-selection"));
    document
      .getElementById("refresh-stories-btn")
      .addEventListener("click", () => this.generateStories(this.currentTheme));

    const createModal = document.getElementById("create-story-modal");
    const closeModalBtn = document.getElementById("close-create-modal");
    const userStoryForm = document.getElementById("user-story-form");

    closeModalBtn.addEventListener("click", () => this.toggleModal(false));
    window.addEventListener("click", (event) => {
      if (event.target === createModal) this.toggleModal(false);
    });

    userStoryForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = document.getElementById("user-story-title").value;
      const description = document.getElementById(
        "user-story-description"
      ).value;
      if (!title.trim()) return;
      this.toggleModal(false);
      const userStory = {
        title: title.trim(),
        description:
          description.trim() || "Uma aventura definida pelo jogador.",
        prompt: `Crie 4 personagens para uma história de ${this.currentTheme} com o título "${title}" e a premissa: "${description}"`,
        id: "user-story",
      };
      this.startStory(userStory);
    });
  }

  toggleModal(show) {
    const createModal = document.getElementById("create-story-modal");
    createModal.style.display = show ? "block" : "none";
  }

  async startLoadingSequence() {
    const progressBar = document.getElementById("progress-bar");
    const loadingText = document.getElementById("loading-text");
    const loadingTexts = [
      "Inicializando o universo...",
      "Conectando aos servidores...",
      "Tecendo narrativas épicas...",
      "Preparando aventuras...",
    ];
    const apiKeysPromise = this._loadApiKeys();
    const visualsPromise = new Promise((resolve) => {
      let progress = 0;
      const textInterval = setInterval(() => {
        loadingText.textContent =
          loadingTexts[Math.floor(progress / 25)] || loadingTexts[3];
      }, 1000);
      const progressInterval = setInterval(() => {
        progress += 2;
        progressBar.style.width = `${progress}%`;
        if (progress >= 100) {
          clearInterval(progressInterval);
          clearInterval(textInterval);
          resolve();
        }
      }, 70);
    });
    await Promise.all([apiKeysPromise, visualsPromise]);
    setTimeout(() => this.showScreen("theme-selection"), 500);
  }

  showScreen(screenId) {
    document
      .querySelectorAll(".screen")
      .forEach((screen) => screen.classList.remove("active"));
    document.getElementById(screenId).classList.add("active");
  }

  selectTheme(theme) {
    this.currentTheme = theme;
    this.currentStoryTitles.clear();
    this.updateThemeColors(theme);
    const themeNames = {
      fantasy: "Aventuras de Fantasia",
      horror: "Contos de Horror",
    };
    document.getElementById("theme-title").textContent = themeNames[theme];
    this.showScreen("story-selection");
    this.generateStories(theme);
  }

  updateThemeColors(theme) {
    const root = document.documentElement;
    const isFantasy = theme === "fantasy";
    root.style.setProperty(
      "--current-primary",
      isFantasy ? "var(--fantasy-primary)" : "var(--horror-primary)"
    );
    root.style.setProperty(
      "--current-accent",
      isFantasy ? "var(--fantasy-accent)" : "var(--horror-accent)"
    );
    root.style.setProperty(
      "--current-glow",
      isFantasy ? "var(--fantasy-glow)" : "var(--horror-glow)"
    );
  }

  showStoryLoading(isLoading) {
    const wrapper = document.getElementById("stories-wrapper");
    if (isLoading) {
      wrapper.innerHTML = `<div class="loading-content"><div class="spinner large"></div><p class="loading-text">Gerando novas histórias...</p></div>`;
    } else {
      wrapper.innerHTML = `<div class="stories-grid" id="stories-container"></div>`;
    }
  }

  async generateStories(theme) {
    this.showStoryLoading(true);

    const existingTitles = Array.from(this.currentStoryTitles).join(", ");
    const promptExclusion = existingTitles
      ? `Evite gerar histórias com os seguintes temas ou títulos: ${existingTitles}.`
      : "";

    const storyGenerationPrompt = `Gere 2 opções de histórias únicas e diversificadas para um jogo de RPG de "${theme}". ${promptExclusion} Evite clichês (ex: mansão assombrada, salvar a princesa), a menos que com um toque muito original. Forneça um array JSON com EXATAMENTE 2 objetos. Título (máx ${this.MAX_TITLE_LENGTH} caracteres), descrição (máx ${this.MAX_DESCRIPTION_LENGTH} caracteres). Responda apenas com o JSON. Formato: [{"title": "t1", "description": "d1", "prompt": "p1", "id": "story-1"}, {"title": "t2", "description": "d2", "prompt": "p2", "id": "story-2"}]`;

    try {
      const response = await fetch(this.GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: storyGenerationPrompt }] }],
          generationConfig: {
            temperature: 1.3,
            maxOutputTokens: 1500,
            response_mime_type: "application/json",
          },
        }),
      });
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      const stories = JSON.parse(data.candidates[0].content.parts[0].text);
      stories.forEach((story) => this.currentStoryTitles.add(story.title));
      this.showStoryLoading(false);
      this.renderStories(stories);
    } catch (error) {
      this.showStoryLoading(false);
      this.renderStories([]);
    }
  }

  renderStories(stories) {
    const container = document.getElementById("stories-container");
    container.innerHTML = "";

    const storiesHtml = stories
      .map(
        (story) => `
      <div class="story-card" data-story-id="${story.id}">
        <h3 class="story-title">${this._truncateText(
          story.title,
          this.MAX_TITLE_LENGTH
        )}</h3>
        <p class="story-description">${this._truncateText(
          story.description,
          this.MAX_DESCRIPTION_LENGTH
        )}</p>
      </div>`
      )
      .join("");

    const createCardHtml = `
      <div class="story-card create-story-card" id="open-create-modal">
        <h3 class="story-title"><i class="fas fa-plus-circle"></i>Criar História</h3>
        <p class="story-description">Use sua imaginação para criar uma aventura única.</p>
      </div>`;

    container.innerHTML = storiesHtml + createCardHtml;

    if (stories.length < 2) {
      for (let i = 0; i < 2 - stories.length; i++) {
        const errorCard = document.createElement("div");
        errorCard.className = "story-card";
        errorCard.innerHTML = `<h3 class="story-title">Erro</h3><p class="story-description">Não foi possível carregar esta história. Tente atualizar.</p>`;
        errorCard.style.cursor = "not-allowed";
        container.insertBefore(
          errorCard,
          container.querySelector(".create-story-card")
        );
      }
    }

    container.querySelectorAll(".story-card[data-story-id]").forEach((card) => {
      const storyId = card.dataset.storyId;
      const storyData = stories.find((s) => s.id === storyId);
      if (storyData)
        card.addEventListener("click", () => this.startStory(storyData));
    });

    document
      .getElementById("open-create-modal")
      .addEventListener("click", () => this.toggleModal(true));
  }

  _truncateText(text, maxLength) {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  }

  async startStory(story) {
    this.currentStory = story;
    this.sceneCounter = 1;
    this.chatHistory = [];
    document.getElementById("current-story-title").textContent = story.title;
    document.getElementById(
      "scene-counter"
    ).textContent = `Cena ${this.sceneCounter}`;
    this.showScreen("game-screen");
    this.showSceneLoading(true, "Preparando a aventura...");
    const imagePrompt = `A high-quality illustration for a ${this.currentTheme} RPG, with the theme of: ${story.title} - ${story.description}`;
    const imageUrl = await this._generateImage(imagePrompt);
    document.documentElement.style.setProperty(
      "--scene-image",
      `url('${imageUrl}')`
    );
    this.showSceneLoading(true, "Gerando a cena inicial...");
    const initialUserPrompt = `Comece a história de "${this.currentTheme}" intitulada "${story.title}". Premissa: "${story.description}". Sua primeira tarefa é criar a cena inicial e 4 opções de personagens, usando como base este prompt: ${story.prompt}. A história DEVE ser sobre "${story.title}".`;
    this.chatHistory.push({
      role: "user",
      parts: [{ text: initialUserPrompt }],
    });
    await this.generateScene();
  }

  async _generateImage(prompt) {
    document.getElementById("scene-loading-text").textContent =
      "Gerando a arte da sua aventura...";
    const enhancedPrompt = `cinematic poster, high-quality detailed illustration for an immersive game, ${prompt}, style of ${this.currentTheme}, epic, vibrant colors, dynamic composition, --style expressive.`;
    try {
      const response = await fetch(this.IMAGE_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.IMAGE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: enhancedPrompt }),
      });
      if (!response.ok)
        throw new Error(`HTTP error! Status: ${response.status}`);
      const imageBlob = await response.blob();
      return URL.createObjectURL(imageBlob);
    } catch (error) {
      return "none";
    }
  }

  async generateScene(playerAction = null, retries = 0) {
    if (this.isApiCallInProgress) return;
    this.isApiCallInProgress = true;
    const startTime = Date.now();
    this.showSceneLoading(true, "A história continua...");
    this.displayOptions([], false, true);
    if (playerAction) {
      this.chatHistory.push({
        role: "user",
        parts: [
          {
            text: `Minha escolha é: ${playerAction}. Descreva a próxima cena.`,
          },
        ],
      });
    }
    const requestBody = {
      contents: this.chatHistory,
      systemInstruction: {
        parts: [
          {
            text: this.gameSystemInstruction.replace(
              "{theme}",
              this.currentTheme
            ),
          },
        ],
      },
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1024,
        response_mime_type: "application/json",
      },
    };
    try {
      const response = await fetch(this.GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (response.status === 429 && retries < this.MAX_RETRIES) {
        this.isApiCallInProgress = false;
        setTimeout(
          () => this.generateScene(playerAction, retries + 1),
          this.RETRY_DELAY * (retries + 1)
        );
        return;
      }
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      if (!data.candidates || !data.candidates[0].content)
        throw new Error("Resposta inválida da API.");
      const scene = JSON.parse(data.candidates[0].content.parts[0].text);
      this.chatHistory.push({
        role: "model",
        parts: [{ text: JSON.stringify(scene) }],
      });
      const elapsedTime = Date.now() - startTime;
      const remainingTime = this.MIN_API_RESPONSE_TIME - elapsedTime;
      setTimeout(async () => {
        this.showSceneLoading(false);
        await this.displayNarrative(scene.narrative);
        this.displayOptions(scene.options, scene.is_end);
        this.isApiCallInProgress = false;
      }, Math.max(0, remainingTime));
    } catch (error) {
      this.isApiCallInProgress = false;
      this.showSceneLoading(false);
      await this.displayNarrative(
        "Ocorreu um erro cósmico e a sua história se perdeu. O narrador pede desculpas."
      );
      this.displayOptions([], true);
    }
  }

  async displayNarrative(text) {
    const narrativeElement = document.getElementById("narrative-text");
    const cursor = document.querySelector(".typewriter-cursor");
    narrativeElement.textContent = "";
    cursor.style.display = "inline";
    this.isTyping = true;
    const fastForward = () => (this.isTyping = false);
    narrativeElement.parentElement.parentElement.addEventListener(
      "click",
      fastForward
    );
    for (let i = 0; i < text.length; i++) {
      if (!this.isTyping) {
        narrativeElement.textContent = text;
        break;
      }
      narrativeElement.textContent = text.slice(0, i + 1);
      await new Promise((resolve) => setTimeout(resolve, this.typewriterSpeed));
    }
    narrativeElement.parentElement.parentElement.removeEventListener(
      "click",
      fastForward
    );
    cursor.style.display = "none";
    this.isTyping = false;
  }

  displayOptions(options, isEnd, disabled = false) {
    const container = document.getElementById("options-container");
    container.innerHTML = "";
    if (isEnd) {
      container.innerHTML = `<div class="story-card" style="grid-column: 1 / -1; text-align: center; animation: fadeInUp 0.5s ease-out;"><h3 class="story-title">O Fim</h3><p class="story-description">Sua aventura chegou ao fim.</p><button class="theme-btn" id="final-restart-btn"><span>Nova Aventura</span><i class="fas fa-redo"></i></button></div>`;
      document
        .getElementById("final-restart-btn")
        .addEventListener("click", () => this.restartGame());
      return;
    }
    if (disabled) return;
    container.innerHTML = options
      .map(
        (option, index) =>
          `<div class="option-card" data-action="${
            option.text
          }" style="animation-delay: ${index * 0.1}s"><p class="option-text">${
            option.text
          }</p></div>`
      )
      .join("");
    container.querySelectorAll(".option-card").forEach((card) => {
      card.addEventListener("click", async () => {
        if (this.isTyping || this.isApiCallInProgress) return;
        this.sceneCounter++;
        document.getElementById(
          "scene-counter"
        ).textContent = `Cena ${this.sceneCounter}`;
        await this.generateScene(card.dataset.action);
      });
    });
  }

  showSceneLoading(show, text = "A história continua...") {
    const loading = document.getElementById("scene-loading");
    document.getElementById("scene-loading-text").textContent = text;
    loading.classList.toggle("active", show);
  }

  restartGame() {
    this.currentTheme = null;
    this.currentStory = null;
    this.currentStoryTitles.clear();
    this.sceneCounter = 1;
    this.chatHistory = [];
    document.getElementById("user-story-form").reset();
    document.documentElement.style.setProperty("--scene-image", "none");
    this.showScreen("theme-selection");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.game = new NightfallChroniclesGame();
});

document.addEventListener("keydown", (e) => {
  if (window.game.isTyping && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    window.game.isTyping = false;
    return;
  }
  if (window.game.isApiCallInProgress || window.game.isTyping) return;
  const num = parseInt(e.key);
  if (num >= 1 && num <= 4) {
    const optionCards = document.querySelectorAll(".option-card");
    if (optionCards[num - 1]) optionCards[num - 1].click();
  }
});

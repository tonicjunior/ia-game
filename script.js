let GEMINI_API_KEY = "";
const GEMINI_MODEL_NAME = "gemini-1.5-flash-latest";
let GEMINI_API_URL = ``;

const IMAGE_API_URL =
  "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
let IMAGE_API_KEY = "";
const IMAGE_API_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

const MIN_API_RESPONSE_TIME = 4000;
const RETRY_DELAY = 4000;
const MAX_RETRIES = 10;
const MAX_TITLE_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 150;

let chatHistory = [];
let gameSystemInstruction = "";
let currentTheme = null;
let isApiCallInProgress = false;
let sceneCounter = 0;

const themeSelectionScreen = document.getElementById("theme-selection");
const themeOptionsContainer = document.getElementById(
  "theme-options-container"
);
const storySelectionScreen = document.getElementById("story-selection");
const storyOptionsContainer = document.getElementById(
  "story-options-container"
);
const gameContainer = document.getElementById("game-container");

const themesData = [
  {
    id: "terror",
    name: "Terror",
    description:
      "Desvende mistérios sombrios e enfrente horrores psicológicos para sobreviver à noite.",
  },
  {
    id: "rpg-dungeons&dragons",
    name: "RPG Medieval",
    description:
      "Forje seu destino com espada e magia em um reino de masmorras, dragões e intrigas.",
  },
];

let progressBarInterval;
const BACKEND_API_URL = "https://apijs-production-2fd0.up.railway.app";

async function loadingApiKeys() {
  try {
    const chatiaKey = await fetch(`${BACKEND_API_URL}/get-chat-key`);
    const imgKey = await fetch(`${BACKEND_API_URL}/get-img-key`);
    if (!chatiaKey.ok) {
      throw new Error("Não foi possível buscar o histórico do servidor.");
    }

    const chatiaKeyJson = await chatiaKey.json();
    const imgKeyJson = await imgKey.json();
    GEMINI_API_KEY = chatiaKeyJson.key;
    IMAGE_API_KEY = imgKeyJson.key;
    GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
  }
}

loadingApiKeys();

function createLoadingScreen() {
  const loadingScreen = document.createElement("div");
  loadingScreen.id = "loading-screen";
  loadingScreen.className = "loading-screen";
  loadingScreen.innerHTML = `
    <h1 class="game-title">NIGHTFALL CHRONICLES</h1>
    <div class="progress-bar-container">
      <div id="progress-bar" class="progress-bar"></div>
    </div>
  `;
  document.body.appendChild(loadingScreen);
  return loadingScreen;
}

function removeLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) {
    loadingScreen.classList.add("hidden");
    setTimeout(() => {
      loadingScreen.remove();
      clearInterval(progressBarInterval);
    }, 800);
  }
}

function updateProgressBar(progress) {
  const progressBar = document.getElementById("progress-bar");
  if (progressBar) {
    progressBar.style.width = `${progress}%`;
  }
}

function simulateProgress(duration = 3000) {
  let progress = 0;
  const endTime = Date.now() + duration;

  clearInterval(progressBarInterval);
  progressBarInterval = setInterval(() => {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      progress = 100;
      clearInterval(progressBarInterval);
    } else {
      progress = 100 - (remaining / duration) * 100;
    }
    updateProgressBar(progress);

    if (progress >= 100) {
      setTimeout(removeLoadingScreen, 500);
    }
  }, 50);
}

function truncateText(text, maxLength) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + "...";
  }
  return text;
}

document.addEventListener("DOMContentLoaded", () => {
  simulateProgress(3000);
  setTimeout(loadThemes, 3500);
});

function loadThemes() {
  themeOptionsContainer.innerHTML = "";
  themesData.forEach((theme) => {
    const themeOption = document.createElement("div");
    themeOption.className = "theme-option animate__animated animate__fadeInUp";
    themeOption.dataset.theme = theme.id;
    themeOption.innerHTML = `
                      <div class="theme-content">
                          <h2>${theme.name}</h2>
                          <p>${theme.description}</p>
                          <button class="select-btn">Selecionar Tema</button>
                      </div>
                  `;
    themeOption
      .querySelector(".select-btn")
      .addEventListener("click", () => showStorySelection(theme.id));
    themeOptionsContainer.appendChild(themeOption);
  });
}

async function showStorySelection(themeId) {
  currentTheme = themeId;
  themeSelectionScreen.classList.add("hidden");
  storySelectionScreen.classList.remove("hidden");

  storyOptionsContainer.innerHTML =
    '<div class="loading-text animate__animated animate__fadeIn">Gerando 3 histórias únicas para você...</div>';

  const storyGenerationPrompt = `Você é uma IA criativa que gera 3 opções de histórias únicas para um jogo de RPG de "${themeId}".
                                  Forneça um array de objetos JSON, com cada objeto representando uma história. O TÍTULO deve ter no máximo 30 caracteres e a DESCRIÇÃO no máximo 150 caracteres. Não inclua nenhum outro texto na resposta.
                                  A estrutura deve ser:
                                  [
                                       {
                                           "title": "Um título criativo e chamativo.",
                                           "description": "Uma descrição breve e intrigante da história.",
                                           "prompt": "Um prompt para o mestre do jogo criar 4 personagens para a cena inicial. Ex: O jogador está em uma taverna prestes a iniciar uma jornada e deve escolher entre quatro heróis com passados misteriosos.",
                                           "id": "story-1"
                                       },
                                       {
                                           "title": "Outro título criativo.",
                                           "description": "Outra descrição intrigante.",
                                           "prompt": "Outro prompt detalhado para a criação de 4 personagens distintos.",
                                           "id": "story-2"
                                       },
                                       {
                                           "title": "Um terceiro título criativo.",
                                           "description": "Mais uma descrição intrigante.",
                                           "prompt": "Mais um prompt inicial que estabelece o cenário para a escolha de um de quatro protagonistas.",
                                           "id": "story-3"
                                       }
                                  ]
                                  Gere agora 3 histórias completas para o tema "${themeId}".`;

  const headers = { "Content-Type": "application/json" };

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        contents: [{ parts: [{ text: storyGenerationPrompt }] }],
        generationConfig: {
          temperature: 1.2,
          maxOutputTokens: 1500,
          response_mime_type: "application/json",
        },
      }),
    });

    const data = await response.json();
    const stories = JSON.parse(data.candidates[0].content.parts[0].text);

    storyOptionsContainer.innerHTML = "";
    stories.forEach((story) => {
      const storyOption = document.createElement("div");
      storyOption.className =
        "story-option animate__animated animate__fadeInUp";
      storyOption.innerHTML = `
                                  <div class="story-content">
                                      <h2>${truncateText(
                                        story.title,
                                        MAX_TITLE_LENGTH
                                      )}</h2>
                                      <p>${truncateText(
                                        story.description,
                                        MAX_DESCRIPTION_LENGTH
                                      )}</p>
                                      <button class="select-btn">Começar Aventura</button>
                                  </div>
                              `;
      storyOption
        .querySelector(".select-btn")
        .addEventListener("click", () => startStory(story));
      storyOptionsContainer.appendChild(storyOption);
    });
  } catch (error) {
    console.error("Erro ao gerar histórias com Gemini:", error);
    storyOptionsContainer.innerHTML = `
                                  <div class="error-message animate__animated animate__fadeIn">
                                      <p>Falha ao gerar histórias. Tente novamente mais tarde.</p>
                                      <button class="option-btn" onclick="location.reload()">Recarregar</button>
                                  </div>
                              `;
  }
}

async function generateImage(prompt) {
  const loadingTextElement = document.querySelector(
    "#game-container .loading-text"
  );
  if (loadingTextElement) {
    loadingTextElement.textContent = "Gerando a arte da sua aventura...";
  }

  const enhancedPrompt = `cinematic poster, high-quality detailed illustration for an immersive game, ${prompt}, style of ${currentTheme}, epic, vibrant colors, dynamic composition, --style expressive.`;

  try {
    const response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${IMAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: enhancedPrompt }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const imageBlob = await response.blob();
    const imageUrl = URL.createObjectURL(imageBlob);
    return imageUrl;
  } catch (error) {
    console.error("Erro ao gerar imagem:", error);
    return "none";
  }
}

async function startStory(story) {
  storySelectionScreen.classList.add("hidden");
  gameContainer.style.display = "block";
  addThemeEffects(currentTheme);

  const imagePrompt = `A high-quality illustration for a ${currentTheme} RPG, with the theme of: ${story.title} - ${story.description}`;

  gameContainer.innerHTML =
    '<div class="loading-text animate__animated animate__fadeIn">Preparando a aventura...</div>';

  const imageUrl = await generateImage(imagePrompt);
  document.documentElement.style.setProperty(
    "--image-url",
    `url('${imageUrl}')`
  );

  gameContainer.innerHTML =
    '<div class="loading-text animate__animated animate__fadeIn">Gerando a cena inicial...</div>';

  sceneCounter = 1;

  gameSystemInstruction = `
Você é um mestre de RPG de texto altamente criativo, responsável por conduzir uma história interativa no estilo "${currentTheme}".
Seu papel é criar uma narrativa imersiva e profissional, onde o jogador toma decisões que impactam o rumo da história.

**Instrução Inicial - Criação de Personagem:**
Na sua primeira resposta, você receberá um prompt para criar 4 opções de personagens.
Sua tarefa é criar uma cena introdutória e 4 personagens distintos como as 4 primeiras opções de escolha para o jogador.
A narrativa deve descrever o cenário e o momento da escolha. A história principal começará *após* o jogador escolher um desses personagens. A partir daí, a história continua normalmente.
Podendo conter os 4 personagens ou focada apenas no personagem escolhido, faça essa escolha de forma randomica.

**Estrutura obrigatória da história:**
- A história deve conter no mínimo **2 cenas sequenciais** após a escolha do personagem, cada uma oferecendo exatamente 4 opções de ação.
- A história pode ter no máximo **5 cenas** no total, ou seja depois de 5 escolhas deve finalizar.
- Nenhum final pode ocorrer antes da 2ª cena.
- A partir da 2ª cena, o desfecho pode acontecer de forma coerente.
- sem finais abruptos

**Requisitos obrigatórios para cada cena:**
1. A descrição deve ser imersiva, rica em detalhes sensoriais.
2. O texto deve ser coeso, fluido e de qualidade literária.
3. Cada cena deve apresentar **exatamente 4 opções de ação**, distintas e relevantes.
4. As escolhas do jogador devem influenciar diretamente o rumo da narrativa.
5. É **altamente recomendável** incluir pelo menos **um plot twist criativo**.
6. O estilo da escrita deve ser profissional e envolvente.
7. Finais devem ser completos, impactantes e satisfatórios, mesmo que trágicos.
8. O conteúdo da história pode conter temas adultos e violentos para um público **18+**.
9. Use como inspiração a estrutura de escolhas e ramificações de **Detroit: Become Human**.
10. Nas opcoes fornecidas ao usuario, jamais devera conter o que vai acontecer se ele escolher a opcao.

**Finais possíveis:**
A história deve encerrar de diversas maneiras, descritas de forma rica e conclusiva.

Seu formato de resposta DEVE ser **APENAS** um objeto JSON, sem nenhum texto extra. O formato é:
{
  "narrative": "A descrição detalhada da cena.",
  "options": [
    { "text": "Primeira opção de ação.", "action": "ação-1" },
    { "text": "Segunda opção de ação.", "action": "ação-2" },
    { "text": "Terceira opção de ação.", "action": "ação-3" },
    { "text": "Quarta opção de ação.", "action": "ação-4" }
  ],
  "is_end": false,
  "end_reason": null
}`;

  // ***** INÍCIO DA CORREÇÃO PRINCIPAL *****
  const initialUserPrompt = `
Você VAI começar a história de "${currentTheme}" intitulada "${story.title}".
A premissa desta história é: "${story.description}".
Sua primeira tarefa é criar a cena inicial e 4 opções de personagens para o jogador escolher, usando como base este prompt: ${story.prompt}.
NÃO se desvie do título e da premissa informados. A história DEVE ser sobre "${story.title}".
`;
  chatHistory = [{ role: "user", parts: [{ text: initialUserPrompt }] }];
  // ***** FIM DA CORREÇÃO PRINCIPAL *****

  await callGeminiApi();
}

async function callGeminiApi(userAction = null, retries = 0) {
  if (isApiCallInProgress) return;
  isApiCallInProgress = true;

  const startTime = Date.now();

  disableOptions();

  if (userAction) {
    chatHistory.push({
      role: "user",
      parts: [
        {
          text: `Minha escolha é: ${userAction}. Descreva a próxima cena com base nisso.`,
        },
      ],
    });
    sceneCounter++;
  }

  const headers = { "Content-Type": "application/json" };

  const requestBody = {
    contents: chatHistory,
    systemInstruction: { parts: [{ text: gameSystemInstruction }] },
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 1024,
      response_mime_type: "application/json",
    },
  };

  const optionsContainer = document.querySelector(".options-container");
  if (optionsContainer)
    optionsContainer.innerHTML = `<div class="loading-text animate__animated animate__fadeIn">Gerando a próxima cena...</div>`;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (response.status === 429 && retries < MAX_RETRIES) {
      console.warn(
        `Erro 429: Limite de requisições excedido. Tentando novamente em ${
          RETRY_DELAY / 1000
        }s... (Tentativa ${retries + 1}/${MAX_RETRIES})`
      );
      isApiCallInProgress = false;
      setTimeout(() => callGeminiApi(userAction, retries + 1), RETRY_DELAY);
      return;
    }

    if (!response.ok) {
      const errorDetails = await response.json().catch(() => ({}));
      throw new Error(
        `Erro da API Gemini: ${response.status} ${
          response.statusText
        }. Detalhes: ${JSON.stringify(errorDetails)}`
      );
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0].content) {
      throw new Error(
        "Resposta inválida da API do Gemini. A resposta pode ter sido bloqueada por segurança."
      );
    }

    const aiResponseText = data.candidates[0].content.parts[0].text;
    const aiResponseJson = JSON.parse(aiResponseText);

    chatHistory.push({ role: "model", parts: [{ text: aiResponseText }] });

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;
    const remainingTime = MIN_API_RESPONSE_TIME - elapsedTime;

    setTimeout(() => {
      renderScene(aiResponseJson);
      isApiCallInProgress = false;
    }, Math.max(0, remainingTime));
  } catch (error) {
    console.error("Erro na chamada da API Gemini:", error);
    isApiCallInProgress = false;
    if (retries < MAX_RETRIES) {
      setTimeout(() => callGeminiApi(userAction, retries + 1), RETRY_DELAY);
    } else {
      const errorContainer =
        document.querySelector(".options-container") || gameContainer;
      errorContainer.innerHTML = `
        <div class="error-message animate__animated animate__fadeIn">
          <p>Ocorreu um erro crítico ao gerar a cena. Por favor, recarregue o jogo.</p>
          <button class="option-btn" onclick="location.reload()">Recarregar</button>
        </div>
      `;
    }
  }
}

function disableOptions() {
  const buttons = document.querySelectorAll(".option-btn");
  buttons.forEach((btn) => (btn.disabled = true));
}

function renderScene(sceneData) {
  const newSceneElement = document.createElement("div");
  newSceneElement.className = "game-scene";

  const narrativeDiv = document.createElement("div");
  narrativeDiv.className = "scene-text";
  narrativeDiv.innerHTML = sceneData.narrative.replace(/\n/g, "<br>");

  const optionsContainer = document.createElement("div");
  optionsContainer.className = "options-container";

  if (sceneData.options && sceneData.options.length > 0) {
    sceneData.options.forEach((option) => {
      const optionCard = document.createElement("div");
      optionCard.className = "option-card";

      const optionBtn = document.createElement("button");
      optionBtn.className = "option-btn";
      optionBtn.textContent = option.text;
      optionBtn.addEventListener("click", () => callGeminiApi(option.text));

      optionCard.appendChild(optionBtn);
      optionsContainer.appendChild(optionCard);
    });
  }

  if (sceneData.is_end && sceneData.options?.length === 0) {
    const restartBtnCard = document.createElement("div");
    restartBtnCard.className =
      "option-card animate__animated animate__bounceIn";

    const restartBtn = document.createElement("button");
    restartBtn.className = "option-btn";
    restartBtn.textContent = "Jogar Novamente";
    restartBtn.addEventListener("click", () => location.reload());

    restartBtnCard.appendChild(restartBtn);
    optionsContainer.innerHTML = "";
    optionsContainer.appendChild(restartBtnCard);
  }

  newSceneElement.appendChild(narrativeDiv);
  newSceneElement.appendChild(optionsContainer);

  narrativeDiv.classList.add("animate__animated", "animate__fadeIn");
  optionsContainer.classList.add(
    "animate__animated",
    "animate__fadeInUp",
    "animate__delay-1s"
  );

  gameContainer.innerHTML = "";
  gameContainer.appendChild(newSceneElement);

  updateThemeColors();
  addThemeEffects(currentTheme);
}

function updateThemeColors() {
  // Corrigido para corresponder ao ID 'rpg-dungeons&dragons'
  if (currentTheme === "rpg-dungeons&dragons") {
    document.documentElement.style.setProperty(
      "--accent-color",
      "var(--rpg-accent)"
    );
    document.documentElement.style.setProperty(
      "--text-color",
      "var(--rpg-text)"
    );
    document.documentElement.style.setProperty("--accent-rgb", "249, 199, 79");
    document.documentElement.style.setProperty(
      "--shadow-color",
      "rgba(249, 199, 79, 0.4)"
    );
  } else if (currentTheme === "terror") {
    document.documentElement.style.setProperty(
      "--accent-color",
      "var(--terror-accent)"
    );
    document.documentElement.style.setProperty(
      "--text-color",
      "var(--terror-text)"
    );
    document.documentElement.style.setProperty("--accent-rgb", "193, 18, 31");
    document.documentElement.style.setProperty(
      "--shadow-color",
      "rgba(193, 18, 31, 0.4)"
    );
  }
}

function addThemeEffects(theme) {
  const bodyElement = document.body;
  bodyElement
    .querySelectorAll(
      ".rpg-bg-effect, .terror-bg-effect, .rpg-particles, .terror-particles, .blood-drips"
    )
    .forEach((el) => el.remove());

  // Corrigido para corresponder ao ID 'rpg-dungeons&dragons'
  if (theme === "rpg-dungeons&dragons") {
    const rpgBg = document.createElement("div");
    rpgBg.className = "rpg-bg-effect";
    bodyElement.appendChild(rpgBg);
    const rpgParticles = document.createElement("div");
    rpgParticles.className = "rpg-particles";
    bodyElement.appendChild(rpgParticles);
    document.documentElement.style.setProperty(
      "--accent-color",
      "var(--rpg-accent)"
    );
    document.documentElement.style.setProperty(
      "--text-color",
      "var(--rpg-text)"
    );
    document.documentElement.style.setProperty("--accent-rgb", "249, 199, 79");
  } else if (theme === "terror") {
    const terrorBg = document.createElement("div");
    terrorBg.className = "terror-bg-effect";
    bodyElement.appendChild(terrorBg);
    const terrorParticles = document.createElement("div");
    terrorParticles.className = "terror-particles";
    bodyElement.appendChild(terrorParticles);
    const bloodDrips = document.createElement("div");
    bloodDrips.className = "blood-drips";
    bodyElement.appendChild(bloodDrips);
    document.documentElement.style.setProperty(
      "--accent-color",
      "var(--terror-accent)"
    );
    document.documentElement.style.setProperty(
      "--text-color",
      "var(--terror-text)"
    );
    document.documentElement.style.setProperty("--accent-rgb", "193, 18, 31");
  }
}

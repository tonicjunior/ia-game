// --- Configurações da API ---
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL_NAME = "llama-3.1-8b-instant";
const GROQ_API_KEY = "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";

// --- Configurações da API de Imagens (Stable Diffusion no Hugging Face) ---
const IMAGE_API_URL =
  "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";
const IMAGE_API_KEY = "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"; // Substitua pela sua chave REAL
const IMAGE_API_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";
const MIN_API_RESPONSE_TIME = 4000; // 4 segundos
const RETRY_DELAY = 2000; // 2 segundos de espera para retry
const MAX_RETRIES = 3; // Máximo de 3 tentativas de retry

// Limites de caracteres para o texto dos cards
const MAX_TITLE_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 150;

// --- Variáveis de estado do jogo ---
let chatHistory = [];
let currentTheme = null;
let isApiCallInProgress = false; // Flag para controlar chamadas simultâneas
let sceneCounter = 0; // Contador de cenas para a progressão de 10 cenas

// --- Elementos do DOM ---
const themeSelectionScreen = document.getElementById("theme-selection");
const themeOptionsContainer = document.getElementById(
  "theme-options-container"
);
const storySelectionScreen = document.getElementById("story-selection");
const storyOptionsContainer = document.getElementById(
  "story-options-container"
);
const gameContainer = document.getElementById("game-container");

// --- Dados de Temas Fixos ---
const themesData = [
  {
    id: "terror",
    name: "Terror de Sobrevivência",
    description:
      "Desvende mistérios sombrios e enfrente horrores psicológicos para sobreviver à noite.",
  },
  {
    id: "rpg",
    name: "Fantasia Medieval",
    description:
      "Embarque em uma jornada épica de dragões, magos e castelos em um mundo de magia e aventura.",
  },
];

// Adicione estas variáveis no início do seu código
let progressBarInterval;

// Adicione estas funções no seu código
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
    }, 800); // Match with CSS transition duration
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
      setTimeout(removeLoadingScreen, 500); // Pequeno delay antes de remover
    }
  }, 50);
}

// --- Função para abreviar texto ---
function truncateText(text, maxLength) {
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + "...";
  }
  return text;
}

// --- Funções do Jogo ---

// Inicia a aplicação exibindo os temas fixos
document.addEventListener("DOMContentLoaded", () => {
  simulateProgress(3000);
  setTimeout(loadThemes, 3500);
});

// Carrega os temas a partir dos dados fixos
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

// Mostra a tela de seleção de histórias e gera as histórias com a IA
async function showStorySelection(themeId) {
  currentTheme = themeId;
  themeSelectionScreen.classList.add("hidden");
  storySelectionScreen.classList.remove("hidden");

  storyOptionsContainer.innerHTML =
    '<div class="loading-text animate__animated animate__fadeIn">Gerando 3 histórias únicas para você...</div>';

  const systemPrompt = {
    role: "system",
    content: `Você é uma IA criativa que gera 3 opções de histórias únicas para um jogo de RPG de "${themeId}".
                Forneça um array de objetos JSON, com cada objeto representando uma história. O TÍTULO deve ter no máximo 30 caracteres e a DESCRIÇÃO no máximo 150 caracteres. Não inclua nenhum outro texto na resposta.
                A estrutura deve ser:
                [
                    {
                        "title": "Um título criativo e chamativo.",
                        "description": "Uma descrição breve e intrigante da história.",
                        "prompt": "Um prompt inicial detalhado para o mestre do jogo, sobre a cena de abertura. Ex: O jogador acorda em um...",
                        "id": "story-1"
                    },
                    {
                        "title": "Outro título criativo.",
                        "description": "Outra descrição intrigante.",
                        "prompt": "Outro prompt inicial detalhado.",
                        "id": "story-2"
                    },
                    {
                        "title": "Um terceiro título criativo.",
                        "description": "Mais uma descrição intrigante.",
                        "prompt": "Mais um prompt inicial detalhado.",
                        "id": "story-3"
                    }
                ]
                Gere agora 3 histórias completas para o tema "${themeId}".`,
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${GROQ_API_KEY}`,
  };

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        model: GROQ_MODEL_NAME,
        messages: [systemPrompt],
        max_tokens: 1500,
        temperature: 1.2,
      }),
    });

    const data = await response.json();
    const stories = JSON.parse(data.choices[0].message.content);

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
    console.error("Erro ao gerar histórias:", error);
    storyOptionsContainer.innerHTML = `
                    <div class="error-message animate__animated animate__fadeIn">
                        <p>Falha ao gerar histórias. Tente novamente mais tarde.</p>
                        <button class="option-btn" onclick="location.reload()">Recarregar</button>
                    </div>
                `;
  }
}

// --- Nova função para gerar a imagem ---
async function generateImage(prompt) {
  const loadingTextElement = document.querySelector(
    "#game-container .loading-text"
  );
  if (loadingTextElement) {
    loadingTextElement.textContent = "Gerando a arte da sua aventura...";
  }

  // Aprimora o prompt para gerar imagens de maior qualidade
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
    return "none"; // Retorna none para o CSS não aplicar background-image
  }
}

// Inicia a história com o prompt inicial
async function startStory(story) {
  storySelectionScreen.classList.add("hidden");
  gameContainer.style.display = "block";
  addThemeEffects(currentTheme);

  const imagePrompt = `A high-quality illustration for a ${currentTheme} RPG, with the theme of: ${story.title} - ${story.description}`;

  // Define uma mensagem de carregamento temporária no contêiner do jogo
  gameContainer.innerHTML =
    '<div class="loading-text animate__animated animate__fadeIn">Preparando a aventura...</div>';

  const imageUrl = await generateImage(imagePrompt);
  document.documentElement.style.setProperty(
    "--image-url",
    `url('${imageUrl}')`
  );

  gameContainer.innerHTML =
    '<div class="loading-text animate__animated animate__fadeIn">Gerando a cena inicial...</div>';

  sceneCounter = 1; // Reseta o contador de cenas para a nova partida

  const systemPrompt = {
    role: "system",
    content: `Você é um mestre de RPG de texto no tema de "${currentTheme}".
                A história deve ter no máximo 7 cenas sequenciais.
                A cada resposta, você deve:
                1. Descrever a cena de forma imersiva, usando sons, cheiros e emoções.
                2. Apresentar **exatamente 4 opções de ação** para o jogador.
                3. A progressão deve levar em conta as escolhas do jogador, com consequências sutis.
                4. Inclua pelo menos **um plot twists obrigatório** em cenas variadas.
                5. A história deve culminar em um dos 5 finais possíveis: "Você vence o mal e é celebrado.", "A vitória exige um sacrifício terrível.","você é derrotado, de uma forma terrivel", "O verdadeiro vilão nunca é revelado" ou "Você se torna o que jurou destruir.".
                
                Seu formato de resposta DEVE ser **APENAS** um objeto JSON, sem nenhum texto extra. O formato é:
                {
                  "narrative": "A descrição detalhada da cena, com o ton de ${currentTheme}.",
                  "options": [
                    { "text": "Primeira opção de ação.", "action": "ação-1" },
                    { "text": "Segunda opção de ação.", "action": "ação-2" },
                    { "text": "Terceira opção de ação.", "action": "ação-3" },
                    { "text": "Quarta opção de ação.", "action": "ação-4" }
                  ],
                  "is_end": false,
                  "end_reason": null
                }
                
                Se a história chegar a uma conclusão (cena 7 ou um final for ativado), defina "is_end" como true e preencha "end_reason" com o nome do final escolhido.
                os finais devem ser bem descritos, para garantir uma imersão na historia.
                
                A aventura começa agora com a cena de abertura: ${story.prompt}.`,
  };

  chatHistory = [systemPrompt];

  await callGroqApi();
}

// Função para chamar a API da Groq
async function callGroqApi(userAction = null, retries = 0) {
  if (isApiCallInProgress) return;
  isApiCallInProgress = true;

  const startTime = Date.now();

  // Desabilita os botões para evitar cliques durante o carregamento
  disableOptions();

  if (userAction) {
    chatHistory.push({ role: "user", content: userAction });
    sceneCounter++;
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${GROQ_API_KEY}`,
  };

  const requestBody = {
    model: GROQ_MODEL_NAME,
    messages: chatHistory,
    max_tokens: 1024,
    temperature: 0.9,
    stream: false,
  };

  const optionsContainer = document.querySelector(".options-container");
  if (optionsContainer)
    optionsContainer.innerHTML = `<div class="loading-text animate__animated animate__fadeIn">Gerando a próxima cena...</div>`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (response.status === 429 && retries < MAX_RETRIES) {
      // Retry logic for 429 error
      console.warn(
        `Erro 429: Limite de requisições excedido. Tentando novamente em ${
          RETRY_DELAY / 1000
        }s... (Tentativa ${retries + 1}/${MAX_RETRIES})`
      );
      isApiCallInProgress = false; // Permite a próxima tentativa
      setTimeout(() => callGroqApi(userAction, retries + 1), RETRY_DELAY);
      return;
    }

    if (!response.ok) {
      const errorDetails = await response.json().catch(() => ({}));
      throw new Error(
        `Erro da API: ${response.status} ${
          response.statusText
        }. Detalhes: ${JSON.stringify(errorDetails)}`
      );
    }

    const data = await response.json();
    const aiResponseText = data.choices[0].message.content;
    const aiResponseJson = JSON.parse(aiResponseText);

    chatHistory.push({ role: "assistant", content: aiResponseText });

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;
    const remainingTime = MIN_API_RESPONSE_TIME - elapsedTime;

    // Garante que o loading dure no mínimo o tempo definido
    setTimeout(() => {
      renderScene(aiResponseJson);
      isApiCallInProgress = false;
    }, Math.max(0, remainingTime));
  } catch (error) {
    callGroqApi();
  }
}

// Desabilita os botões de opção durante o carregamento
function disableOptions() {
  const buttons = document.querySelectorAll(".option-btn");
  buttons.forEach((btn) => (btn.disabled = true));
}

// Função para renderizar uma cena com base nos dados JSON da IA
function renderScene(sceneData) {
  // Cria um novo elemento de cena
  const newSceneElement = document.createElement("div");
  newSceneElement.className = "game-scene";

  // Cria os elementos da cena
  const narrativeDiv = document.createElement("div");
  narrativeDiv.className = "scene-text";
  narrativeDiv.innerHTML = sceneData.narrative.replace(/\n/g, "<br>");

  const optionsContainer = document.createElement("div");
  optionsContainer.className = "options-container";

  // Se houver opções, cria as novas cartas interativas
  if (sceneData.options && sceneData.options.length > 0) {
    sceneData.options.forEach((option) => {
      const optionCard = document.createElement("div");
      optionCard.className = "option-card";

      const optionBtn = document.createElement("button");
      optionBtn.className = "option-btn";
      optionBtn.textContent = option.text;
      optionBtn.addEventListener("click", () => callGroqApi(option.action));

      optionCard.appendChild(optionBtn);
      optionsContainer.appendChild(optionCard);
    });
  }

  // Verifica se a história terminou
  if (sceneData.is_end || sceneCounter >= 10) {
    narrativeDiv.innerHTML += `<br><br><strong>FIM DO JOGO:</strong> ${
      sceneData.end_reason || "A aventura chega ao fim após um longo caminho."
    }`;
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

  // Adiciona os elementos à nova cena
  newSceneElement.appendChild(narrativeDiv);
  newSceneElement.appendChild(optionsContainer);

  // Adiciona animações de entrada
  narrativeDiv.classList.add("animate__animated", "animate__fadeIn");
  optionsContainer.classList.add(
    "animate__animated",
    "animate__fadeInUp",
    "animate__delay-1s"
  );

  // Substitui o conteúdo do container de forma suave
  gameContainer.innerHTML = "";
  gameContainer.appendChild(newSceneElement);

  // Atualiza a cor de destaque e a sombra com base no tema
  updateThemeColors();
  addThemeEffects(currentTheme);
}

// Nova função para atualizar as cores do tema e a sombra
function updateThemeColors() {
  if (currentTheme === "rpg") {
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

// Adiciona efeitos visuais ao fundo
function addThemeEffects(theme) {
  const bodyElement = document.body;
  bodyElement
    .querySelectorAll(
      ".rpg-bg-effect, .terror-bg-effect, .rpg-particles, .terror-particles, .blood-drips"
    )
    .forEach((el) => el.remove());

  if (theme === "rpg") {
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

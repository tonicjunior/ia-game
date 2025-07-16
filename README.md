# Nightfall Chronicles ⚔️

**Nightfall Chronicles** é um jogo de RPG de texto imersivo, onde a narrativa é moldada dinamicamente por inteligência artificial. Escolha entre um universo de fantasia medieval ou um cenário de terror de sobrevivência e tome decisões que determinarão seu destino. Cada partida é uma aventura única.

## 🎮 Demonstração Ao Vivo

Experimente o jogo agora mesmo!

[![Jogue Agora](https://img.shields.io/badge/JOGAR_AGORA-8A2BE2?style=for-the-badge&logo=githubpages)](https://tonicjunior.github.io/ia-game/)

## ✨ Recursos

-   **Narrativas Geradas por IA**: Histórias e cenários criados dinamicamente pela API do Gemini, garantindo que não haja duas aventuras iguais.
-   **Dois Temas Distintos**: Mergulhe em um mundo de **RPG Medieval** com masmorras e dragões, ou tente sobreviver aos horrores psicológicos de um cenário de **Terror**.
-   **Arte Imersiva**: Cada aventura é iniciada com uma imagem única gerada por IA (Stable Diffusion) para estabelecer o tom visual da sua jornada.
-   **Escolhas com Consequências**: Cada cena apresenta 4 opções de ação. Suas decisões influenciam diretamente o enredo, levando a múltiplos finais possíveis.
-   **Finais Impactantes**: A história pode se desenrolar em até 5 cenas, com finais que variam de triunfos heroicos a desfechos trágicos.
-   **Efeitos Visuais Temáticos**: A interface se adapta ao tema escolhido, com efeitos de partículas, cores e animações personalizadas para uma imersão total.
-   **Design Responsivo**: Jogue confortavelmente em seu desktop, tablet ou smartphone.

***

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído com um conjunto de tecnologias modernas para criar uma experiência rica e dinâmica.

-   **Frontend**: `HTML5`, `CSS3`, `JavaScript` (Vanilla JS)
-   **Geração de Texto (IA)**: **Google Gemini API** (`gemini-1.5-flash-latest`)
-   **Geração de Imagens (IA)**: **Stable Diffusion XL** via Hugging Face API
-   **Hospedagem de Chaves**: Backend em `Node.js` hospedado no **Railway** para gerenciamento seguro das chaves de API.
-   **Animações**: Biblioteca `Animate.css` para transições e efeitos de interface.

***

## 🚀 Como Executar Localmente

Para executar o projeto em sua máquina local, siga estes passos simples:

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/tonicjunior/ia-game.git](https://github.com/tonicjunior/ia-game.git)
    ```

2.  **Navegue até o diretório do projeto:**
    ```bash
    cd ia-game
    ```

3.  **Abra o arquivo `index.html` em seu navegador:**
    -   Você pode simplesmente clicar duas vezes no arquivo `index.html`.
    -   Ou, para uma melhor experiência (evitando possíveis problemas com CORS), inicie um servidor local. Se você tiver o Python instalado:
        ```bash
        # Python 3.x
        python -m http.server
        ```
        Em seguida, acesse `http://localhost:8000` em seu navegador.

***

## 🔧 Configuração

O projeto está configurado para buscar as chaves da API Gemini e Hugging Face de um backend hospedado no Railway.

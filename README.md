# Bug Buster 🐛☕

Um jogo retro-cyberpunk 2D de labirinto, desenvolvido inteiramente com as tecnologias base da Web (**HTML5, CSS3 e JavaScript Vanilla**), sem dependência de bibliotecas externas ou frameworks.

## 🎮 Como Jogar
- **Objetivo:** Colete todas as *Linhas de Código* (pontos brancos) do servidor para avançar de nível.
- **Movimentação:** Use as setinhas do teclado (Cima, Baixo, Esquerda, Direita).
- **Inimigos:** Evite os bugs. O Vermelho tentará te perseguir, o Roxo é aleatório.
- **Power-Up:** Pegue a Caneca de Café (laranja) para ficar invencível por alguns segundos. Enquanto estiver dourado, você pode devorar os bugs para ganhar 100 pontos bônus!
- **Túneis:** Saia pelas extremidades esquerda/direita do mapa para reaparecer no lado oposto.

## 🛠️ Tecnologias Utilizadas
- **HTML5 Canvas:** Renderização gráfica 2D de alta performance (60 FPS).
- **CSS3:** Estilização de interface e criação do efeito *Neon/Glow* usando sombras (`box-shadow`, `shadowBlur`).
- **JavaScript (ES6):** Toda a arquitetura do jogo, separada entre *Lógica de Negócio* (matrizes e controle de estado) e *Renderização/Loop* de jogo.
- **Web Audio API:** Sintetizadores embutidos geram os efeitos sonoros de coleta, poder e game over dinamicamente, sem necessidade de carregar arquivos de áudio externos.

## 📁 Estrutura do Projeto
- `index.html`: Telas de menu, vitória, derrota e o canvas.
- `style.css`: Estética do terminal hacker.
- `logic.js`: Classe pura de lógica e regras (testável em ambientes Node).
- `game.js`: Controlador do loop de renderização (requestAnimationFrame), input e áudio.
- `Documentacao_BugBuster.docx`: Documentação de projeto Frontend.

## 🚀 Como Executar
Basta fazer o clone deste repositório e abrir o arquivo `index.html` em qualquer navegador moderno. Não requer servidor local, Node.js ou bundler.

---
*Projeto desenvolvido para a disciplina de Aplicações Front End.*

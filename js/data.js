/*
 * UnlockGame — dados das fases.
 * É o único arquivo que você precisa editar para personalizar a jornada.
 *
 * Campos de cada fase:
 *  - day, title, releaseDate  → número, nome e quando abre (horário local do celular dele).
 *  - game                     → o minijogo que PRECISA ser vencido para liberar a recompensa.
 *  - keyFragment              → letra-chave ganha ao concluir; a fase 5 junta todas (A+M+O+R = AMOR).
 *  - unlockCodeHash           → hash do "código do Player 2": você manda por mensagem e ele
 *                               libera a fase sem jogar (plano B se algo der errado).
 *                               Gere novos códigos em tools/gerar-hash.html.
 *  - challenge                → a missão da vida real (vira "missão extra" depois do minijogo).
 *  - quote, spotifyEmbedUrl, diary → a recompensa.
 */
window.UG = window.UG || {};

UG.levelsData = [
  {
    day: 1,
    title: "Nível 1: Press start",
    releaseDate: "2026-10-19T00:00:00",
    game: {
      type: "memory",
      pairs: 4,
      intro: "Vire as cartas e encontre os 4 pares das nossas fotos.",
      photos: ["assets/fotos/foto1.jpeg", "assets/fotos/foto2.jpeg", "assets/fotos/foto3.jpeg", "assets/fotos/foto4.jpeg"]
    },
    keyFragment: "A",
    unlockCodeHash: "0b08510ff3650c",
    challenge: "Me manda uma foto de algo que te faz sorrir",
    quote: "“Me diga quantas vezes seu coração foi quebrado, para que eu possa saber quantas partes de você precisarei amar.”",
    spotifyEmbedUrl: "https://open.spotify.com/embed/track/3jh1luJjH8fBPOPOH9e43O?utm_source=generator",
    diary: "Primeiro nível concluído! Enquanto você estiver lendo isso, provavelmente eu estou contando as horas para te ver de novo. Vai com calma... A aventura só está começando."
  },
  {
    day: 2,
    title: "Nível 2: Combo de saudade",
    releaseDate: "2026-10-20T00:00:00",
    game: { type: "melody", rounds: 6, intro: "PuppyByte toca uma melodia. Repita a sequência — ela cresce a cada rodada." },
    keyFragment: "M",
    unlockCodeHash: "0c0610307061b1",
    challenge: "Escolhe uma música que tenha a nossa cara e me manda o verso que mais parece ter sido escrito para nós.",
    quote: "“Antes de você, minhas palavras eram apenas tinha perdida em páginas vazias. Mas então você chegou... e, pela primeira vez, senti que cada frase que escrevo sempre esteve tentando encontrar você.”",
    spotifyEmbedUrl: "https://open.spotify.com/embed/track/7i0yGIZxaP1GuHvVMpkLoB?utm_source=generator",
    diary: "Hoje ainda é o dia 2 e eu já estou morrendo de saudade de te ver, espero que esteja tomando água e comendo direitinho, te amo te amo te amo."
  },
  {
    day: 3,
    title: "Nível 3: Poção de coragem",
    releaseDate: "2026-10-21T00:00:00",
    game: { type: "catch", goal: 20, lives: 3, intro: "Arraste a poção e colete 20 corações. Desvie das nuvens de saudade!" },
    keyFragment: "O",
    unlockCodeHash: "186dd9bfabd3fd",
    challenge: "Tira uma selfie agora, do jeitinho que você está rsrs, sem arrumar nada, e me manda com a legenda ‘player 1 pronta’.",
    quote: "“Você me ensinou a amar... mas eu já te amava antes mesmo de aprender.”",
    spotifyEmbedUrl: "https://open.spotify.com/embed/track/1AaBgDyjuG6ckj8PuRoG9m?utm_source=generator",
    diary: "Coragem não é não ter medo, é ir mesmo assim. E você faz isso o tempo todo, mesmo sem perceber. Hoje eu só queria que você soubesse que eu percebo."
  },
  {
    day: 4,
    title: "Nível 4: Dois players",
    releaseDate: "2026-10-22T00:00:00",
    game: { type: "maze", cols: 7, rows: 9, intro: "Leve o PuppyByte pelo labirinto até o Player 2 ♥. Deslize na tela ou use as setas — e pegue as 3 estrelas no caminho." },
    keyFragment: "R",
    unlockCodeHash: "06fb9dee6b97e6",
    challenge: "Termina a frase e me manda: ‘A minha parte favorita da gente é…’",
    quote: "“Eu te reconheceria na escuridão total, mesmo que você fosse mudo e eu surdo. Eu te reconheceria em outra vida inteira, em corpos diferentes, em tempos diferentes. E eu te amaria em tudo isso, até que a última estrela do céu se apagasse no céu pela eternidade.”",
    spotifyEmbedUrl: "https://open.spotify.com/embed/track/5OQzIgnLWKct3kq6T1z5gZ?utm_source=generator",
    diary: "Quase no final do mapa. Eu já tenho uma lista mental de tudo que quero fazer com você quando voltar, e ela não para de crescer. Spoiler: o primeiro item é um beijo rsrsrs."
  },
  {
    day: 5,
    title: "Nível 5: Fase bônus",
    releaseDate: "2026-10-23T00:00:00",
    game: { type: "lock", intro: "O último baú está trancado. Use as letras-chave que você ganhou em cada fase para abrir o cofre." },
    keyFragment: "",
    unlockCodeHash: "0162b4856e2b3c",
    challenge: "Pronto, agora já pode montar o roteiro do nosso primeiro dia juntas depois da viagem: café, almoço, jantar, benfica kk....",
    quote: "“Por favor, nunca se esqueça de que o sol se levanta e se põe com seu sorriso. Pelo menos para mim. Você é a única coisa nesse mundo que merece devoção.”",
    spotifyEmbedUrl: "https://open.spotify.com/embed/track/0dBXYlJ3QBuf5edUSZQNRT?utm_source=generator",
    diary: "Você venceu o jogo! Obrigada por jogar até aqui, agora vem a minha parte favorita: nós, juntinhas de novo."
  }
];

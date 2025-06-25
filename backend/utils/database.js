const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "../data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const GAMES_FILE = path.join(DATA_DIR, "games.json");
const USER_GAMES_FILE = path.join(DATA_DIR, "userGames.json");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");

const initializeDatabase = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const initialData = {
    users: [],
    games: [
      {
        id: generateId(),
        title: "Hollow Knight: Silksong",
        description:
          "Hollow Knight: Silksong é um futuro jogo de ação e aventura metroidvania desenvolvido e publicado pela Team Cherry para Windows, macOS, Linux, Nintendo Switch, Xbox One, Xbox Series X/S, PlayStation 4, e PlayStation 5.",
        developer: "Team Cherry",
        publisher: "Team Cherry",
        releaseDate: "2025-02-30",
        genres: ["Metroidvania", "Action", "Adventure"],
        platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch"],
        tags: ["Souls-like", "Action", "PC", "Gamepass"],
        images: {
          cover:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1030300/header.jpg?t=1742776298",
          banner:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1030300/header.jpg?t=1742776298",
          screenshots: [],
        },
        ratings: {
          average: 8.1,
          count: 325,
          distribution: { 1: 5, 2: 10, 3: 50, 4: 100, 5: 160 },
        },
        metadata: {
          isReleased: false,
          website: "",
          trailer: "",
        },
        stats: {
          totalPlayers: 1500,
          averagePlaytime: 45,
          completionRate: 65,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "Cyberpunk 2077",
        description:
          "Open-world action-adventure story set in Night City, a megalopolis obsessed with power, glamour and body modification.",
        developer: "CD Projekt RED",
        publisher: "CD Projekt",
        releaseDate: "2020-12-10",
        genres: ["RPG", "Action", "Open World"],
        platforms: ["PC", "PlayStation", "Xbox"],
        tags: ["Cyberpunk", "RPG", "Open World", "Futuristic"],
        images: {
          cover:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/e9047d8ec47ae3d94bb8b464fb0fc9e9972b4ac7/header.jpg?t=1749198613",
          banner:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/e9047d8ec47ae3d94bb8b464fb0fc9e9972b4ac7/header.jpg?t=1749198613",
          screenshots: [],
        },
        ratings: {
          average: 7.8,
          count: 1547,
          distribution: { 1: 50, 2: 100, 3: 300, 4: 600, 5: 497 },
        },
        metadata: {
          isReleased: true,
          website: "https://www.cyberpunk.net",
          trailer: "",
        },
        stats: {
          totalPlayers: 12000,
          averagePlaytime: 85,
          completionRate: 42,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "The Witcher 3: Wild Hunt",
        description:
          "As war rages on throughout the Northern Realms, you take on the greatest contract of your life — tracking down the Child of Prophecy, a living weapon that can alter the shape of the world.",
        developer: "CD Projekt RED",
        publisher: "CD Projekt",
        releaseDate: "2015-05-19",
        genres: ["RPG", "Fantasy", "Open World"],
        platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch"],
        tags: ["Fantasy", "RPG", "Open World", "Story Rich"],
        images: {
          cover:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/292030/ad9240e088f953a84aee814034c50a6a92bf4516/header.jpg?t=1749199563",
          banner:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/292030/ad9240e088f953a84aee814034c50a6a92bf4516/header.jpg?t=1749199563",
          screenshots: [],
        },
        ratings: {
          average: 9.3,
          count: 8924,
          distribution: { 1: 15, 2: 45, 3: 200, 4: 1500, 5: 7164 },
        },
        metadata: {
          isReleased: true,
          website: "https://thewitcher.com",
          trailer: "",
        },
        stats: {
          totalPlayers: 25000,
          averagePlaytime: 127,
          completionRate: 78,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "NEKOPARA Vol. 1",
        description:
          "What's NEKOPARA? Why, it's a cat paradise! Minaduki Kashou, the son of a long line of Japanese confection makers moved out to open his own shop 'La Soleil' as a patisserie.",
        developer: "NEKO WORKs",
        publisher: "Sekai Project",
        releaseDate: "2014-12-30",
        genres: ["Visual Novel", "Anime", "Romance"],
        platforms: ["PC", "PlayStation", "Nintendo Switch"],
        tags: ["Visual Novel", "Anime", "Cats", "Romance"],
        images: {
          cover:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/333600/header.jpg?t=1735218735",
          banner:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/333600/header.jpg?t=1735218735",
          screenshots: [],
        },
        ratings: {
          average: 8.7,
          count: 15420,
          distribution: { 1: 200, 2: 300, 3: 1500, 4: 4500, 5: 8920 },
        },
        metadata: {
          isReleased: true,
          website: "https://nekopara.com",
          trailer: "",
        },
        stats: {
          totalPlayers: 45000,
          averagePlaytime: 8,
          completionRate: 85,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "Counter-Strike 2",
        description:
          "For over two decades, Counter-Strike has offered an elite competitive experience, one shaped by millions of players from across the globe. And now the next chapter in the CS story is about to begin.",
        developer: "Valve",
        publisher: "Valve",
        releaseDate: "2023-09-27",
        genres: ["FPS", "Competitive", "Tactical"],
        platforms: ["PC"],
        tags: ["FPS", "Competitive", "Tactical", "Esports"],
        images: {
          cover:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/header.jpg?t=1729703045",
          banner:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/730/header.jpg?t=1729703045",
          screenshots: [],
        },
        ratings: {
          average: 7.2,
          count: 156842,
          distribution: { 1: 15000, 2: 20000, 3: 35000, 4: 45000, 5: 41842 },
        },
        metadata: {
          isReleased: true,
          website: "https://www.counter-strike.net",
          trailer: "",
        },
        stats: {
          totalPlayers: 1200000,
          averagePlaytime: 250,
          completionRate: 15,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "Lethal Company",
        description:
          "A co-op horror about scavenging at abandoned moons to sell scrap to the Company. Can you make the quota or will the monsters turn you into bloody paste?",
        developer: "Zeekerss",
        publisher: "Zeekerss",
        releaseDate: "2023-10-23",
        genres: ["Horror", "Co-op", "Survival"],
        platforms: ["PC"],
        tags: ["Horror", "Co-op", "Survival", "Multiplayer"],
        images: {
          cover:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1966720/header.jpg?t=1700243145",
          banner:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1966720/header.jpg?t=1700243145",
          screenshots: [],
        },
        ratings: {
          average: 9.1,
          count: 89542,
          distribution: { 1: 500, 2: 1000, 3: 5000, 4: 20000, 5: 63042 },
        },
        metadata: {
          isReleased: true,
          website: "",
          trailer: "",
        },
        stats: {
          totalPlayers: 185000,
          averagePlaytime: 35,
          completionRate: 25,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "UNO",
        description:
          "UNO makes its return with new exciting features! Match cards by color or value and play action cards to change things up. Race against others to empty your hand before everyone else in Classic play or customize your experience with House Rules.",
        developer: "Ubisoft Pune",
        publisher: "Ubisoft",
        releaseDate: "2016-08-09",
        genres: ["Card Game", "Party", "Casual"],
        platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile"],
        tags: ["Card Game", "Party", "Multiplayer", "Casual"],
        images: {
          cover:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/470220/header.jpg?t=1732730468",
          banner:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/470220/header.jpg?t=1732730468",
          screenshots: [],
        },
        ratings: {
          average: 6.8,
          count: 12458,
          distribution: { 1: 1500, 2: 2000, 3: 3500, 4: 3500, 5: 1958 },
        },
        metadata: {
          isReleased: true,
          website: "https://www.ubisoft.com/en-us/game/uno",
          trailer: "",
        },
        stats: {
          totalPlayers: 95000,
          averagePlaytime: 15,
          completionRate: 60,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "Terraria",
        description:
          "Dig, fight, explore, build! Nothing is impossible in this action-packed adventure game. Four Pack also available!",
        developer: "Re-Logic",
        publisher: "Re-Logic",
        releaseDate: "2011-05-16",
        genres: ["Sandbox", "Adventure", "Action"],
        platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile"],
        tags: ["Sandbox", "2D", "Building", "Adventure"],
        images: {
          cover:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/105600/header.jpg?t=1666290860",
          banner:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/105600/header.jpg?t=1666290860",
          screenshots: [],
        },
        ratings: {
          average: 9.4,
          count: 154782,
          distribution: { 1: 800, 2: 1500, 3: 8000, 4: 35000, 5: 109482 },
        },
        metadata: {
          isReleased: true,
          website: "https://terraria.org",
          trailer: "",
        },
        stats: {
          totalPlayers: 850000,
          averagePlaytime: 95,
          completionRate: 35,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "Minecraft",
        description:
          "Explore infinite worlds and build everything from the simplest of homes to the grandest of castles. Play in creative mode with unlimited resources or mine deep into the world in survival mode.",
        developer: "Mojang Studios",
        publisher: "Microsoft Studios",
        releaseDate: "2011-11-18",
        genres: ["Sandbox", "Survival", "Creative"],
        platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile"],
        tags: ["Sandbox", "Survival", "Building", "Creative"],
        images: {
          cover:
            "https://www.minecraft.net/content/dam/games/minecraft/key-art/Homepage_Vanilla-PMP_2880x1620.jpg",
          banner:
            "https://www.minecraft.net/content/dam/games/minecraft/key-art/Homepage_Vanilla-PMP_2880x1620.jpg",
          screenshots: [],
        },
        ratings: {
          average: 9.0,
          count: 284756,
          distribution: { 1: 5000, 2: 8000, 3: 25000, 4: 85000, 5: 161756 },
        },
        metadata: {
          isReleased: true,
          website: "https://www.minecraft.net",
          trailer: "",
        },
        stats: {
          totalPlayers: 2500000,
          averagePlaytime: 180,
          completionRate: 20,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        title: "Dark Souls",
        description:
          "Dark Souls is the new action role-playing game from the developers who brought you Demon's Souls, FromSoftware. Dark Souls will have many familiar features.",
        developer: "FromSoftware",
        publisher: "Bandai Namco Entertainment",
        releaseDate: "2011-09-22",
        genres: ["Action RPG", "Souls-like", "Dark Fantasy"],
        platforms: ["PC", "PlayStation", "Xbox", "Nintendo Switch"],
        tags: ["Souls-like", "Difficult", "Dark Fantasy", "Action RPG"],
        images: {
          cover:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/211420/header.jpg?t=1726158298",
          banner:
            "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/211420/header.jpg?t=1726158298",
          screenshots: [],
        },
        ratings: {
          average: 8.9,
          count: 45892,
          distribution: { 1: 1000, 2: 2000, 3: 5000, 4: 12000, 5: 25892 },
        },

        metadata: {
          isReleased: true,
          website: "https://www.fromsoftware.jp/ww/detail.html?csm=098",
          trailer: "",
        },
        stats: {
          totalPlayers: 195000,
          averagePlaytime: 65,
          completionRate: 28,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    userGames: [],
    reviews: [],
  };

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialData.users, null, 2));
  }

  if (!fs.existsSync(GAMES_FILE)) {
    fs.writeFileSync(GAMES_FILE, JSON.stringify(initialData.games, null, 2));
  }

  if (!fs.existsSync(USER_GAMES_FILE)) {
    fs.writeFileSync(
      USER_GAMES_FILE,
      JSON.stringify(initialData.userGames, null, 2)
    );
  }

  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(
      REVIEWS_FILE,
      JSON.stringify(initialData.reviews, null, 2)
    );
  }
};

const readData = (filename) => {
  try {
    const data = fs.readFileSync(filename, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [];
  }
};

const writeData = (filename, data) => {
  try {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error);
    return false;
  }
};

const generateId = () => {
  return crypto.randomBytes(12).toString("hex");
};

const users = {
  getAll: () => readData(USERS_FILE),
  getById: (id) => {
    const users = readData(USERS_FILE);
    return users.find((user) => user.id === id);
  },
  getByEmail: (email) => {
    const users = readData(USERS_FILE);
    return users.find((user) => user.email === email);
  },
  getByUsername: (username) => {
    const users = readData(USERS_FILE);
    return users.find((user) => user.username === username);
  },
  create: (userData) => {
    const users = readData(USERS_FILE);
    const newUser = {
      id: generateId(),
      ...userData,
      followers: [],
      following: [],
      stats: {
        totalGames: 0,
        completedGames: 0,
        currentlyPlaying: 0,
        totalHours: 0,
        averageRating: 0,
        reviewsWritten: 0,
      },
      preferences: {
        emailNotifications: true,
        profileVisibility: "public",
        showOnlineStatus: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(newUser);
    writeData(USERS_FILE, users);
    return newUser;
  },
  update: (id, updateData) => {
    const users = readData(USERS_FILE);
    const index = users.findIndex((user) => user.id === id);
    if (index !== -1) {
      users[index] = {
        ...users[index],
        ...updateData,
        updatedAt: new Date().toISOString(),
      };
      writeData(USERS_FILE, users);
      return users[index];
    }
    return null;
  },
  delete: (id) => {
    const users = readData(USERS_FILE);
    const filtered = users.filter((user) => user.id !== id);
    writeData(USERS_FILE, filtered);
    return filtered.length < users.length;
  },
};

const games = {
  getAll: () => readData(GAMES_FILE),
  getById: (id) => {
    const games = readData(GAMES_FILE);
    return games.find((game) => game.id === id);
  },
  create: (gameData) => {
    const games = readData(GAMES_FILE);
    const newGame = {
      id: generateId(),
      ...gameData,
      ratings: {
        average: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
      stats: { totalPlayers: 0, averagePlaytime: 0, completionRate: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    games.push(newGame);
    writeData(GAMES_FILE, games);
    return newGame;
  },
  update: (id, updateData) => {
    const games = readData(GAMES_FILE);
    const index = games.findIndex((game) => game.id === id);
    if (index !== -1) {
      games[index] = {
        ...games[index],
        ...updateData,
        updatedAt: new Date().toISOString(),
      };
      writeData(GAMES_FILE, games);
      return games[index];
    }
    return null;
  },
  delete: (id) => {
    const games = readData(GAMES_FILE);
    const filtered = games.filter((game) => game.id !== id);
    writeData(GAMES_FILE, filtered);
    return filtered.length < games.length;
  },
};

const userGames = {
  getAll: () => readData(USER_GAMES_FILE),
  getByUserId: (userId) => {
    const userGames = readData(USER_GAMES_FILE);
    return userGames.filter((ug) => ug.userId === userId);
  },
  getByUserAndGame: (userId, gameId) => {
    const userGames = readData(USER_GAMES_FILE);
    return userGames.find((ug) => ug.userId === userId && ug.gameId === gameId);
  },
  create: (userGameData) => {
    const userGames = readData(USER_GAMES_FILE);
    const newUserGame = {
      id: generateId(),
      ...userGameData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    userGames.push(newUserGame);
    writeData(USER_GAMES_FILE, userGames);
    return newUserGame;
  },
  update: (id, updateData) => {
    const userGames = readData(USER_GAMES_FILE);
    const index = userGames.findIndex((ug) => ug.id === id);
    if (index !== -1) {
      userGames[index] = {
        ...userGames[index],
        ...updateData,
        updatedAt: new Date().toISOString(),
      };
      writeData(USER_GAMES_FILE, userGames);
      return userGames[index];
    }
    return null;
  },
  delete: (id) => {
    const userGames = readData(USER_GAMES_FILE);
    const filtered = userGames.filter((ug) => ug.id !== id);
    writeData(USER_GAMES_FILE, filtered);
    return filtered.length < userGames.length;
  },
};

const reviews = {
  getAll: () => readData(REVIEWS_FILE),
  getById: (id) => {
    const reviews = readData(REVIEWS_FILE);
    return reviews.find((review) => review.id === id);
  },
  getByGameId: (gameId) => {
    const reviews = readData(REVIEWS_FILE);
    return reviews.filter(
      (review) => review.gameId === gameId && review.status === "active"
    );
  },
  getByUserId: (userId) => {
    const reviews = readData(REVIEWS_FILE);
    return reviews.filter(
      (review) => review.userId === userId && review.status === "active"
    );
  },
  create: (reviewData) => {
    const reviews = readData(REVIEWS_FILE);
    const newReview = {
      id: generateId(),
      ...reviewData,
      helpfulVotes: { count: 0, users: [] },
      reports: [],
      status: "active",
      isEdited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reviews.push(newReview);
    writeData(REVIEWS_FILE, reviews);
    return newReview;
  },
  update: (id, updateData) => {
    const reviews = readData(REVIEWS_FILE);
    const index = reviews.findIndex((review) => review.id === id);
    if (index !== -1) {
      reviews[index] = {
        ...reviews[index],
        ...updateData,
        isEdited: true,
        lastEditedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      writeData(REVIEWS_FILE, reviews);
      return reviews[index];
    }
    return null;
  },
  delete: (id) => {
    const reviews = readData(REVIEWS_FILE);
    const filtered = reviews.filter((review) => review.id !== id);
    writeData(REVIEWS_FILE, filtered);
    return filtered.length < reviews.length;
  },
};

module.exports = {
  initializeDatabase,
  generateId,
  users,
  games,
  userGames,
  reviews,
};

const express = require("express");
const { body, validationResult } = require("express-validator");
const { games, userGames, reviews, users } = require("../utils/database");
const auth = require("../middleware/auth");
const { optionalAuth } = require("../middleware/auth");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      genre,
      platform,
      search,
      sortBy = "rating",
    } = req.query;

    let allGames = games.getAll();
    let filteredGames = [...allGames];

    if (search) {
      const searchTerm = search.toLowerCase();
      filteredGames = filteredGames.filter(
        (game) =>
          game.title.toLowerCase().includes(searchTerm) ||
          game.developer.toLowerCase().includes(searchTerm) ||
          game.publisher.toLowerCase().includes(searchTerm) ||
          game.genres.some((g) => g.toLowerCase().includes(searchTerm)) ||
          game.tags.some((t) => t.toLowerCase().includes(searchTerm))
      );
    }

    if (genre) {
      filteredGames = filteredGames.filter((game) =>
        game.genres.includes(genre)
      );
    }

    if (platform) {
      filteredGames = filteredGames.filter((game) =>
        game.platforms.includes(platform)
      );
    }

    const total = filteredGames.length;
    const startIndex = (page - 1) * limit;
    const paginatedGames = filteredGames.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    res.json({
      games: paginatedGames,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: total,
      },
      filters: {
        genre,
        platform,
        search,
        sortBy,
      },
    });
  } catch (error) {
    console.error("Get games error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Search query must be at least 2 characters" });
    }

    const searchTerm = q.trim().toLowerCase();
    const allGames = games.getAll();

    const searchResults = allGames
      .filter(
        (game) =>
          game.title.toLowerCase().includes(searchTerm) ||
          game.developer.toLowerCase().includes(searchTerm) ||
          game.publisher.toLowerCase().includes(searchTerm) ||
          game.genres.some((genre) =>
            genre.toLowerCase().includes(searchTerm)
          ) ||
          game.tags.some((tag) => tag.toLowerCase().includes(searchTerm))
      )
      .sort(
        (a, b) =>
          b.ratings.average - a.ratings.average ||
          b.ratings.count - a.ratings.count
      );

    const total = searchResults.length;
    const startIndex = (page - 1) * limit;
    const paginatedResults = searchResults.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    res.json({
      games: paginatedResults,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: total,
      },
    });
  } catch (error) {
    console.error("Search games error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/genres", async (req, res) => {
  try {
    const allGames = games.getAll();
    const genresSet = new Set();

    allGames.forEach((game) => {
      game.genres.forEach((genre) => genresSet.add(genre));
    });

    const genresArray = Array.from(genresSet).sort();
    res.json({ genres: genresArray });
  } catch (error) {
    console.error("Get genres error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/platforms", async (req, res) => {
  try {
    const allGames = games.getAll();
    const platformsSet = new Set();

    allGames.forEach((game) => {
      game.platforms.forEach((platform) => platformsSet.add(platform));
    });

    const platformsArray = Array.from(platformsSet).sort();
    res.json({ platforms: platformsArray });
  } catch (error) {
    console.error("Get platforms error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:gameId", optionalAuth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user?.userId;

    const game = games.getById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    let userGame = null;
    if (userId) {
      userGame = userGames.getByUserAndGame(userId, gameId);
    }

    const gameReviews = reviews
      .getByGameId(gameId)
      .slice(0, 5)
      .map((review) => {
        const user = users.getById(review.userId);
        return {
          ...review,
          user: user
            ? { displayName: user.displayName, username: user.username }
            : null,
        };
      });

    res.json({
      game,
      userGame,
      recentReviews: gameReviews,
    });
  } catch (error) {
    console.error("Get game details error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/:gameId/add-to-list",
  auth,
  [
    body("status").isIn([
      "planned",
      "playing",
      "completed",
      "dropped",
      "paused",
    ]),
    body("platform")
      .optional()
      .isIn([
        "PC",
        "PlayStation",
        "Xbox",
        "Nintendo Switch",
        "Mobile",
        "Mac",
        "Linux",
      ]),
    body("rating").optional().isInt({ min: 1, max: 5 }),
    body("hoursPlayed").optional().isFloat({ min: 0 }),
    body("notes").optional().isLength({ max: 1000 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { gameId } = req.params;
      const { status, platform, rating, hoursPlayed, notes } = req.body;
      const userId = req.user.userId;

      const game = games.getById(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      let existingUserGame = userGames.getByUserAndGame(userId, gameId);

      if (existingUserGame) {
        const updatedUserGame = userGames.update(existingUserGame.id, {
          status,
          platform: platform || existingUserGame.platform,
          rating: rating || existingUserGame.rating,
          hoursPlayed:
            hoursPlayed !== undefined
              ? hoursPlayed
              : existingUserGame.hoursPlayed,
          notes: notes !== undefined ? notes : existingUserGame.notes,
        });

        res.json({
          message: "Game updated in list successfully",
          userGame: updatedUserGame,
        });
      } else {
        const newUserGame = userGames.create({
          userId,
          gameId,
          status,
          platform,
          rating,
          hoursPlayed: hoursPlayed || 0,
          notes: notes || "",
          dateAdded: new Date().toISOString(),
          progress: 0,
          isFavorite: false,
        });

        res.json({
          message: "Game added to list successfully",
          userGame: newUserGame,
        });
      }

      updateGameStats(gameId);
    } catch (error) {
      console.error("Add to list error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/:gameId/rate",
  auth,
  [
    body("rating").isInt({ min: 1, max: 5 }),
    body("platform").isIn([
      "PC",
      "PlayStation",
      "Xbox",
      "Nintendo Switch",
      "Mobile",
      "Mac",
      "Linux",
    ]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { gameId } = req.params;
      const { rating, platform } = req.body;
      const userId = req.user.userId;

      const game = games.getById(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      let existingUserGame = userGames.getByUserAndGame(userId, gameId);

      if (!existingUserGame) {
        existingUserGame = userGames.create({
          userId,
          gameId,
          status: "planned",
          platform,
          rating,
          hoursPlayed: 0,
          notes: "",
          dateAdded: new Date().toISOString(),
          progress: 0,
          isFavorite: false,
        });
      } else {
        userGames.update(existingUserGame.id, {
          rating,
          platform: platform || existingUserGame.platform,
        });
      }

      updateGameStats(gameId);

      res.json({
        message: "Game rated successfully",
        userGame: existingUserGame,
      });
    } catch (error) {
      console.error("Rate game error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post("/:gameId/favorite", auth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.userId;

    const existingUserGame = userGames.getByUserAndGame(userId, gameId);
    if (!existingUserGame) {
      return res.status(404).json({ message: "Game not found in your list" });
    }

    const updatedUserGame = userGames.update(existingUserGame.id, {
      isFavorite: !existingUserGame.isFavorite,
    });

    res.json({
      message: updatedUserGame.isFavorite
        ? "Added to favorites"
        : "Removed from favorites",
      isFavorite: updatedUserGame.isFavorite,
    });
  } catch (error) {
    console.error("Toggle favorite error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:gameId/remove", auth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.userId;

    const existingUserGame = userGames.getByUserAndGame(userId, gameId);
    if (!existingUserGame) {
      return res.status(404).json({ message: "Game not found in your list" });
    }

    userGames.delete(existingUserGame.id);

    res.json({ message: "Game removed from list successfully" });
  } catch (error) {
    console.error("Remove game error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:gameId/reviews", async (req, res) => {
  try {
    const { gameId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "helpful",
      filterBy = "all",
    } = req.query;

    const game = games.getById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    let gameReviews = reviews.getByGameId(gameId);

    if (filterBy !== "all") {
      if (filterBy === "recommended") {
        gameReviews = gameReviews.filter((review) => review.isRecommended);
      } else if (filterBy === "not_recommended") {
        gameReviews = gameReviews.filter((review) => !review.isRecommended);
      } else if (filterBy.startsWith("rating_")) {
        const rating = parseInt(filterBy.split("_")[1]);
        gameReviews = gameReviews.filter((review) => review.rating === rating);
      }
    }

    switch (sortBy) {
      case "helpful":
        gameReviews.sort(
          (a, b) =>
            b.helpfulVotes.count - a.helpfulVotes.count ||
            new Date(b.createdAt) - new Date(a.createdAt)
        );
        break;
      case "newest":
        gameReviews.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        break;
      case "oldest":
        gameReviews.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        break;
      case "rating_high":
        gameReviews.sort(
          (a, b) =>
            b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt)
        );
        break;
      case "rating_low":
        gameReviews.sort(
          (a, b) =>
            a.rating - b.rating || new Date(b.createdAt) - new Date(a.createdAt)
        );
        break;
    }

    const total = gameReviews.length;
    const startIndex = (page - 1) * limit;
    const paginatedReviews = gameReviews
      .slice(startIndex, startIndex + parseInt(limit))
      .map((review) => {
        const user = users.getById(review.userId);
        return {
          ...review,
          user: user
            ? {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
              }
            : null,
        };
      });

    const ratingStats = {};
    for (let i = 1; i <= 5; i++) {
      ratingStats[i] = gameReviews.filter(
        (review) => review.rating === i
      ).length;
    }

    res.json({
      reviews: paginatedReviews,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: total,
      },
      ratingStats,
    });
  } catch (error) {
    console.error("Get game reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:gameId/similar", async (req, res) => {
  try {
    const { gameId } = req.params;
    const { limit = 6 } = req.query;

    const game = games.getById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const similarGames = games
      .getAll()
      .filter(
        (g) =>
          g.id !== gameId &&
          (g.genres.some((genre) => game.genres.includes(genre)) ||
            g.developer === game.developer ||
            g.tags.some((tag) => game.tags.includes(tag)))
      )
      .sort(
        (a, b) =>
          b.ratings.average - a.ratings.average ||
          b.ratings.count - a.ratings.count
      )
      .slice(0, parseInt(limit))
      .map((g) => ({
        id: g.id,
        title: g.title,
        developer: g.developer,
        images: { cover: g.images.cover },
        ratings: g.ratings,
        genres: g.genres,
        platforms: g.platforms,
      }));

    res.json({ similarGames });
  } catch (error) {
    console.error("Get similar games error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/",
  auth,
  [
    body("title").notEmpty().isLength({ max: 200 }),
    body("description").notEmpty().isLength({ max: 2000 }),
    body("developer").notEmpty().isLength({ max: 100 }),
    body("publisher").notEmpty().isLength({ max: 100 }),
    body("releaseDate").isISO8601(),
    body("genres").isArray({ min: 1 }),
    body("platforms").isArray({ min: 1 }),
    body("images.cover").isURL(),
    body("images.banner").isURL(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const gameData = req.body;
      const game = games.create(gameData);

      res.status(201).json({
        message: "Game created successfully",
        game,
      });
    } catch (error) {
      console.error("Create game error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.put("/:gameId", auth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const updates = req.body;

    const game = games.update(gameId, updates);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    res.json({
      message: "Game updated successfully",
      game,
    });
  } catch (error) {
    console.error("Update game error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:gameId/stats", async (req, res) => {
  try {
    const { gameId } = req.params;

    const game = games.getById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const gameUserGames = userGames
      .getAll()
      .filter((ug) => ug.gameId === gameId);

    const statusStats = {};
    const platformStats = {};
    const ratingDistribution = {};

    gameUserGames.forEach((ug) => {
      statusStats[ug.status] = (statusStats[ug.status] || 0) + 1;

      if (ug.platform) {
        if (!platformStats[ug.platform]) {
          platformStats[ug.platform] = { count: 0, totalHours: 0 };
        }
        platformStats[ug.platform].count++;
        platformStats[ug.platform].totalHours += ug.hoursPlayed || 0;
      }

      if (ug.rating) {
        ratingDistribution[ug.rating] =
          (ratingDistribution[ug.rating] || 0) + 1;
      }
    });

    Object.keys(platformStats).forEach((platform) => {
      platformStats[platform].avgHours =
        platformStats[platform].totalHours / platformStats[platform].count;
    });

    res.json({
      statusStats: Object.entries(statusStats).map(([status, count]) => ({
        _id: status,
        count,
      })),
      platformStats: Object.entries(platformStats).map(([platform, data]) => ({
        _id: platform,
        count: data.count,
        avgHours: data.avgHours,
      })),
      ratingDistribution: Object.entries(ratingDistribution).map(
        ([rating, count]) => ({
          _id: parseInt(rating),
          count,
        })
      ),
      gameStats: game.stats,
    });
  } catch (error) {
    console.error("Get game stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

function updateGameStats(gameId) {
  try {
    const game = games.getById(gameId);
    if (!game) return;

    const gameUserGames = userGames
      .getAll()
      .filter((ug) => ug.gameId === gameId);
    const ratedUserGames = gameUserGames.filter(
      (ug) => ug.rating && ug.rating > 0
    );

    let newRatings = {
      average: 0,
      count: ratedUserGames.length,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };

    if (ratedUserGames.length > 0) {
      const totalRating = ratedUserGames.reduce(
        (sum, ug) => sum + ug.rating,
        0
      );
      newRatings.average = totalRating / ratedUserGames.length;

      ratedUserGames.forEach((ug) => {
        newRatings.distribution[ug.rating]++;
      });
    }

    const playedGames = gameUserGames.filter(
      (ug) => ug.hoursPlayed && ug.hoursPlayed > 0
    );
    const averagePlaytime =
      playedGames.length > 0
        ? playedGames.reduce((sum, ug) => sum + ug.hoursPlayed, 0) /
          playedGames.length
        : 0;

    const completedGames = gameUserGames.filter(
      (ug) => ug.status === "completed"
    );
    const completionRate =
      gameUserGames.length > 0
        ? (completedGames.length / gameUserGames.length) * 100
        : 0;

    games.update(gameId, {
      ratings: newRatings,
      stats: {
        totalPlayers: gameUserGames.length,
        averagePlaytime,
        completionRate,
      },
    });
  } catch (error) {
    console.error("Error updating game stats:", error);
  }
}

module.exports = router;

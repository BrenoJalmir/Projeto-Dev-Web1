const express = require("express");
const { body, validationResult } = require("express-validator");
const { userGames, games, users } = require("../utils/database");
const auth = require("../middleware/auth");
const router = express.Router();

//Get user's game list with filters and pagination
router.get("/", auth, async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      sortBy = "dateAdded",
      search,
      genre,
      platform,
    } = req.query;

    const userId = req.user.userId;
    let userGamesList = userGames.getByUserId(userId);

    //Filter by status
    if (status && status !== "all") {
      userGamesList = userGamesList.filter((ug) => ug.status === status);
    }

    //Add game information and apply filters
    userGamesList = userGamesList
      .map((ug) => {
        const game = games.getById(ug.gameId);
        return {
          ...ug,
          gameInfo: game || {
            title: "Unknown Game",
            genres: [],
            platforms: [],
          },
        };
      })
      .filter((ug) => {
        //Search filter
        if (
          search &&
          !ug.gameInfo.title.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }

        //Genre filter
        if (genre && !ug.gameInfo.genres.includes(genre)) {
          return false;
        }

        //Platform filter
        if (platform && ug.platform !== platform) {
          return false;
        }

        return true;
      });

    //Sort the results
    switch (sortBy) {
      case "title":
        userGamesList.sort((a, b) =>
          a.gameInfo.title.localeCompare(b.gameInfo.title)
        );
        break;
      case "rating":
        userGamesList.sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          if (ratingA === ratingB) {
            return new Date(b.dateAdded) - new Date(a.dateAdded);
          }
          return ratingB - ratingA;
        });
        break;
      case "dateAdded":
        userGamesList.sort(
          (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
        );
        break;
      case "releaseDate":
        userGamesList.sort((a, b) => {
          const dateA = a.gameInfo.releaseDate
            ? new Date(a.gameInfo.releaseDate)
            : new Date(0);
          const dateB = b.gameInfo.releaseDate
            ? new Date(b.gameInfo.releaseDate)
            : new Date(0);
          return dateB - dateA;
        });
        break;
      case "hoursPlayed":
        userGamesList.sort(
          (a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0)
        );
        break;
      default:
        userGamesList.sort(
          (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
        );
    }

    //Pagination
    const total = userGamesList.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedGames = userGamesList.slice(startIndex, endIndex);

    res.json({
      games: paginatedGames,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: total,
      },
      filters: {
        status,
        search,
        genre,
        platform,
        sortBy,
      },
    });
  } catch (error) {
    console.error("Get user list error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Get user statistics
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userGamesList = userGames.getByUserId(userId);

    //Basic stats
    const basicStats = {
      totalGames: userGamesList.length,
      totalHours: userGamesList.reduce(
        (sum, ug) => sum + (ug.hoursPlayed || 0),
        0
      ),
      averageRating: 0,
      completedGames: userGamesList.filter((ug) => ug.status === "completed")
        .length,
      currentlyPlaying: userGamesList.filter((ug) => ug.status === "playing")
        .length,
      plannedGames: userGamesList.filter((ug) => ug.status === "planned")
        .length,
    };

    const ratedGames = userGamesList.filter((ug) => ug.rating);
    if (ratedGames.length > 0) {
      basicStats.averageRating =
        Math.round(
          (ratedGames.reduce((sum, ug) => sum + ug.rating, 0) /
            ratedGames.length) *
            10
        ) / 10;
    }

    //Status distribution
    const statusDistribution = {};
    userGamesList.forEach((ug) => {
      statusDistribution[ug.status] = (statusDistribution[ug.status] || 0) + 1;
    });

    //Genre stats
    const genreStats = {};
    userGamesList.forEach((ug) => {
      const game = games.getById(ug.gameId);
      if (game && game.genres) {
        game.genres.forEach((genre) => {
          if (!genreStats[genre]) {
            genreStats[genre] = { count: 0, totalHours: 0, ratings: [] };
          }
          genreStats[genre].count++;
          genreStats[genre].totalHours += ug.hoursPlayed || 0;
          if (ug.rating) {
            genreStats[genre].ratings.push(ug.rating);
          }
        });
      }
    });

    //Calculate average ratings for genres
    Object.keys(genreStats).forEach((genre) => {
      const ratings = genreStats[genre].ratings;
      genreStats[genre].avgRating =
        ratings.length > 0
          ? Math.round(
              (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10
            ) / 10
          : null;
      delete genreStats[genre].ratings;
    });

    const topGenres = Object.entries(genreStats)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([genre, stats]) => ({ _id: genre, ...stats }));

    //Platform stats
    const platformStats = {};
    userGamesList.forEach((ug) => {
      if (ug.platform) {
        if (!platformStats[ug.platform]) {
          platformStats[ug.platform] = { count: 0, totalHours: 0, ratings: [] };
        }
        platformStats[ug.platform].count++;
        platformStats[ug.platform].totalHours += ug.hoursPlayed || 0;
        if (ug.rating) {
          platformStats[ug.platform].ratings.push(ug.rating);
        }
      }
    });

    Object.keys(platformStats).forEach((platform) => {
      const ratings = platformStats[platform].ratings;
      platformStats[platform].avgRating =
        ratings.length > 0
          ? Math.round(
              (ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10
            ) / 10
          : null;
      delete platformStats[platform].ratings;
    });

    const sortedPlatformStats = Object.entries(platformStats)
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([platform, stats]) => ({ _id: platform, ...stats }));

    //Monthly activity (last 12 months)
    const monthlyActivity = {};
    userGamesList.forEach((ug) => {
      const date = new Date(ug.dateAdded);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      if (!monthlyActivity[key]) {
        monthlyActivity[key] = { gamesAdded: 0, hoursPlayed: 0 };
      }
      monthlyActivity[key].gamesAdded++;
      monthlyActivity[key].hoursPlayed += ug.hoursPlayed || 0;
    });

    const sortedMonthlyActivity = Object.entries(monthlyActivity)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([monthYear, stats]) => {
        const [year, month] = monthYear.split("-");
        return {
          _id: { year: parseInt(year), month: parseInt(month) },
          ...stats,
        };
      });

    //Recent activity
    const recentActivity = userGamesList
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map((ug) => {
        const game = games.getById(ug.gameId);
        return {
          ...ug,
          game: game
            ? {
                id: game.id,
                title: game.title,
                images: game.images,
                developer: game.developer,
              }
            : { title: "Unknown Game" },
        };
      });

    //Top rated games
    const topRatedGames = userGamesList
      .filter((ug) => ug.rating)
      .sort((a, b) => {
        if (a.rating === b.rating) {
          return new Date(b.dateAdded) - new Date(a.dateAdded);
        }
        return b.rating - a.rating;
      })
      .slice(0, 5)
      .map((ug) => {
        const game = games.getById(ug.gameId);
        return {
          ...ug,
          game: game
            ? {
                id: game.id,
                title: game.title,
                images: game.images,
                developer: game.developer,
              }
            : { title: "Unknown Game" },
        };
      });

    //Favorites
    const favorites = userGamesList
      .filter((ug) => ug.isFavorite)
      .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
      .map((ug) => {
        const game = games.getById(ug.gameId);
        return {
          ...ug,
          game: game
            ? {
                id: game.id,
                title: game.title,
                images: game.images,
                developer: game.developer,
              }
            : { title: "Unknown Game" },
        };
      });

    res.json({
      basicStats,
      statusDistribution: Object.entries(statusDistribution).map(
        ([status, count]) => ({
          _id: status,
          count,
        })
      ),
      genreStats: topGenres,
      platformStats: sortedPlatformStats,
      monthlyActivity: sortedMonthlyActivity,
      recentActivity,
      topRatedGames,
      favorites,
    });
  } catch (error) {
    console.error("Get list stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Add game to user's list
router.post(
  "/add",
  auth,
  [
    body("gameId").notEmpty().withMessage("Valid game ID is required"),
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

      const { gameId, status, platform, rating, hoursPlayed, notes } = req.body;
      const userId = req.user.userId;

      const game = games.getById(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const existingEntry = userGames.getByUserAndGame(userId, gameId);
      if (existingEntry) {
        return res.status(400).json({ message: "Game already in your list" });
      }

      const newUserGame = userGames.create({
        userId,
        gameId,
        status,
        platform,
        rating,
        hoursPlayed: hoursPlayed || 0,
        notes: notes || "",
        progress: 0,
        isFavorite: false,
        dateAdded: new Date().toISOString(),
      });

      const populatedUserGame = {
        ...newUserGame,
        game: {
          id: game.id,
          title: game.title,
          developer: game.developer,
          publisher: game.publisher,
          releaseDate: game.releaseDate,
          genres: game.genres,
          platforms: game.platforms,
          images: game.images,
        },
      };

      res.status(201).json({
        message: "Game added to list successfully",
        userGame: populatedUserGame,
      });
    } catch (error) {
      console.error("Add to list error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

//Update user game entry
router.put(
  "/:userGameId",
  auth,
  [
    body("status")
      .optional()
      .isIn(["planned", "playing", "completed", "dropped", "paused"]),
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
    body("progress").optional().isInt({ min: 0, max: 100 }),
    body("notes").optional().isLength({ max: 1000 }),
    body("isFavorite").optional().isBoolean(),
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

      const { userGameId } = req.params;
      const userId = req.user.userId;

      const userGame = userGames.getById(userGameId);
      if (!userGame || userGame.userId !== userId) {
        return res.status(404).json({ message: "Game not found in your list" });
      }

      const updatedUserGame = userGames.update(userGameId, req.body);

      const game = games.getById(updatedUserGame.gameId);
      const populatedUserGame = {
        ...updatedUserGame,
        game: game
          ? {
              id: game.id,
              title: game.title,
              developer: game.developer,
              publisher: game.publisher,
              releaseDate: game.releaseDate,
              genres: game.genres,
              platforms: game.platforms,
              images: game.images,
            }
          : null,
      };

      res.json({
        message: "Game updated successfully",
        userGame: populatedUserGame,
      });
    } catch (error) {
      console.error("Update list item error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

//Remove game from user's list
router.delete("/:userGameId", auth, async (req, res) => {
  try {
    const { userGameId } = req.params;
    const userId = req.user.userId;

    const userGame = userGames.getById(userGameId);
    if (!userGame || userGame.userId !== userId) {
      return res.status(404).json({ message: "Game not found in your list" });
    }

    userGames.delete(userGameId);

    res.json({ message: "Game removed from list successfully" });
  } catch (error) {
    console.error("Remove from list error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Get user's favorite games
router.get("/favorites", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;

    let favoritesList = userGames
      .getByUserId(userId)
      .filter((ug) => ug.isFavorite);

    //Add game information
    favoritesList = favoritesList.map((ug) => {
      const game = games.getById(ug.gameId);
      return {
        ...ug,
        game: game || { title: "Unknown Game" },
      };
    });

    favoritesList.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

    const total = favoritesList.length;
    const startIndex = (page - 1) * limit;
    const paginatedFavorites = favoritesList.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    res.json({
      favorites: paginatedFavorites,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: total,
      },
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Toggle favorite status
router.post("/:userGameId/favorite", auth, async (req, res) => {
  try {
    const { userGameId } = req.params;
    const userId = req.user.userId;

    const userGame = userGames.getById(userGameId);
    if (!userGame || userGame.userId !== userId) {
      return res.status(404).json({ message: "Game not found in your list" });
    }

    const updatedUserGame = userGames.update(userGameId, {
      isFavorite: !userGame.isFavorite,
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

//Get game recommendations
router.get("/recommendations", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const userGamesList = userGames.getByUserId(userId);

    if (userGamesList.length === 0) {
      const popularGames = games
        .getAll()
        .filter((game) => game.metadata.isReleased)
        .sort(
          (a, b) =>
            b.ratings.average - a.ratings.average ||
            b.ratings.count - a.ratings.count
        )
        .slice(0, parseInt(limit));

      return res.json({
        recommendations: popularGames,
        reason: "Popular games for new users",
      });
    }

    //Get user's favorite genres and developers
    const favoriteGenres = {};
    const favoriteDevelopers = {};
    const userGameIds = userGamesList.map((ug) => ug.gameId);

    userGamesList.forEach((userGame) => {
      if (userGame.rating && userGame.rating >= 4) {
        const game = games.getById(userGame.gameId);
        if (game) {
          game.genres.forEach((genre) => {
            favoriteGenres[genre] = (favoriteGenres[genre] || 0) + 1;
          });

          favoriteDevelopers[game.developer] =
            (favoriteDevelopers[game.developer] || 0) + 1;
        }
      }
    });

    const topGenres = Object.keys(favoriteGenres)
      .sort((a, b) => favoriteGenres[b] - favoriteGenres[a])
      .slice(0, 3);

    const topDevelopers = Object.keys(favoriteDevelopers)
      .sort((a, b) => favoriteDevelopers[b] - favoriteDevelopers[a])
      .slice(0, 2);

    const recommendations = games
      .getAll()
      .filter(
        (game) =>
          !userGameIds.includes(game.id) &&
          game.metadata.isReleased &&
          (game.genres.some((genre) => topGenres.includes(genre)) ||
            topDevelopers.includes(game.developer))
      )
      .sort(
        (a, b) =>
          b.ratings.average - a.ratings.average ||
          b.ratings.count - a.ratings.count
      )
      .slice(0, parseInt(limit));

    res.json({
      recommendations,
      reason: `Based on your favorite genres: ${topGenres.join(", ")}`,
    });
  } catch (error) {
    console.error("Get recommendations error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Export user's game list
router.get("/export", auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { format = "json" } = req.query;

    let userGamesList = userGames.getByUserId(userId);

    //Add game information
    userGamesList = userGamesList.map((ug) => {
      const game = games.getById(ug.gameId);
      return {
        ...ug,
        game: game || { title: "Unknown Game" },
      };
    });

    userGamesList.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

    if (format === "csv") {
      const csvHeader =
        "Title,Developer,Publisher,Release Date,Status,Rating,Hours Played,Platform,Date Added,Notes\n";
      const csvData = userGamesList
        .map((ug) => {
          const game = ug.game;
          return [
            game.title || "",
            game.developer || "",
            game.publisher || "",
            game.releaseDate
              ? new Date(game.releaseDate).toISOString().split("T")[0]
              : "",
            ug.status || "",
            ug.rating || "",
            ug.hoursPlayed || 0,
            ug.platform || "",
            new Date(ug.dateAdded).toISOString().split("T")[0],
            (ug.notes || "").replace(/"/g, '""'),
          ]
            .map((field) => `"${field}"`)
            .join(",");
        })
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=game-list.csv"
      );
      res.send(csvHeader + csvData);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=game-list.json"
      );
      res.json({
        exportDate: new Date().toISOString(),
        totalGames: userGamesList.length,
        games: userGamesList,
      });
    }
  } catch (error) {
    console.error("Export list error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Import games to user's list
router.post("/import", auth, async (req, res) => {
  try {
    const { games: gamesToImport } = req.body;
    const userId = req.user.userId;

    if (!Array.isArray(gamesToImport)) {
      return res.status(400).json({ message: "Games must be an array" });
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    for (const gameData of gamesToImport) {
      try {
        const game = games.getAll().find((g) => g.title === gameData.title);
        if (!game) {
          results.errors.push(`Game not found: ${gameData.title}`);
          continue;
        }

        const existingEntry = userGames.getByUserAndGame(userId, game.id);
        if (existingEntry) {
          results.skipped++;
          continue;
        }

        userGames.create({
          userId,
          gameId: game.id,
          status: gameData.status || "planned",
          platform: gameData.platform,
          rating: gameData.rating,
          hoursPlayed: gameData.hoursPlayed || 0,
          notes: gameData.notes || "",
          dateAdded: gameData.dateAdded
            ? new Date(gameData.dateAdded).toISOString()
            : new Date().toISOString(),
          progress: 0,
          isFavorite: false,
        });

        results.imported++;
      } catch (error) {
        results.errors.push(
          `Error importing ${gameData.title}: ${error.message}`
        );
      }
    }

    res.json({
      message: "Import completed",
      results,
    });
  } catch (error) {
    console.error("Import list error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

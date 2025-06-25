const express = require("express");
const { body, validationResult } = require("express-validator");
const { reviews, games, userGames, users } = require("../utils/database");
const auth = require("../middleware/auth");
const router = express.Router();

//Create a new review
router.post(
  "/",
  auth,
  [
    body("gameId").notEmpty().withMessage("Valid game ID is required"),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("content")
      .isLength({ min: 10, max: 2000 })
      .withMessage("Review content must be between 10 and 2000 characters"),
    body("platform")
      .isIn([
        "PC",
        "PlayStation",
        "Xbox",
        "Nintendo Switch",
        "Mobile",
        "Mac",
        "Linux",
      ])
      .withMessage("Valid platform is required"),
    body("title")
      .optional()
      .isLength({ max: 200 })
      .withMessage("Title must be less than 200 characters"),
    body("hoursPlayed")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Hours played must be a positive number"),
    body("containsSpoilers").optional().isBoolean(),
    body("isRecommended").optional().isBoolean(),
    body("pros").optional().isArray(),
    body("cons").optional().isArray(),
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

      const {
        gameId,
        rating,
        content,
        platform,
        title,
        hoursPlayed,
        containsSpoilers = false,
        isRecommended = true,
        pros = [],
        cons = [],
      } = req.body;

      const userId = req.user.userId;

      //Check if game exists
      const game = games.getById(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      //Check if user already reviewed this game
      const existingReviews = reviews.getAll();
      const existingReview = existingReviews.find(
        (review) =>
          review.userId === userId &&
          review.gameId === gameId &&
          review.status === "active"
      );
      if (existingReview) {
        return res
          .status(400)
          .json({ message: "You have already reviewed this game" });
      }

      //Create the review
      const newReview = reviews.create({
        userId,
        gameId,
        rating,
        content,
        platform,
        title,
        hoursPlayed,
        containsSpoilers,
        isRecommended,
        pros,
        cons,
      });

      //Update or create user game entry
      let userGame = userGames.getByUserAndGame(userId, gameId);
      if (!userGame) {
        userGame = userGames.create({
          userId,
          gameId,
          status: "completed",
          platform,
          rating,
          hoursPlayed: hoursPlayed || 0,
        });
      } else {
        const updateData = {};
        if (!userGame.rating) updateData.rating = rating;
        if (!userGame.platform) updateData.platform = platform;
        if (hoursPlayed && hoursPlayed > (userGame.hoursPlayed || 0)) {
          updateData.hoursPlayed = hoursPlayed;
        }
        if (Object.keys(updateData).length > 0) {
          userGames.update(userGame.id, updateData);
        }
      }

      //Get populated review data
      const user = users.getById(userId);
      const populatedReview = {
        ...newReview,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
        },
        game: {
          id: game.id,
          title: game.title,
          images: { cover: game.images.cover },
        },
      };

      res.status(201).json({
        message: "Review created successfully",
        review: populatedReview,
      });
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

//Get a specific review
router.get("/:reviewId", async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = reviews.getById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.status !== "active") {
      return res.status(404).json({ message: "Review not available" });
    }

    //Get populated data
    const user = users.getById(review.userId);
    const game = games.getById(review.gameId);

    const populatedReview = {
      ...review,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        joinDate: user.createdAt,
      },
      game: {
        id: game.id,
        title: game.title,
        developer: game.developer,
        images: { cover: game.images.cover },
        releaseDate: game.releaseDate,
      },
    };

    res.json({ review: populatedReview });
  } catch (error) {
    console.error("Get review error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Update a review
router.put(
  "/:reviewId",
  auth,
  [
    body("rating").optional().isInt({ min: 1, max: 5 }),
    body("content").optional().isLength({ min: 10, max: 2000 }),
    body("title").optional().isLength({ max: 200 }),
    body("hoursPlayed").optional().isFloat({ min: 0 }),
    body("containsSpoilers").optional().isBoolean(),
    body("isRecommended").optional().isBoolean(),
    body("pros").optional().isArray(),
    body("cons").optional().isArray(),
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

      const { reviewId } = req.params;
      const userId = req.user.userId;

      const review = reviews.getById(reviewId);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      if (review.userId !== userId) {
        return res
          .status(403)
          .json({ message: "Not authorized to edit this review" });
      }

      const updates = req.body;
      const updatedReview = reviews.update(reviewId, updates);

      //Update user game rating if provided
      if (updates.rating) {
        const userGame = userGames.getByUserAndGame(userId, review.gameId);
        if (userGame) {
          userGames.update(userGame.id, { rating: updates.rating });
        }
      }

      //Get populated review data
      const user = users.getById(userId);
      const game = games.getById(review.gameId);

      const populatedReview = {
        ...updatedReview,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
        },
        game: {
          id: game.id,
          title: game.title,
          images: { cover: game.images.cover },
        },
      };

      res.json({
        message: "Review updated successfully",
        review: populatedReview,
      });
    } catch (error) {
      console.error("Update review error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

//Delete a review (soft delete)
router.delete("/:reviewId", auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;

    const review = reviews.getById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.userId !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this review" });
    }

    reviews.update(reviewId, { status: "deleted" });

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Mark review as helpful/unhelpful
router.post("/:reviewId/helpful", auth, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;

    const review = reviews.getById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review.userId === userId) {
      return res
        .status(400)
        .json({ message: "Cannot mark your own review as helpful" });
    }

    const helpfulVotes = review.helpfulVotes || { count: 0, users: [] };
    const userIndex = helpfulVotes.users.indexOf(userId);
    let isHelpful;

    if (userIndex > -1) {
      //Remove helpful vote
      helpfulVotes.users.splice(userIndex, 1);
      helpfulVotes.count = Math.max(0, helpfulVotes.count - 1);
      isHelpful = false;
    } else {
      //Add helpful vote
      helpfulVotes.users.push(userId);
      helpfulVotes.count++;
      isHelpful = true;
    }

    reviews.update(reviewId, { helpfulVotes });

    res.json({
      message: isHelpful ? "Marked as helpful" : "Removed helpful mark",
      isHelpful,
      helpfulCount: helpfulVotes.count,
    });
  } catch (error) {
    console.error("Toggle helpful error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Report a review
router.post(
  "/:reviewId/report",
  auth,
  [
    body("reason").isIn([
      "spam",
      "inappropriate",
      "offensive",
      "spoilers",
      "other",
    ]),
    body("description").optional().isLength({ max: 500 }),
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

      const { reviewId } = req.params;
      const { reason, description = "" } = req.body;
      const userId = req.user.userId;

      const review = reviews.getById(reviewId);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }

      if (review.userId === userId) {
        return res
          .status(400)
          .json({ message: "Cannot report your own review" });
      }

      const reports = review.reports || [];
      const existingReport = reports.find((report) => report.userId === userId);

      if (existingReport) {
        return res
          .status(400)
          .json({ message: "You have already reported this review" });
      }

      reports.push({
        userId,
        reason,
        description,
        reportedAt: new Date().toISOString(),
      });

      reviews.update(reviewId, { reports });

      res.json({ message: "Review reported successfully" });
    } catch (error) {
      console.error("Report review error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

//Get reviews for a specific game
router.get("/game/:gameId", async (req, res) => {
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

    //Filter reviews
    if (filterBy !== "all") {
      switch (filterBy) {
        case "recommended":
          gameReviews = gameReviews.filter((review) => review.isRecommended);
          break;
        case "not_recommended":
          gameReviews = gameReviews.filter((review) => !review.isRecommended);
          break;
        case "recent":
          const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          gameReviews = gameReviews.filter(
            (review) => new Date(review.createdAt) > oneWeekAgo
          );
          break;
      }
    }

    //Sort reviews
    switch (sortBy) {
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
      case "helpful":
        gameReviews.sort((a, b) => {
          const aHelpful = a.helpfulVotes?.count || 0;
          const bHelpful = b.helpfulVotes?.count || 0;
          if (aHelpful === bHelpful) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return bHelpful - aHelpful;
        });
        break;
      case "rating_high":
        gameReviews.sort((a, b) => {
          if (a.rating === b.rating) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return b.rating - a.rating;
        });
        break;
      case "rating_low":
        gameReviews.sort((a, b) => {
          if (a.rating === b.rating) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return a.rating - b.rating;
        });
        break;
    }

    //Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedReviews = gameReviews.slice(startIndex, endIndex);

    //Populate reviews with user and game data
    const populatedReviews = paginatedReviews.map((review) => {
      const user = users.getById(review.userId);
      return {
        ...review,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
        },
        game: {
          id: game.id,
          title: game.title,
          images: { cover: game.images.cover },
        },
      };
    });

    //Calculate rating statistics
    const ratingStats = {
      average: 0,
      total: gameReviews.length,
      recommended: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };

    if (gameReviews.length > 0) {
      const totalRating = gameReviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      ratingStats.average =
        Math.round((totalRating / gameReviews.length) * 10) / 10;
      ratingStats.recommended = Math.round(
        (gameReviews.filter((review) => review.isRecommended).length /
          gameReviews.length) *
          100
      );

      gameReviews.forEach((review) => {
        ratingStats.distribution[review.rating]++;
      });
    }

    res.json({
      reviews: populatedReviews,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(gameReviews.length / limit),
        count: gameReviews.length,
      },
      stats: ratingStats,
    });
  } catch (error) {
    console.error("Get game reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Get reviews by a specific user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, sortBy = "newest" } = req.query;

    let userReviews = reviews.getByUserId(userId);

    //Sort reviews
    switch (sortBy) {
      case "newest":
        userReviews.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        break;
      case "oldest":
        userReviews.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        break;
      case "helpful":
        userReviews.sort((a, b) => {
          const aHelpful = a.helpfulVotes?.count || 0;
          const bHelpful = b.helpfulVotes?.count || 0;
          return bHelpful - aHelpful;
        });
        break;
    }

    //Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedReviews = userReviews.slice(startIndex, endIndex);

    //Populate reviews with user and game data
    const populatedReviews = paginatedReviews.map((review) => {
      const user = users.getById(review.userId);
      const game = games.getById(review.gameId);
      return {
        ...review,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
        },
        game: {
          id: game.id,
          title: game.title,
          developer: game.developer,
          images: { cover: game.images.cover },
        },
      };
    });

    res.json({
      reviews: populatedReviews,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(userReviews.length / limit),
        count: userReviews.length,
      },
    });
  } catch (error) {
    console.error("Get user reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Get all reviews with filters
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = "newest",
      rating,
      platform,
    } = req.query;

    let allReviews = reviews
      .getAll()
      .filter((review) => review.status === "active");

    //Apply filters
    if (rating) {
      allReviews = allReviews.filter(
        (review) => review.rating === parseInt(rating)
      );
    }

    if (platform) {
      allReviews = allReviews.filter((review) => review.platform === platform);
    }

    //Sort reviews
    switch (sortBy) {
      case "newest":
        allReviews.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        break;
      case "oldest":
        allReviews.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        break;
      case "helpful":
        allReviews.sort((a, b) => {
          const aHelpful = a.helpfulVotes?.count || 0;
          const bHelpful = b.helpfulVotes?.count || 0;
          if (aHelpful === bHelpful) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return bHelpful - aHelpful;
        });
        break;
      case "rating_high":
        allReviews.sort((a, b) => {
          if (a.rating === b.rating) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return b.rating - a.rating;
        });
        break;
      case "rating_low":
        allReviews.sort((a, b) => {
          if (a.rating === b.rating) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          }
          return a.rating - b.rating;
        });
        break;
    }

    //Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedReviews = allReviews.slice(startIndex, endIndex);

    //Populate reviews with user and game data
    const populatedReviews = paginatedReviews.map((review) => {
      const user = users.getById(review.userId);
      const game = games.getById(review.gameId);
      return {
        ...review,
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
        },
        game: {
          id: game.id,
          title: game.title,
          developer: game.developer,
          images: { cover: game.images.cover },
        },
      };
    });

    res.json({
      reviews: populatedReviews,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(allReviews.length / limit),
        count: allReviews.length,
      },
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

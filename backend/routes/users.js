const express = require("express");
const { body, validationResult } = require("express-validator");
const { users, userGames, reviews, games } = require("../utils/database");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");
const router = express.Router();

router.get("/profile/:userId?", auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
    const requestingUserId = req.user.userId;

    const user = users.getById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      user.preferences.profileVisibility === "private" &&
      userId !== requestingUserId
    ) {
      return res.status(403).json({ message: "This profile is private" });
    }

    const isOwnProfile = userId === requestingUserId;
    const isFollowing =
      user.followers && user.followers.includes(requestingUserId);

    const userGamesList = userGames.getByUserId(userId);
    const userReviews = reviews.getByUserId(userId);

    //Calculate stats
    const stats = {
      totalGames: userGamesList.length,
      completedGames: userGamesList.filter((ug) => ug.status === "completed")
        .length,
      currentlyPlaying: userGamesList.filter((ug) => ug.status === "playing")
        .length,
      totalHours: userGamesList.reduce(
        (sum, ug) => sum + (ug.hoursPlayed || 0),
        0
      ),
      reviewsWritten: userReviews.length,
    };

    const ratedGames = userGamesList.filter((ug) => ug.rating && ug.rating > 0);
    if (ratedGames.length > 0) {
      stats.averageRating =
        ratedGames.reduce((sum, ug) => sum + ug.rating, 0) / ratedGames.length;
    } else {
      stats.averageRating = 0;
    }

    const recentGames = userGamesList
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5)
      .map((ug) => {
        const game = games.getById(ug.gameId);
        return {
          ...ug,
          game: game || { title: "Unknown Game", developer: "Unknown" },
        };
      });

    const response = {
      user: {
        ...user,
        stats: {
          ...user.stats,
          ...stats,
        },
      },
      recentGames,
      isOwnProfile,
      isFollowing,
    };

    if (!isOwnProfile) {
      delete response.user.email;
      delete response.user.preferences;
      delete response.user.verificationToken;
      delete response.user.resetPasswordToken;
      delete response.user.resetPasswordExpires;
    }

    res.json(response);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/profile",
  auth,
  [
    body("displayName")
      .optional()
      .isLength({ min: 1, max: 50 })
      .withMessage("Display name must be between 1 and 50 characters"),
    body("bio")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Bio must be less than 500 characters"),
    body("location")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Location must be less than 100 characters"),
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

      const { displayName, bio, location } = req.body;
      const user = users.getById(req.user.userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updateData = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (bio !== undefined) updateData.bio = bio;
      if (location !== undefined) updateData.location = location;

      const updatedUser = users.update(req.user.userId, updateData);

      const {
        password,
        verificationToken,
        resetPasswordToken,
        resetPasswordExpires,
        ...userResponse
      } = updatedUser;

      res.json({
        message: "Profile updated successfully",
        user: userResponse,
      });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post("/avatar", auth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const user = users.getById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    users.update(req.user.userId, { avatar: avatarUrl });

    res.json({
      message: "Avatar updated successfully",
      avatar: avatarUrl,
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/follow/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    if (userId === currentUserId) {
      return res.status(400).json({ message: "Cannot follow yourself" });
    }

    const userToFollow = users.getById(userId);
    const currentUser = users.getById(currentUserId);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const isAlreadyFollowing =
      currentUser.following && currentUser.following.includes(userId);

    let newFollowing = currentUser.following || [];
    let newFollowers = userToFollow.followers || [];

    if (isAlreadyFollowing) {
      newFollowing = newFollowing.filter((id) => id !== userId);
      newFollowers = newFollowers.filter((id) => id !== currentUserId);
    } else {
      newFollowing.push(userId);
      newFollowers.push(currentUserId);
    }

    users.update(currentUserId, { following: newFollowing });
    users.update(userId, { followers: newFollowers });

    res.json({
      message: isAlreadyFollowing
        ? "Unfollowed successfully"
        : "Followed successfully",
      isFollowing: !isAlreadyFollowing,
    });
  } catch (error) {
    console.error("Follow/unfollow error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/followers/:userId?", auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;

    const user = users.getById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const followersList = (user.followers || [])
      .map((followerId) => {
        const follower = users.getById(followerId);
        if (follower) {
          const {
            password,
            verificationToken,
            resetPasswordToken,
            resetPasswordExpires,
            ...followerData
          } = follower;
          return followerData;
        }
        return null;
      })
      .filter(Boolean);

    res.json({
      followers: followersList,
      count: followersList.length,
    });
  } catch (error) {
    console.error("Get followers error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/following/:userId?", auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;

    const user = users.getById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const followingList = (user.following || [])
      .map((followingId) => {
        const following = users.getById(followingId);
        if (following) {
          const {
            password,
            verificationToken,
            resetPasswordToken,
            resetPasswordExpires,
            ...followingData
          } = following;
          return followingData;
        }
        return null;
      })
      .filter(Boolean);

    res.json({
      following: followingList,
      count: followingList.length,
    });
  } catch (error) {
    console.error("Get following error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/games/:userId?", auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
    const { status, page = 1, limit = 20, sort = "dateAdded" } = req.query;

    let userGamesList = userGames.getByUserId(userId);

    if (status && status !== "all") {
      userGamesList = userGamesList.filter((ug) => ug.status === status);
    }

    //Add game information
    userGamesList = userGamesList.map((ug) => {
      const game = games.getById(ug.gameId);
      return {
        ...ug,
        gameInfo: game || { title: "Unknown Game", developer: "Unknown" },
      };
    });

    //Sort
    switch (sort) {
      case "title":
        userGamesList.sort((a, b) =>
          (a.gameInfo.title || "").localeCompare(b.gameInfo.title || "")
        );
        break;
      case "rating":
        userGamesList.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "dateAdded":
        userGamesList.sort(
          (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
        );
        break;
      case "hoursPlayed":
        userGamesList.sort(
          (a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0)
        );
        break;
    }

    const total = userGamesList.length;
    const startIndex = (page - 1) * limit;
    const paginatedGames = userGamesList.slice(
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
    });
  } catch (error) {
    console.error("Get user games error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/reviews/:userId?", auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;
    const { page = 1, limit = 10, sort = "newest" } = req.query;

    let userReviews = reviews.getByUserId(userId);

    //Add game information
    userReviews = userReviews.map((review) => {
      const game = games.getById(review.gameId);
      return {
        ...review,
        game: game || { title: "Unknown Game", developer: "Unknown" },
      };
    });

    //Sort
    switch (sort) {
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
        userReviews.sort(
          (a, b) => (b.helpfulVotes.count || 0) - (a.helpfulVotes.count || 0)
        );
        break;
    }

    const total = userReviews.length;
    const startIndex = (page - 1) * limit;
    const paginatedReviews = userReviews.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    res.json({
      reviews: paginatedReviews,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: total,
      },
    });
  } catch (error) {
    console.error("Get user reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/search", auth, async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Search query must be at least 2 characters" });
    }

    const searchTerm = q.trim().toLowerCase();
    const allUsers = users.getAll();

    const searchResults = allUsers
      .filter(
        (user) =>
          user.preferences.profileVisibility !== "private" &&
          (user.username.toLowerCase().includes(searchTerm) ||
            user.displayName.toLowerCase().includes(searchTerm))
      )
      .map((user) => {
        const {
          password,
          verificationToken,
          resetPasswordToken,
          resetPasswordExpires,
          ...userResponse
        } = user;
        return userResponse;
      });

    const total = searchResults.length;
    const startIndex = (page - 1) * limit;
    const paginatedResults = searchResults.slice(
      startIndex,
      startIndex + parseInt(limit)
    );

    res.json({
      users: paginatedResults,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: total,
      },
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

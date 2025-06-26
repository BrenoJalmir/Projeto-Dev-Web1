const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    platform: {
      type: String,
      enum: [
        "PC",
        "PlayStation",
        "Xbox",
        "Nintendo Switch",
        "Mobile",
        "Mac",
        "Linux",
      ],
      required: true,
    },
    hoursPlayed: {
      type: Number,
      min: 0,
    },
    pros: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],
    cons: [
      {
        type: String,
        trim: true,
        maxlength: 200,
      },
    ],
    isRecommended: {
      type: Boolean,
      default: true,
    },
    containsSpoilers: {
      type: Boolean,
      default: false,
    },
    helpfulVotes: {
      count: {
        type: Number,
        default: 0,
      },
      users: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    lastEditedAt: {
      type: Date,
    },
    reports: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reason: {
          type: String,
          enum: ["spam", "inappropriate", "offensive", "spoilers", "other"],
        },
        description: String,
        reportedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "hidden", "deleted"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ user: 1, game: 1 }, { unique: true });
reviewSchema.index({ game: 1, status: 1 });
reviewSchema.index({ user: 1, status: 1 });
reviewSchema.index({ "helpfulVotes.count": -1 });
reviewSchema.index({ createdAt: -1 });

reviewSchema.pre("save", function (next) {
  if (
    this.isModified("content") ||
    this.isModified("title") ||
    this.isModified("rating")
  ) {
    if (!this.isNew) {
      this.isEdited = true;
      this.lastEditedAt = new Date();
    }
  }
  next();
});

reviewSchema.methods.markHelpful = async function (userId) {
  const userIndex = this.helpfulVotes.users.indexOf(userId);

  if (userIndex === -1) {
    this.helpfulVotes.users.push(userId);
    this.helpfulVotes.count += 1;
  } else {
    this.helpfulVotes.users.splice(userIndex, 1);
    this.helpfulVotes.count -= 1;
  }

  return this.save();
};

reviewSchema.methods.reportReview = async function (
  userId,
  reason,
  description = ""
) {
  const existingReport = this.reports.find(
    (report) => report.user.toString() === userId.toString()
  );

  if (existingReport) {
    throw new Error("You have already reported this review");
  }

  this.reports.push({
    user: userId,
    reason,
    description,
  });

  return this.save();
};

reviewSchema.statics.getGameReviews = function (gameId, options = {}) {
  const {
    page = 1,
    limit = 10,
    sortBy = "helpful",
    filterBy = "all",
  } = options;

  const skip = (page - 1) * limit;
  let sort = {};
  let match = { game: mongoose.Types.ObjectId(gameId), status: "active" };

  switch (sortBy) {
    case "helpful":
      sort = { "helpfulVotes.count": -1, createdAt: -1 };
      break;
    case "newest":
      sort = { createdAt: -1 };
      break;
    case "oldest":
      sort = { createdAt: 1 };
      break;
    case "rating_high":
      sort = { rating: -1, createdAt: -1 };
      break;
    case "rating_low":
      sort = { rating: 1, createdAt: -1 };
      break;
  }

  if (filterBy !== "all") {
    switch (filterBy) {
      case "recommended":
        match.isRecommended = true;
        break;
      case "not_recommended":
        match.isRecommended = false;
        break;
      case "rating_5":
        match.rating = 5;
        break;
      case "rating_4":
        match.rating = 4;
        break;
      case "rating_3":
        match.rating = 3;
        break;
      case "rating_2":
        match.rating = 2;
        break;
      case "rating_1":
        match.rating = 1;
        break;
    }
  }

  return this.find(match)
    .populate("user", "username displayName avatar")
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

reviewSchema.statics.getUserReviews = function (userId, options = {}) {
  const { page = 1, limit = 10, sortBy = "newest" } = options;

  const skip = (page - 1) * limit;
  let sort = {};

  switch (sortBy) {
    case "newest":
      sort = { createdAt: -1 };
      break;
    case "oldest":
      sort = { createdAt: 1 };
      break;
    case "helpful":
      sort = { "helpfulVotes.count": -1, createdAt: -1 };
      break;
  }

  return this.find({ user: userId, status: "active" })
    .populate("game", "title images.cover developer releaseDate")
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

module.exports = mongoose.model("Review", reviewSchema);
